
import React, { useState, useMemo } from 'react';
import { Job, AuditLog, JobStatus, UserRole } from '../types';
import { BarChart, DollarSign, TrendingUp, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface AccountingReportsViewProps {
    jobs: Job[];
    logs: AuditLog[];
    userRole: UserRole;
}

const AccountingReportsView: React.FC<AccountingReportsViewProps> = ({ jobs, logs, userRole }) => {
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [activeTab, setActiveTab] = useState<'cost' | 'subcontractor' | 'audit' | 'summary'>('cost');
    const [summaryViewMode, setSummaryViewMode] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
    const [summarySearch, setSummarySearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const handleExportSummary = () => {
        let data: [string | number, number][] = [];
        let filename = '';

        switch (summaryViewMode) {
            case 'daily': data = costSummary.daily; filename = 'daily_cost_report'; break;
            case 'weekly': data = costSummary.weekly; filename = 'weekly_cost_report'; break;
            case 'monthly': data = costSummary.monthly; filename = 'monthly_cost_report'; break;
            case 'yearly': data = costSummary.yearly; filename = 'yearly_cost_report'; break;
        }

        const csvContent = "Period,Total Cost\n" + data.map(([label, value]) => `${label},${value}`).join("\n");
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // Filter completed/billed jobs only for accurate cost reporting
    const validJobs = useMemo(() => {
        return jobs.filter(j => j.status !== JobStatus.CANCELLED);
    }, [jobs]);

    // --- Reports Logic ---

    // 1. Cost by Route
    const costByRoute = useMemo(() => {
        const routeMap = new Map<string, { count: number; totalCost: number }>();
        validJobs.forEach(job => {
            const key = `${job.origin} -> ${job.destination}`;
            const current = routeMap.get(key) || { count: 0, totalCost: 0 };
            routeMap.set(key, {
                count: current.count + 1,
                totalCost: current.totalCost + (job.cost || 0) + (job.extraCharge || 0)
            });
        });
        return Array.from(routeMap.entries()).sort((a, b) => b[1].totalCost - a[1].totalCost);
    }, [validJobs]);

    // 2. Cost by Subcontractor
    const costBySubcontractor = useMemo(() => {
        const subMap = new Map<string, { count: number; totalCost: number }>();
        validJobs.forEach(job => {
            const key = job.subcontractor || 'Unknown/Pending';
            const current = subMap.get(key) || { count: 0, totalCost: 0 };
            subMap.set(key, {
                count: current.count + 1,
                totalCost: current.totalCost + (job.cost || 0) + (job.extraCharge || 0)
            });
        });
        return Array.from(subMap.entries()).sort((a, b) => b[1].totalCost - a[1].totalCost);
    }, [validJobs]);

    // 3. Change Frequency Log
    const changeFrequency = useMemo(() => {
        const jobChangeMap = new Map<string, number>();
        logs.forEach(log => {
            // Focus on meaningful edits (e.g., cost, price overrides)
            if (['Cost (Price)', 'Price Override', 'Subcontractor'].includes(log.field)) {
                jobChangeMap.set(log.jobId, (jobChangeMap.get(log.jobId) || 0) + 1);
            }
        });

        return Array.from(jobChangeMap.entries())
            .filter(([_, count]) => count > 2) // Filter for high frequency > 2 edits
            .sort((a, b) => b[1] - a[1])
            .map(([jobId, count]) => {
                const job = jobs.find(j => j.id === jobId);
                return { jobId, count, job };
            });
    }, [logs, jobs]);

    // 4. Extra Charge Summary
    const extraChargeSummary = useMemo(() => {
        return validJobs
            .filter(j => (j.extraCharge || 0) > 0)
            .reduce((acc, job) => acc + (job.extraCharge || 0), 0);
    }, [validJobs]);

    // 5. Approved vs Rejected
    const approvalStats = useMemo(() => {
        let approved = 0;
        let rejected = 0;
        let pending = 0;
        validJobs.forEach(j => {
            if (j.accountingStatus === 'Approved') approved++;
            else if (j.accountingStatus === 'Rejected') rejected++;
            else pending++;
        });
        return { approved, rejected, pending };
    }, [validJobs]);

    // 6. Cost Summary (Time Periods)
    const costSummary = useMemo(() => {
        const daily = new Map<string, number>();
        const weekly = new Map<string, number>();
        const monthly = new Map<string, number>();
        const yearly = new Map<number, number>();

        const getWeekNumber = (d: Date) => {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
            return `W${weekNo}-${d.getUTCFullYear()}`;
        };

        validJobs.forEach(job => {
            const date = new Date(job.dateOfService);

            // Apply Date Range Filter if set
            if (startDate) {
                const start = new Date(startDate);
                if (date < start) return;
            }
            if (endDate) {
                const endDt = new Date(endDate);
                // Set end date to end of day for inclusive comparison if needed, 
                // but standard comparison usually works if input is YYYY-MM-DD. 
                // Creating a new date object from input string sets time to 00:00:00 (UTC) usually or local depending on parsing.
                // Best to be safe: valid until 23:59:59 of that day.
                endDt.setHours(23, 59, 59, 999);
                if (date > endDt) return;
            }

            const cost = (job.cost || 0) + (job.extraCharge || 0);

            const dayKey = date.toISOString().split('T')[0];
            const weekKey = getWeekNumber(date);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const yearKey = date.getFullYear();

            daily.set(dayKey, (daily.get(dayKey) || 0) + cost);
            weekly.set(weekKey, (weekly.get(weekKey) || 0) + cost);
            monthly.set(monthKey, (monthly.get(monthKey) || 0) + cost);
            yearly.set(yearKey, (yearly.get(yearKey) || 0) + cost);
        });

        return {
            daily: Array.from(daily.entries()).sort(), // All days in range
            weekly: Array.from(weekly.entries()).sort(),
            monthly: Array.from(monthly.entries()).sort(),
            yearly: Array.from(yearly.entries()).sort()
        };
    }, [validJobs, startDate, endDate]);


    const formatCurrency = (amount: number) =>
        `฿${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* Selection Tabs */}
            <div className="glass p-2 rounded-[2rem] flex flex-wrap gap-2 sticky top-0 z-10">
                <button
                    onClick={() => setActiveTab('cost')}
                    className={`flex-1 py-3 px-6 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'cost' ? 'bg-slate-900 text-white shadow-xl' : 'hover:bg-white text-slate-500'}`}
                >
                    💰 ต้นทุน & เส้นทาง (Cost Analysis)
                </button>
                <button
                    onClick={() => setActiveTab('subcontractor')}
                    className={`flex-1 py-3 px-6 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'subcontractor' ? 'bg-slate-900 text-white shadow-xl' : 'hover:bg-white text-slate-500'}`}
                >
                    🚚 ผู้รับจ้าง (Subcontractors)
                </button>
                <button
                    onClick={() => setActiveTab('audit')}
                    className={`flex-1 py-3 px-6 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'audit' ? 'bg-slate-900 text-white shadow-xl' : 'hover:bg-white text-slate-500'}`}
                >
                    🛡️ ตรวจสอบภายใน (Internal Audit)
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-3 px-6 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'summary' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'hover:bg-white text-slate-500'}`}
                >
                    📈 สรุปภาพรวม (Periodic Summary)
                </button>
            </div>

            {/* Content Area */}

            {/* 1. Cost Analysis */}
            {activeTab === 'cost' && (
                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            <TrendingUp className="text-blue-600" />
                            รายงานต้นทุนแยกตามเส้นทาง (Cost by Route)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="p-4 rounded-tl-2xl">เส้นทาง (Route)</th>
                                        <th className="p-4 text-center">จำนวนเที่ยว (Trips)</th>
                                        <th className="p-4 text-right">ยอดรวมค่าขนส่ง (Total Cost)</th>
                                        <th className="p-4 rounded-tr-2xl text-right">เฉลี่ยต่อเที่ยว (Avg/Trip)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {costByRoute.map(([route, data], idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700 text-xs">{route}</td>
                                            <td className="p-4 text-center font-bold text-slate-500 text-xs">{data.count}</td>
                                            <td className="p-4 text-right font-black text-slate-900 text-sm">{formatCurrency(data.totalCost)}</td>
                                            <td className="p-4 text-right font-bold text-slate-500 text-xs">{formatCurrency(data.totalCost / data.count)}</td>
                                        </tr>
                                    ))}
                                    {costByRoute.length === 0 && (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-300 italic">ไม่มีข้อมูล (No Data)</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. Subcontractor Analysis */}
            {activeTab === 'subcontractor' && (
                <div className="grid grid-cols-1 gap-6">
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                            <TrendingUp className="text-orange-600" />
                            รายงานต้นทุนแยกตามผู้รับจ้าง (Cost by Subcontractor)
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="p-4 rounded-tl-2xl">ผู้รับจ้าง (Subcontractor)</th>
                                        <th className="p-4 text-center">จำนวนเที่ยว (Trips)</th>
                                        <th className="p-4 text-right rounded-tr-2xl">ยอดจ่ายรวม (Total Payment)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {costBySubcontractor.map(([sub, data], idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 font-bold text-slate-700 text-xs">{sub}</td>
                                            <td className="p-4 text-center font-bold text-slate-500 text-xs">{data.count}</td>
                                            <td className="p-4 text-right font-black text-slate-900 text-sm">{formatCurrency(data.totalCost)}</td>
                                        </tr>
                                    ))}
                                    {costBySubcontractor.length === 0 && (
                                        <tr><td colSpan={3} className="p-8 text-center text-slate-300 italic">ไม่มีข้อมูล (No Data)</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. Internal Audit */}
            {activeTab === 'audit' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Change Frequency */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
                        <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2 text-rose-600">
                            <AlertTriangle size={20} />
                            ตรวจสอบความถี่การแก้ไข (Suspicious Edits)
                        </h3>
                        <p className="text-xs text-slate-400 mb-4">แสดงใบงานที่มีการแก้ไขข้อมูลสำคัญ (ราคา/รถ) เกิน 2 ครั้งขึ้นไป</p>
                        <div className="space-y-3">
                            {changeFrequency.length === 0 ? (
                                <div className="text-center p-8 text-slate-300 italic">ไม่พบความผิดปกติ (No suspicious edits found)</div>
                            ) : (
                                changeFrequency.map((item, idx) => (
                                    <div key={idx} className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex items-center justify-between">
                                        <div>
                                            <p className="font-black text-rose-700 text-sm">Job #{item.jobId}</p>
                                            <p className="text-[10px] text-slate-500">
                                                {item.job?.origin} - {item.job?.destination}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <span className="block text-2xl font-black text-rose-600 leading-none">{item.count}</span>
                                            <span className="text-[9px] font-bold text-rose-400 uppercase">Times Edited</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Report Cards Side Stack */}
                    <div className="space-y-6">
                        {/* Approved vs Rejected */}
                        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100 h-full">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                <CheckCircle className="text-emerald-600" />
                                สถานะการอนุมัติ (Approval Stats)
                            </h3>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                                    <span className="text-sm font-bold text-emerald-700 flex items-center gap-2"><CheckCircle size={16} /> อนุมัติแล้ว (Approved)</span>
                                    <span className="text-xl font-black text-emerald-800">{approvalStats.approved}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-rose-50 rounded-2xl border border-rose-100">
                                    <span className="text-sm font-bold text-rose-700 flex items-center gap-2"><XCircle size={16} /> ปฏิเสธ/ตีกลับ (Rejected)</span>
                                    <span className="text-xl font-black text-rose-800">{approvalStats.rejected}</span>
                                </div>
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                    <span className="text-sm font-bold text-slate-600 flex items-center gap-2">⏳ รอตรวจสอบ (Pending)</span>
                                    <span className="text-xl font-black text-slate-700">{approvalStats.pending}</span>
                                </div>
                            </div>
                        </div>

                        {/* Extra Charge Summary */}
                        <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                                    <DollarSign className="text-amber-500" /> ค่าใช้จ่ายพิเศษ (Extra Charges)
                                </h3>
                            </div>
                            <div className="text-center py-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                                <span className="block text-4xl font-black text-amber-600 tracking-tight">{formatCurrency(extraChargeSummary)}</span>
                                <span className="text-xs font-bold text-amber-500 uppercase tracking-widest mt-2 block">Total Extra Charges Accrued</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 4. Periodic Summary */}
            {activeTab === 'summary' && (
                <div className="space-y-6">
                    {/* Filter Controls */}
                    <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 items-center">
                            {['daily', 'weekly', 'monthly', 'yearly'].map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setSummaryViewMode(mode as any)}
                                    className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${summaryViewMode === mode ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                                >
                                    {mode === 'daily' ? 'รายวัน' : mode === 'weekly' ? 'รายสัปดาห์' : mode === 'monthly' ? 'รายเดือน' : 'รายปี'}
                                </button>
                            ))}
                            {/* Date Range Inputs */}
                            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-slate-200">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">จาก (From)</span>
                                    <input
                                        type="date"
                                        aria-label="Start Date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="text-xs font-bold text-slate-700 bg-slate-50 border-none p-0 focus:ring-0 cursor-pointer"
                                    />
                                </div>
                                <span className="text-slate-300">-</span>
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">ถึง (To)</span>
                                    <input
                                        type="date"
                                        aria-label="End Date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="text-xs font-bold text-slate-700 bg-slate-50 border-none p-0 focus:ring-0 cursor-pointer"
                                    />
                                </div>
                                {(startDate || endDate) && (
                                    <button
                                        onClick={() => { setStartDate(''); setEndDate(''); }}
                                        className="ml-1 text-slate-400 hover:text-rose-500"
                                        title="Clear Date Filter"
                                    >
                                        <XCircle size={14} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                            <input
                                type="text"
                                placeholder="ค้นหา... (เช่น 2024, Jan)"
                                value={summarySearch}
                                onChange={(e) => setSummarySearch(e.target.value)}
                                className="flex-1 md:w-64 px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={handleExportSummary}
                                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-md flex items-center gap-2 whitespace-nowrap"
                            >
                                <DollarSign size={14} /> Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Table View */}
                    <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-xl shadow-slate-100">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                    <tr>
                                        <th className="p-4 rounded-tl-2xl">ช่วงเวลา (Period)</th>
                                        <th className="p-4 text-right">ยอดรวม (Total Cost)</th>
                                        <th className="p-4 rounded-tr-2xl w-1/2">กราฟแสดงผล (Visual)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {(() => {
                                        let data: [string | number, number][] = [];
                                        switch (summaryViewMode) {
                                            case 'daily': data = costSummary.daily; break;
                                            case 'weekly': data = costSummary.weekly; break;
                                            case 'monthly': data = costSummary.monthly; break;
                                            case 'yearly': data = costSummary.yearly; break;
                                        }

                                        // Apply Search Filter
                                        const filteredData = data.filter(([label]) =>
                                            String(label).toLowerCase().includes(summarySearch.toLowerCase())
                                        );
                                        const maxVal = Math.max(...data.map(d => d[1])) || 1;

                                        if (filteredData.length === 0) return <tr><td colSpan={3} className="p-8 text-center text-slate-300 italic">ไม่พบข้อมูล (No Data)</td></tr>;

                                        return filteredData.map(([label, val], idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4 font-bold text-slate-700 text-xs">
                                                    {summaryViewMode === 'daily' ? new Date(label as string).toLocaleDateString('th-TH') : label}
                                                </td>
                                                <td className="p-4 text-right font-black text-slate-900 text-sm">{formatCurrency(val)}</td>
                                                <td className="p-4">
                                                    <div className="relative w-full max-w-xs h-6 bg-slate-100/80 rounded-full shadow-inner overflow-hidden group/bar cursor-default">
                                                        <svg width="100%" height="100%">
                                                            <defs>
                                                                <linearGradient id="gradDaily" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                    <stop offset="0%" stopColor="#3b82f6" />
                                                                    <stop offset="100%" stopColor="#22d3ee" />
                                                                </linearGradient>
                                                                <linearGradient id="gradWeekly" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                    <stop offset="0%" stopColor="#6366f1" />
                                                                    <stop offset="100%" stopColor="#c084fc" />
                                                                </linearGradient>
                                                                <linearGradient id="gradMonthly" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                    <stop offset="0%" stopColor="#10b981" />
                                                                    <stop offset="100%" stopColor="#2dd4bf" />
                                                                </linearGradient>
                                                                <linearGradient id="gradYearly" x1="0%" y1="0%" x2="100%" y2="0%">
                                                                    <stop offset="0%" stopColor="#334155" />
                                                                    <stop offset="100%" stopColor="#4b5563" />
                                                                </linearGradient>
                                                                <linearGradient id="gradGloss" x1="0%" y1="0%" x2="0%" y2="100%">
                                                                    <stop offset="0%" stopColor="white" stopOpacity="0.5" />
                                                                    <stop offset="100%" stopColor="white" stopOpacity="0" />
                                                                </linearGradient>
                                                            </defs>
                                                            <rect
                                                                width={`${(val / maxVal) * 100}%`}
                                                                height="100%"
                                                                fill={`url(#grad${summaryViewMode.charAt(0).toUpperCase() + summaryViewMode.slice(1)})`}
                                                                className="transition-all duration-1000 ease-out origin-left group-hover/bar:brightness-110"
                                                            />
                                                            <rect
                                                                width={`${(val / maxVal) * 100}%`}
                                                                height="100%"
                                                                fill="url(#gradGloss)"
                                                                className="transition-all duration-1000 ease-out origin-left pointer-events-none"
                                                            />
                                                        </svg>
                                                    </div>
                                                </td>
                                            </tr>
                                        ));
                                    })()}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default AccountingReportsView;
