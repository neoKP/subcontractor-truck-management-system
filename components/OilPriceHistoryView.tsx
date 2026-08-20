import React, { useMemo, useState } from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
    Fuel, TrendingUp, CalendarClock, ArrowUpDown, FileDown, Table2, History, Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import SAHA_OIL from '../data/sahaOilAdjust.json';
import DIESEL_HISTORY from '../data/dieselHistory.json';
import { buildOilRounds, todayIsoLocal, OIL_BASE } from '../utils/oilRounds';

const TH_MONTH = ['', 'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MON_ABBR = ['', 'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

type RangeKey = '3เดือน' | '6เดือน' | 'ปีนี้' | 'all';

const OilPriceHistoryView: React.FC = () => {
    const [range, setRange] = useState<RangeKey>('all');

    // คำนวณครั้งเดียวตอน mount — งวดล่าสุดต้องนับถึงวันนี้
    const todayIso = useMemo(() => todayIsoLocal(), []);

    const byDate = (SAHA_OIL as { byDate: Record<string, number> }).byDate;
    const rounds = useMemo(() => buildOilRounds(byDate, todayIso), [byDate, todayIso]);

    const filtered = useMemo(() => {
        if (range === 'all') return rounds;
        const all = Object.keys(byDate).sort();
        const lastIso = all[all.length - 1] || '';
        if (!lastIso) return rounds;
        const [ly, lm] = lastIso.split('-').map(Number);
        const cut = range === 'ปีนี้'
            ? `${ly}-01-01`
            : new Date(Date.UTC(ly, lm - 1 - (range === '3เดือน' ? 3 : 6), 1)).toISOString().slice(0, 10);
        return rounds.filter(r => r.startIso >= cut);
    }, [rounds, range, byDate]);

    const latest = rounds[rounds.length - 1];
    const dieselVals = rounds.map(r => r.diesel);
    const hi = dieselVals.length ? Math.max(...dieselVals) : 0;
    const lo = dieselVals.length ? Math.min(...dieselVals) : 0;

    const chartData = filtered.map(r => ({
        label: `${r.day} ${TH_MON_ABBR[r.month]}`,
        'ราคาดีเซล': r.diesel,
        'น้ำมัน%': r.pctCum,
    }));

    // ราคาดีเซลตลาดย้อนหลัง (ปตท. B7 เฉลี่ยรายเดือน) — ข้อมูลอ้างอิง ไม่ใช่ %ค่าขนส่ง
    const histMonths = (DIESEL_HISTORY as {
        months: { ym: string; label: string; avg: number; min: number; max: number }[]
    }).months;
    const histLo = histMonths.length ? Math.min(...histMonths.map(m => m.avg)) : 0;
    const histHi = histMonths.length ? Math.max(...histMonths.map(m => m.avg)) : 0;

    // เติมเดือนที่ขาดเป็น null เพื่อให้กราฟเว้นช่วง แทนที่จะลากเส้นข้ามช่องว่าง
    const histChart = useMemo(() => {
        if (!histMonths.length) return [];
        const byYM = new Map(histMonths.map(m => [m.ym, m]));
        const first = histMonths[0].ym;
        const last = histMonths[histMonths.length - 1].ym;
        const rows: { label: string; 'ราคาเฉลี่ย': number | null }[] = [];
        let [y, m] = first.split('-').map(Number);
        const [ly, lm] = last.split('-').map(Number);
        while (y < ly || (y === ly && m <= lm)) {
            const ym = `${y}-${String(m).padStart(2, '0')}`;
            const hit = byYM.get(ym);
            rows.push({
                label: hit ? hit.label : `${TH_MON_ABBR[m]}${String(y + 543).slice(-2)}`,
                'ราคาเฉลี่ย': hit ? hit.avg : null,
            });
            m++;
            if (m > 12) { m = 1; y++; }
        }
        return rows;
    }, [histMonths]);

    const handleExportExcel = () => {
        const wb = XLSX.utils.book_new();

        const roundRows = filtered.map(r => ({
            'ครั้งที่': r.seq === 0 ? 'ฐาน' : r.seq,
            'วันเริ่มงวด': `${r.day} ${TH_MON_ABBR[r.month]} ${String(r.year + 543).slice(-2)}`,
            'เดือน': TH_MONTH[r.month],
            'ราคาดีเซล': r.diesel,
            'ปรับครั้งนี้': r.seq === 0 ? '—' : r.delta,
            '%สะสม': r.pctCum,
            'จำนวนวัน': r.days,
        }));
        const ws1 = XLSX.utils.json_to_sheet(roundRows);
        ws1['!cols'] = [{ wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }];
        XLSX.utils.book_append_sheet(wb, ws1, 'งวดปรับน้ำมัน');

        const histRows = histMonths.map(m => ({
            'เดือน': m.label,
            'ราคาเฉลี่ย': m.avg,
            'ต่ำสุด': m.min,
            'สูงสุด': m.max,
        }));
        const ws2 = XLSX.utils.json_to_sheet(histRows);
        ws2['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
        XLSX.utils.book_append_sheet(wb, ws2, 'ราคาดีเซลตลาดย้อนหลัง');

        XLSX.writeFile(wb, `ประวัติราคาน้ำมัน_${latest?.startIso || 'export'}.xlsx`);
    };

    const KPI_CARDS = [
        {
            label: 'งวดล่าสุด (%สะสม)',
            value: latest ? `${latest.pctCum.toFixed(2)}%` : '-',
            suffix: latest ? `ดีเซล ${latest.diesel.toFixed(2)} บาท` : '',
            icon: TrendingUp,
            tone: 'blue' as const,
        },
        {
            label: 'ราคาดีเซลล่าสุด',
            value: latest ? `฿${latest.diesel.toFixed(2)}` : '-',
            suffix: latest ? `มีผล ${latest.day} ${TH_MON_ABBR[latest.month]} ${String(latest.year + 543).slice(-2)}` : '',
            icon: Fuel,
            tone: 'emerald' as const,
        },
        {
            label: 'จำนวนงวดปรับ',
            value: String(rounds.length),
            suffix: rounds.length ? `ตั้งแต่ ${rounds[0].day} ${TH_MON_ABBR[rounds[0].month]}` : '',
            icon: CalendarClock,
            tone: 'slate' as const,
        },
        {
            label: 'ช่วงราคาดีเซล',
            value: `${lo.toFixed(2)}–${hi.toFixed(2)}`,
            suffix: 'ต่ำสุด–สูงสุด (บาท/ลิตร)',
            icon: ArrowUpDown,
            tone: 'amber' as const,
        },
    ];

    const toneClass: Record<string, string> = {
        blue: 'bg-blue-50 text-blue-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        slate: 'bg-slate-100 text-slate-600',
        amber: 'bg-amber-50 text-amber-600',
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 sm:gap-6 bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
                <div className="flex items-center gap-4 sm:gap-5 relative z-10">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-amber-500/10 backdrop-blur-xl rounded-xl sm:rounded-[2rem] flex items-center justify-center text-amber-400 border border-amber-500/20 shadow-inner shrink-0">
                        <Fuel size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight">ประวัติราคาน้ำมัน (สหพัฒน์)</h2>
                        <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                            Diesel Price Timeline
                            <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                        </p>
                        <p className="text-slate-400 text-[11px] sm:text-xs mt-1.5">
                            งวดปรับ %ค่าขนส่งตามราคาดีเซล · %สะสม = ราคาดีเซล − {OIL_BASE}
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleExportExcel}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-[1.5rem] flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/40 hover:scale-105 active:scale-95 relative z-10"
                >
                    <FileDown size={18} />
                    <span>Export</span>
                </button>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {KPI_CARDS.map((kpi, idx) => (
                    <div
                        key={idx}
                        className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-2xl transition-all duration-500"
                    >
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{kpi.label}</p>
                                <h3 className="text-2xl font-black text-slate-900 tracking-tight tabular-nums">{kpi.value}</h3>
                                {kpi.suffix && (
                                    <div className="mt-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase inline-block bg-slate-100 text-slate-600">
                                        {kpi.suffix}
                                    </div>
                                )}
                            </div>
                            <div className={`p-3 rounded-2xl ${toneClass[kpi.tone]} group-hover:scale-110 transition-transform duration-500`}>
                                <kpi.icon size={24} />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Trend chart */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={18} className="text-blue-600" />
                        แนวโน้มราคาดีเซล &amp; %สะสม
                    </h3>
                    <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] gap-1">
                        {(['3เดือน', '6เดือน', 'ปีนี้', 'all'] as RangeKey[]).map(rg => (
                            <button
                                key={rg}
                                onClick={() => setRange(rg)}
                                className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all duration-300 ${range === rg
                                    ? 'bg-slate-900 text-white shadow-lg'
                                    : 'text-slate-500 hover:text-slate-900'
                                    }`}
                            >
                                {rg === 'all' ? 'ทั้งหมด' : rg}
                            </button>
                        ))}
                    </div>
                </div>

                {chartData.length === 0 ? (
                    <div className="h-[300px] flex items-center justify-center text-slate-400 text-xs font-bold">
                        ไม่มีข้อมูลในช่วงที่เลือก
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94A3B8' }} axisLine={false} tickLine={false} />
                            <YAxis
                                yAxisId="left"
                                tick={{ fontSize: 11, fill: '#94A3B8' }}
                                axisLine={false}
                                tickLine={false}
                                domain={['auto', 'auto']}
                                label={{ value: 'บาท/ลิตร', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94A3B8' }}
                            />
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fontSize: 11, fill: '#94A3B8' }}
                                axisLine={false}
                                tickLine={false}
                                label={{ value: '%', angle: 90, position: 'insideRight', fontSize: 10, fill: '#94A3B8' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    borderRadius: '1rem',
                                    border: '1px solid #E2E8F0',
                                    fontSize: '12px',
                                    boxShadow: '0 10px 40px rgba(15,23,42,0.12)',
                                }}
                            />
                            <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                            <Line yAxisId="left" type="monotone" dataKey="ราคาดีเซล" stroke="#0F172A" strokeWidth={2.5} dot={{ r: 2 }} />
                            <Line yAxisId="right" type="monotone" dataKey="น้ำมัน%" stroke="#F59E0B" strokeWidth={2.5} dot={{ r: 2 }} />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Rounds table */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-6">
                    <Table2 size={18} className="text-blue-600" />
                    ตารางงวดปรับ ({filtered.length} งวด)
                </h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[640px]">
                        <thead>
                            <tr className="bg-slate-900 text-white">
                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest rounded-l-2xl">ครั้งที่</th>
                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest">วันเริ่มงวด</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">ราคาดีเซล</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">ปรับครั้งนี้</th>
                                <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest">%สะสม</th>
                                <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest rounded-r-2xl">จำนวนวัน</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-xs font-bold">
                                        ไม่มีข้อมูลในช่วงที่เลือก
                                    </td>
                                </tr>
                            ) : (
                                [...filtered].reverse().map((r, i) => (
                                    <tr
                                        key={r.startIso}
                                        className={`border-b border-slate-100 transition-colors ${r.startIso === latest?.startIso
                                            ? 'bg-amber-50 font-black'
                                            : i % 2
                                                ? 'bg-slate-50/60'
                                                : ''
                                            }`}
                                    >
                                        <td className="px-4 py-3 text-center text-slate-500 font-bold">
                                            {r.seq === 0 ? 'ฐาน' : r.seq}
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-700 font-bold">
                                            {r.day} {TH_MON_ABBR[r.month]} {String(r.year + 543).slice(-2)}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums font-black text-slate-900">
                                            {r.diesel.toFixed(2)}
                                        </td>
                                        <td className={`px-4 py-3 text-right tabular-nums font-bold ${r.delta > 0 ? 'text-red-600' : r.delta < 0 ? 'text-emerald-600' : 'text-slate-400'
                                            }`}>
                                            {r.seq === 0 ? '—' : `${r.delta > 0 ? '+' : ''}${r.delta.toFixed(2)}`}
                                        </td>
                                        <td className="px-4 py-3 text-right tabular-nums font-black text-blue-600">
                                            {r.pctCum.toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-3 text-center text-slate-500 font-bold">{r.days}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Market history (reference only) */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <History size={18} className="text-amber-600" />
                        ราคาดีเซลตลาดย้อนหลัง (ปตท. B7 เฉลี่ยรายเดือน)
                    </h3>
                    {histMonths.length > 0 && (
                        <span className="text-[10px] text-slate-400 font-bold">
                            {histMonths[0].label} – {histMonths[histMonths.length - 1].label} · {histMonths.length} เดือน · ต่ำสุด {histLo} / สูงสุด {histHi} บาท
                        </span>
                    )}
                </div>

                <div className="flex items-start gap-2 mb-6 px-4 py-3 rounded-2xl bg-slate-50 border border-slate-100">
                    <Info size={14} className="text-slate-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                        ราคาน้ำมันตลาดใช้อ้างอิงเท่านั้น — ไม่ใช่ %ค่าขนส่งสหพัฒน์ ·
                        ปี 59 – ก.พ. 69 = ปตท. B7 · ปี 69 (มี.ค. เป็นต้นไป) = ฐานสหพัฒน์ {OIL_BASE} + %สะสม
                    </p>
                </div>

                <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={histChart} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94A3B8' }} interval={5} axisLine={false} tickLine={false} />
                        <YAxis
                            tick={{ fontSize: 11, fill: '#94A3B8' }}
                            axisLine={false}
                            tickLine={false}
                            domain={['auto', 'auto']}
                            label={{ value: 'บาท/ลิตร', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#94A3B8' }}
                        />
                        <Tooltip
                            contentStyle={{
                                borderRadius: '1rem',
                                border: '1px solid #E2E8F0',
                                fontSize: '12px',
                                boxShadow: '0 10px 40px rgba(15,23,42,0.12)',
                            }}
                        />
                        <Line type="monotone" dataKey="ราคาเฉลี่ย" stroke="#D97706" strokeWidth={2.5} dot={false} connectNulls={false} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

export default OilPriceHistoryView;
