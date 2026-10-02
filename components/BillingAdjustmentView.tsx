import React, { useEffect, useMemo, useState } from 'react';
import {
    Calculator, Fuel, FileDown, AlertTriangle, Info, CalendarClock, CheckCircle2, Loader2,
} from 'lucide-react';
import { exportExcelReport, thaiFileDate, type ReportSheet } from '../utils/excelReport';
import { watchActiveFuelRates, type FuelRateVersion } from '../utils/fuelRateStore';
import { useOilPrice } from '../utils/useOilPrice';
import { todayIsoLocal } from '../utils/oilRounds';
import { summarizeMonth, monthsWithJobs, type AdjustedJob } from '../utils/billingAdjustment';
import { pageCount, pageNumbers as buildPageNumbers, pageSlice, PAGE_SIZE } from '../utils/pagination';
import type { Job } from '../types';

/*
  หน้าสรุปยอดปรับตามค่าเฉลี่ยน้ำมันรายเดือน — สำหรับเอาไปวางบิล

  ข้อตกลงกับหน่วยงาน (2 ต.ค. 2569)
    เปิดใบงาน — ราคาน้ำมันรายวัน (ไม่เปลี่ยน)
    วางบิล    — ค่าเฉลี่ยทั้งเดือนของเดือนที่วิ่งงาน · ต้องรอให้เดือนจบก่อน

  หน้านี้ "คำนวณให้ดู" อย่างเดียว ไม่แก้ยอดในใบงาน เพราะทีมทำบิลนอกระบบ
  (Excel) แล้วค่อยบันทึกย้อนหลัง · ถ้าไปแก้ job.cost เงียบ ๆ ตัวเลขจะไม่ตรง
  กับเอกสารที่ส่งไปแล้ว และไม่มีใครรู้ว่าถูกแก้ตอนไหน
*/

const TH_MONTH = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];

const monthLabel = (m: string): string => {
    const [y, mm] = m.split('-').map(Number);
    return `${TH_MONTH[mm] ?? m} ${y + 543}`;
};

const money = (n: number): string =>
    n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_LABEL: Record<AdjustedJob['status'], string> = {
    adjusted: 'ปรับยอด',
    unchanged: 'เท่าเดิม',
    'month-not-over': 'เดือนยังไม่จบ',
    'no-average': 'ไม่มีข้อมูลราคา',
    'no-rate': 'ไม่พบเรท',
    incomplete: 'ข้อมูลไม่ครบ',
};

interface Props {
    jobs: Job[];
}

