
import React, { useMemo, useState } from 'react';
import { Job, JobStatus, AccountingStatus } from '../types';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Cell, PieChart, Pie, Legend, LineChart, Line, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import {
    TrendingUp, Truck, Users, CreditCard, Activity, Target,
    ArrowUpRight, ArrowDownRight, Package, MapPin, AlertCircle, Clock, CheckCircle2, Calendar
} from 'lucide-react';
import { formatThaiCurrency, roundHalfUp } from '../utils/format';

interface DashboardProps {
    jobs: Job[];
}

const PremiumExecutiveDashboard: React.FC<DashboardProps> = ({ jobs }) => {
    const [activeFilter, setActiveFilter] = useState<string | null>(null);

    // Time Period State
    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString());
    const [selectedMonth, setSelectedMonth] = useState((now.getMonth() + 1).toString().padStart(2, '0'));

    // --- 0. Filter Jobs by Selected Period ---
    const periodJobs = useMemo(() => {
        return jobs.filter(j => {
            if (!j.dateOfService) return false;
            const jobDate = new Date(j.dateOfService);
            const jobYear = jobDate.getFullYear().toString();
            const jobMonth = (jobDate.getMonth() + 1).toString().padStart(2, '0');
            return jobYear === selectedYear && jobMonth === selectedMonth;
        });
    }, [jobs, selectedYear, selectedMonth]);

    // --- 1. Aggregated Metrics (คำนวณจากข้อมูลจริง) ---
    const metrics = useMemo(() => {
        let revenue = 0;
        let cost = 0;
        let completed = 0;
        let pending = 0;
        let cancelled = 0;

        periodJobs.forEach(j => {
            if (j.status === JobStatus.CANCELLED) {
                cancelled++;
                return;
            }
            revenue += (j.sellingPrice || 0);
            // รวม extraCharges array ถ้ามี
            const extraChargesTotal = j.extraCharges?.reduce((sum, ec) => sum + (ec.amount || 0), 0) || 0;
            cost += (j.cost || 0) + (j.extraCharge || 0) + extraChargesTotal;
            if (j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED) completed++;
            else pending++;
        });

        const profit = revenue - cost;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        const successRate = (completed + pending) > 0 ? (completed / (completed + pending)) * 100 : 0;

        return {
            revenue, cost, profit, margin, completed, pending, cancelled, successRate,
            activeJobs: periodJobs.filter(j => j.status !== JobStatus.CANCELLED && j.status !== JobStatus.COMPLETED && j.status !== JobStatus.BILLED).length,
            totalCount: periodJobs.length
        };
    }, [periodJobs]);

    // --- 2. Volume Trend (by Day) ---
    const trendData = useMemo(() => {
        // Find all unique days in the selected period
        const daysInPeriod = Array.from(new Set(periodJobs.filter(j => j.dateOfService).map(j => (j.dateOfService || '').split('T')[0]))).sort();

        return daysInPeriod.map((date: any) => {
            const dayJobs = periodJobs.filter(j => j.dateOfService && (j.dateOfService || '').split('T')[0] === date);
            return {
                date: (date as string).split('-').slice(2).join('/'), // Show only Day part for cleaner axis
                volume: dayJobs.length,
                revenue: dayJobs.reduce((sum, j) => sum + (j.sellingPrice || 0), 0)
            };
        });
    }, [periodJobs]);

    // --- 3. Subcontractor Performance ---
    const subPerformance = useMemo(() => {
        const subMap: Record<string, { volume: number, revenue: number, profit: number }> = {};
        periodJobs.forEach(j => {
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
    }, [periodJobs]);

    // --- 4. Route Analysis ---
    const routeData = useMemo(() => {
        const routeMap: Record<string, number> = {};
        periodJobs.forEach(j => {
            if (j.status === JobStatus.CANCELLED) return;
            const key = `${j.origin} → ${j.destination}`;
            routeMap[key] = (routeMap[key] || 0) + 1;
        });
        return Object.entries(routeMap)
            .map(([route, volume]) => ({ route, volume }))
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 5);
    }, [periodJobs]);

    // Status Distribution for Pie
    const statusDist = useMemo(() => {
        const counts: Record<string, number> = {};
        periodJobs.forEach(j => {
            counts[j.status] = (counts[j.status] || 0) + 1;
        });
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [periodJobs]);

    return (
        <div className="p-2 sm:p-4 md:p-6 space-y-4 sm:space-y-6 bg-[#f8fafc] min-h-screen">

            {/* Header with Glassmorphism */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2 sm:gap-3">
                        <Activity className="text-indigo-600 animate-pulse shrink-0" size={24} />
                        Operations Intelligence (BI)
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[9px] sm:text-[10px] tracking-[0.2em] sm:tracking-[0.3em] mt-1 ml-1">
                        Real-time Analytics (ข้อมูลสรุปภาพรวม)
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                    {/* Period Selector */}
                    <div className="flex items-center gap-2 px-4 border-r border-slate-100">
                        <Calendar size={18} className="text-indigo-500" />
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            title="เลือกเดือน"
                            className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
                        >
                            {Array.from({ length: 12 }, (_, i) => {
                                const m = (i + 1).toString().padStart(2, '0');
                                return <option key={m} value={m}>{new Date(2000, i).toLocaleString('th-TH', { month: 'long' })}</option>;
                            })}
                        </select>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            title="เลือกปี"
                            className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y.toString()}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <div className="px-4 border-r border-slate-100">
                        <span className="block text-[9px] font-black text-slate-400 uppercase">Live Sync</span>
                        <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            <span className="text-xs font-black text-slate-700">Connected</span>
                        </span>
                    </div>
                    <div className="px-4">
                        <span className="block text-[9px] font-black text-slate-400 uppercase">Analysis Items</span>
                        <span className="text-xs font-black text-slate-700">{metrics.totalCount} งาน</span>
                    </div>
                </div>
            </div>

            {/* Level 1: Key Scorecards - Power BI Style */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                    { label: 'ต้นทุนรวม', value: metrics.cost, icon: CreditCard, color: 'text-rose-600', bg: 'bg-rose-50', prefix: '฿' },
                    { label: 'อัตราสำเร็จ', value: metrics.successRate, icon: CheckCircle2, color: 'text-blue-600', bg: 'bg-blue-50', suffix: '%' },
                    { label: 'งานกำลังดำเนินการ', value: metrics.activeJobs, icon: Activity, color: 'text-amber-600', bg: 'bg-amber-50', suffix: ' งาน' },
                    { label: 'งานทั้งหมด', value: metrics.totalCount, icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50', suffix: ' งาน' }
                ].map((card, idx) => (
                    <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg hover:border-slate-300 transition-all duration-200 cursor-pointer group overflow-hidden relative">
                        <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full ${card.bg} opacity-10 group-hover:scale-125 transition-transform duration-300`}></div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-xl ${card.bg} ${card.color}`}>
                                    <card.icon size={20} />
                                </div>
                            </div>
                            <span className="text-sm font-bold text-slate-600 block mb-1">{card.label}</span>
                            <div className="text-2xl font-black text-slate-900 flex items-baseline gap-1">
                                {card.prefix && <span className="text-sm text-slate-500">{card.prefix}</span>}
                                {card.suffix === '%' ? card.value.toFixed(1) : card.suffix?.includes('งาน') ? Math.round(card.value) : formatThaiCurrency(card.value)}
                                {card.suffix && <span className="text-sm text-slate-500">{card.suffix}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Level 2: Primary Visuals (Bento Grid) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Growth Chart */}
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">แนวโน้มจำนวนงานรายวัน <span className="text-slate-400 font-normal text-sm">(Daily Job Volume)</span></h3>
                            <p className="text-xs text-slate-500 mt-1">วิเคราะห์ปริมาณงานขนส่งรายวัน</p>
                        </div>
                    </div>
                    <div className="h-[300px] w-full">
                        {trendData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-slate-300">
                                <div className="text-center">
                                    <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
                                    <p className="font-bold">ไม่มีข้อมูลในเดือนนี้</p>
                                    <p className="text-xs mt-1">ลองเปลี่ยนเดือนหรือปี</p>
                                </div>
                            </div>
                        ) : (
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
                                <Area type="monotone" dataKey="volume" stroke="#4f46e5" strokeWidth={4} fillOpacity={1} fill="url(#colorRev)" />
                            </AreaChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Operational Health (Donut) */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                    <h3 className="text-sm font-bold text-slate-700 mb-2">สถานะงาน <span className="text-slate-400 font-normal">(Job Status)</span></h3>
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
                            <span className="text-3xl font-black text-slate-900 leading-none">{periodJobs.length}</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">งานในเดือนนี้</span>
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
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
                        <MapPin size={18} className="text-rose-500" />
                        เส้นทางหลัก <span className="text-slate-400 font-normal">(Top Routes)</span>
                    </h3>
                    <div className="space-y-6">
                        {routeData.map((route, idx) => {
                            const max = routeData[0].volume;
                            const pct = (route.volume / max) * 100;
                            return (
                                <div key={idx} className="group">
                                    <div className="flex justify-between items-start gap-4 mb-2">
                                        <span className="text-xs font-black text-slate-700 leading-snug break-words flex-1">{route.route}</span>
                                        <span className="text-[10px] font-black text-slate-400 whitespace-nowrap pt-0.5">{route.volume} Trips</span>
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
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-6 flex items-center gap-2">
                        <Users size={18} className="text-blue-500" />
                        ผู้รับเหมาหลัก <span className="text-slate-400 font-normal">(Top Subcontractors)</span>
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

        </div>
    );
};

export default PremiumExecutiveDashboard;
