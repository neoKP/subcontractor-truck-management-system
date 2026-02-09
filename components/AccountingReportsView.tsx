
import React, { useState, useMemo, useEffect } from 'react';
import { Job, AuditLog, JobStatus, UserRole } from '../types';
import * as XLSX from 'xlsx';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
    PieChart,
    Pie,
    Legend
} from 'recharts';
import {
    TrendingUp,
    DollarSign,
    Truck,
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
    Search,
    PieChart as PieChartIcon,
    BarChart3,
    Layers,
    MapPin,
    FileDown,
    Target as TargetIcon,
    XCircle,
    MousePointer2,
    Wallet
} from 'lucide-react';
import BillingReportView from './BillingReportView';
import { formatThaiCurrency, roundHalfUp } from '../utils/format';

interface AccountingReportsViewProps {
    jobs: Job[];
    logs: AuditLog[];
    userRole: UserRole;
}

// Recharts Custom Tooltip (Cost Focused)
const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl ring-1 ring-white/20">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center justify-between gap-8 mb-1">
                        <span className="flex items-center gap-2">
                            <svg className="w-2 h-2 shrink-0">
                                <circle cx="4" cy="4" r="4" fill={entry.color} />
                            </svg>
                            <span className="text-[10px] font-bold text-white/70 uppercase">{entry.name}</span>
                        </span>
                        <span className="text-xs font-black text-white">฿{formatThaiCurrency(entry.value)}</span>
                    </div>
                ))}
            </div>
        );
    }
    return null;
};

