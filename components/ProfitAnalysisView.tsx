
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
    FileDown,
    Layers,
    BarChart3,
    PieChart as PieChartIcon
} from 'lucide-react';
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
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
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

    // 1. Core KPIs
    const totalRevenue = useMemo(() => {
        return filteredJobs.reduce((sum, j) => sum + (j.sellingPrice || 0) + (j.extraCharge || 0), 0);
    }, [filteredJobs]);

    const totalCost = useMemo(() => {
        return filteredJobs.reduce((sum, j) => sum + (j.cost || 0), 0);
    }, [filteredJobs]);

    const grossProfit = totalRevenue - totalCost;
    const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    const successRate = useMemo(() => {
        if (filteredJobs.length === 0) return 0;
        const completedCount = filteredJobs.filter(j => j.status === JobStatus.COMPLETED).length;
        return (completedCount / filteredJobs.length) * 100;
    }, [filteredJobs]);

    // 2. Chart Data: Daily Trend
    const trendData = useMemo(() => {
        const trend: Record<string, { date: string; revenue: number; profit: number }> = {};

        // Populate days based on filter
        filteredJobs.forEach(j => {
            const dateStr = j.dateOfService.split('T')[0];
            const rev = (j.sellingPrice || 0) + (j.extraCharge || 0);
            const cost = (j.cost || 0);
            const profit = rev - cost;

            if (!trend[dateStr]) {
                trend[dateStr] = { date: dateStr, revenue: 0, profit: 0 };
            }
            trend[dateStr].revenue += rev;
            trend[dateStr].profit += profit;
        });

        return Object.values(trend).sort((a, b) => a.date.localeCompare(b.date));
    }, [filteredJobs]);

    // 3. Chart Data: Subcontractor / Route Performance
    const performanceData = useMemo(() => {
        const groups: Record<string, { name: string; revenue: number; profit: number }> = {};

        filteredJobs.forEach(j => {
            const key = groupBy === 'subcontractor'
                ? (j.subcontractor || 'General')
                : `${j.origin.split(' ')[0]} -> ${j.destination.split(' ')[0]}`;

            if (!groups[key]) {
                groups[key] = { name: key, revenue: 0, profit: 0 };
            }

            const rev = (j.sellingPrice || 0) + (j.extraCharge || 0);
            const cost = (j.cost || 0);

            groups[key].revenue += rev;
            groups[key].profit += (rev - cost);
        });

        return Object.values(groups).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    }, [filteredJobs, groupBy]);

    // 4. Chart Data: Status Distribution
    const statusData = useMemo(() => {
        const counts: Record<string, number> = {};
        filteredJobs.forEach(j => {
            counts[j.status] = (counts[j.status] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [filteredJobs]);

    const STATUS_COLORS: Record<string, string> = {
        [JobStatus.NEW_REQUEST]: '#3b82f6', // Blue
        [JobStatus.ASSIGNED]: '#8b5cf6',    // Purple
        [JobStatus.COMPLETED]: '#10b981',   // Emerald
        [JobStatus.PENDING_PRICING]: '#f59e0b' // Amber
    };

    // --- Export ---
    const handleExportExcel = () => {
        const data = performanceData.map(g => ({
            "Label": g.name,
            "Revenue": g.revenue,
            "Gross Profit": g.profit,
            "Margin %": ((g.profit / g.revenue) * 100 || 0).toFixed(2) + "%"
        }));

        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Performance");
        XLSX.writeFile(workbook, `Dashboard_Export_${new Date().getTime()}.xlsx`);
    };

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-4 rounded-2xl shadow-2xl">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 border-b border-white/5 pb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <div key={index} className="flex items-center justify-between gap-8 mb-1">
                            <span className="flex items-center gap-2">
                                <svg className="w-2 h-2" viewBox="0 0 8 8">
                                    <circle cx="4" cy="4" r="4" fill={entry.color} />
                                </svg>
                                <span className="text-[10px] font-bold text-white/70 uppercase">{entry.name}</span>
                            </span>
                            <span className="text-xs font-black text-white">฿{entry.value.toLocaleString()}</span>
                        </div>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-8 animate-in fade-in zoom-in duration-700 pb-20">
            {/* Control Bar - Power BI Style */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-slate-900 p-8 rounded-[3rem] shadow-2xl text-white relative overflow-hidden group">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(circle_at_50%_-20%,#3b82f6,transparent)]"></div>

                <div className="flex items-center gap-6 z-10">
                    <div className="w-16 h-16 bg-blue-500/10 backdrop-blur-xl rounded-[2rem] flex items-center justify-center text-blue-400 border border-blue-500/20 group-hover:scale-110 transition-transform duration-500 shadow-inner">
                        <TrendingUp size={32} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black leading-tight tracking-tighter">Command Center</h2>
                        <p className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.25em] mt-1 flex items-center gap-2">
                            Real-time Business Intelligence <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 z-10 w-full xl:w-auto">
                    <div className="flex bg-white/5 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-white/10 shadow-xl">
                        {['day', 'month', 'year', 'custom'].map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type as any)}
                                className={`px-5 py-2 rounded-xl text-[10px] font-black transition-all duration-300 ${filterType === type
                                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/40'
                                    : 'text-slate-400 hover:text-white'
                                    }`}
                            >
                                {type.toUpperCase()}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-5 py-2.5 rounded-[1.5rem] border border-white/10 shadow-xl">
                        {filterType === 'month' && (
                            <div className="flex items-center gap-2">
                                <select
                                    value={filterMonth.split('-')[1]}
                                    onChange={e => setFilterMonth(`${filterMonth.split('-')[0]}-${e.target.value}`)}
                                    className="bg-transparent text-xs font-black outline-none cursor-pointer"
                                    aria-label="Select Month"
                                >
                                    {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map(m => (
                                        <option key={m} value={m} className="text-slate-900">{new Date(2024, parseInt(m) - 1).toLocaleString('th-TH', { month: 'long' })}</option>
                                    ))}
                                </select>
                                <span className="opacity-20 font-light">|</span>
                                <select
                                    value={filterMonth.split('-')[0]}
                                    onChange={e => setFilterMonth(`${e.target.value}-${filterMonth.split('-')[1]}`)}
                                    className="bg-transparent text-xs font-black outline-none cursor-pointer"
                                    aria-label="Select Year"
                                >
                                    {[2024, 2025, 2026].map(y => <option key={y} value={y} className="text-slate-900">{y}</option>)}
                                </select>
                            </div>
                        )}
                        {filterType === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input type="date" value={filterCustom.start} onChange={e => setFilterCustom({ ...filterCustom, start: e.target.value })} className="bg-transparent text-[10px] font-black outline-none" title="Start Date" aria-label="Start Date" />
                                <span className="opacity-30">→</span>
                                <input type="date" value={filterCustom.end} onChange={e => setFilterCustom({ ...filterCustom, end: e.target.value })} className="bg-transparent text-[10px] font-black outline-none" title="End Date" aria-label="End Date" />
                            </div>
                        )}
                        <Calendar size={16} className="text-blue-500" />
                    </div>

                    <button
                        onClick={handleExportExcel}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-[1.5rem] flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/40 hover:scale-105 active:scale-95"
                    >
                        <FileDown size={18} />
                        <span>Export</span>
                    </button>
                </div>
            </div>

            {/* KPI Section with Sparklines */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Revenue', value: `฿${totalRevenue.toLocaleString()}`, color: 'blue', icon: DollarSign, trend: trendData.map(d => ({ v: d.revenue })) },
                    { label: 'Gross Profit', value: `฿${grossProfit.toLocaleString()}`, color: 'emerald', icon: TrendingUp, trend: trendData.map(d => ({ v: d.profit })), suffix: `${marginPercent.toFixed(1)}% Margin` },
                    { label: 'Job Success', value: `${successRate.toFixed(1)}%`, color: 'purple', icon: CheckCircle2, trend: trendData.map(d => ({ v: Math.random() * 100 })), suffix: 'Delivery Rate' },
                    { label: 'Total Volume', value: filteredJobs.length, color: 'slate', icon: Truck, trend: trendData.map(d => ({ v: Math.random() * 20 })), suffix: 'Ops Executed' }
                ].map((kpi, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 group hover:shadow-2xl transition-all duration-500 flex flex-col justify-between overflow-hidden relative">
                        <div className="flex justify-between items-start mb-4 relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{kpi.label}</p>
                                <h3 className={`text-2xl font-black text-slate-900 tracking-tight`}>{kpi.value}</h3>
                                {kpi.suffix && (
                                    <div className={`mt-1.5 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase inline-block ${kpi.color === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-600'}`}>
                                        {kpi.suffix}
                                    </div>
                                )}
                            </div>
                            <div className={`p-3 rounded-2xl bg-${kpi.color}-50 text-${kpi.color}-600 group-hover:scale-110 transition-transform duration-500`}>
                                <kpi.icon size={24} />
                            </div>
                        </div>

                        {/* Sparkline Simulation */}
                        <div className="h-12 w-full mt-4 -mx-6 mb-[-1.5rem] opacity-30 group-hover:opacity-100 transition-opacity duration-500">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={kpi.trend}>
                                    <defs>
                                        <linearGradient id={`grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={kpi.color === 'blue' ? '#3b82f6' : kpi.color === 'emerald' ? '#10b981' : '#8b5cf6'} stopOpacity={0.1} />
                                            <stop offset="95%" stopColor={kpi.color === 'blue' ? '#3b82f6' : kpi.color === 'emerald' ? '#10b981' : '#8b5cf6'} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <Area
                                        type="monotone"
                                        dataKey="v"
                                        stroke={kpi.color === 'blue' ? '#3b82f6' : kpi.color === 'emerald' ? '#10b981' : '#8b5cf6'}
                                        strokeWidth={2}
                                        fill={`url(#grad-${idx})`}
                                        isAnimationActive={true}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Visualizations Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Revenue Trend Area Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <Activity className="text-blue-500" size={20} /> Revenue vs Profit Trend
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Daily analysis of financial performance</p>
                        </div>
                        <div className="flex gap-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                <span className="text-[10px] font-black uppercase text-slate-400">Revenue</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                                <span className="text-[10px] font-black uppercase text-slate-400">Profit</span>
                            </div>
                        </div>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="date"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                                    tickFormatter={(val) => val.split('-').slice(1).join('/')}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }}
                                    tickFormatter={(val) => `฿${(val / 1000)}k`}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    name="Revenue"
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#3b82f6"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorRev)"
                                />
                                <Area
                                    name="Profit"
                                    type="monotone"
                                    dataKey="profit"
                                    stroke="#10b981"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorProfit)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Status Distribution Pie Chart */}
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col">
                    <div className="mb-8">
                        <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <PieChartIcon className="text-purple-500" size={20} /> Operations Mix
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Status and workload distribution</p>
                    </div>
                    <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusData}
                                    innerRadius={80}
                                    outerRadius={110}
                                    paddingAngle={8}
                                    dataKey="value"
                                    stroke="none"
                                >
                                    {statusData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#cbd5e1'} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend
                                    verticalAlign="bottom"
                                    height={36}
                                    iconType="circle"
                                    formatter={(value) => <span className="text-[10px] font-black uppercase text-slate-600 ml-2">{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-6 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Core Efficiency</span>
                            <span className="text-xs font-black text-slate-900">{successRate.toFixed(0)}%</span>
                        </div>
                        <div className="w-full">
                            <progress
                                className="performance-progress progress-emerald"
                                value={successRate}
                                max="100"
                            ></progress>
                        </div>
                    </div>
                </div>
            </div>

            {/* Performance Bar Chart & Grouped Table */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Ranking Bar Chart */}
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                                <BarChart3 className="text-amber-500" size={20} /> Top Performers (By {groupBy})
                            </h4>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Ranking by total revenue generated</p>
                        </div>
                        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
                            <button onClick={() => setGroupBy('subcontractor')} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${groupBy === 'subcontractor' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>PARTNERS</button>
                            <button onClick={() => setGroupBy('route')} className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${groupBy === 'route' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>ROUTES</button>
                        </div>
                    </div>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={performanceData} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#64748b', fontWeight: 800 }}
                                    width={120}
                                />
                                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                                <Bar
                                    dataKey="revenue"
                                    radius={[0, 12, 12, 0]}
                                    barSize={24}
                                >
                                    {performanceData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={index === 0 ? '#3b82f6' : '#94a3b8'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Efficiency Grid */}
                <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden flex flex-col">
                    <div className="mb-8">
                        <h4 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-3">
                            <Layers className="text-indigo-500" size={20} /> Performance Audit
                        </h4>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Deep dive into operational margins</p>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[9px] font-black uppercase text-slate-400 tracking-[0.15em] border-b border-slate-100 italic">
                                    <th className="pb-4">Name</th>
                                    <th className="pb-4 text-right">Revenue</th>
                                    <th className="pb-4 text-center">Margin %</th>
                                    <th className="pb-4 text-right">Profit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {performanceData.map((item, idx) => {
                                    const margin = (item.profit / item.revenue) * 100 || 0;
                                    return (
                                        <tr key={idx} className="group hover:bg-slate-50/50 transition-colors">
                                            <td className="py-4 whitespace-nowrap">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg ${idx === 0 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-[10px] font-black`}>#{idx + 1}</div>
                                                    <span className="text-xs font-black text-slate-700 tracking-tight">{item.name}</span>
                                                </div>
                                            </td>
                                            <td className="py-4 text-right">
                                                <span className="text-xs font-black text-slate-900">฿{item.revenue.toLocaleString()}</span>
                                            </td>
                                            <td className="py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <div className="flex items-center">
                                                        <progress
                                                            className={`margin-progress ${margin >= 15 ? 'progress-emerald' : 'progress-blue'}`}
                                                            value={Math.min(margin, 100)}
                                                            max="100"
                                                        ></progress>
                                                    </div>
                                                    <span className={`text-[9px] font-black w-8 ${margin >= 15 ? 'text-emerald-600' : 'text-blue-600'}`}>{margin.toFixed(0)}%</span>
                                                </div>
                                            </td>
                                            <td className="py-4 text-right">
                                                <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${item.profit >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                    ฿{item.profit.toLocaleString()}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-8 pt-6 border-t border-slate-100 flex justify-between items-center italic">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Showing Top 5 Impact Leaders</div>
                        <button className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-2">View Full Report <ArrowUpRight size={14} /></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfitAnalysisView;