const BillingAdjustmentView: React.FC<Props> = ({ jobs }) => {
    const [version, setVersion] = useState<FuelRateVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState('');
    const [page, setPage] = useState(1);
    const [exporting, setExporting] = useState(false);
    const live = useOilPrice();

    useEffect(() => watchActiveFuelRates(
        v => { setVersion(v); setLoading(false); },
        () => { setVersion(null); setLoading(false); },
    ), []);

    const months = useMemo(() => monthsWithJobs(jobs), [jobs]);

    // เลือกเดือนล่าสุดที่ "จบแล้ว" ให้อัตโนมัติ — เดือนปัจจุบันยังคำนวณไม่ได้ตามข้อตกลง
    useEffect(() => {
        if (month || !months.length) return;
        const thisMonth = todayIsoLocal().slice(0, 7);
        setMonth(months.find(m => m < thisMonth) ?? months[0]);
    }, [months, month]);

    const summary = useMemo(
        () => (month
            ? summarizeMonth(jobs, month, version?.rows ?? [], live.byDate, todayIsoLocal())
            : null),
        [jobs, month, version, live.byDate]
    );

    useEffect(() => { setPage(1); }, [month]);

    const rows = summary?.jobs ?? [];
    const totalPages = pageCount(rows.length, PAGE_SIZE);
    const safePage = Math.min(page, Math.max(totalPages, 1));
    const shown: AdjustedJob[] = pageSlice(rows, safePage, PAGE_SIZE);

    const handleExport = async () => {
        if (!summary || exporting) return;
        setExporting(true);
        try {
            await exportExcelReport([{
                name: 'ยอดปรับตามค่าเฉลี่ย',
                title: `ยอดปรับค่าขนส่งตามค่าเฉลี่ยราคาน้ำมัน — ${monthLabel(summary.month)}`,
                subtitle: summary.average.usable
                    ? `ค่าเฉลี่ยดีเซล ${summary.average.diesel.toFixed(3)} บาท/ลิตร`
                      + ` · เฉลี่ยจาก ${summary.average.days} วัน`
                      + ` · ช่วงราคา ${summary.average.min.toFixed(2)}–${summary.average.max.toFixed(2)}`
                    : 'ยังคำนวณค่าเฉลี่ยไม่ได้',
                columns: [
                    { header: 'ลำดับ', value: (_r, i) => (i ?? 0) + 1, type: 'text', width: 7 },
                    { header: 'เลขที่ใบงาน', value: r => r.jobId, type: 'text' },
                    { header: 'วันที่วิ่ง', value: r => r.dateOfService || '-', type: 'text' },
                    { header: 'ผู้รับเหมา', value: r => r.subcontractor || '-', type: 'text' },
                    { header: 'ต้นทาง', value: r => r.origin || '-', type: 'text' },
                    { header: 'ปลายทาง', value: r => r.destination || '-', type: 'text' },
                    { header: 'ประเภทรถ', value: r => r.truckType || '-', type: 'text' },
                    { header: 'ยอดตอนเปิดงาน', value: r => r.originalCost, type: 'money' },
                    // ปล่อยว่างเมื่อคำนวณไม่ได้ ไม่ใส่ 0 — คนอ่านต้องแยกออกว่า
                    // "ยังไม่รู้ยอด" ไม่ใช่ "ยอดเป็นศูนย์"
                    { header: 'ยอดหลังปรับ', value: r => r.adjustedCost, type: 'money' },
                    { header: 'ส่วนต่าง', value: r => r.difference, type: 'money' },
                    { header: 'ช่วงราคาที่ใช้', value: r => r.band || '-', type: 'text' },
                    { header: 'สถานะ', value: r => STATUS_LABEL[r.status], type: 'text', width: 14 },
                ],
                rows,
                footnotes: [
                    'ยอดตอนเปิดงานคำนวณจากราคาน้ำมัน ณ วันที่ต้องการรถ'
                    + ' · ยอดหลังปรับคำนวณจากค่าเฉลี่ยทั้งเดือนตามที่ตกลงกับหน่วยงาน',
                    'ช่องที่เว้นว่าง = ยังคำนวณไม่ได้ ไม่ใช่ยอด 0 บาท — ดูสาเหตุที่คอลัมน์สถานะ',
                    `ตารางเรทที่ใช้: ${version?.fileName || '-'}`,
                ],
            }] as ReportSheet<AdjustedJob>[],
                `ยอดปรับค่าขนส่ง_${summary.month}_${thaiFileDate()}`);
        } catch (e) {
            console.error('[BillingAdjustment] สร้างไฟล์ไม่สำเร็จ:', e);
            const Swal = (window as any).Swal;
            const msg = e instanceof Error ? e.message : String(e);
            if (Swal) {
                Swal.fire({
                    icon: 'error',
                    title: 'สร้างไฟล์ไม่สำเร็จ',
                    text: msg,
                    confirmButtonColor: '#ef4444',
                    customClass: { popup: 'rounded-[1.5rem]' },
                });
            } else {
                alert('สร้างไฟล์ไม่สำเร็จ: ' + msg);
            }
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20 text-slate-400 gap-3">
                <Loader2 className="animate-spin" size={20} />
                <span className="text-sm font-bold">กำลังโหลดตารางเรท…</span>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ── หัวหน้า ── */}
            <div className="bg-slate-900 rounded-[2rem] p-6 sm:p-8 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-white/10 rounded-2xl p-3">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black">ยอดปรับตามค่าเฉลี่ยน้ำมัน</h1>
                            <p className="text-[11px] font-bold tracking-[0.2em] text-slate-400 uppercase">
                                Monthly Average Adjustment
                            </p>
                            <p className="text-sm text-slate-300 mt-1">
                                สำหรับใช้ประกอบการวางบิล · ไม่แก้ยอดในใบงาน
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={exporting || !summary?.average.usable}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all"
                    >
                        <FileDown size={18} />
                        <span>{exporting ? 'กำลังสร้างไฟล์…' : 'Export'}</span>
                    </button>
                </div>
            </div>

            {/* ── เลือกเดือน ── */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2">
                    เดือนที่วิ่งงาน
                </label>
                <select
                    value={month}
                    onChange={e => setMonth(e.target.value)}
                    className="w-full sm:w-72 px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500"
                >
                    {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                </select>
                <p className="text-xs text-slate-500 mt-2">
                    เลือกตามเดือนที่รถวิ่งจริง ไม่ใช่เดือนที่ออกบิล
                </p>
            </div>

            {/* ── สถานะค่าเฉลี่ย ── */}
            {summary && !summary.average.usable && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                    <CalendarClock className="text-amber-600 shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-amber-900">
                        <p className="font-black mb-1">ยังคำนวณค่าเฉลี่ยของเดือนนี้ไม่ได้</p>
                        <p>
                            {summary.average.status === 'month-not-over'
                                ? 'เดือนนี้ยังไม่สิ้นสุด — ตามที่ตกลงกับหน่วยงาน ต้องรอให้เดือนจบก่อนจึงจะทราบค่าเฉลี่ยที่แน่นอน'
                                : summary.average.status === 'before-history'
                                    ? 'ข้อมูลราคาน้ำมันไม่ครอบคลุมทั้งเดือน จึงเฉลี่ยไม่ได้'
                                    : summary.average.status === 'bad-data'
                                        ? 'ข้อมูลราคาน้ำมันของเดือนนี้เสียหาย ต้องตรวจที่ต้นทาง'
                                        : 'ไม่มีข้อมูลราคาน้ำมันสำหรับเดือนนี้'}
                        </p>
                    </div>
                </div>
            )}

            {summary?.average.usable && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex gap-3">
                    <Fuel className="text-emerald-600 shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-emerald-900">
                        <span className="font-black">
                            ค่าเฉลี่ยดีเซล {summary.average.diesel.toFixed(3)} บาท/ลิตร
                        </span>
                        <span className="text-emerald-700">
                            {' '}· เฉลี่ยจาก {summary.average.days} วัน
                            {' '}· ช่วงราคาในเดือน {summary.average.min.toFixed(2)}–{summary.average.max.toFixed(2)}
                        </span>
                    </div>
                </div>
            )}

            {/* ── ตัวเลขสรุป ── */}
            {summary && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                        { label: 'งานในเดือนนี้', value: String(summary.jobs.length), tone: 'text-slate-900' },
                        { label: 'ต้องปรับยอด', value: String(summary.adjustedCount), tone: 'text-amber-600' },
                        { label: 'ยอดเท่าเดิม', value: String(summary.unchangedCount), tone: 'text-emerald-600' },
                        { label: 'ต้องตรวจเอง', value: String(summary.problemCount), tone: 'text-rose-600' },
                    ].map(c => (
                        <div key={c.label} className="bg-white rounded-2xl border border-slate-200 p-5">
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{c.label}</p>
                            <p className={`text-3xl font-black mt-1 ${c.tone}`}>{c.value}</p>
                        </div>
                    ))}
                </div>
            )}

            {summary && summary.average.usable && (
                <div className="bg-white rounded-2xl border border-slate-200 p-5 grid sm:grid-cols-3 gap-4 text-sm">
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ยอดรวมเดิม</p>
                        <p className="text-xl font-black text-slate-700 mt-1">฿{money(summary.totalOriginal)}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ยอดรวมหลังปรับ</p>
                        <p className="text-xl font-black text-slate-900 mt-1">฿{money(summary.totalAdjusted)}</p>
                    </div>
                    <div>
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">ส่วนต่าง</p>
                        <p className={`text-xl font-black mt-1 ${summary.totalDifference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {summary.totalDifference >= 0 ? '+' : ''}฿{money(summary.totalDifference)}
                        </p>
                    </div>
                </div>
            )}

            {summary && summary.problemCount > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 flex gap-3">
                    <AlertTriangle className="text-rose-600 shrink-0 mt-0.5" size={20} />
                    <div className="text-sm text-rose-900">
                        <p className="font-black mb-1">
                            มี {summary.problemCount} งานที่คำนวณยอดใหม่ไม่ได้
                        </p>
                        <p>
                            ระบบไม่เดายอดให้ — ต้องตรวจเองว่าเป็นเพราะไม่พบเรทของเส้นทางนั้น
                            หรือข้อมูลในใบงานไม่ครบ · ดูสาเหตุรายตัวที่คอลัมน์สถานะ
                        </p>
                    </div>
                </div>
            )}

            {/* ── ตาราง ── */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-4 py-3 text-left">วันที่วิ่ง</th>
                                <th className="px-4 py-3 text-left">ผู้รับเหมา · เส้นทาง</th>
                                <th className="px-4 py-3 text-right">ยอดเดิม</th>
                                <th className="px-4 py-3 text-right">ยอดหลังปรับ</th>
                                <th className="px-4 py-3 text-right">ส่วนต่าง</th>
                                <th className="px-4 py-3 text-left">สถานะ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {shown.map(r => (
                                <tr key={r.jobId} className="hover:bg-slate-50">
                                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{r.dateOfService || '-'}</td>
                                    <td className="px-4 py-3">
                                        <p className="font-bold text-slate-800">{r.subcontractor || '-'}</p>
                                        <p className="text-xs text-slate-500">
                                            {r.origin || '-'} → {r.destination || '-'} · {r.truckType || '-'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                                        {money(r.originalCost)}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-900 tabular-nums">
                                        {r.adjustedCost === null ? '—' : money(r.adjustedCost)}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${
                                        r.difference === null ? 'text-slate-300'
                                            : r.difference > 0 ? 'text-emerald-600'
                                                : r.difference < 0 ? 'text-rose-600' : 'text-slate-400'
                                    }`}>
                                        {r.difference === null ? '—'
                                            : r.difference === 0 ? '0.00'
                                                : `${r.difference > 0 ? '+' : ''}${money(r.difference)}`}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                                            r.status === 'adjusted' ? 'bg-amber-100 text-amber-700'
                                                : r.status === 'unchanged' ? 'bg-emerald-100 text-emerald-700'
                                                    : 'bg-rose-100 text-rose-700'
                                        }`}>
                                            {r.status === 'unchanged' && <CheckCircle2 size={12} />}
                                            {STATUS_LABEL[r.status]}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                            {!shown.length && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-sm font-bold">
                                        ไม่มีงานในเดือนที่เลือก
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-1.5 p-4 border-t border-slate-100">
                        {buildPageNumbers(totalPages, safePage).map((p, i) =>
                            p === null ? (
                                <span key={`gap-${i}`} className="px-2 text-slate-400">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => setPage(p as number)}
                                    className={`min-w-9 h-9 px-2 rounded-lg text-sm font-bold transition-all ${
                                        p === safePage
                                            ? 'bg-slate-900 text-white'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                >
                                    {p}
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex gap-3">
                <Info className="text-slate-400 shrink-0 mt-0.5" size={18} />
                <div className="text-xs text-slate-600 space-y-1">
                    <p>
                        <span className="font-bold">หน้านี้ไม่แก้ยอดในใบงาน</span> —
                        คำนวณให้ดูและ Export เป็น Excel เพื่อใช้ประกอบการวางบิลเท่านั้น
                    </p>
                    <p>
                        ยอดตอนเปิดงานคำนวณจากราคาน้ำมัน ณ วันที่ต้องการรถ ·
                        ยอดหลังปรับคำนวณจากค่าเฉลี่ยทั้งเดือน ตามที่ตกลงกับหน่วยงานอัตราจ้าง
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BillingAdjustmentView;
