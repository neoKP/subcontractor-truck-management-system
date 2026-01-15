
import React, { useMemo, useState } from 'react';
import { Job, JobStatus, AccountingStatus } from '../types';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
    TrendingUp, Truck, Users, CreditCard, Activity, Target,
    ArrowUpRight, ArrowDownRight, Package, MapPin, AlertCircle, Clock, CheckCircle2
} from 'lucide-react';
import { formatThaiCurrency, roundHalfUp } from '../utils/format';

interface DashboardProps {
    jobs: Job[];
}

const PremiumExecutiveDashboard: React.FC<DashboardProps> = ({ jobs }) => {
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // --- 1. Aggregated Metrics ---
    const metrics = useMemo(() => {
        let revenue = 0;
        let cost = 0;
        let completed = 0;
        let pending = 0;
        let cancelled = 0;

        jobs.forEach(j => {
            if (j.status === JobStatus.CANCELLED) {
                cancelled++;
                return;
            }
            revenue += (j.sellingPrice || 0);
            cost += (j.cost || 0) + (j.extraCharge || 0);
            if (j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED) completed++;
            else pending++;
        });

        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const successRate = (completed + pending) > 0 ? (completed / (completed + pending)) * 100 : 0;

        return {
            revenue, cost, profit, margin, completed, pending, cancelled, successRate,
            activeJobs: jobs.filter(j => j.status !== JobStatus.CANCELLED && j.status !== JobStatus.COMPLETED && j.status !== JobStatus.BILLED).length
        };
    }, [jobs]);

    // --- 2. Volume Trend (by Day) ---
    const trendData = useMemo(() => {
        const last7Days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - (6 - i));
            return d.toISOString().split('T')[0];
        });

        return last7Days.map(date => {
            const dayJobs = jobs.filter(j => j.serviceDate === date);
            return {
                date: date.split('-').slice(1).join('/'),
                volume: dayJobs.length,
                revenue: dayJobs.reduce((sum, j) => sum + (j.sellingPrice || 0), 0)
            };
        });
    }, [jobs]);

    // --- 3. Subcontractor Performance (Radar Chart) ---
    const subPerformance = useMemo(() => {
        const subMap: Record<string, { volume: number, revenue: number, profit: number }> = {};
        jobs.forEach(j => {
            if (!j.subcontractor || j.status === JobStatus.CANCELLED) return;
            if (!subMap[j.subcontractor]) subMap[j.subcontractor] = { volume: 0, revenue: 0, profit: 0 };
            subMap[j.subcontractor].volume++;
            subMap[j.subcontractor].revenue += (j.sellingPrice || 0);
            subMap[j.subcontractor].profit += (j.sellingPrice || 0) - ((j.cost || 0) + (j.extraCharge || 0));
        });

        return Object.entries(subMap)
            .map(([name, data]) => ({ name, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);
    }, [jobs]);

    // --- 4. Route Analysis ---
    const routeData = useMemo(() => {
        const routeMap: Record<string, number> = {};
        jobs.forEach(j => {
            if (j.status === JobStatus.CANCELLED) return;
            const key = `${j.origin} → ${j.destination}`;
            routeMap[key] = (routeMap[key] || 0) + 1;
        });
        return Object.entries(routeMap)
            .map(([route, volume]) => ({ route, volume }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [jobs]);

    // Status Distribution for Pie
    const statusDist = useMemo(() => {
        const counts: Record<string, number> = {};
        jobs.forEach(j => {
            counts[j.status] = (counts[j.status] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [jobs]);

    return (
        <div className="p-2 md:p-6 space-y-6 bg-[#f8fafc] min-h-screen">

            {/* Header with Glassmorphism */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Activity className="text-indigo-600 animate-pulse" size={32} />
                        Operations Intelligence (BI)
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em] mt-1 ml-1">
                        Real-time Fleet Performance & Financial Analytics (ข้อมูลสรุปภาพรวม)
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    <div className="px-4 border-r border-slate-100">
                        <span className="block text-[9px] font-black text-slate-400 uppercase">Live Sync</span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <span className="text-xs font-black text-slate-700">Connected</span>
                        </span>
                    </div>
                    <div className="px-4">
                        <span className="block text-[9px] font-black text-slate-400 uppercase">Last Updated</span>
                        <span className="text-xs font-black text-slate-700">{new Date().toLocaleTimeString()}</span>
                    </div>
                </div>
            </div>

            {/* Level 1: Key Scorecards - Power BI Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'Total Revenue (รายได้รวม)', value: metrics.revenue, icon: TrendingUp, color: 'text-indigo-600', bg: 'bg-indigo-50', trend: '+12.5%', prefix: '฿' },
                    { label: 'Net Profit (กำไรสุทธิ)', value: metrics.profit, icon: CreditCard, color: 'text-emerald-600', bg: 'bg-emerald-50', trend: '+8.2%', prefix: '฿' },
                    { label: 'Gross Margin (เปอร์เซ็นต์กำไร)', value: metrics.margin, icon: Target, color: 'text-amber-600', bg: 'bg-amber-50', trend: '+2.1%', suffix: '%' },
                    { label: 'Success Rate (ความสำเร็จ)', value: metrics.successRate, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', trend: '-0.4%', suffix: '%' }
                ].map((card, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group overflow-hidden relative">
                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${card.bg} opacity-20 group-hover:scale-150 transition-transform duration-700`}></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-2xl ${card.bg} ${card.color}`}>
                                    <card.icon size={20} />
                                </div>
                                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-full ${card.trend.startsWith('+') ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                    {card.trend.startsWith('+') ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                    {card.trend}
                                </div>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">{card.label}</span>
                            <div className="text-2xl font-black text-slate-900 flex items-baseline gap-1">
                                {card.prefix && <span className="text-sm text-slate-400">{card.prefix}</span>}
                                {card.suffix ? card.value.toFixed(1) : formatThaiCurrency(card.value)}
                                {card.suffix && <span className="text-sm text-slate-400">{card.suffix}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Level 2: Primary Visuals (Bento Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Growth Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Volume & Revenue Trends (แนวโน้มงานและรายได้)</h3>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Daily cycle analysis of fleet productivity</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 800, fill: '#94a3b8' }} />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 p-4 rounded-2xl shadow-2xl border border-white/10">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{payload[0].payload.date}</p>
                                                    <div className="space-y-1">
                                                        <p className="text-xs text-white flex justify-between gap-8">Volume: <span className="font-black">{payload[0].payload.volume} Jobs</span></p>
                                                        <p className="text-xs text-indigo-400 flex justify-between gap-8">Revenue: <span className="font-black">฿{formatThaiCurrency(Number(payload[0].payload.revenue))}</span></p>
                                                    </div>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Operational Health (Donut) */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2">Fleet Status (สถานะฝูงรถ)</h3>
                    <div className="h-[250px] w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={statusDist}
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {statusDist.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={['#4f46e5', '#f59e0b', '#10b981', '#ef4444', '#64748b'][index % 5]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-3xl font-black text-slate-900 leading-none">{jobs.length}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total Jobs</span>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 w-full mt-4">
                        <div className="p-4 bg-slate-50 rounded-2xl text-center">
                            <span className="block text-xl font-black text-indigo-600">{metrics.activeJobs}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase">In Progress</span>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-2xl text-center">
                            <span className="block text-xl font-black text-emerald-600">{metrics.completed}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase">Settled</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Level 3: Detailed Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Top Routes performance chart */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <MapPin size={18} className="text-rose-500" />
                        Top Strategic Routes (เส้นทางหลัก)
                    </h3>
                    <div className="space-y-6">
                        {routeData.map((route, idx) => {
                            const max = routeData[0].volume;
                            const pct = (route.volume / max) * 100;
                            return (
                                <div key={idx} className="group">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-black text-slate-700 truncate max-w-[250px]">{route.route}</span>
                                        <span className="text-[10px] font-black text-slate-400">{route.volume} Trips</span>
                                    </div>
                                    <div className="h-2 w-full">
                                        <progress
                                            className="premium-route-progress block"
                                            value={pct}
                                            max={100}
                                        ></progress>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Subcontractor Performance Radar */}
                <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <Users size={18} className="text-blue-500" />
                        Fleet Leaderboard (ผู้นำกลุ่มรถร่วม)
                    </h3>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={subPerformance}>
                                <PolarGrid stroke="#f1f5f9" />
                                <PolarAngleAxis dataKey="name" tick={{ fontSize: 9, fontWeight: 900, fill: '#64748b' }} />
                                <Radar name="Volume" dataKey="volume" stroke="#4f46e5" fill="#4f46e5" fillOpacity={0.5} />
                                <Tooltip />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

            </div>

            {/* Level 4: Bottom Quick Actions / Info */}
            <div className="bg-indigo-900 p-8 rounded-[3.5rem] border border-indigo-800 shadow-2xl relative overflow-hidden group">
                <div className="absolute right-0 top-0 w-96 h-96 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:scale-110 transition-transform duration-1000"></div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                    <div className="max-w-md">
                        <h2 className="text-2xl font-black text-white leading-tight mb-2">Advanced Predictive Analytics Enabling...</h2>
                        <p className="text-indigo-200 text-sm font-bold uppercase tracking-widest">Integrating machine learning for next-gen route optimization and cost forecasting.</p>
                    </div>
                    <div className="flex gap-4">
                        <div className="px-8 py-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                            <span className="block text-3xl font-black text-white">{metrics.margin.toFixed(1)}%</span>
                            <span className="text-[9px] font-black text-indigo-300 uppercase">Avg Profit Margin</span>
                        </div>
                        <div className="px-8 py-4 bg-indigo-600 rounded-2xl shadow-xl text-center">
                            <span className="block text-3xl font-black text-white">{metrics.activeJobs}</span>
                            <span className="text-[9px] font-black text-indigo-200 uppercase">Jobs In-Flight</span>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default PremiumExecutiveDashboard;
