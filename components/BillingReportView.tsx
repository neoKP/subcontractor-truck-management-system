import React, { useState, useMemo } from 'react';
import { Job, JobStatus, AccountingStatus } from '../types';
import { Calendar, CheckCircle, Clock, AlertCircle, TrendingUp, Filter, FileText, ChevronRight, DollarSign, Wallet, Search, X } from 'lucide-react';

interface BillingReportViewProps {
    jobs: Job[];
}

const BillingReportView: React.FC<BillingReportViewProps> = ({ jobs }) => {
    // --- 1. Pending Billing (Backlog) ---
    const pendingJobs = useMemo(() => {
        return jobs.filter(j =>
            j.accountingStatus === AccountingStatus.APPROVED &&
            j.status !== JobStatus.BILLED &&
            j.status !== JobStatus.CANCELLED
        );
    }, [jobs]);

    const pendingStats = useMemo(() => {
        const totalAmount = pendingJobs.reduce((sum, j) => sum + (j.cost || 0) + (j.extraCharge || 0), 0);
        const subMap: Record<string, { count: number; amount: number }> = {};

        pendingJobs.forEach(j => {
            const sub = j.subcontractor || 'Unknown';
            if (!subMap[sub]) subMap[sub] = { count: 0, amount: 0 };
            subMap[sub].count++;
            subMap[sub].amount += (j.cost || 0) + (j.extraCharge || 0);
        });

        return {
            count: pendingJobs.length,
            amount: totalAmount,
            bySub: Object.entries(subMap).map(([name, data]) => ({ name, ...data })).sort((a, b) => b.amount - a.amount)
        };
    }, [pendingJobs]);

    // --- 2. History (Billed) ---
    const billedJobs = useMemo(() => jobs.filter(j => j.status === JobStatus.BILLED), [jobs]);

    const getStatsForPeriod = (start: Date, end: Date) => {
        const periodJobs = billedJobs.filter(j => {
            // Use billingDate if available, else dateOfService
            const dStr = j.billingDate || j.dateOfService;
            if (!dStr) return false;
            const d = new Date(dStr);
            return d >= start && d <= end;
        });

        const amount = periodJobs.reduce((sum, j) => sum + (j.cost || 0) + (j.extraCharge || 0), 0);
        const uniqueSubs = new Set(periodJobs.map(j => j.subcontractor)).size;

        // Group by Document No (if available)
        const docs = new Set(periodJobs.map(j => j.billingDocNo)).size; // Crude count, assumes 1 doc missing = 1 doc? No, filter

        return { count: periodJobs.length, amount, uniqueSubs, docs };
    };

    const periodStats = useMemo(() => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

        // Week (Mon-Sun)
        const dayOfWeek = now.getDay() || 7; // 1-7
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
        startOfWeek.setHours(0, 0, 0, 0);

        // Month
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Year
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        return {
            today: getStatsForPeriod(startOfDay, endOfDay),
            week: getStatsForPeriod(startOfWeek, endOfDay),
            month: getStatsForPeriod(startOfMonth, endOfDay),
            year: getStatsForPeriod(startOfYear, endOfDay)
        };
    }, [billedJobs]);

    // --- 3. Custom Search History ---
    const [searchRange, setSearchRange] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const searchedJobs = useMemo(() => {
        return billedJobs.filter(j => {
            const dStr = j.billingDate || j.dateOfService;
            if (!dStr) return false;
            const d = dStr.split('T')[0];
            return d >= searchRange.start && d <= searchRange.end;
        }).sort((a, b) => new Date(b.billingDate || b.dateOfService).getTime() - new Date(a.billingDate || a.dateOfService).getTime());
    }, [billedJobs, searchRange]);

    const [selectedPendingSub, setSelectedPendingSub] = useState<string | null>(null);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                        <Wallet className="text-emerald-600" /> สรุปยอดการวางบิล (Billing Summary)
                    </h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest pl-8">Overview of Billed & Pending Items</p>
                </div>
                <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Last Updated</p>
                    <p className="text-xs font-bold text-slate-700">{new Date().toLocaleTimeString()}</p>
                </div>
            </div>

            {/* 1. Executive Summary Cards (Done) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Today', icon: Clock, data: periodStats.today, color: 'emerald' },
                    { label: 'This Week', icon: Calendar, data: periodStats.week, color: 'blue' },
                    { label: 'This Month', icon: TrendingUp, data: periodStats.month, color: 'indigo' },
                    { label: 'This Year', icon: FileText, data: periodStats.year, color: 'slate' },
                ].map((item, i) => (
                    <div key={i} className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all`}>
                        <div className={`absolute top-0 right-0 p-4 opacity-10 text-${item.color}-500`}>
                            <item.icon size={64} />
                        </div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{item.label}</p>
                        <h4 className={`text-3xl font-black text-${item.color}-600 tracking-tight`}>
                            ฿{item.data.amount.toLocaleString()}
                        </h4>
                        <div className="flex items-center gap-4 mt-3 text-[10px] font-bold text-slate-500">
                            <span className="flex items-center gap-1"><FileText size={12} /> {item.data.count} Jobs</span>
                            <span className="flex items-center gap-1"><CheckCircle size={12} /> {item.data.uniqueSubs} Subs</span>
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* 2. Pending Billing (Queue) */}
                <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100 bg-amber-50/50 flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                                <AlertCircle size={20} />
                            </div>
                            <div>
                                <h4 className="font-black text-slate-800 uppercase">งานคงค้าง (Pending Queue)</h4>
                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Ready for Billing</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-amber-600">฿{pendingStats.amount.toLocaleString()}</p>
                            <p className="text-[10px] font-bold text-amber-700/60 uppercase">{pendingStats.count} Jobs Pending</p>
                        </div>
                    </div>

                    <div className="overflow-y-auto max-h-[400px] p-2">
                        {pendingStats.bySub.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {pendingStats.bySub.map((sub, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-amber-200 transition-all group">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 shadow-sm">
                                                {idx + 1}
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-700 text-sm">{sub.name}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase">{sub.count} Jobs</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-slate-800">฿{sub.amount.toLocaleString()}</p>
                                            <button
                                                onClick={() => setSelectedPendingSub(sub.name)}
                                                className="text-[10px] font-bold text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-48 text-slate-300">
                                <CheckCircle size={48} className="mb-2 opacity-20" />
                                <p className="font-bold">No Pending Items</p>
                                <p className="text-xs">All approved jobs have been billed.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. Quick Actions / Recent Activity */}
                <div className="bg-slate-900 rounded-[2.5rem] shadow-xl p-8 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-20 pointer-events-none"></div>
                    <h4 className="font-black uppercase tracking-widest text-slate-400 mb-6 text-xs">Recent Billing Activity</h4>

                    <div className="space-y-4 relative z-10">
                        {billedJobs.slice(-5).reverse().map((job, i) => (
                            <div key={job.id} className="flex items-center justify-between border-b border-slate-800 pb-3 last:border-0">
                                <div>
                                    <p className="font-bold text-sm text-white">{job.billingDocNo || 'N/A'}</p>
                                    <p className="text-[10px] text-slate-400">{job.subcontractor}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-emerald-400">฿{(job.cost || 0).toLocaleString()}</p>
                                    <p className="text-[9px] text-slate-500">{new Date(job.billingDate || job.dateOfService).toLocaleDateString('th-TH')}</p>
                                </div>
                            </div>
                        ))}
                        {billedJobs.length === 0 && <p className="text-slate-500 italic text-sm">No recent activity.</p>}
                    </div>
                </div>
            </div>

            {/* 4. Billing History Search */}
            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-8 mt-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div>
                        <h4 className="flex items-center gap-3 text-lg font-black text-slate-800 uppercase">
                            <Search className="text-blue-500" /> ค้นหาประวัติการวางบิล (Billing History)
                        </h4>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest pl-9">Filter by Date Range</p>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-2 px-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
                            <input
                                type="date"
                                aria-label="Start Date"
                                value={searchRange.start}
                                onChange={(e) => setSearchRange({ ...searchRange, start: e.target.value })}
                                className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
                            />
                        </div>
                        <span className="text-slate-300">|</span>
                        <div className="flex items-center gap-2 px-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
                            <input
                                type="date"
                                aria-label="End Date"
                                value={searchRange.end}
                                onChange={(e) => setSearchRange({ ...searchRange, end: e.target.value })}
                                className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
                            />
                        </div>
                    </div>
                </div>

                {/* Summary for Selection */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-blue-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Total Amount</p>
                        <p className="text-2xl font-black text-blue-600">฿{searchedJobs.reduce((s, j) => s + (j.cost || 0) + (j.extraCharge || 0), 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Doc Count</p>
                        <p className="text-2xl font-black text-slate-700">{searchedJobs.length} <span className="text-xs">Jobs</span></p>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                <th className="py-4 pl-4">Billing Date</th>
                                <th className="py-4">Doc No</th>
                                <th className="py-4">Subcontractor</th>
                                <th className="py-4 text-right">Route</th>
                                <th className="py-4 text-right pr-4">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {searchedJobs.length > 0 ? searchedJobs.map(job => (
                                <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="py-3 pl-4 text-xs font-bold text-slate-500">
                                        {new Date(job.billingDate || job.dateOfService).toLocaleDateString('th-TH')}
                                    </td>
                                    <td className="py-3 text-sm font-black text-slate-700">{job.billingDocNo || '-'}</td>
                                    <td className="py-3 text-xs font-bold text-slate-600">{job.subcontractor}</td>
                                    <td className="py-3 text-right text-xs text-slate-400">{job.origin.split(' ')[0]} &rarr; {job.destination.split(' ')[0]}</td>
                                    <td className="py-3 text-right pr-4 text-sm font-black text-emerald-600">
                                        ฿{((job.cost || 0) + (job.extraCharge || 0)).toLocaleString()}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-300 italic">No billing records found in this range.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* Pending Details Modal */}
            {selectedPendingSub && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2rem] w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">{selectedPendingSub}</h3>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Pending Invoices Breakdown</p>
                            </div>
                            <button
                                onClick={() => setSelectedPendingSub(null)}
                                aria-label="Close"
                                className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 p-0">
                            <table className="w-full text-left border-collapse">
                                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                        <th className="py-4 pl-6 bg-slate-50/80 backdrop-blur-sm">Job ID</th>
                                        <th className="py-4 bg-slate-50/80 backdrop-blur-sm">Date</th>
                                        <th className="py-4 bg-slate-50/80 backdrop-blur-sm">Route</th>
                                        <th className="py-4 text-right pr-6 bg-slate-50/80 backdrop-blur-sm">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {pendingJobs.filter(j => j.subcontractor === selectedPendingSub).map(job => (
                                        <tr key={job.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="py-4 pl-6 font-bold text-slate-700 text-sm">#{job.id}</td>
                                            <td className="py-4 text-xs font-bold text-slate-500">{new Date(job.dateOfService).toLocaleDateString('th-TH')}</td>
                                            <td className="py-4 text-xs text-slate-600">{job.origin.split(' ')[0]} &rarr; {job.destination.split(' ')[0]}</td>
                                            <td className="py-4 text-right pr-6 font-black text-slate-900">
                                                ฿{((job.cost || 0) + (job.extraCharge || 0)).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Pending</p>
                                <p className="text-2xl font-black text-amber-600">
                                    ฿{pendingJobs.filter(j => j.subcontractor === selectedPendingSub).reduce((a, b) => a + (b.cost || 0) + (b.extraCharge || 0), 0).toLocaleString()}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BillingReportView;
