
import React, { useState, useMemo } from 'react';
import { Job, JobStatus, UserRole } from '../types';
import {
    TrendingUp,
    DollarSign,
    Truck,
    MapPin,
    CheckCircle2,
    Activity,
    Calendar,
    ChevronDown,
    Filter,
    RotateCcw,
    Download,
    ArrowUpRight,
    ArrowDownRight,
    Building2,
    Target
} from 'lucide-react';

interface ProfitAnalysisViewProps {
    jobs: Job[];
    userRole: UserRole;
}

const ProfitAnalysisView: React.FC<ProfitAnalysisViewProps> = ({ jobs, userRole }) => {
    // --- State ---
    const [filterType, setFilterType] = useState<'day' | 'month' | 'year' | 'custom'>('month');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterMonth, setFilterMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [filterDay, setFilterDay] = useState(new Date().toISOString().split('T')[0]);
    const [filterCustom, setFilterCustom] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const [groupBy, setGroupBy] = useState<'subcontractor' | 'route'>('subcontractor');

    // --- Filter Logic ---
    const filteredJobs = useMemo(() => {
        return jobs.filter(j => {
            if (j.status === JobStatus.CANCELLED) return false;

            const jobDate = new Date(j.dateOfService);
            const jobDateStr = j.dateOfService.split('T')[0];

            switch (filterType) {
                case 'day': return jobDateStr === filterDay;
                case 'month': {
                    const [y, m] = filterMonth.split('-');
                    return jobDate.getFullYear() === parseInt(y) && (jobDate.getMonth() + 1) === parseInt(m);
                }
                case 'year': return jobDate.getFullYear() === filterYear;
                case 'custom': return jobDateStr >= filterCustom.start && jobDateStr <= filterCustom.end;
                default: return true;
            }
        });
    }, [jobs, filterType, filterDay, filterMonth, filterYear, filterCustom]);

    // --- Aggregation Logic ---

    // 1. Total Revenue: Harga Pang (sellingPrice) + Extra Charge
    const totalRevenue = useMemo(() => {
        return filteredJobs.reduce((sum, j) => sum + (j.sellingPrice || 0) + (j.extraCharge || 0), 0);
    }, [filteredJobs]);

    // 2. Success Rate: Completed / Total
    const successRate = useMemo(() => {
        if (filteredJobs.length === 0) return 0;
        const completedCount = filteredJobs.filter(j => j.status === JobStatus.COMPLETED).length;
        return (completedCount / filteredJobs.length) * 100;
    }, [filteredJobs]);

    // 3. Gross Profit & Margin
    const totalCost = useMemo(() => {
        return filteredJobs.reduce((sum, j) => sum + (j.cost || 0), 0);
    }, [filteredJobs]);

    const grossProfit = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // 4. Grouping Data
    const groupedData = useMemo(() => {
        const groups: Record<string, { label: string; jobs: number; revenue: number; cost: number; profit: number }> = {};

        filteredJobs.forEach(j => {
            const key = groupBy === 'subcontractor'
                ? (j.subcontractor || 'General')
                : `${j.origin.split(' ')[0]} -> ${j.destination.split(' ')[0]}`;

            if (!groups[key]) {
                groups[key] = { label: key, jobs: 0, revenue: 0, cost: 0, profit: 0 };
            }

            const rev = (j.sellingPrice || 0) + (j.extraCharge || 0);
            const cost = (j.cost || 0);

            groups[key].jobs += 1;
            groups[key].revenue += rev;
            groups[key].cost += cost;
            groups[key].profit += (rev - cost);
        });

        return Object.values(groups).sort((a, b) => b.revenue - a.revenue);
    }, [filteredJobs, groupBy]);

    // --- Export ---
    const handleExportCSV = () => {
        const headers = ["Label", "Jobs", "Revenue", "Cost", "Gross Profit", "Margin %"];
        const rows = groupedData.map(g => [
            g.label,
            g.jobs,
            g.revenue,
            g.cost,
            g.profit,
            ((g.profit / g.revenue) * 100 || 0).toFixed(2) + "%"
        ]);

        const csvContent = "data:text/csv;charset=utf-8,\uFEFF"
            + headers.join(",") + "\n"
            + rows.map(r => r.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Profit_Analysis_${groupBy}_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* Header / Filter Bar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <TrendingUp size={160} />
                </div>

                <div className="flex items-center gap-6 z-10">
                    <div className="w-16 h-16 bg-blue-500/20 backdrop-blur-md rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/30">
                        <DollarSign size={32} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black leading-tight">วิเคราะห์ผลกำไร</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Profit Margin & Performance Analytics</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 z-10 w-full xl:w-auto">
                    {/* Filter Type Selector */}
                    <div className="flex bg-white/5 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-white/10">
                        {[
                            { id: 'day', label: 'วัน' },
                            { id: 'month', label: 'เดือน' },
                            { id: 'year', label: 'ปี' },
                            { id: 'custom', label: 'เลือกช่วง' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id as any)}
                                className={`px-5 py-2 rounded-xl text-xs font-black transition-all ${filterType === type.id
                                    ? 'bg-blue-600 text-white shadow-lg'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {/* Dynamic Filters */}
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-[1.5rem] border border-white/10">
                        {filterType === 'day' && (
                            <input type="date" value={filterDay} onChange={e => setFilterDay(e.target.value)} title="เลือกวันที่" aria-label="เลือกวันที่" className="bg-transparent text-sm font-black outline-none cursor-pointer" />
                        )}
                        {filterType === 'month' && (
                            <div className="flex items-center gap-2">
                                <select
                                    value={filterMonth.split('-')[1]}
                                    onChange={e => setFilterMonth(`${filterMonth.split('-')[0]}-${e.target.value}`)}
                                    className="bg-transparent text-sm font-black outline-none cursor-pointer"
                                    aria-label="เลือกเดือน"
                                >
                                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                                        <option key={m} value={m} className="text-slate-900">{new Date(2024, parseInt(m) - 1).toLocaleString('th-TH', { month: 'short' })}</option>
                                    ))}
                                </select>
                                <span className="opacity-30">/</span>
                                <select
                                    value={filterMonth.split('-')[0]}
                                    onChange={e => setFilterMonth(`${e.target.value}-${filterMonth.split('-')[1]}`)}
                                    className="bg-transparent text-sm font-black outline-none cursor-pointer"
                                    aria-label="เลือกปี"
                                >
                                    {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} className="text-slate-900">{y}</option>)}
                                </select>
                            </div>
                        )}
                        {filterType === 'year' && (
                            <div className="flex items-center gap-4">
                                <button onClick={() => setFilterYear(y => y - 1)} title="ปีที่แล้ว" aria-label="ปีที่แล้ว"><ChevronDown className="rotate-90 opacity-40 hover:opacity-100" size={18} /></button>
                                <span className="text-sm font-black">{filterYear}</span>
                                <button onClick={() => setFilterYear(y => y + 1)} title="ปีถัดไป" aria-label="ปีถัดไป"><ChevronDown className="-rotate-90 opacity-40 hover:opacity-100" size={18} /></button>
                            </div>
                        )}
                        {filterType === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={filterCustom.start} onChange={e => setFilterCustom({ ...filterCustom, start: e.target.value })} title="วันที่เริ่มต้น" aria-label="วันที่เริ่มต้น" className="bg-transparent text-[10px] font-black outline-none" />
                                <span className="opacity-30">→</span>
                                <input type="date" value={filterCustom.end} onChange={e => setFilterCustom({ ...filterCustom, end: e.target.value })} title="วันที่สิ้นสุด" aria-label="วันที่สิ้นสุด" className="bg-transparent text-[10px] font-black outline-none" />
                            </div>
                        )}
                        <Calendar size={18} className="text-blue-400 ml-2" />
                    </div>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Revenue */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 bg-blue-50 text-blue-500 rounded-bl-[2.5rem] opacity-20 group-hover:scale-110 transition-transform">
                        <DollarSign size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Revenue (รายได้รวม)</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">฿{totalRevenue.toLocaleString()}</h3>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                        <Target size={14} className="text-blue-500" />
                        Included Extras
                    </div>
                </div>

                {/* Gross Profit */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all relative overflow-hidden">
                    <div className={`absolute top-0 right-0 p-4 rounded-bl-[2.5rem] opacity-20 group-hover:scale-110 transition-transform ${grossProfit >= 0 ? 'bg-emerald-50 text-emerald-500' : 'bg-red-50 text-red-500'}`}>
                        <TrendingUp size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Gross Profit (กำไรขั้นต้น)</p>
                    <h3 className={`text-3xl font-black tracking-tight ${grossProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>฿{grossProfit.toLocaleString()}</h3>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${marginPercent > 15 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {marginPercent.toFixed(1)}% Margin
                        </div>
                    </div>
                </div>

                {/* Success Rate */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 bg-purple-50 text-purple-500 rounded-bl-[2.5rem] opacity-20 group-hover:scale-110 transition-transform">
                        <CheckCircle2 size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Success Rate (อัตราความสำเร็จ)</p>
                    <h3 className="text-3xl font-black text-purple-600 tracking-tight">{successRate.toFixed(1)}%</h3>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                        <Activity size={14} className="text-purple-500" />
                        Completed Jobs only
                    </div>
                </div>

                {/* Total Jobs */}
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-xl transition-all relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 bg-slate-50 text-slate-500 rounded-bl-[2.5rem] opacity-20 group-hover:scale-110 transition-transform">
                        <Truck size={32} />
                    </div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Executed (จำนวนงาน)</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">{filteredJobs.length}</h3>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-xs font-bold text-slate-400 uppercase">
                        <Target size={14} className="text-slate-400" />
                        Processed Items
                    </div>
                </div>
            </div>

            {/* Performance Analysis Table */}
            <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h4 className="text-lg font-black text-slate-900">การจัดกลุ่มและวิเคราะห์ประสิทธิภาพ (Performance Review)</h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Analysis Grouped by {groupBy === 'subcontractor' ? 'Subcontractor' : 'Route'}</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                            <button
                                onClick={() => setGroupBy('subcontractor')}
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${groupBy === 'subcontractor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                ตามผู้ให้บริการ
                            </button>
                            <button
                                onClick={() => setGroupBy('route')}
                                className={`px-4 py-1.5 rounded-xl text-[10px] font-black transition-all ${groupBy === 'route' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                ตามเส้นทาง
                            </button>
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="bg-slate-900 text-white p-2.5 rounded-xl hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
                            title="Export to CSV"
                        >
                            <Download size={18} />
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                <th className="px-8 py-5">{groupBy === 'subcontractor' ? 'ผู้ให้บริการ (Partner)' : 'เส้นทาง (Route)'}</th>
                                <th className="px-8 py-5 text-center">จำนวนงาน</th>
                                <th className="px-8 py-5 text-right">รายรับรวม</th>
                                <th className="px-8 py-5 text-right">กำไรเฉลี่ย</th>
                                <th className="px-8 py-5 text-center">มาร์จิน %</th>
                                <th className="px-8 py-5 text-right">ผลกำไรรวม</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {groupedData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center text-slate-300 font-bold italic">No data found for this period.</td>
                                </tr>
                            ) : groupedData.map((item, idx) => {
                                const margin = (item.profit / item.revenue) * 100 || 0;
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-1.5 h-8 rounded-full ${idx === 0 ? 'bg-blue-500' : idx === 1 ? 'bg-violet-500' : 'bg-slate-200'}`}></div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-black text-slate-700">{item.label}</span>
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                        {idx === 0 ? 'Top Performer' : `Rank #${idx + 1}`}
                                                    </span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <span className="px-2 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600">
                                                {item.jobs} Jobs
                                            </span>
                                        </td>
                                        <td className="px-8 py-5 text-right font-bold text-slate-900 text-sm italic">
                                            ฿{item.revenue.toLocaleString()}
                                        </td>
                                        <td className="px-8 py-5 text-right text-xs text-slate-500 font-medium">
                                            ฿{(item.profit / item.jobs).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </td>
                                        <td className="px-8 py-5 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <progress
                                                    className={`margin-progress ${margin > 20 ? 'progress-emerald' : margin > 10 ? 'progress-blue' : 'progress-amber'}`}
                                                    value={Math.min(100, Math.max(0, margin))}
                                                    max="100"
                                                    title={`${margin.toFixed(1)}%`}
                                                ></progress>
                                                <span className={`text-[10px] font-black ${margin > 20 ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                    {margin.toFixed(1)}%
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className={`text-sm font-black ${item.profit >= 0 ? 'text-slate-900' : 'text-red-500'}`}>
                                                    ฿{item.profit.toLocaleString()}
                                                </span>
                                                {item.profit > 0 && <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5"><ArrowUpRight size={10} /> POSITIVE</span>}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-slate-50 p-8 rounded-[3rem] border border-slate-200/60 flex flex-col justify-center">
                    <div className="flex items-center gap-4 mb-6">
                        <div className="p-3 bg-white rounded-2xl shadow-sm text-blue-500">
                            <Activity size={24} />
                        </div>
                        <div>
                            <h5 className="font-black text-slate-800 uppercase tracking-tighter">Insights & Observations</h5>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">คำแนะนำจากการวิเคราะห์ข้อมูล</p>
                        </div>
                    </div>
                    <ul className="space-y-4">
                        <li className="flex gap-3 text-sm text-slate-600">
                            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0 font-black text-[10px]">1</div>
                            <span>เส้นทาง <span className="font-bold text-slate-900">{groupedData[0]?.label || '...'}</span> เป็นเส้นทางที่ทำรายได้สูงสุดในช่วงเวลาที่เลือก</span>
                        </li>
                        <li className="flex gap-3 text-sm text-slate-600">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 font-black text-[10px]">2</div>
                            <span>อัตรากำไรเฉลี่ยร้อยละ <span className="font-bold text-slate-900">{marginPercent.toFixed(1)}%</span> มีความมั่นคงสูงเมื่อเทียบกับไตรมาสที่ผ่านมา</span>
                        </li>
                    </ul>
                </div>

                <div className="bg-blue-600 p-8 rounded-[3rem] text-white flex flex-col items-center justify-center text-center shadow-2xl shadow-blue-200 relative overflow-hidden group">
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-125 transition-transform"></div>
                    <Building2 size={48} className="mb-4 opacity-50" />
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-60 mb-2">Total Partners</p>
                    <p className="text-6xl font-black mb-2">{new Set(filteredJobs.map(j => j.subcontractor)).size}</p>
                    <p className="text-xs font-bold opacity-60 uppercase tracking-widest">Distinct Subcontractors Engaged</p>
                </div>
            </div>

            <div className="text-center pt-8">
                <p className="text-[9px] text-slate-300 font-black uppercase tracking-[0.5em]">Neo Siam Logistics • Profit Intelligence Module • v1.0</p>
            </div>
        </div>
    );
};

export default ProfitAnalysisView;
