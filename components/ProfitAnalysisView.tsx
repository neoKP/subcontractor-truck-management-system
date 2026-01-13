
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
    Target,
    FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';

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
    const [statusFilter, setStatusFilter] = useState<JobStatus | 'ALL'>('ALL');

    const [groupBy, setGroupBy] = useState<'subcontractor' | 'route'>('subcontractor');

    // --- Filter Logic ---
    const filteredJobs = useMemo(() => {
        return jobs.filter(j => {
            const jobDate = new Date(j.dateOfService);
            const jobDateStr = j.dateOfService.split('T')[0];
            let matchesTime = false;
            switch (filterType) {
                case 'day': matchesTime = jobDateStr === filterDay; break;
                case 'month': {
                    const [y, m] = filterMonth.split('-');
                    matchesTime = jobDate.getFullYear() === parseInt(y) && (jobDate.getMonth() + 1) === parseInt(m);
                    break;
                }
                case 'year': matchesTime = jobDate.getFullYear() === filterYear; break;
                case 'custom': matchesTime = jobDateStr >= filterCustom.start && jobDateStr <= filterCustom.end; break;
                default: matchesTime = true;
            }

            if (!matchesTime) return false;

            if (statusFilter === 'ALL') {
                return j.status !== JobStatus.CANCELLED;
            }
            return j.status === statusFilter;
        });
    }, [jobs, filterType, filterDay, filterMonth, filterYear, filterCustom, statusFilter]);

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

        const csvContent = headers.join(",") + "\n"
            + rows.map(r => r.join(",")).join("\n");

        const blob = new Blob(["\uFEFF", csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `Profit_Analysis_${groupBy}_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportExcel = () => {
        const headers = ["Label", "Jobs", "Revenue", "Cost", "Gross Profit", "Margin %"];
        const data = groupedData.map(g => {
            const row: Record<string, any> = {};
            const vals = [
                g.label,
                g.jobs,
                g.revenue,
                g.cost,
                g.profit,
                ((g.profit / g.revenue) * 100 || 0).toFixed(2) + "%"
            ];
            headers.forEach((h, i) => {
                row[h] = vals[i];
            });
            return row;
        });

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Profit Analysis");
        XLSX.writeFile(workbook, `Profit_Analysis_${groupBy}_${new Date().getTime()}.xlsx`);
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
                            <input type="date" value={filterDay} onKeyDown={(e) => e.preventDefault()} onChange={e => setFilterDay(e.target.value)} title="เลือกวันที่" aria-label="เลือกวันที่" className="bg-transparent text-sm font-black outline-none cursor-pointer" />
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
                                <input type="date" value={filterCustom.start} onKeyDown={(e) => e.preventDefault()} onChange={e => setFilterCustom({ ...filterCustom, start: e.target.value })} title="วันที่เริ่มต้น" aria-label="วันที่เริ่มต้น" className="bg-transparent text-[10px] font-black outline-none" />
                                <span className="opacity-30">→</span>
                                <input type="date" value={filterCustom.end} onKeyDown={(e) => e.preventDefault()} onChange={e => setFilterCustom({ ...filterCustom, end: e.target.value })} title="วันที่สิ้นสุด" aria-label="วันที่สิ้นสุด" className="bg-transparent text-[10px] font-black outline-none" />
                            </div>
                        )}
                        <Calendar size={18} className="text-blue-400 ml-2" />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-[1.5rem] border border-white/10">
                        <Filter size={16} className="text-slate-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="bg-transparent text-xs font-black outline-none cursor-pointer pr-4"
                            aria-label="กรองสถานะ"
                        >
                            <option value="ALL" className="text-slate-900">ทุกสถานะ (All Active)</option>
                            <option value={JobStatus.NEW_REQUEST} className="text-slate-900">คำขอใหม่ (New)</option>
                            <option value={JobStatus.ASSIGNED} className="text-slate-900">อยู่ระหว่างทาง (In Progress)</option>
                            <option value={JobStatus.COMPLETED} className="text-slate-900">เสร็จสมบูรณ์ (Completed)</option>
                            <option value={JobStatus.CANCELLED} className="text-slate-900">ยกเลิก (Cancelled)</option>
                        </select>
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
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleExportCSV}
                                className="bg-slate-100 text-slate-600 p-2.5 rounded-xl hover:bg-slate-200 transition-colors border border-slate-200"
                                title="Export to CSV"
                            >
                                <Download size={18} />
                            </button>
                            <button
                                onClick={handleExportExcel}
                                className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 text-xs font-black uppercase tracking-widest"
                                title="Export to Excel"
                            >
                                <FileDown size={14} /> <span>Excel</span>
                            </button>
                        </div>
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
                            ) : groupedData.map((group, idx) => {
                                const margin = (group.profit / group.revenue) * 100 || 0;
                                return (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                    {groupBy === 'subcontractor' ? <Building2 size={20} /> : <MapPin size={20} />}
                                                </div>
                                                <span className="text-sm font-black text-slate-700">{group.label}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-center font-bold text-slate-500 text-sm">{group.jobs} งาน</td>
                                        <td className="px-8 py-5 text-right font-black text-slate-900">฿{group.revenue.toLocaleString()}</td>
                                        <td className="px-8 py-5 text-right text-xs font-bold text-slate-400 italic">
                                            ฿{(group.profit / group.jobs).toLocaleString()} / job
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex items-center justify-center gap-3">
                                                <progress
                                                    className={`margin-progress ${margin >= 15 ? 'progress-emerald' : margin >= 5 ? 'progress-blue' : 'progress-amber'}`}
                                                    value={margin}
                                                    max="30"
                                                    title={`${margin.toFixed(1)}% Margin`}
                                                ></progress>
                                                <span className={`text-[10px] font-black w-10 ${margin >= 15 ? 'text-emerald-600' : 'text-blue-600'}`}>{margin.toFixed(1)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <span className={`px-4 py-1.5 rounded-xl text-xs font-black ${group.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                ฿{group.profit.toLocaleString()}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default ProfitAnalysisView;
