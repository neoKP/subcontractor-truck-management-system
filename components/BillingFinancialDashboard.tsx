
import React, { useMemo } from 'react';
import { Job, JobStatus, AccountingStatus } from '../types';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
    ShieldCheck, FileText, CreditCard, CheckCircle2,
    TrendingUp, AlertCircle, Clock, Wallet, ArrowRight
} from 'lucide-react';
import { formatThaiCurrency, roundHalfUp } from '../utils/format';

interface BillingFinancialDashboardProps {
    jobs: Job[];
    onStageSelect: (stage: 'VERIFICATION' | 'TO_BILL' | 'TO_PAY' | 'PAID') => void;
    activeStage: string;
}

const BillingFinancialDashboard: React.FC<BillingFinancialDashboardProps> = ({
    jobs, onStageSelect, activeStage
}) => {

    // --- Data Aggregation ---
    const stats = useMemo(() => {
        const defaultStats = {
            VERIFICATION: { count: 0, amount: 0, color: '#64748b', icon: ShieldCheck, label: 'Verification (รอตรวจสอบ)' },
            TO_BILL: { count: 0, amount: 0, color: '#4f46e5', icon: FileText, label: 'To Bill (พร้อมวางบิล)' },
            TO_PAY: { count: 0, amount: 0, color: '#f59e0b', icon: CreditCard, label: 'To Pay (รอจ่ายเงิน)' },
            PAID: { count: 0, amount: 0, color: '#10b981', icon: CheckCircle2, label: 'Paid (จ่ายแล้ว)' }
        };

        jobs.forEach(j => {
            if (j.status === JobStatus.CANCELLED) return;
            const amount = (j.cost || 0) + (j.extraCharge || 0);

            // VERIFICATION
            if (j.status === JobStatus.COMPLETED && (j.accountingStatus === AccountingStatus.PENDING_REVIEW || !j.accountingStatus || j.accountingStatus === AccountingStatus.REJECTED)) {
                defaultStats.VERIFICATION.count++;
                defaultStats.VERIFICATION.amount = roundHalfUp(defaultStats.VERIFICATION.amount + amount);
            }
            // TO BILL
            else if (j.status === JobStatus.COMPLETED && j.accountingStatus === AccountingStatus.APPROVED) {
                defaultStats.TO_BILL.count++;
                defaultStats.TO_BILL.amount = roundHalfUp(defaultStats.TO_BILL.amount + amount);
            }
            // TO PAY
            else if (j.status === JobStatus.BILLED && j.accountingStatus !== AccountingStatus.PAID && j.accountingStatus !== AccountingStatus.LOCKED) {
                defaultStats.TO_PAY.count++;
                defaultStats.TO_PAY.amount = roundHalfUp(defaultStats.TO_PAY.amount + amount);
            }
            // PAID
            else if (j.accountingStatus === AccountingStatus.PAID || j.accountingStatus === AccountingStatus.LOCKED) {
                defaultStats.PAID.count++;
                defaultStats.PAID.amount = roundHalfUp(defaultStats.PAID.amount + amount);
            }
        });

        return defaultStats;
    }, [jobs]);

    // Subcontractor Pending Breakdown (Top 5)
    const subBreakdown = useMemo(() => {
        const map: Record<string, number> = {};
        jobs.forEach(j => {
            if (j.status === JobStatus.CANCELLED) return;
            const isExposure = (j.status === JobStatus.COMPLETED && j.accountingStatus === AccountingStatus.APPROVED) ||
                (j.status === JobStatus.BILLED && j.accountingStatus !== AccountingStatus.PAID && j.accountingStatus !== AccountingStatus.LOCKED);

            if (isExposure && j.subcontractor) {
                map[j.subcontractor] = (map[j.subcontractor] || 0) + (j.cost || 0) + (j.extraCharge || 0);
            }
        });

        return Object.entries(map)
            .map(([name, value]) => ({ name, value: roundHalfUp(value) }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
    }, [jobs]);

    // Status Distribution for Legend
    const legendData = [
        { name: 'Verification (รอตรวจ)', color: 'bg-slate-500' },
        { name: 'To Bill (พร้อมวางบิล)', color: 'bg-indigo-600' },
        { name: 'To Pay (รอจ่าย)', color: 'bg-amber-500' },
        { name: 'Paid (จ่ายแล้ว)', color: 'bg-emerald-500' },
    ];

    return (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 sm:gap-6 animate-in fade-in slide-in-from-top-4 duration-700">

            {/* Left Column: Stage Funnel Metrics */}
            <div className="xl:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                {(Object.entries(stats) as [keyof typeof stats, any][]).map(([key, data]) => {
                    const Icon = data.icon;
                    const isActive = activeStage === key;

                    return (
                        <button
                            key={key}
                            onClick={() => onStageSelect(key)}
                            className={`relative overflow-hidden group p-4 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border transition-all duration-300 text-left ${isActive
                                ? 'bg-slate-900 border-slate-900 ring-4 ring-slate-100 shadow-2xl scale-[1.02] z-10'
                                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-xl'
                                }`}
                        >
                            {/* Decorative Background Icon */}
                            <div className={`absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform ${isActive ? 'text-white' : 'text-slate-200'}`}>
                                <Icon size={120} />
                            </div>

                            <div className="relative z-10">
                                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-4 transition-colors ${isActive ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-900'
                                    }`}>
                                    <Icon size={20} />
                                </div>

                                <h4 className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] mb-1 ${isActive ? 'text-slate-400' : 'text-slate-400'}`}>
                                    {data.label}
                                </h4>

                                <div className="flex items-baseline gap-2">
                                    <span className={`text-2xl font-black tracking-tight ${isActive ? 'text-white' : 'text-slate-900'}`}>
                                        ฿{formatThaiCurrency(data.amount)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2 mt-3">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-500 font-mono'
                                        }`}>
                                        {data.count} ใบงาน (Jobs)
                                    </span>
                                    {isActive && (
                                        <div className="ml-auto w-6 h-6 rounded-full bg-white flex items-center justify-center text-slate-900 animate-pulse">
                                            <ArrowRight size={14} />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </button>
                    );
                })}

                {/* Financial Health Summary Chart */}
                <div className="col-span-2 md:col-span-4 bg-white rounded-2xl sm:rounded-[3rem] border border-slate-100 p-4 sm:p-8 shadow-sm group hover:shadow-xl transition-all h-auto sm:h-[300px]">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 sm:mb-6 gap-2">
                        <div>
                            <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider sm:tracking-widest flex items-center gap-2">
                                <TrendingUp size={16} className="text-emerald-500 shrink-0" />
                                <span>Financial Workflow</span>
                            </h3>
                            <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">สถานะกระแสเงินสดแบบเรียลไทม์</p>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                            {legendData.map(d => (
                                <div key={d.name} className="flex items-center gap-1 sm:gap-2">
                                    <div className={`w-2 h-2 rounded-full ${d.color}`}></div>
                                    <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase">{d.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="w-full h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[
                                { name: 'Verification', amount: stats.VERIFICATION.amount },
                                { name: 'To Bill', amount: stats.TO_BILL.amount },
                                { name: 'To Pay', amount: stats.TO_PAY.amount },
                                { name: 'Paid', amount: stats.PAID.amount },
                            ]}>
                                <defs>
                                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
                                    dy={10}
                                />
                                <Tooltip
                                    content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                            return (
                                                <div className="bg-slate-900 p-3 rounded-2xl shadow-2xl border border-white/10 ring-1 ring-white/10">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{payload[0].payload.name}</p>
                                                    <p className="text-sm font-black text-white">฿{formatThaiCurrency(Number(payload[0].value))}</p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="amount"
                                    stroke="#4f46e5"
                                    strokeWidth={4}
                                    fillOpacity={1}
                                    fill="url(#colorAmount)"
                                    animationDuration={2000}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Right Column: Key Constraints */}
            <div className="flex flex-col gap-4 sm:gap-6">
                {/* Top Exposure Card */}
                <div className="bg-white rounded-2xl sm:rounded-[3rem] border border-slate-100 p-4 sm:p-8 shadow-sm flex flex-col h-full group hover:shadow-xl transition-all">
                    <div className="mb-3 sm:mb-4">
                        <h3 className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wider sm:tracking-widest flex items-center gap-2">
                            <Wallet size={16} className="text-amber-500 shrink-0" />
                            Outstanding Exposure (หนี้ค้างจ่าย)
                        </h3>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase mt-1 tracking-tighter">ยอดค้างจ่ายรวมตามผู้รับเหมา</p>
                    </div>

                    <div className="flex-1 space-y-4 py-4">
                        {subBreakdown.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-4">
                                <AlertCircle size={32} className="text-slate-100 mb-2" />
                                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No outstanding payable (ไม่มีหนี้ค้างจ่าย)</p>
                            </div>
                        ) : (
                            subBreakdown.map((sub, idx) => {
                                const maxVal = subBreakdown[0].value;
                                const width = (sub.value / maxVal) * 100;
                                return (
                                    <div key={sub.name} className="space-y-1.5">
                                        <div className="flex justify-between items-center text-[10px] font-black">
                                            <span className="text-slate-500 uppercase truncate max-w-[120px]">{sub.name}</span>
                                            <span className="text-slate-900">฿{formatThaiCurrency(sub.value)}</span>
                                        </div>
                                        <div className="h-2 w-full flex items-center">
                                            <progress
                                                className={`sub-exposure-progress ${idx === 1 ? 'progress-indigo-500' : idx > 1 ? 'progress-indigo-400' : ''}`}
                                                value={width}
                                                max={100}
                                                title={`${sub.name}: ${width.toFixed(1)}%`}
                                            ></progress>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div className="mt-4 p-4 bg-slate-50 rounded-2xl border border-dotted border-slate-200">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock size={12} className="text-slate-400" />
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Next Settlement Cycle (รอบจ่ายถัดไป)</span>
                        </div>
                        <p className="text-xs font-black text-slate-700 tracking-tight">
                            Every Friday Audit Session (รอบตรวจสอบทุกวันศุกร์)
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
};

export default BillingFinancialDashboard;
