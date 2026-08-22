import React, { useEffect, useMemo, useState } from 'react';
import {
    Table2, Search, Fuel, Loader2, FileDown, AlertTriangle, Info, Upload,
} from 'lucide-react';
import { exportExcelReport, thaiFileDate, type ReportSheet } from '../utils/excelReport';
import { findRateAt, type FuelRateRow } from '../utils/fuelRateParser';
import { watchActiveFuelRates, type FuelRateVersion } from '../utils/fuelRateStore';
import { useOilPrice } from '../utils/useOilPrice';
import { pageCount, pageNumbers as buildPageNumbers, pageSlice, PAGE_SIZE } from '../utils/pagination';

const money = (n: number): string =>
    n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const formatDateTime = (iso: string): string => {
    if (!iso) return '-';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const FuelRateTableView: React.FC = () => {
    const live = useOilPrice();

    const [version, setVersion] = useState<FuelRateVersion | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');

    const [search, setSearch] = useState('');
    const [company, setCompany] = useState('');
    const [truckType, setTruckType] = useState('');
    const [onlyMissing, setOnlyMissing] = useState(false);
    const [page, setPage] = useState(1);

    // เฝ้าดูรุ่นที่ใช้งาน ไม่ใช่โหลดครั้งเดียว — หน้านี้ถูกเปิดค้างทั้งวัน
    // ถ้ามีคนอัปเรทรอบใหม่ คนที่เปิดค้างต้องเห็นทันที ไม่ใช่คิดเงินจากเรทเก่าต่อ
    useEffect(() => {
        const stop = watchActiveFuelRates(
            v => { setVersion(v); setLoadError(''); setLoading(false); },
            msg => { setLoadError(msg); setLoading(false); }
        );
        return stop;
    }, []);

    const rows = version?.rows ?? [];

    const companies = useMemo(
        () => [...new Set(rows.map(r => r.company).filter(Boolean))].sort(),
        [rows]
    );
    const truckTypes = useMemo(
        () => [...new Set(rows.map(r => r.truckType).filter(Boolean))].sort(),
        [rows]
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return rows.filter(r => {
            if (company && r.company !== company) return false;
            if (truckType && r.truckType !== truckType) return false;
            if (onlyMissing && findRateAt(r, live.diesel) !== null) return false;
            if (!q) return true;
            return [r.company, r.origin, r.destination, r.truckType, r.note, r.section]
                .some(f => (f || '').toLowerCase().includes(q));
        });
    }, [rows, search, company, truckType, onlyMissing, live.diesel]);

    const totalPages = pageCount(filtered.length, PAGE_SIZE);
    // กันหน้าค้างเกินขอบเขตหลังกรอง — ถ้าอยู่หน้า 5 แล้วกรองจนเหลือ 10 แถว จะได้ตารางว่าง
    const safePage = Math.min(page, totalPages);
    const pageRows = useMemo(
        () => pageSlice(filtered, safePage, PAGE_SIZE),
        [filtered, safePage]
    );

    // เปลี่ยนตัวกรองแล้วต้องกลับหน้าแรก ไม่งั้นผลลัพธ์ชุดใหม่จะเริ่มที่หน้ากลาง ๆ
    useEffect(() => { setPage(1); }, [search, company, truckType, onlyMissing]);

    // ข้อมูลหดลงได้โดยไม่ผ่านตัวกรอง เช่น มีคนอัปเรทรุ่นใหม่ที่แถวน้อยกว่า
    // ถ้าปล่อยให้ page ค้างเกินขอบเขต ปุ่มจะกดหลายทีกว่าตารางจะขยับ
    useEffect(() => {
        setPage(p => Math.min(p, totalPages));
    }, [totalPages]);

    const pageNumbers = useMemo(
        () => buildPageNumbers(totalPages, safePage),
        [totalPages, safePage]
    );

    // จำนวนเส้นทางที่หาเรทไม่ได้ที่ราคาน้ำมันปัจจุบัน — ต้องเห็นชัดเพราะกระทบการคิดเงิน
    const missingCount = useMemo(
        () => rows.filter(r => findRateAt(r, live.diesel) === null).length,
        [rows, live.diesel]
    );

    const handleExport = async () => {
        await exportExcelReport([{
            name: 'เรทค่าขนส่ง',
            title: 'ตารางเรทค่าขนส่งตามราคาน้ำมัน',
            subtitle: `ราคาดีเซลที่ใช้คิด ${live.diesel.toFixed(2)} บาท/ลิตร · ${filtered.length} เส้นทาง`,
            columns: [
                { header: 'บริษัท', value: r => r.company || '-', type: 'text' },
                { header: 'ตาราง', value: r => r.section ?? 'ตารางหลัก', type: 'text' },
                { header: 'ต้นทาง', value: r => r.origin || '-', type: 'text' },
                { header: 'ปลายทาง', value: r => r.destination || '-', type: 'text' },
                { header: 'ประเภทรถ', value: r => r.truckType || '-', type: 'text' },
                { header: 'หมายเหตุ', value: r => r.note || '', type: 'text' },
                {
                    header: 'ช่วงราคาน้ำมันที่ใช้',
                    value: r => { const hit = findRateAt(r, live.diesel); return hit ? `${hit.fuelFrom}–${hit.fuelTo}` : '-'; },
                    type: 'text',
                },
                {
                    // ปล่อยว่างเมื่อไม่มีเรท ไม่ใส่ 0 — คนอ่านไฟล์ต้องแยกออกว่า "ไม่มีเรท" ไม่ใช่ "ฟรี"
                    header: `ค่าขนส่งที่น้ำมัน ${live.diesel.toFixed(2)} บาท`,
                    value: r => findRateAt(r, live.diesel)?.price ?? null,
                    type: 'money',
                },
            ],
            rows: filtered,
            footnotes: [
                'ช่องค่าขนส่งที่เว้นว่าง = หน่วยงานยังไม่ได้กำหนดราคาในช่วงราคาน้ำมันนี้ ไม่ใช่ค่าขนส่ง 0 บาท',
            ],
        }] as ReportSheet<FuelRateRow>[], `เรทค่าขนส่ง_ณ_${live.diesel.toFixed(2)}บาท_${thaiFileDate()}`);
    };

    if (loading) {
        return (
            <div className="py-24 text-center text-slate-400">
                <Loader2 size={30} className="animate-spin mx-auto mb-3" />
                <p className="text-xs font-black uppercase tracking-widest">กำลังโหลดตารางเรท...</p>
            </div>
        );
    }

    if (loadError) {
        return (
            <div className="flex items-start gap-2 px-5 py-4 rounded-[1.5rem] bg-red-50 border border-red-100">
                <AlertTriangle size={15} className="text-red-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-red-700 font-bold">{loadError}</p>
            </div>
        );
    }

    if (!version) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl text-white">
                    <div className="flex items-center gap-4 sm:gap-5">
                        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500/10 rounded-xl sm:rounded-[2rem] flex items-center justify-center text-blue-400 border border-blue-500/20 shrink-0">
                            <Table2 size={28} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-3xl font-black tracking-tight">ตารางเรทค่าขนส่ง</h2>
                            <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">
                                Fuel-Indexed Rate Table
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
                    <div className="w-16 h-16 mx-auto rounded-[2rem] bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                        <Upload size={30} />
                    </div>
                    <p className="text-sm font-black text-slate-900 mb-1">ยังไม่มีตารางเรทในระบบ</p>
                    <p className="text-[11px] text-slate-500 font-medium">
                        ไปที่เมนู &ldquo;อัปโหลดเรทค่าขนส่ง&rdquo; เพื่อนำเข้าไฟล์ Excel ที่หน่วยงานส่งมาก่อน
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 sm:gap-6 bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl text-white">
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500/10 backdrop-blur-xl rounded-xl sm:rounded-[2rem] flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-inner shrink-0">
                        <Table2 size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight">ตารางเรทค่าขนส่ง</h2>
                        <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">
                            Fuel-Indexed Rate Table
                        </p>
                        <p className="text-slate-400 text-[11px] sm:text-xs mt-1.5 truncate max-w-md">
                            {version.fileName} · อัปโหลด {formatDateTime(version.uploadedAt)}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleExport}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-[1.5rem] flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/40 hover:scale-105 active:scale-95"
                >
                    <FileDown size={18} />
                    <span>Export</span>
                </button>
            </div>

            {/* ราคาน้ำมันที่ใช้เปิดตาราง */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 rounded-[1.5rem] bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-2">
                    <Fuel size={16} className="text-amber-600 shrink-0" />
                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">
                        ราคาน้ำมันที่ใช้คิด
                    </span>
                </div>
                <p className="text-[11px] text-slate-600 font-medium sm:border-l sm:border-amber-200 sm:pl-3">
                    ดีเซล <b className="text-slate-900 tabular-nums">{live.diesel.toFixed(2)}</b> บาท/ลิตร
                    {live.effectiveDate && ` (มีผล ${live.effectiveDate})`}
                    {live.source === 'bundled' && ' · จากข้อมูลที่บันทึกไว้ ยังไม่ได้เชื่อมต่อแหล่งข้อมูล'}
                </p>
            </div>

            {/* สรุปตัวเลข */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'เส้นทางทั้งหมด', value: String(rows.length), tone: 'slate' },
                    { label: 'บริษัท', value: String(companies.length), tone: 'blue' },
                    { label: 'มีเรทใช้งานได้', value: String(rows.length - missingCount), tone: 'emerald' },
                    { label: 'ไม่มีเรทที่ราคานี้', value: String(missingCount), tone: missingCount ? 'amber' : 'slate' },
                ].map((s, i) => (
                    <div key={i} className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{s.label}</p>
                        <p className={`text-2xl font-black tabular-nums ${s.tone === 'emerald' ? 'text-emerald-600'
                            : s.tone === 'amber' ? 'text-amber-600'
                                : s.tone === 'blue' ? 'text-blue-600' : 'text-slate-900'
                            }`}>
                            {s.value}
                        </p>
                    </div>
                ))}
            </div>

            {missingCount > 0 && (
                <div className="flex items-start gap-2 px-5 py-4 rounded-[1.5rem] bg-amber-50 border border-amber-100">
                    <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-700 font-medium leading-relaxed">
                        มี <b>{missingCount} เส้นทาง</b>ที่หาเรทไม่ได้ที่ราคาน้ำมัน {live.diesel.toFixed(2)} บาท —
                        หน่วยงานไม่ได้ระบุค่าขนส่งไว้ในช่วงนี้ · ระบบไม่เดาราคาให้ ต้องกรอกเองหรือสอบถามหน่วยงาน
                        <br />กดปุ่ม &ldquo;เฉพาะที่ไม่มีเรท&rdquo; ด้านล่างเพื่อดูรายการ
                    </p>
                </div>
            )}

            {/* ตัวกรอง */}
            <div className="bg-white p-5 rounded-[2rem] shadow-sm border border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="relative md:col-span-2">
                        <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="ค้นหา บริษัท / ต้นทาง / ปลายทาง"
                            className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 text-xs font-medium outline-none focus:border-slate-400"
                        />
                    </div>
                    <select
                        value={company}
                        onChange={e => setCompany(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:border-slate-400"
                    >
                        <option value="">ทุกบริษัท</option>
                        {companies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                        value={truckType}
                        onChange={e => setTruckType(e.target.value)}
                        className="px-4 py-3 rounded-2xl border border-slate-200 text-xs font-bold text-slate-600 outline-none focus:border-slate-400"
                    >
                        <option value="">ทุกประเภทรถ</option>
                        {truckTypes.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <div className="flex flex-wrap items-center gap-3 mt-3">
                    <button
                        onClick={() => setOnlyMissing(v => !v)}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${onlyMissing
                            ? 'bg-amber-500 text-white shadow-lg'
                            : 'bg-slate-100 text-slate-500 hover:text-slate-900'
                            }`}
                    >
                        เฉพาะที่ไม่มีเรท
                    </button>
                    {(search || company || truckType || onlyMissing) && (
                        <button
                            onClick={() => { setSearch(''); setCompany(''); setTruckType(''); setOnlyMissing(false); }}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-500 hover:text-slate-900 transition-all"
                        >
                            ล้างตัวกรอง
                        </button>
                    )}
                    <span className="text-[10px] text-slate-400 font-bold ml-auto">
                        {filtered.length === 0
                            ? `ไม่พบเส้นทาง (ทั้งหมด ${rows.length})`
                            : `แสดง ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, filtered.length)} จาก ${filtered.length} เส้นทาง`}
                        {filtered.length !== rows.length && ` · ทั้งหมด ${rows.length}`}
                    </span>
                </div>
            </div>

            {/* ตาราง */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[860px]">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest rounded-l-2xl">บริษัท</th>
                                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest">ต้นทาง</th>
                                <th className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-widest">ปลายทาง</th>
                                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest">รถ</th>
                                <th className="px-3 py-3 text-center text-[10px] font-black uppercase tracking-widest">ช่วงน้ำมันที่ใช้</th>
                                <th className="px-3 py-3 text-right text-[10px] font-black uppercase tracking-widest rounded-r-2xl">
                                    ค่าขนส่ง (บาท)
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-12 text-center text-slate-400 text-xs font-bold">
                                        ไม่พบเส้นทางที่ตรงกับเงื่อนไข
                                    </td>
                                </tr>
                            ) : (
                                pageRows.map((r: FuelRateRow, i) => {
                                    const hit = findRateAt(r, live.diesel);
                                    return (
                                        <tr
                                            key={`${r.company}-${r.origin}-${r.destination}-${r.truckType}-${i}`}
                                            className={`border-b border-slate-100 ${!hit ? 'bg-amber-50/60' : i % 2 ? 'bg-slate-50/60' : ''}`}
                                        >
                                            <td className="px-3 py-2.5 text-slate-700 font-bold">{r.company || '-'}</td>
                                            <td className="px-3 py-2.5 text-slate-600">{r.origin || '-'}</td>
                                            <td className="px-3 py-2.5 text-slate-600">
                                                {r.destination || '-'}
                                                {/* แถวจากตารางย่อยไม่มีต้นทาง/บริษัท ติดป้ายไว้จะได้ไม่สับสนกับตารางหลัก */}
                                                {r.section && (
                                                    <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black whitespace-nowrap">{r.section}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2.5 text-center text-slate-500 font-bold">{r.truckType || '-'}</td>
                                            <td className="px-3 py-2.5 text-center text-[11px] text-slate-500 font-bold tabular-nums">
                                                {hit ? `${hit.fuelFrom}–${hit.fuelTo}` : '—'}
                                            </td>
                                            <td className="px-3 py-2.5 text-right">
                                                {hit ? (
                                                    <span className="text-base font-black text-slate-900 tabular-nums">
                                                        {money(hit.price!)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-600">
                                                        ไม่มีเรท
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* แบ่งหน้า — แสดงเมื่อมีมากกว่าหนึ่งหน้าเท่านั้น */}
                {totalPages > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
                        <button
                            onClick={() => setPage(Math.max(1, safePage - 1))}
                            disabled={safePage === 1}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 transition-all"
                        >
                            ← ก่อนหน้า
                        </button>

                        {pageNumbers.map((n, i) =>
                            n === null ? (
                                <span key={`gap-${i}`} className="px-1 text-slate-300 font-black">…</span>
                            ) : (
                                <button
                                    key={n}
                                    onClick={() => setPage(n)}
                                    className={`min-w-[38px] px-3 py-2 rounded-xl text-[11px] font-black transition-all ${n === safePage
                                        ? 'bg-slate-900 text-white shadow-lg'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {n}
                                </button>
                            )
                        )}

                        <button
                            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                            disabled={safePage === totalPages}
                            className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 text-slate-600 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-slate-100 transition-all"
                        >
                            ถัดไป →
                        </button>
                    </div>
                )}
            </div>

            {/* คำเตือนจากตอนอัปโหลด */}
            {version.issues?.length > 0 && (
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-4">
                        <Info size={18} className="text-amber-600" />
                        หมายเหตุจากไฟล์ที่อัปโหลด
                    </h3>
                    <ul className="space-y-2">
                        {version.issues.map((iss, i) => (
                            <li key={i} className="text-[11px] text-slate-600 leading-relaxed">• {iss.message}</li>
                        ))}
                    </ul>
                    <p className="text-[10px] text-slate-400 font-bold mt-3">
                        ระบบบันทึกตัวเลขตามไฟล์ ไม่ได้แก้ไขค่าใด ๆ
                    </p>
                </div>
            )}
        </div>
    );
};

export default FuelRateTableView;
