import React, { useState, useEffect } from 'react';
import { Job, JobStatus, UserRole } from '../types';
import { Truck, Clock, CheckCircle2, LayoutPanelTop, BarChart3, ArrowRight, User as UserIcon, Lock } from 'lucide-react';

interface HomeViewProps {
    jobs: Job[];
    user: { id: string; name: string; role: UserRole } | null;
    onTabChange: (tab: any) => void;
    onLoginClick: () => void;
    onLogout: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ jobs, user, onTabChange, onLoginClick, onLogout }) => {
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Calculate Statistics
    const stats = {
        total: jobs.length,
        assigned: jobs.filter(j => j.status === JobStatus.ASSIGNED).length,
        completed: jobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED).length,
    };

    const dayFormat = currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    const timeFormat = currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const isGuest = !user;

    // --- Animated Stats Logic ---
    const [animatedStats, setAnimatedStats] = useState({ total: 0, assigned: 0, rate: 0 });

    useEffect(() => {
        if (!isGuest) {
            const duration = 1000;
            const startTime = Date.now();
            const targetRate = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 100;

            const animate = () => {
                const now = Date.now();
                const progress = Math.min((now - startTime) / duration, 1);

                // Ease out expo
                const easedProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

                setAnimatedStats({
                    total: Math.floor(stats.total * easedProgress),
                    assigned: Math.floor(stats.assigned * easedProgress),
                    rate: Math.floor(targetRate * easedProgress)
                });

                if (progress < 1) {
                    requestAnimationFrame(animate);
                }
            };
            requestAnimationFrame(animate);
        }
    }, [user, jobs]);

    return (
        <div className="relative min-h-screen -m-6 overflow-x-hidden bg-slate-900 flex flex-col cursor-pointer-all">
            {/* Cinematic Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <img
                    src="/warehouse_bg.jpg"
                    alt="Modern Warehouse"
                    className="w-full h-full object-cover opacity-40"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black"></div>
            </div>

            {/* Premium Header */}
            <header className="relative z-50 flex items-center justify-between px-6 md:px-10 py-5 border-b border-cyan-500/30 bg-black/40 backdrop-blur-xl shrink-0">
                <div className="flex items-center gap-3">
                    {/* Logo Container */}
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center p-1.5 border border-white/20 shadow-xl overflow-hidden">
                        <img src="/logo.png" alt="NeoSiam Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black tracking-tighter text-white leading-none">
                            Neo<span className="text-cyan-400">Siam</span> Logistics
                        </h2>
                        <p className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">subcontractor-truck-management-system</p>
                    </div>
                </div>

                <nav className="hidden md:flex items-center gap-10">
                    <button className="relative py-2 text-sm font-black text-cyan-400 transition-all">
                        HOME HUB
                        <div className="absolute -bottom-5 left-0 right-0 h-[3px] bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
                    </button>
                    {!isGuest && (
                        <button onClick={() => onTabChange('board')} className="text-sm font-black text-slate-400 hover:text-white transition-all uppercase tracking-widest">
                            Dashboard
                        </button>
                    )}
                </nav>

                <div className="flex items-center gap-4 md:gap-6">
                    <div className="text-right hidden sm:block">
                        <p className="text-[10px] md:text-xs font-black text-slate-200">{dayFormat}</p>
                    </div>
                    <button
                        onClick={isGuest ? onLoginClick : onLogout}
                        className={`flex items-center gap-3 px-3 md:px-4 py-2 rounded-xl border transition-all group/profile ${isGuest
                            ? 'bg-cyan-500/10 border-cyan-500/50 hover:bg-cyan-500/20 hover:scale-105 shadow-[0_0_20px_rgba(34,211,238,0.2)]'
                            : 'bg-white/5 border-white/10 hover:bg-rose-500/10 hover:border-rose-500/50 hover:scale-105'}`}
                    >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden border transition-colors ${isGuest ? 'bg-cyan-500/20 border-cyan-400' : 'bg-slate-700 border-white/20 group-hover/profile:bg-rose-500/20 group-hover/profile:border-rose-500'}`}>
                            {isGuest ? <Lock size={16} className="text-cyan-400" /> : <UserIcon size={16} className="text-slate-300 group-hover/profile:text-rose-400" />}
                        </div>
                        <div className="text-left">
                            <p className="text-[9px] md:text-[10px] font-black text-white leading-none mb-1">{timeFormat}</p>
                            <div className="flex items-center gap-1">
                                <span className={`text-[8px] font-bold transition-colors ${isGuest ? 'text-rose-400' : 'text-cyan-400 group-hover/profile:text-rose-400'}`}>
                                    {isGuest ? 'LOCKED' : '+7'}
                                </span>
                                <span className={`px-1.5 py-0.5 rounded-[4px] text-[7px] font-black uppercase transition-colors ${isGuest ? 'bg-rose-500 text-white' : 'bg-cyan-500 text-black group-hover/profile:bg-rose-500 group-hover/profile:text-white'}`}>
                                    {isGuest ? 'Sign In' : 'Sign Out'}
                                </span>
                            </div>
                        </div>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 md:px-8 py-12 text-center overflow-y-auto">
                <div className="max-w-5xl animate-in fade-in slide-in-from-bottom-8 duration-1000 mb-12">
                    <div className="inline-block px-4 py-1.5 mb-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 backdrop-blur-md">
                        <p className="text-[10px] font-black text-cyan-400 uppercase tracking-[0.4em] flex items-center gap-2">
                            {isGuest ? '🔒 Security Priority Protocol' : `🛡️ Welcome Back, ${user.name.split(' ')[0]}`}
                        </p>
                    </div>
                    <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-white tracking-tighter mb-8 leading-tight select-none font-display">
                        NEOSIAM <br className="md:hidden" />
                        <span className="text-gradient">
                            LOGISTICS & TRANSPORT
                        </span>
                    </h1>
                    <p className="text-base md:text-xl font-medium text-slate-300 max-w-4xl mx-auto leading-relaxed">
                        บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด <span className="text-cyan-400 font-bold">ให้บริการด้านการขนส่ง และ กระจายสินค้า</span><br className="hidden md:block" />
                        ครอบคลุมทุกความต้องการ ทั้งแบบสินค้าพัสดุภัณฑ์ทั่วไป และ แบบสินค้าเหมาคัน
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full max-w-6xl mb-12">
                    <div className="group bg-black/40 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/5 h-48 flex flex-col items-center justify-center transition-all hover:border-cyan-500/30 hover:bg-black/60 hover:-translate-y-1">
                        {isGuest ? (
                            <div className="text-slate-600 flex flex-col items-center opacity-40"><Lock size={32} className="mb-2" /> <p className="text-[10px] font-black uppercase tracking-widest">Jobs Protected</p></div>
                        ) : (
                            <>
                                <div className="w-14 h-14 bg-cyan-500/10 text-cyan-400 rounded-2xl flex items-center justify-center mb-4 border border-cyan-500/20 shadow-[0_0_15px_rgba(6,182,212,0.1)] group-hover:scale-110 transition-transform"><Truck size={28} /></div>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Total Jobs</p>
                                <span className="text-5xl font-black text-white tracking-tighter">{animatedStats.total}</span>
                            </>
                        )}
                    </div>

                    <div className="group bg-black/40 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/5 h-48 flex flex-col items-center justify-center transition-all hover:border-blue-500/30 hover:bg-black/60 hover:-translate-y-1">
                        {isGuest ? (
                            <div className="text-slate-600 flex flex-col items-center opacity-40"><Lock size={32} className="mb-2" /> <p className="text-[10px] font-black uppercase tracking-widest">Movement Protected</p></div>
                        ) : (
                            <>
                                <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mb-4 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)] group-hover:scale-110 transition-transform"><Clock size={28} /></div>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Active Movement</p>
                                <span className="text-5xl font-black text-white tracking-tighter">{animatedStats.assigned}</span>
                            </>
                        )}
                    </div>

                    <div className="group bg-black/40 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/5 h-48 flex flex-col items-center justify-center transition-all hover:border-emerald-500/30 hover:bg-black/60 hover:-translate-y-1">
                        {isGuest ? (
                            <div className="text-slate-600 flex flex-col items-center opacity-40"><Lock size={32} className="mb-2" /> <p className="text-[10px] font-black uppercase tracking-widest">Metrics Protected</p></div>
                        ) : (
                            <>
                                <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)] group-hover:scale-110 transition-transform"><CheckCircle2 size={28} /></div>
                                <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Success Rate</p>
                                <span className="text-5xl font-black text-white tracking-tighter">
                                    {animatedStats.rate}%
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="mb-12">
                    <button
                        onClick={isGuest ? onLoginClick : () => onTabChange('board')}
                        className={`group relative px-12 md:px-16 py-5 md:py-6 rounded-2xl font-black text-white shadow-2xl transition-all active:scale-95 flex items-center gap-4 overflow-hidden ${isGuest
                            ? 'bg-slate-800 hover:bg-slate-700'
                            : 'bg-gradient-to-r from-cyan-600 to-blue-700 hover:shadow-cyan-500/50 hover:-translate-y-1'}`}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                        {isGuest ? <Lock size={24} /> : <LayoutPanelTop size={24} />}
                        <span className="relative z-10 text-lg md:text-xl tracking-tight uppercase">
                            {isGuest ? 'Unlock Full Access' : 'Enter Logistics Hub'}
                        </span>
                        <ArrowRight size={24} className="relative z-10 group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>
            </div>

            <footer className="relative z-50 text-center py-8 shrink-0 select-none opacity-40 bg-black/20">
                <p className="text-[9px] md:text-[10px] font-black text-white uppercase tracking-[0.6em] md:tracking-[0.8em]">
                    NEOSIAM LOGISTICS & TRANSPORT
                </p>
            </footer>
        </div>
    );
};

export default HomeView;
