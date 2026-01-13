
import React, { useState, useMemo } from 'react';
import { Job, AuditLog, JobStatus, UserRole } from '../types';
import { BarChart as BarIcon, DollarSign, TrendingUp, AlertTriangle, CheckCircle, XCircle, PieChart, Calendar, ChevronDown, Activity, Truck, Map as MapIcon, Layers, Download, Printer as PrintIcon, Filter, RotateCcw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface AccountingReportsViewProps {
    jobs: Job[];
    logs: AuditLog[];
    userRole: UserRole;
}

// --- Custom SVG Chart Components ---

const DonutChart = ({ data, colors, unit = '฿' }: { data: { label: string; value: number }[]; colors: { hex: string; className: string }[]; unit?: string }) => {
    const total = data.reduce((a, b) => a + b.value, 0);
    let cumulative = 0;

    if (total === 0) return <div className="flex items-center justify-center h-48 text-slate-300 font-bold italic">No Data Available</div>;

    const formatCenter = (val: number) => {
        if (unit === '฿') {
            if (val >= 1000000) return `฿${(val / 1000000).toFixed(1)}M`;
            if (val >= 1000) return `฿${(val / 1000).toFixed(1)}K`;
            return `฿${val.toLocaleString()}`;
        }
        return val.toLocaleString();
    };

    return (
        <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-40 h-40 shrink-0">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full">
                    {data.map((item, i) => {
                        const start = cumulative;
                        const percentage = item.value / total;
                        cumulative += percentage;
                        const dashArray = 2 * Math.PI * 40; // r=40
                        const dashOffset = dashArray * (1 - percentage);
                        const rotation = start * 360;
                        const colorObj = colors[i % colors.length];

                        return (
                            <circle
                                key={i}
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                stroke={colorObj.hex}
                                strokeWidth="12"
                                strokeDasharray={dashArray}
                                strokeDashoffset={dashOffset}
                                transform={`rotate(${rotation} 50 50)`}
                                className="transition-all duration-700 hover:stroke-[14px] cursor-pointer"
                            />
                        );
                    })}
                    <text x="50" y="50" textAnchor="middle" dy="0.3em" className="text-[9px] font-black fill-slate-800 transform rotate-90">
                        {formatCenter(total)}
                    </text>
                </svg>
            </div>
            <div className="flex-1 w-full space-y-2.5">
                {data.map((item, i) => (
                    <div
                        key={i}
                        className={`flex items-center justify-between text-[11px] p-1.5 rounded-xl hover:bg-slate-50 cursor-pointer transition-all legend-item`}
                        data-label={item.label}
                    >
                        <div className="flex items-center gap-2 min-w-0 pointer-events-none">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[i % colors.length].className}`}></div>
                            <span className="font-bold text-slate-600 truncate" title={item.label}>{item.label}</span>
                        </div>
                        <div className="text-right pl-2 shrink-0">
                            <span className="font-black text-slate-800">
                                {unit === '฿' ? `฿${item.value.toLocaleString()}` : item.value}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const SimpleBarChart = ({ data, color }: { data: { label: string; value: number }[]; color: string }) => {
    const max = Math.max(...data.map(d => d.value)) || 1;

    return (
        <div className="space-y-3">
            {data.slice(0, 5).map((item, i) => {
                const percentage = (item.value / max) * 100;
                // Map background color classes to hex for SVG fill if needed, 
                // but tailwind v4 can handle fill-[color]
                const fillColor = color.replace('bg-', 'fill-');

                return (
                    <div key={i} className={`group cursor-pointer p-1.5 rounded-xl hover:bg-slate-50 transition-all bar-item`} data-label={item.label}>
                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1 pointer-events-none">
                            <span className="truncate max-w-[150px]" title={item.label}>{item.label}</span>
                            <span className="text-slate-800">฿{item.value.toLocaleString()}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <svg width="100%" height="100%" preserveAspectRatio="none" className="block">
                                <rect
                                    width={`${percentage}%`}
                                    height="100%"
                                    rx="4"
                                    className={`${fillColor} transition-all duration-1000 ease-out`}
                                />
                            </svg>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

const TrendLineChart = ({ data, color }: { data: { label: string; value: number }[]; color: string }) => {
    if (data.length < 2) return <div className="h-40 flex items-center justify-center text-slate-300 text-xs">Not enough data for trend</div>;

    const max = Math.max(...data.map(d => d.value)) * 1.2 || 100;
    const points = data.map((d, i) => {
        const x = (i / (data.length - 1)) * 100;
        const y = 100 - (d.value / max) * 100;
        return `${x},${y}`;
    }).join(' ');

    return (
        <div className="relative h-48 w-full">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                {/* Grid lines */}
                <line x1="0" y1="25" x2="100" y2="25" stroke="#f1f5f9" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="#f1f5f9" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="#f1f5f9" strokeWidth="0.5" />

                {/* Area fill */}
                <polygon points={`0,100 ${points} 100,100`} fill="url(#gradientArea)" className="opacity-20" />

                {/* Line */}
                <polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />

                {/* Dots */}
                {data.map((d, i) => (
                    <circle
                        key={i}
                        cx={(i / (data.length - 1)) * 100}
                        cy={100 - (d.value / max) * 100}
                        r="1.5"
                        fill="white"
                        stroke={color}
                        strokeWidth="1"
                        className="hover:r-3 transition-all"
                    >
                        <title>{d.label}: ฿{d.value.toLocaleString()}</title>
                    </circle>
                ))}

                <defs>
                    <linearGradient id="gradientArea" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={color} />
                        <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                </defs>
            </svg>
            <div className="flex justify-between mt-2 text-[9px] text-slate-400 font-bold uppercase">
                <span>{data[0]?.label}</span>
                <span>{data[Math.floor(data.length / 2)]?.label}</span>
                <span>{data[data.length - 1]?.label}</span>
            </div>
        </div>
    );
};

// --- Main Component ---

const AccountingReportsView: React.FC<AccountingReportsViewProps> = ({ jobs, logs, userRole }) => {
    const [filterType, setFilterType] = useState<'day' | 'month' | 'year' | 'custom'>('year');
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const [filterMonth, setFilterMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
    const [filterDay, setFilterDay] = useState(new Date().toISOString().split('T')[0]);
    const [filterCustom, setFilterCustom] = useState({
        start: new Date().toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const [viewMode, setViewMode] = useState<'dashboard' | 'table'>('dashboard');
    const [drillDown, setDrillDown] = useState<{ type: 'sub' | 'route' | null; value: string | null }>({ type: null, value: null });

    // --- Helper for Period Comparison ---
    const getPreviousPeriodRange = () => {
        if (filterType === 'month') {
            const [y, m] = filterMonth.split('-').map(Number);
            const prevMonth = m === 1 ? 12 : m - 1;
            const prevYear = m === 1 ? y - 1 : y;
            return { year: prevYear, month: prevMonth, type: 'month' };
        }
        if (filterType === 'year') {
            return { year: filterYear - 1, type: 'year' };
        }
        return null;
    };

    const prevPeriod = getPreviousPeriodRange();


    // --- Data Aggregation Logic (Reused & Optimized) ---

    const validJobs = useMemo(() => {
        return jobs.filter(j => {
            if (j.status === JobStatus.CANCELLED) return false;

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

            // Drill-down filter
            if (drillDown.type === 'sub') return j.subcontractor === drillDown.value;
            if (drillDown.type === 'route') {
                const routeName = `${j.origin.split(' ')[0]} -> ${j.destination.split(' ')[0]}`;
                return routeName === drillDown.value;
            }

            return true;
        });
    }, [jobs, filterType, filterDay, filterMonth, filterYear, filterCustom, drillDown]);

    const prevJobs = useMemo(() => {
        if (!prevPeriod) return [];
        return jobs.filter(j => {
            if (j.status === JobStatus.CANCELLED) return false;
            const jobDate = new Date(j.dateOfService);
            if (prevPeriod.type === 'month') {
                return jobDate.getFullYear() === prevPeriod.year && (jobDate.getMonth() + 1) === prevPeriod.month;
            } else {
                return jobDate.getFullYear() === prevPeriod.year;
            }
        });
    }, [jobs, prevPeriod]);

    // KPI Data Calculations
    const totalRev = validJobs.reduce((acc, j) => acc + (j.cost || 0) + (j.extraCharge || 0), 0);
    const totalCost = validJobs.reduce((acc, j) => acc + (j.cost || 0), 0); // Cost is same as Revenue in this specific aggregation requested? 
    // Actually user says Total Revenue = Cost + Extra.
    const netProfit = totalRev - totalCost; // This might be just Extra Charge then.
    const profitMargin = totalRev > 0 ? (netProfit / totalRev) * 100 : 0;

    const prevTotalRev = prevJobs.reduce((acc, j) => acc + (j.sellingPrice || 0) + (j.extraCharge || 0), 0);
    const revenueGrowth = prevTotalRev > 0 ? ((totalRev - prevTotalRev) / prevTotalRev) * 100 : 0;

    const totalTrips = validJobs.length;
    const completedJobs = validJobs.filter(j => j.status === JobStatus.COMPLETED).length;
    const completionRate = totalTrips > 0 ? (completedJobs / totalTrips) * 100 : 0;


    // Charts Data
    const revenueBySub = useMemo(() => {
        const subMap: { [key: string]: number } = {};
        validJobs.forEach(j => {
            const sub = j.subcontractor || 'Waiting';
            subMap[sub] = (subMap[sub] || 0) + (j.cost || 0) + (j.extraCharge || 0);
        });
        return Object.entries(subMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5); // Top 5
    }, [validJobs]);

    const revenueByPeriodTrend = useMemo(() => {
        if (filterType === 'day' || (filterType === 'month')) {
            // Show daily trend for the month or just specific days
            const daysInMonth = filterType === 'day' ? 1 : new Date(parseInt(filterMonth.split('-')[0]), parseInt(filterMonth.split('-')[1]), 0).getDate();
            const days = Array(daysInMonth).fill(0).map((_, i) => ({
                label: filterType === 'day' ? filterDay : `${i + 1}`,
                value: 0
            }));

            validJobs.forEach(j => {
                const d = new Date(j.dateOfService);
                const dayIdx = d.getDate() - 1;
                if (days[dayIdx]) days[dayIdx].value += (j.cost || 0) + (j.extraCharge || 0);
            });
            return days;
        } else {
            // Monthly trend for year or custom
            const months = Array(12).fill(0).map((_, i) => ({ label: new Date(2026, i).toLocaleString('default', { month: 'short' }), value: 0 }));
            validJobs.forEach(j => {
                const d = new Date(j.dateOfService);
                months[d.getMonth()].value += (j.cost || 0) + (j.extraCharge || 0);
            });
            return months;
        }
    }, [validJobs, filterType, filterMonth, filterDay]);

    const revenueByRoute = useMemo(() => {
        const routeMap: { [key: string]: number } = {};
        validJobs.forEach(j => {
            const route = `${j.origin.split(' ')[0]} -> ${j.destination.split(' ')[0]}`;
            routeMap[route] = (routeMap[route] || 0) + (j.cost || 0) + (j.extraCharge || 0);
        });
        return Object.entries(routeMap)
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 6);
    }, [validJobs]);

    const statusDist = useMemo(() => {
        const distMap: { [key: string]: number } = {};
        validJobs.forEach(j => {
            const status = j.status === JobStatus.NEW_REQUEST ? 'New Request' :
                j.status === JobStatus.ASSIGNED ? 'In Progress' :
                    j.status === JobStatus.COMPLETED ? 'Completed' : 'Other';
            distMap[status] = (distMap[status] || 0) + 1;
        });
        return Object.entries(distMap).map(([label, value]) => ({ label, value }));
    }, [validJobs]);

    // --- Actions ---
    const exportToCSV = () => {
        const headers = ["Job ID", "Date", "Route", "Subcontractor", "Base Cost", "Extra Charge", "Total Aggregated Revenue", "Status"];
        const rows = validJobs.map(j => [
            j.id,
            j.dateOfService,
            `${j.origin} -> ${j.destination}`,
            j.subcontractor || '-',
            j.cost || 0,
            j.extraCharge || 0,
            (j.cost || 0) + (j.extraCharge || 0),
            j.status
        ]);

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(r => r.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `NEOSIAM_Analytics_${filterType}_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20 print:bg-white print:p-0">
            {/* Header / Filter Bar */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 no-print">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
                        <BarIcon size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-slate-900 leading-tight uppercase">การประมวลผลตัวเลข</h2>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Data Aggregation Service</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
                    {/* Filter Type Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        {[
                            { id: 'day', label: 'รายวัน' },
                            { id: 'month', label: 'รายเดือน' },
                            { id: 'year', label: 'รายปี' },
                            { id: 'custom', label: 'คัดกรองเอง' }
                        ].map(type => (
                            <button
                                key={type.id}
                                onClick={() => setFilterType(type.id as any)}
                                className={`px-4 py-1.5 rounded-xl text-xs font-black transition-all ${filterType === type.id
                                    ? 'bg-white text-slate-900 shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {type.label}
                            </button>
                        ))}
                    </div>

                    {/* Dynamic Filter Controls */}
                    <div className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex-1 sm:flex-initial">
                        {filterType === 'day' && (
                            <input
                                type="date"
                                value={filterDay}
                                onChange={(e) => setFilterDay(e.target.value)}
                                aria-label="เลือกวันที่"
                                title="เลือกวันที่"
                                className="bg-transparent text-sm font-black text-slate-700 outline-none focus:ring-0 cursor-pointer"
                            />
                        )}
                        {filterType === 'month' && (
                            <div className="flex items-center gap-1">
                                <select
                                    value={filterMonth.split('-')[1]}
                                    onChange={(e) => {
                                        const [y] = filterMonth.split('-');
                                        setFilterMonth(`${y}-${e.target.value}`);
                                    }}
                                    title="เลือกเดือน"
                                    aria-label="เลือกเดือน"
                                    className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                                >
                                    {Array.from({ length: 12 }, (_, i) => {
                                        const m = String(i + 1).padStart(2, '0');
                                        return (
                                            <option key={m} value={m} className="text-slate-900 bg-white">
                                                {new Date(2024, i).toLocaleString('th-TH', { month: 'short' })}
                                            </option>
                                        );
                                    })}
                                </select>
                                <span className="text-slate-300">/</span>
                                <select
                                    value={filterMonth.split('-')[0]}
                                    onChange={(e) => {
                                        const [, m] = filterMonth.split('-');
                                        setFilterMonth(`${e.target.value}-${m}`);
                                    }}
                                    title="เลือกปี"
                                    aria-label="เลือกปี"
                                    className="bg-transparent text-sm font-black text-slate-700 outline-none cursor-pointer hover:text-blue-600 transition-colors"
                                >
                                    {[2024, 2025, 2026, 2027].map(y => (
                                        <option key={y} value={y} className="text-slate-900 bg-white">{y}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        {filterType === 'year' && (
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setFilterYear(y => y - 1)}
                                    className="hover:text-blue-500 transition-colors"
                                    aria-label="ปีที่แล้ว"
                                    title="ปีที่แล้ว"
                                >
                                    <ChevronDown className="rotate-90" size={16} />
                                </button>
                                <span className="text-sm font-black text-slate-700 w-12 text-center">{filterYear}</span>
                                <button
                                    onClick={() => setFilterYear(y => y + 1)}
                                    className="hover:text-blue-500 transition-colors"
                                    aria-label="ปีถัดไป"
                                    title="ปีถัดไป"
                                >
                                    <ChevronDown className="-rotate-90" size={16} />
                                </button>
                            </div>
                        )}
                        {filterType === 'custom' && (
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    value={filterCustom.start}
                                    onChange={(e) => setFilterCustom(prev => ({ ...prev, start: e.target.value }))}
                                    aria-label="วันที่เริ่มต้น"
                                    title="วันที่เริ่มต้น"
                                    className="bg-transparent text-xs font-black text-slate-700 outline-none"
                                />
                                <span className="text-slate-300">→</span>
                                <input
                                    type="date"
                                    value={filterCustom.end}
                                    onChange={(e) => setFilterCustom(prev => ({ ...prev, end: e.target.value }))}
                                    aria-label="วันที่สิ้นสุด"
                                    title="วันที่สิ้นสุด"
                                    className="bg-transparent text-xs font-black text-slate-700 outline-none"
                                />
                            </div>
                        )}
                        <Calendar size={16} className="text-blue-500 ml-auto" />
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => window.print()}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-all"
                            title="พิมพ์รายงาน"
                        >
                            <PrintIcon size={18} />
                        </button>
                        <button
                            onClick={exportToCSV}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-lg shadow-blue-200 transition-all"
                        >
                            <Download size={14} /> ส่งออก CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Drill-down Info Bar */}
            {drillDown.value && (
                <div className="flex items-center justify-between bg-blue-600 text-white px-8 py-3 rounded-2xl shadow-lg animate-in slide-in-from-top-4">
                    <div className="flex items-center gap-3">
                        <Filter size={18} />
                        <span className="text-sm font-bold">แสดงข้อมูลเฉพาะ: <span className="underline decoration-2 underline-offset-4">{drillDown.value}</span></span>
                    </div>
                    <button
                        onClick={() => setDrillDown({ type: null, value: null })}
                        className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-xl text-xs font-black transition-all"
                    >
                        <RotateCcw size={14} /> ล้างการเจาะลึก
                    </button>
                </div>
            )}

            {/* KPI Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Total Billing (Revenue) */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Revenue</p>
                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                        ฿{totalRev >= 1000000 ? `${(totalRev / 1000000).toFixed(2)}M` : totalRev.toLocaleString()}
                    </h3>
                    <div className="flex items-center gap-2 mt-2">
                        <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-black ${revenueGrowth >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {revenueGrowth >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                            {Math.abs(revenueGrowth).toFixed(1)}%
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">vs prev. period</span>
                    </div>
                </div>

                {/* Profit KPI */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Gross Profit</p>
                    <h3 className={`text-3xl font-black tracking-tight ${netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        ฿{Math.abs(netProfit) >= 1000000 ? `${(netProfit / 1000000).toFixed(2)}M` : netProfit.toLocaleString()}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-[10px] font-black uppercase text-slate-400 tracking-tighter">
                        Margin: <span className={profitMargin > 15 ? 'text-emerald-600' : 'text-amber-500'}>{profitMargin.toFixed(1)}%</span>
                    </div>
                </div>

                {/* Total Trips */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Operational Flow</p>
                    <h3 className="text-3xl font-black text-blue-600 tracking-tight">{totalTrips} <span className="text-lg font-bold text-slate-300">Jobs</span></h3>
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-blue-500 bg-blue-50 w-fit px-2 py-0.5 rounded-md uppercase">
                        {completedJobs} Confirmed
                    </div>
                </div>

                {/* Avg Ticket */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-xl transition-all">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Ticket Quality</p>
                    <h3 className="text-3xl font-black text-slate-800 tracking-tight">{completionRate.toFixed(1)}%</h3>
                    <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-slate-400 uppercase">
                        Completion Rate
                    </div>
                </div>
            </div>

            {/* 1. Full Width Row: Monthly Trend */}
            <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-6">
                <div className="flex justify-between items-center mb-8">
                    <h4 className="font-black text-slate-800 flex items-center gap-3 text-lg">
                        <TrendingUp size={24} className="text-blue-500" />
                        {filterType === 'day' ? 'ยอดรายได้รายชั่วโมง (ประมาณการ)' : filterType === 'month' ? 'แนวโน้มรายได้รายวัน' : 'แนวโน้มรายได้รายเดือน'}
                    </h4>
                    <div className="text-xs font-black text-slate-400 bg-slate-50 px-4 py-1.5 rounded-full uppercase tracking-tighter">
                        {filterType === 'day' ? filterDay : filterType === 'month' ? filterMonth : `ปี ${filterYear}`}
                    </div>
                </div>
                <TrendLineChart data={revenueByPeriodTrend} color="#3b82f6" />
            </div>

            {/* 2. Equal Split Row: Subcontractors & Routes */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="font-black text-slate-800 flex items-center justify-between mb-8 text-lg">
                        <div className="flex items-center gap-3">
                            <PieChart size={24} className="text-purple-500" />
                            Revenue by Subcontractor
                        </div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Click to drill-down</span>
                    </h4>
                    <div onClick={(e) => {
                        const target = e.target as HTMLElement;
                        const label = target.closest('.legend-item')?.getAttribute('data-label');
                        if (label) setDrillDown({ type: 'sub', value: label });
                    }}>
                        <DonutChart data={revenueBySub} colors={[
                            { hex: '#3b82f6', className: 'bg-blue-500 legend-item' },
                            { hex: '#8b5cf6', className: 'bg-violet-500 legend-item' },
                            { hex: '#ec4899', className: 'bg-pink-500 legend-item' },
                            { hex: '#f59e0b', className: 'bg-amber-500 legend-item' },
                            { hex: '#10b981', className: 'bg-emerald-500 legend-item' },
                            { hex: '#64748b', className: 'bg-slate-500 legend-item' }
                        ]} />
                    </div>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="font-black text-slate-800 flex items-center justify-between mb-8 text-lg">
                        <div className="flex items-center gap-3">
                            <MapIcon size={24} className="text-orange-500" />
                            Top Routes Performance
                        </div>
                        <span className="text-[9px] text-slate-400 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-lg">Interactive Chart</span>
                    </h4>
                    <div onClick={(e) => {
                        const target = e.target as HTMLElement;
                        const label = target.closest('.bar-item')?.getAttribute('data-label');
                        if (label) setDrillDown({ type: 'route', value: label });
                    }}>
                        <SimpleBarChart data={revenueByRoute} color="bg-orange-500 bar-item" />
                    </div>
                </div>
            </div>

            {/* 3. Bottom Row: Status Distribution & Statistics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h4 className="font-black text-slate-800 flex items-center gap-3 mb-8 text-lg">
                        <Activity size={24} className="text-emerald-500" />
                        Operations Status Overview
                    </h4>
                    <DonutChart data={statusDist} unit=" Jobs" colors={[
                        { hex: '#f59e0b', className: 'bg-amber-500' },
                        { hex: '#3b82f6', className: 'bg-blue-500' },
                        { hex: '#10b981', className: 'bg-emerald-500' },
                        { hex: '#64748b', className: 'bg-slate-500' }
                    ]} />
                </div>

                <div className="bg-slate-900 p-8 rounded-[2.5rem] shadow-xl flex flex-col justify-center items-center text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
                        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white rounded-full blur-3xl"></div>
                        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl"></div>
                    </div>
                    <Truck size={48} className="text-blue-400 mb-4" />
                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Active Routes</p>
                    <p className="text-5xl font-black text-white mb-2">{revenueByRoute.length}</p>
                    <p className="text-xs text-slate-400 font-bold">Total distinct routes operated in {filterYear}</p>
                </div>
            </div>

            <div className="text-center pt-12 opacity-40">
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.3em]">Neo Siam Logistics • Intelligent Data Analytics • 2026</p>
            </div>
        </div>
    );
};

export default AccountingReportsView;
