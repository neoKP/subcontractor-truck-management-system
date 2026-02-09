
import React from 'react';
import { Job, JobStatus, UserRole, PriceMatrix } from '../types';
import { X, Search, AlertCircle, MapPin, Truck, ExternalLink, ShieldAlert } from 'lucide-react';

interface PendingPricingModalProps {
    jobs: Job[];
    priceMatrix: PriceMatrix[];
    isOpen: boolean;
    onClose: () => void;
    onAction: (job: Job) => void;
    userRole: UserRole;
}

const PendingPricingModal: React.FC<PendingPricingModalProps> = ({
    jobs,
    priceMatrix,
    isOpen,
    onClose,
    onAction,
    userRole
}) => {
    if (!isOpen) return null;

    const pendingJobs = jobs.filter(j => j.status === JobStatus.PENDING_PRICING);
    const canManage = [UserRole.ADMIN, UserRole.ACCOUNTANT].includes(userRole);

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white w-full max-w-5xl max-h-[95vh] sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="px-8 py-6 bg-slate-900 flex items-center justify-between text-white">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500 rounded-2xl shadow-lg shadow-yellow-500/20">
                            <ShieldAlert size={24} className="text-slate-900" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black uppercase tracking-tight">รายการรอตรวจสอบราคา (Pending Pricing Queue)</h2>
                            <p className="text-[10px] font-bold text-yellow-400 uppercase tracking-widest leading-none">
                                {pendingJobs.length} Items requiring master price update
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
                    {pendingJobs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                            <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                                <AlertCircle size={48} className="opacity-20" />
                            </div>
                            <p className="font-black uppercase tracking-widest text-sm">No Pending Items</p>
                            <p className="text-xs font-bold mt-1">Everything is priced and ready for operations.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-200">
                                        <th className="px-6 py-4">Job Info</th>
                                        <th className="px-6 py-4">Route Details</th>
                                        <th className="px-6 py-4">Truck Type</th>
                                        <th className="px-6 py-4 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {pendingJobs.map(job => (
                                        <tr key={job.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-5">
                                                <span className="text-xs font-black text-blue-600 font-mono">#{job.id}</span>
                                                <div className="text-[10px] font-bold text-slate-400 mt-1">
                                                    Ref: {job.id.split('-')[1] || '-'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                        <div className="w-px h-3 bg-slate-200"></div>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                                    </div>
                                                    <div className="text-xs font-bold text-slate-700">
                                                        <div>{job.origin}</div>
                                                        <div className="mt-1">{job.destination}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className="flex items-center gap-2">
                                                    <Truck size={14} className="text-slate-400" />
                                                    <span className="text-xs font-black text-slate-800 uppercase">{job.truckType}</span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-bold mt-1">{job.productDetail || '-'}</div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                {canManage ? (
                                                    <button
                                                        onClick={() => onAction(job)}
                                                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2 mx-auto"
                                                    >
                                                        Add Price <ExternalLink size={12} />
                                                    </button>
                                                ) : (
                                                    <span className="text-[9px] font-black text-rose-500 uppercase bg-rose-50 px-3 py-1.5 rounded-lg border border-rose-100">
                                                        Waiting Admin
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-white border-t border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-slate-400">
                        <AlertCircle size={16} />
                        <p className="text-[10px] font-bold uppercase tracking-wide">
                            * ข้อมูลเหล่านี้จะไม่สามารถจัดรถได้ จนกว่าจะมีการตั้งราคากลางใน Master Table
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
                    >
                        ปิดหน้าต่างนี้ (Close)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PendingPricingModal;