const AccountingReportsView: React.FC<AccountingReportsViewProps> = ({ jobs, logs, userRole }) => {
    const canViewBilling = userRole === UserRole.ADMIN || userRole === UserRole.ACCOUNTANT;

    // --- State ---
    const [filterType, setFilterType] = useState<'day' | 'month' | 'year' | 'custom'>('year');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterMonth, setFilterMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [filterDay, setFilterDay] = useState(new Date().toISOString().split('T')[0]);
    const [filterCustom, setFilterCustom] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [statusFilter, setStatusFilter] = useState<JobStatus | 'ALL'>('ALL');
    const [reportMode, setReportMode] = useState<'profit' | 'billing'>(canViewBilling ? 'billing' : 'profit');
    const [groupBy, setGroupBy] = useState<'sub' | 'route'>('sub');
    const [searchQuery, setSearchQuery] = useState('');
    const [isMounted, setIsMounted] = useState(false);

    // --- Cross-Filtering State ---
    const [selectedSub, setSelectedSub] = useState<string | null>(null);
    const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

    // Ensure charts only render after layout is stable
    useEffect(() => {
        const timer = setTimeout(() => setIsMounted(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Reset cross-filters when main filters or search change
    useEffect(() => {
        setSelectedSub(null);
        setSelectedRoute(null);
    }, [filterType, filterYear, filterMonth, filterDay, filterCustom, statusFilter, searchQuery]);

    // --- Aggregation Logic ---
    const validJobs = useMemo(() => {
        return jobs.filter(j => {
            if (j.status === JobStatus.CANCELLED) return false;

            // Search Filter
            const searchLower = searchQuery.toLowerCase();
            const matchesSearch = !searchQuery ||
                j.id.toLowerCase().includes(searchLower) ||
                (j.subcontractor || '').toLowerCase().includes(searchLower) ||
                j.origin.toLowerCase().includes(searchLower) ||
                j.destination.toLowerCase().includes(searchLower);

            if (!matchesSearch) return false;

            // Cross-Filtering Logic (Clean names for robust matching)
            if (selectedSub) {
                const subClean = (j.subcontractor || 'Waiting').replace(/\s*BO$/i, '').trim();
                const targetClean = selectedSub.replace(/\s*BO$/i, '').trim();
                if (subClean !== targetClean) return false;
            }
            if (selectedRoute) {
                const currentRoute = `${j.origin} → ${j.destination}`;
                if (currentRoute !== selectedRoute) return false;
            }

            if (!j.dateOfService) return false;
            const jobDate = new Date(j.dateOfService);
            const jobDateStr = (j.dateOfService || '').split('T')[0];

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
            if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;

            return true;
        });
    }, [jobs, filterType, filterDay, filterMonth, filterYear, filterCustom, statusFilter, searchQuery, selectedSub, selectedRoute]);

    // Financial KPIs - Cost Focused
    const metrics = useMemo(() => {
        const totalItems = validJobs.length;
        const totalCost = validJobs.reduce((acc, j) => acc + (j.cost || 0), 0);
        const avgCost = totalItems > 0 ? totalCost / totalItems : 0;
        const successCount = validJobs.filter(j => j.status === JobStatus.COMPLETED).length;
        const success = totalItems > 0 ? (successCount / totalItems) * 100 : 0;

        return { totalCost, avgCost, loads: totalItems, success, successCount };
    }, [validJobs]);

    // Trend Data - Cost Focused
    const trendData = useMemo(() => {
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthlyRecords = months.map(m => ({ label: m, cost: 0, loadCount: 0 }));
        const currentYear = filterType === 'year' ? filterYear : new Date(filterMonth).getFullYear();

        jobs.forEach(j => {
            if (j.status === JobStatus.CANCELLED) return;

            if (selectedSub) {
                const subClean = (j.subcontractor || 'Waiting').replace(/\s*BO$/i, '').trim();
                const targetClean = selectedSub.replace(/\s*BO$/i, '').trim();
                if (subClean !== targetClean) return;
            }
            if (selectedRoute) {
                const currentRoute = `${j.origin} → ${j.destination}`;
                if (currentRoute !== selectedRoute) return;
            }

            if (!j.dateOfService) return;
            const d = new Date(j.dateOfService);
            if (d.getFullYear() === currentYear) {
                const mIdx = d.getMonth();
                const cost = (j.cost || 0);
                monthlyRecords[mIdx].cost += cost;
                monthlyRecords[mIdx].loadCount += 1;
            }
        });
        return monthlyRecords.map(r => ({
            ...r,
            avgCost: r.loadCount > 0 ? r.cost / r.loadCount : 0
        }));
    }, [jobs, filterType, filterYear, filterMonth, selectedSub, selectedRoute]);

    // Subcontractor Cost Distribution
    const subData = useMemo(() => {
        const dist: Record<string, number> = {};
        validJobs.forEach(j => {
            const name = (j.subcontractor || 'Waiting').replace(/\s*BO$/i, '').trim();
            dist[name] = (dist[name] || 0) + (j.cost || 0);
        });
        return Object.entries(dist)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [validJobs]);

    // Route Cost Performance
    const routePerformanceData = useMemo(() => {
        const dist: Record<string, number> = {};
        validJobs.forEach(j => {
            const route = `${j.origin} → ${j.destination}`;
            dist[route] = (dist[route] || 0) + (j.cost || 0);
        });
        return Object.entries(dist)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [validJobs]);

    // Audit Table Data - Cost Analytics
    const performanceTableData = useMemo(() => {
        const groups: Record<string, { name: string; jobs: number; cost: number }> = {};
        validJobs.forEach(j => {
            const key = groupBy === 'sub'
                ? (j.subcontractor || 'Waiting').replace(/\s*BO$/i, '').trim()
                : `${j.origin} → ${j.destination}`;

            if (!groups[key]) groups[key] = { name: key, jobs: 0, cost: 0 };
            groups[key].jobs += 1;
            groups[key].cost += (j.cost || 0);
        });
        return Object.values(groups).sort((a, b) => b.cost - a.cost);
    }, [validJobs, groupBy]);

    const handleExportExcel = () => {
        const data = performanceTableData.map(d => ({
            "Analysis Target": d.name,
            "Total Jobs": d.jobs,
            "Total Cost": formatThaiCurrency(d.cost),
            "Avg Cost/Job": formatThaiCurrency(d.cost / d.jobs),
            "Cost Share %": ((d.cost / metrics.totalCost) * 100 || 0).toFixed(2) + "%"
        }));
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Cost_Analysis");
        XLSX.writeFile(workbook, `Cost_Analysis_Export_${new Date().getTime()}.xlsx`);
    };

    const CLEAR_CROSS_FILTERS = () => {
        setSelectedSub(null);
        setSelectedRoute(null);
    };

    const formatCurrency = (v: number) => {
        const absV = Math.abs(v);
        const sign = v < 0 ? '-' : '';
        return `${sign}฿${formatThaiCurrency(absV)}`;
    };

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-700 pb-20 no-print">
            {/* Unified Control Center */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 relative group overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_50%_-20%,#3b82f6,transparent)]"></div>

                <div className="flex items-center gap-6 z-10 w-full xl:w-auto">
                    <div className="w-16 h-16 bg-blue-500/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center text-blue-500 border border-blue-500/20 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        {reportMode === 'billing' ? <Layers size={32} /> : <Wallet size={32} />}
                    </div>
                    <div className="flex-1">
                        <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
                            {reportMode === 'billing' ? 'Billing Command' : 'Business Intelligence (COST)'}
                        </h2>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                            <div className="relative max-w-sm">
                                <input
                                    type="text"
                                    placeholder="Search Job ID or Billing Ref..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-4 text-xs font-bold focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    title="ค้นหารายการ"
                                />
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            </div>
                            {(selectedSub || selectedRoute) && (
                                <button
                                    onClick={CLEAR_CROSS_FILTERS}
                                    className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-[10px] font-black flex items-center gap-2 hover:bg-red-100 transition-all border border-red-100 shadow-sm"
                                >
                                    <XCircle size={14} /> RESET FILTERS
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 z-10 w-full xl:w-auto">
                    <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200 mr-2 shadow-inner">
                        <button
                            onClick={() => setReportMode('billing')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${reportMode === 'billing' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            BILLING
                        </button>
                        <button
                            onClick={() => setReportMode('profit')}
                            className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${reportMode === 'profit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            ANALYTICS (COST)
                        </button>
                    </div>

                    {reportMode === 'profit' && (
                        <>
                            <div className="flex bg-slate-100 p-1.5 rounded-[1.5rem] border border-slate-200">
                                {['day', 'month', 'year', 'custom'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type as any)}
                                        className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all ${filterType === type ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20' : 'text-slate-400 hover:text-slate-600'}`}
                                    >
                                        {type.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                            <div className="flex items-center gap-3 bg-slate-50 px-5 py-2.5 rounded-[1.5rem] border border-slate-200 shadow-sm">
                                {filterType === 'month' && (
                                    <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)} className="bg-transparent text-xs font-black outline-none" title="Select Month">
                                        {Array.from({ length: 12 }, (_, i) => {
                                            const m = String(i + 1).padStart(2, '0');
                                            const y = filterMonth.split('-')[0];
                                            return <option key={m} value={`${y}-${m}`}>{new Date(2024, i).toLocaleString('th-TH', { month: 'long' })} {y}</option>;
                                        })}
                                    </select>
                                )}
                                {filterType === 'year' && (
                                    <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} className="bg-transparent text-xs font-black outline-none" title="Select Year">
                                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                                    </select>
                                )}
                                <Calendar size={16} className="text-blue-500" />
                            </div>
                            <button onClick={handleExportExcel} className="bg-emerald-600 text-white px-6 py-3 rounded-[1.5rem] flex items-center gap-3 text-xs font-black uppercase shadow-lg shadow-emerald-100 active:scale-95 transition-all">
                                <FileDown size={18} /> Export Cost Data
                            </button>
                        </>
                    )}
                </div>
            </div>

            {reportMode === 'billing' ? (
                <BillingReportView jobs={jobs} />
            ) : (
                <>
                    {/* Cost Focused KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                            { label: 'Total Truck Cost', value: formatCurrency(metrics.totalCost), icon: Wallet, color: '#f97316', sparkKey: 'cost' },
                            { label: 'Avg Cost / Load', value: formatCurrency(metrics.avgCost), icon: Activity, color: '#3b82f6', suffix: 'Per Trip Efficiency', sparkKey: 'avgCost' },
                            { label: 'Fulfillment Rate', value: `${metrics.success.toFixed(1)}%`, icon: CheckCircle2, color: '#10b981', suffix: 'Operational Success' },
                            { label: 'Total Volume', value: metrics.loads, icon: Truck, color: '#8b5cf6', suffix: 'Loads Dispatched' }
                        ].map((kpi, idx) => (
                            <div key={idx} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all duration-500 group relative overflow-hidden">
                                <div className="flex justify-between items-start relative z-10">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{kpi.label}</p>
                                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">{kpi.value}</h3>
                                        {kpi.suffix && <div className="mt-2 inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-slate-50 text-slate-500 tracking-tight">{kpi.suffix}</div>}
                                    </div>
                                    <div className="p-3 rounded-2xl bg-slate-50 text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all transform group-hover:rotate-12">
                                        <kpi.icon size={20} />
                                    </div>
                                </div>
                                {kpi.sparkKey && isMounted && (
                                    <div className="h-14 w-full mt-4 -mx-6 -mb-6 opacity-40 group-hover:opacity-100 transition-opacity bg-gradient-to-t from-slate-50 to-transparent">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={trendData}>
                                                <Area type="monotone" dataKey={kpi.sparkKey} stroke={kpi.color} strokeWidth={2} fill={kpi.color} fillOpacity={0.1} isAnimationActive={true} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Cost Trend Chart */}
                    <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                                    <TrendingUp className="text-orange-500" size={24} />
                                    Operational Cost Dynamics
                                </h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Monthly total and average cost mapping</p>
                            </div>
                            <div className="text-[11px] font-black text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full uppercase tracking-tighter shadow-inner">FY {filterYear}</div>
                        </div>
                        <div className="h-[350px] w-full min-h-[350px]">
                            {isMounted && (
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                            </linearGradient>
                                            <linearGradient id="colorAvgCost" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }} padding={{ left: 20, right: 20 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 800 }} tickFormatter={formatCurrency} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase' }} />
                                        <Area name="Total Cost" type="monotone" dataKey="cost" stroke="#f97316" strokeWidth={4} fillOpacity={1} fill="url(#colorCost)" dot={{ stroke: '#f97316', strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#f97316' }} />
                                        <Area name="Avg Cost/Job" type="monotone" dataKey="avgCost" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorAvgCost)" dot={{ stroke: '#3b82f6', strokeWidth: 2, r: 4, fill: '#fff' }} activeDot={{ r: 8, strokeWidth: 0, fill: '#3b82f6' }} />
                                    </AreaChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Cost by Partner */}
                        <div className={`bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col min-h-[450px] transition-all relative group ${selectedSub ? 'ring-2 ring-blue-500 shadow-xl' : ''}`}>
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3"><PieChartIcon className="text-purple-500" size={22} /> Partner Cost Share</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Truck cost distribution by partner</p>
                                </div>
                                {selectedSub ? <button onClick={() => setSelectedSub(null)} className="text-[9px] font-black bg-blue-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2"> {selectedSub} <XCircle size={12} /></button> : <div className="text-[9px] text-blue-500 font-black bg-blue-50 px-3 py-1.5 rounded-lg flex items-center gap-2"><MousePointer2 size={12} /> CLICK TO FILTER</div>}
                            </div>
                            <div className="flex-1 w-full min-h-[300px]">
                                {isMounted && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie data={subData} cx="50%" cy="45%" innerRadius={85} outerRadius={120} paddingAngle={8} dataKey="value" nameKey="name" stroke="none" onClick={(e) => setSelectedSub(selectedSub === e.name ? null : e.name)} className="cursor-pointer">
                                                {subData.map((entry, i) => (
                                                    <Cell key={i} fill={['#f97316', '#8b5cf6', '#3b82f6', '#10b981', '#ec4899'][i % 5]} opacity={selectedSub && selectedSub !== entry.name ? 0.3 : 1} className="transition-all duration-300" />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" formatter={(value, entry: any) => (<span className={`text-[11px] font-extrabold ml-3 transition-colors ${selectedSub === value ? 'text-blue-600' : 'text-slate-500'}`}>{value} <span className="text-slate-900 ml-4 font-black">฿{formatThaiCurrency(entry.payload.value)}</span></span>)} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>

                        {/* Cost by Route */}
                        <div className={`bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col transition-all relative group ${selectedRoute ? 'ring-2 ring-orange-500 shadow-xl' : ''}`}>
                            <div className="flex justify-between items-center mb-10">
                                <div>
                                    <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-3"><MapPin className="text-emerald-500" size={22} /> High-Cost Routes</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Operational expenditure by transit line</p>
                                </div>
                                {selectedRoute ? <button onClick={() => setSelectedRoute(null)} className="text-[9px] font-black bg-emerald-600 text-white px-3 py-1.5 rounded-lg flex items-center gap-2"> {selectedRoute.substring(0, 15)}... <XCircle size={12} /></button> : <div className="text-[9px] text-emerald-500 font-black bg-emerald-50 px-3 py-1.5 rounded-lg flex items-center gap-2"><MousePointer2 size={12} /> BARS ARE CLICKABLE</div>}
                            </div>
                            <div className="flex-1 w-full min-h-[300px]">
                                {isMounted && (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart
                                            data={routePerformanceData} layout="vertical" margin={{ left: 0, right: 40, top: 0, bottom: 0 }}
                                            onClick={(e) => e && e.activePayload && setSelectedRoute(selectedRoute === e.activePayload[0].payload.name ? null : e.activePayload[0].payload.name)}
                                        >
                                            <XAxis type="number" hide />
                                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 9, fill: '#64748b', fontWeight: 800 }} width={220} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} />
                                            <Bar dataKey="value" radius={[0, 10, 10, 0]} className="cursor-pointer">
                                                {routePerformanceData.map((entry, i) => (
                                                    <Cell key={i} fill={selectedRoute === entry.name ? '#10b981' : '#34d399'} opacity={selectedRoute && selectedRoute !== entry.name ? 0.3 : 1} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Audit Table - Cost Focused */}
                    <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-6 bg-slate-50/30">
                            <div>
                                <h4 className="text-xl font-black text-slate-900 tracking-tighter">Expenditure Audit Grid</h4>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Detailed cost breakdown by {groupBy === 'sub' ? 'partner' : 'route'}</p>
                            </div>
                            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                                <button onClick={() => setGroupBy('sub')} className={`px-6 py-2 rounded-xl text-[10px] font-black transition-all ${groupBy === 'sub' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>PARTNERS</button>
                                <button onClick={() => setGroupBy('route')} className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${groupBy === 'route' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>ROUTES</button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                        <th className="px-8 py-5">Analysis Target</th>
                                        <th className="px-8 py-5 text-center">Load Volume</th>
                                        <th className="px-8 py-5 text-right">Total Truck Cost</th>
                                        <th className="px-8 py-5 text-right">Avg Cost/Job</th>
                                        <th className="px-8 py-5 text-center">Cost Share %</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {performanceTableData.map((d, i) => {
                                        const share = (d.cost / metrics.totalCost) * 100;
                                        return (
                                            <tr key={i} className="group hover:bg-orange-50/30 transition-colors">
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-1.5 h-10 rounded-full ${i === 0 ? 'bg-orange-500 shadow-lg shadow-orange-200' : 'bg-slate-200 group-hover:bg-slate-300'}`}></div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[13px] font-black text-slate-700 tracking-tight">{d.name}</span>
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Rank #{i + 1}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-5 text-center">
                                                    <span className="px-3 py-1 bg-slate-100 rounded-lg text-[10px] font-black text-slate-600 uppercase">{d.jobs} งาน</span>
                                                </td>
                                                <td className="px-8 py-5 text-right"><span className="text-sm font-black text-slate-900 tracking-tight">฿{formatThaiCurrency(d.cost)}</span></td>
                                                <td className="px-8 py-5 text-right"><span className="text-xs font-bold text-slate-500 font-sans tracking-tight">฿{formatThaiCurrency(d.cost / d.jobs)}</span></td>
                                                <td className="px-8 py-5">
                                                    <div className="flex items-center justify-center gap-3">
                                                        <progress className={`margin-progress w-12 h-1.5 progress-orange`} value={share} max="50" />
                                                        <span className="text-[10px] font-black text-slate-400 w-8">{share.toFixed(0)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
            <div className="text-center pt-8 opacity-30">
                <p className="text-[9px] font-black uppercase tracking-[0.4em]">Integrated Business Intelligence Systems • Version 4.0 BI • Neo Siam Logistics</p>
            </div>
        </div>
    );
};

export default AccountingReportsView;
