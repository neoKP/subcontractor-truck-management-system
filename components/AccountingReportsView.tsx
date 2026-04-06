
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Job, AuditLog, JobStatus, JOB_STATUS_LABELS, UserRole } from '../types';
import { db, ref, get, query, orderByChild, startAt, endAt } from '../firebaseConfig';
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
    Wallet,
    ChevronUp,
    Phone,
    Package,
    Table2,
    ChevronsUpDown
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
    const [analyticsJobs, setAnalyticsJobs] = useState<Job[]>([]);
    const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

    // --- Detail Table State ---
    const [showDetailTable, setShowDetailTable] = useState(true);
    const [detailSearch, setDetailSearch] = useState('');
    const [detailSubFilter, setDetailSubFilter] = useState('');
    const [detailPage, setDetailPage] = useState(1);
    const [detailSortCol, setDetailSortCol] = useState<string>('dateOfService');
    const [detailSortDir, setDetailSortDir] = useState<'asc' | 'desc'>('desc');

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

    // --- Firebase Date-Range Fetch for Analytics (profit mode only) ---
    const fetchAnalyticsJobs = useCallback(async () => {
        if (reportMode !== 'profit') return;

        // Derive the year range to fetch (always full year for trend chart)
        let fetchStart: string;
        let fetchEnd: string;

        if (filterType === 'year') {
            fetchStart = `${filterYear}-01-01`;
            fetchEnd = `${filterYear}-12-31\u{F8FF}`;
        } else if (filterType === 'month') {
            const y = filterMonth.split('-')[0];
            fetchStart = `${y}-01-01`;
            fetchEnd = `${y}-12-31\u{F8FF}`;
        } else if (filterType === 'day') {
            const y = filterDay.split('-')[0];
            fetchStart = `${y}-01-01`;
            fetchEnd = `${y}-12-31\u{F8FF}`;
        } else {
            // custom: fetch exact range
            fetchStart = filterCustom.start;
            fetchEnd = filterCustom.end + '\u{F8FF}';
        }

        setIsLoadingAnalytics(true);
        try {
            const q = query(
                ref(db, 'jobs'),
                orderByChild('dateOfService'),
                startAt(fetchStart),
                endAt(fetchEnd)
            );
            const snapshot = await get(q);
            const data = snapshot.val();
            setAnalyticsJobs(data ? (Object.values(data) as Job[]) : []);
        } catch (err) {
            console.error('Analytics fetch error:', err);
            setAnalyticsJobs([]);
        } finally {
            setIsLoadingAnalytics(false);
        }
    }, [reportMode, filterType, filterYear, filterMonth, filterDay, filterCustom]);

    useEffect(() => {
        fetchAnalyticsJobs();
    }, [fetchAnalyticsJobs]);

    // --- Aggregation Logic ---
    const validJobs = useMemo(() => {
        return analyticsJobs.filter(j => {
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
            const jobDateStr = (j.dateOfService || '').split('T')[0];

            let matchesTime = false;
            switch (filterType) {
                case 'day': matchesTime = jobDateStr === filterDay; break;
                case 'month': matchesTime = jobDateStr.startsWith(filterMonth); break;
                case 'year': matchesTime = jobDateStr.startsWith(String(filterYear)); break;
                case 'custom': matchesTime = jobDateStr >= filterCustom.start && jobDateStr <= filterCustom.end; break;
                default: matchesTime = true;
            }

            if (!matchesTime) return false;
            if (statusFilter !== 'ALL' && j.status !== statusFilter) return false;

            return true;
        });
    }, [analyticsJobs, filterType, filterDay, filterMonth, filterYear, filterCustom, statusFilter, searchQuery, selectedSub, selectedRoute]);

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

        analyticsJobs.forEach(j => {
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
            const dateStr = (j.dateOfService || '').split('T')[0];
            const jobYear = parseInt(dateStr.split('-')[0]);
            const mIdx = parseInt(dateStr.split('-')[1]) - 1;
            if (jobYear === currentYear && mIdx >= 0 && mIdx <= 11) {
                const cost = (j.cost || 0);
                monthlyRecords[mIdx].cost += cost;
                monthlyRecords[mIdx].loadCount += 1;
            }
        });
        return monthlyRecords.map(r => ({
            ...r,
            avgCost: r.loadCount > 0 ? r.cost / r.loadCount : 0
        }));
    }, [analyticsJobs, filterType, filterYear, filterMonth, selectedSub, selectedRoute]);

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

    // --- Detail Table Logic ---
    const DETAIL_PAGE_SIZE = 50;

    // Reset page when filter/search/sort changes
    useEffect(() => { setDetailPage(1); }, [detailSearch, detailSubFilter, detailSortCol, detailSortDir, filterType, filterYear, filterMonth, filterDay, filterCustom, statusFilter]);

    const detailSubList = useMemo(() => {
        const names = new Set<string>();
        validJobs.forEach(j => { if (j.subcontractor) names.add(j.subcontractor.trim()); });
        return Array.from(names).sort();
    }, [validJobs]);

    const detailTableJobs = useMemo(() => {
        let list = [...validJobs];
        if (detailSubFilter) list = list.filter(j => (j.subcontractor || '').trim() === detailSubFilter);
        if (detailSearch) {
            const s = detailSearch.toLowerCase();
            list = list.filter(j =>
                j.id.toLowerCase().includes(s) ||
                (j.subcontractor || '').toLowerCase().includes(s) ||
                j.origin.toLowerCase().includes(s) ||
                j.destination.toLowerCase().includes(s) ||
                (j.driverName || '').toLowerCase().includes(s) ||
                (j.licensePlate || '').toLowerCase().includes(s)
            );
        }
        list.sort((a, b) => {
            let va: any, vb: any;
            if (detailSortCol === 'cost') { va = a.cost || 0; vb = b.cost || 0; }
            else if (detailSortCol === 'totalCost') {
                const eA = (a.extraCharges || []).filter(e => e.status === 'APPROVED').reduce((s, e) => s + (e.amount || 0), 0);
                const eB = (b.extraCharges || []).filter(e => e.status === 'APPROVED').reduce((s, e) => s + (e.amount || 0), 0);
                va = (a.cost || 0) + eA; vb = (b.cost || 0) + eB;
            } else if (detailSortCol === 'subcontractor') { va = a.subcontractor || ''; vb = b.subcontractor || ''; }
            else if (detailSortCol === 'status') { va = a.status; vb = b.status; }
            else { va = a.dateOfService || ''; vb = b.dateOfService || ''; }
            if (va < vb) return detailSortDir === 'asc' ? -1 : 1;
            if (va > vb) return detailSortDir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [validJobs, detailSubFilter, detailSearch, detailSortCol, detailSortDir]);

    const detailPageJobs = useMemo(() => {
        const start = (detailPage - 1) * DETAIL_PAGE_SIZE;
        return detailTableJobs.slice(start, start + DETAIL_PAGE_SIZE);
    }, [detailTableJobs, detailPage]);

    const detailTotalPages = Math.ceil(detailTableJobs.length / DETAIL_PAGE_SIZE);

    const handleDetailExportExcel = () => {
        const rows = detailTableJobs.map(job => {
            const extraTotal = (job.extraCharges || []).filter(e => e.status === 'APPROVED').reduce((s, e) => s + (e.amount || 0), 0);
            const base: Record<string, any> = {
                'Job ID': job.id,
                'วันที่ให้บริการ': (job.dateOfService || '').split('T')[0],
                'สถานะงาน': JOB_STATUS_LABELS[job.status],
                'ต้นทาง': job.origin,
                'ปลายทาง': job.destination,
                'บริษัทรถร่วม': job.subcontractor || '-',
                'คนขับ': job.driverName || '-',
                'เบอร์โทรคนขับ': job.driverPhone || '-',
                'ทะเบียนรถ': job.licensePlate || '-',
                'ประเภทรถ': job.truckType || '-',
                'รายละเอียดสินค้า': job.productDetail || '-',
                'น้ำหนัก/ปริมาณ': job.weightVolume || '-',
                'วันที่เสร็จงาน': (job.actualArrivalTime || '').split('T')[0] || '-',
                'ระยะทาง (km)': job.mileage || '-',
                'หมายเหตุ': job.remark || '-',
            };
            if (canViewBilling) {
                base['ต้นทุนพื้นฐาน (Base Cost)'] = job.cost || 0;
                base['ค่าใช้จ่ายพิเศษ (Extra)'] = extraTotal;
                base['ต้นทุนรวม (Total Cost)'] = (job.cost || 0) + extraTotal;
                base['ธนาคาร'] = job.bankName || '-';
                base['ชื่อบัญชี'] = job.bankAccountName || '-';
                base['เลขที่บัญชี'] = job.bankAccountNo || '-';
                base['เลขผู้เสียภาษี (Tax ID)'] = job.taxId || '-';
                base['หมายเหตุบัญชี'] = job.accountingRemark || '-';
            }
            return base;
        });
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Job Details');
        XLSX.writeFile(wb, `Job_Details_${new Date().getTime()}.xlsx`);
    };

    const handleDetailSort = (col: string) => {
        if (detailSortCol === col) setDetailSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setDetailSortCol(col); setDetailSortDir('desc'); }
    };

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
                    {/* Loading Indicator */}
                    {isLoadingAnalytics && (
                        <div className="flex items-center justify-center gap-3 py-6 bg-blue-50 rounded-2xl border border-blue-100">
                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs font-black text-blue-700 uppercase tracking-widest">กำลังโหลดข้อมูลจาก Firebase...</span>
                        </div>
                    )}
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

                    {/* ===== JOB DETAIL TABLE ===== */}
                    <div className="bg-white rounded-[3rem] shadow-sm border border-slate-100 overflow-hidden">
                        {/* Header */}
                        <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/30">
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-slate-800 rounded-xl text-white"><Table2 size={18} /></div>
                                        <div>
                                            <h4 className="text-xl font-black text-slate-900 tracking-tighter">Job Transaction Detail</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                                                {detailTableJobs.length} รายการ {detailSubFilter ? `• ${detailSubFilter}` : ''}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={handleDetailExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black transition-all">
                                            <FileDown size={14} />EXPORT
                                        </button>
                                        <button onClick={() => setShowDetailTable(v => !v)} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[11px] font-black transition-all">
                                            {showDetailTable ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                            {showDetailTable ? 'ซ่อน' : 'แสดง'}
                                        </button>
                                    </div>
                                </div>
                                {/* Filters Row */}
                                {showDetailTable && (
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        {/* Sub Filter */}
                                        <select
                                            value={detailSubFilter}
                                            onChange={e => setDetailSubFilter(e.target.value)}
                                            title="กรองตามบริษัทรถร่วม"
                                            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:ring-4 focus:ring-blue-100 outline-none cursor-pointer"
                                        >
                                            <option value="">บริษัทรถร่วมทั้งหมด</option>
                                            {detailSubList.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                        {/* Search */}
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                            <input
                                                type="text"
                                                placeholder="ค้นหา Job ID, ทะเบียน, คนขับ, ต้นทาง..."
                                                value={detailSearch}
                                                onChange={e => setDetailSearch(e.target.value)}
                                                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-4 focus:ring-blue-100 outline-none"
                                            />
                                        </div>
                                        {(detailSubFilter || detailSearch) && (
                                            <button onClick={() => { setDetailSubFilter(''); setDetailSearch(''); }} className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-500 hover:text-red-600 transition-colors">
                                                <XCircle size={13} />ล้าง
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Table */}
                        {showDetailTable && (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left min-w-max">
                                        <thead>
                                            <tr className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                                {[
                                                    { label: 'Job ID', col: 'id' },
                                                    { label: 'วันที่ให้บริการ', col: 'dateOfService' },
                                                    { label: 'สถานะ', col: 'status' },
                                                ].map(h => (
                                                    <th key={h.col} onClick={() => handleDetailSort(h.col)} className="px-5 py-4 cursor-pointer select-none hover:text-slate-700 whitespace-nowrap">
                                                        <span className="flex items-center gap-1">{h.label}
                                                            {detailSortCol === h.col ? (detailSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={10} className="opacity-30" />}
                                                        </span>
                                                    </th>
                                                ))}
                                                <th className="px-5 py-4 whitespace-nowrap">ต้นทาง / ปลายทาง</th>
                                                <th onClick={() => handleDetailSort('subcontractor')} className="px-5 py-4 cursor-pointer select-none hover:text-slate-700 whitespace-nowrap">
                                                    <span className="flex items-center gap-1">บริษัทรถร่วม / คนขับ
                                                        {detailSortCol === 'subcontractor' ? (detailSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={10} className="opacity-30" />}
                                                    </span>
                                                </th>
                                                <th className="px-5 py-4 whitespace-nowrap">ทะเบียน / ประเภท</th>
                                                <th className="px-5 py-4 whitespace-nowrap">สินค้า / น้ำหนัก</th>
                                                <th className="px-5 py-4 whitespace-nowrap">วันเสร็จ / ระยะทาง</th>
                                                <th className="px-5 py-4 whitespace-nowrap">หมายเหตุ</th>
                                                {canViewBilling && (
                                                    <>
                                                        <th onClick={() => handleDetailSort('cost')} className="px-5 py-4 cursor-pointer select-none hover:text-amber-700 whitespace-nowrap bg-amber-50 text-amber-600">
                                                            <span className="flex items-center gap-1">ต้นทุน (฿)
                                                                {detailSortCol === 'cost' ? (detailSortDir === 'asc' ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : <ChevronsUpDown size={10} className="opacity-30" />}
                                                            </span>
                                                        </th>
                                                        <th className="px-5 py-4 whitespace-nowrap bg-amber-50 text-amber-600">ข้อมูลธนาคาร</th>
                                                        <th className="px-5 py-4 whitespace-nowrap bg-amber-50 text-amber-600">Tax ID / หมายเหตุบัญชี</th>
                                                    </>
                                                )}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-50 text-sm">
                                            {detailPageJobs.length > 0 ? detailPageJobs.map(job => {
                                                const extraTotal = (job.extraCharges || []).filter(e => e.status === 'APPROVED').reduce((s, e) => s + (e.amount || 0), 0);
                                                const totalCost = (job.cost || 0) + extraTotal;
                                                return (
                                                    <tr key={job.id} className="hover:bg-blue-50/20 transition-colors">
                                                        <td className="px-5 py-3 font-mono font-bold text-blue-600 text-xs whitespace-nowrap">#{job.id}</td>
                                                        <td className="px-5 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">{(job.dateOfService || '').split('T')[0]}</td>
                                                        <td className="px-5 py-3 whitespace-nowrap">
                                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : job.status === JobStatus.ASSIGNED ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                                {JOB_STATUS_LABELS[job.status]}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <div className="text-[11px] font-bold min-w-[130px]">
                                                                <div className="flex items-center gap-1 text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />{job.origin}</div>
                                                                <div className="flex items-center gap-1 text-slate-400 mt-0.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />{job.destination}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <div className="text-xs min-w-[120px]">
                                                                <div className="font-black text-slate-700">{job.subcontractor || '-'}</div>
                                                                {job.driverName && <div className="flex items-center gap-1 text-slate-500 font-bold mt-0.5"><span className="text-[10px]">{job.driverName}</span></div>}
                                                                {job.driverPhone && <div className="flex items-center gap-1 text-slate-400 font-bold mt-0.5"><Phone size={9} /><span className="text-[10px]">{job.driverPhone}</span></div>}
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <div className="text-xs whitespace-nowrap">
                                                                <div className="font-black text-slate-700">{job.licensePlate || '-'}</div>
                                                                <div className="font-bold text-slate-400">{job.truckType}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <div className="text-[11px] min-w-[100px]">
                                                                <div className="flex items-center gap-1 font-bold text-slate-700"><Package size={9} className="text-slate-400 shrink-0" />{job.productDetail || '-'}</div>
                                                                <div className="font-bold text-slate-400 mt-0.5">{job.weightVolume || '-'}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3">
                                                            <div className="text-xs whitespace-nowrap">
                                                                <div className="font-bold text-slate-700">{(job.actualArrivalTime || '').split('T')[0] || '-'}</div>
                                                                <div className="font-bold text-slate-400">{job.mileage ? `${job.mileage} km` : '-'}</div>
                                                            </div>
                                                        </td>
                                                        <td className="px-5 py-3 max-w-[120px]">
                                                            <div className="text-[11px] text-slate-500 truncate" title={job.remark || '-'}>{job.remark || '-'}</div>
                                                        </td>
                                                        {canViewBilling && (
                                                            <>
                                                                <td className="px-5 py-3 bg-amber-50/30 whitespace-nowrap">
                                                                    <div className="text-xs">
                                                                        <div className="font-bold text-slate-500">Base: ฿{(job.cost || 0).toLocaleString()}</div>
                                                                        {extraTotal > 0 && <div className="font-bold text-orange-600">Extra: ฿{extraTotal.toLocaleString()}</div>}
                                                                        <div className="font-black text-slate-800 border-t border-slate-200 mt-0.5 pt-0.5">฿{totalCost.toLocaleString()}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3 bg-amber-50/30">
                                                                    <div className="text-[11px] min-w-[120px]">
                                                                        <div className="font-bold text-slate-600">{job.bankName || '-'}</div>
                                                                        <div className="font-bold text-slate-500">{job.bankAccountName || '-'}</div>
                                                                        <div className="font-bold text-slate-400">{job.bankAccountNo || '-'}</div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-5 py-3 bg-amber-50/30">
                                                                    <div className="text-[11px]">
                                                                        <div className="font-bold text-slate-500">{job.taxId || '-'}</div>
                                                                        <div className="text-slate-400 truncate max-w-[120px]" title={job.accountingRemark || '-'}>{job.accountingRemark || '-'}</div>
                                                                    </div>
                                                                </td>
                                                            </>
                                                        )}
                                                    </tr>
                                                );
                                            }) : (
                                                <tr><td colSpan={canViewBilling ? 12 : 9} className="px-6 py-10 text-center text-slate-400 font-bold text-sm">ไม่พบข้อมูล</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {/* Pagination */}
                                {detailTotalPages > 1 && (
                                    <div className="flex items-center justify-between px-8 py-4 border-t border-slate-100 bg-slate-50/30">
                                        <span className="text-xs text-slate-500 font-bold">
                                            แสดง {((detailPage - 1) * DETAIL_PAGE_SIZE) + 1}–{Math.min(detailPage * DETAIL_PAGE_SIZE, detailTableJobs.length)} จาก {detailTableJobs.length} รายการ
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <button onClick={() => setDetailPage(p => Math.max(1, p - 1))} disabled={detailPage === 1} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-black transition-all">← ก่อนหน้า</button>
                                            <div className="flex gap-1">
                                                {Array.from({ length: Math.min(detailTotalPages, 7) }, (_, i) => {
                                                    const pg = detailTotalPages <= 7 ? i + 1 : detailPage <= 4 ? i + 1 : detailPage + i - 3;
                                                    if (pg < 1 || pg > detailTotalPages) return null;
                                                    return (
                                                        <button key={pg} onClick={() => setDetailPage(pg)} className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${detailPage === pg ? 'bg-slate-800 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'}`}>{pg}</button>
                                                    );
                                                })}
                                            </div>
                                            <button onClick={() => setDetailPage(p => Math.min(detailTotalPages, p + 1))} disabled={detailPage === detailTotalPages} className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-xs font-black transition-all">ถัดไป →</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
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
