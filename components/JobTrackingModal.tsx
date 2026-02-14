
import React from 'react';
import { Job, JobStatus, AccountingStatus, UserRole } from '../types';
import {
    FileText, Truck, Receipt, CreditCard, CheckCircle,
    Clock, MapPin, User, Phone, Calendar, X, ExternalLink,
    ShieldCheck, FileCheck, DollarSign, CircleDot, CheckCircle2
} from 'lucide-react';
import { formatDate } from '../utils/format';

interface JobTrackingModalProps {
    job: Job;
    onClose: () => void;
    currentUser?: { role: UserRole };
}

const TimelineStep: React.FC<{
    active: boolean;
    completed: boolean;
    icon: React.ReactNode;
    title: string;
    date?: string;
    children?: React.ReactNode;
    isLast?: boolean;
}> = ({ active, completed, icon, title, date, children, isLast }) => {
    return (
        <div className={`relative pl-8 pb-8 ${isLast ? '' : 'border-l-2'} ${completed ? 'border-emerald-500' : active ? 'border-blue-500' : 'border-slate-200'}`}>
            <div
                className={`absolute -left-[11px] top-0 w-6 h-6 rounded-full flex items-center justify-center border-2 bg-white transition-all duration-500 z-10
          ${completed ? 'border-emerald-500 text-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.3)]' :
                        active ? 'border-blue-500 text-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.5)] scale-110' :
                            'border-slate-300 text-slate-300'}
        `}
            >
                {completed ? <CheckCircle size={14} /> : icon}
            </div>

            <div className={`transition-all duration-500 ${active || completed ? 'opacity-100 translate-x-0' : 'opacity-50 translate-x-2'}`}>
                <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold text-sm ${completed ? 'text-emerald-700' : active ? 'text-blue-700' : 'text-slate-500'}`}>
                        {title}
                    </h3>
                    {date && <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{formatDate(date)}</span>}
                </div>

                <div className="bg-white/50 backdrop-blur-sm border border-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow">
                    {children}
                </div>
            </div>
        </div>
    );
};

const JobTrackingModal: React.FC<JobTrackingModalProps> = ({ job, onClose, currentUser }) => {

    const isCompleted = job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED;
    const isBilled = job.status === JobStatus.BILLED;
    const isPaid = job.accountingStatus === AccountingStatus.PAID;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-50 w-full max-w-lg max-h-[95vh] sm:max-h-[90vh] rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">

                {/* Header with Aero Effect */}
                <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white overflow-hidden">
                    <div className="absolute top-0 right-0 p-32 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 opacity-80 mb-1">
                                <ShieldCheck size={14} />
                                <span className="text-[10px] uppercase tracking-widest font-bold">Secure Job Tracking</span>
                            </div>
                            <h2 className="text-3xl font-black tracking-tight">{job.id}</h2>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="px-2 py-0.5 bg-white/20 rounded-lg text-[10px] font-bold backdrop-blur-md border border-white/10">
                                    {job.subcontractor || 'Assigned Subcontractor'}
                                </span>
                            </div>
                        </div>
                        <button onClick={onClose} title="Close" className="p-2 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md transition-all">
                            <X size={20} />
                        </button>
                    </div>

                    {/* Route Card in Header */}
                    <div className="mt-6 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center justify-between">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-blue-100 uppercase">Origin</span>
                            <span className="font-bold text-sm">{job.origin}</span>
                        </div>
                        <div className="flex-1 border-t-2 border-dashed border-white/30 mx-4 relative">
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 rounded-full p-1">
                                <Truck size={12} />
                            </div>
                        </div>
                        <div className="flex flex-col text-right">
                            <span className="text-[10px] text-blue-100 uppercase">Destination</span>
                            <span className="font-bold text-sm">{job.destination}</span>
                        </div>
                    </div>
                </div>

                {/* Timeline Content */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-hide bg-slate-50">

                    {/* Step 1: Request */}
                    <TimelineStep
                        active={true}
                        completed={true}
                        icon={<FileText size={14} />}
                        title="สร้างคำขอบริการ (Job Request Created)"
                        date={job.createdAt}
                    >
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs uppercase">
                                {job.requestedByName ? job.requestedByName.charAt(0) : 'U'}
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-700">เจ้าหน้าที่ Booking</p>
                                <p className="text-[10px] text-slate-500">{job.requestedByName || 'ไม่ระบุ'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] bg-slate-100 p-2 rounded-lg">
                            <div className="flex flex-col">
                                <span className="text-slate-400">Service Date</span>
                                <span className="font-bold text-slate-700">{formatDate(job.dateOfService)}</span>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-slate-400">Truck Type</span>
                                <span className="font-bold text-slate-700">{job.truckType}</span>
                            </div>
                        </div>
                    </TimelineStep>

                    {/* Step 2: Transportation */}
                    <TimelineStep
                        active={job.status !== JobStatus.PENDING_PRICING && job.status !== JobStatus.NEW_REQUEST}
                        completed={isCompleted || isBilled}
                        icon={<Truck size={14} />}
                        title="ดำเนินการขนส่ง (Transportation)"
                        date={job.dateOfService} // Approximate
                    >
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${isCompleted ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                    {isCompleted ? 'เสร็จสิ้น (Completed)' : 'กำลังดำเนินการ (In Progress)'}
                                </span>
                            </div>

                            {(job.driverName || job.licensePlate) && (
                                <div className="flex items-center gap-3 p-2 bg-slate-100 rounded-lg">
                                    <User size={16} className="text-slate-400" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{job.driverName || 'ยังไม่ได้มอบหมายพนักงานขับรถ'}</p>
                                        <p className="text-[10px] text-slate-500">{job.licensePlate} {job.driverPhone ? `• ${job.driverPhone}` : ''}</p>
                                    </div>
                                </div>
                            )}

                            {/* Drop Checkpoints Timeline */}
                            {job.drops && job.drops.length > 0 && (
                                <div className="mt-4 space-y-4 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
                                    <p className="text-[9px] font-black text-slate-400 mb-2 uppercase tracking-widest pl-1">Checkpoints & Location Proofs</p>
                                    {job.drops.map((drop, idx) => (
                                        <div key={idx} className="relative pl-7 group">
                                            <div className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center transition-all z-10 ${drop.status === 'COMPLETED' ? 'bg-emerald-500 border-emerald-500 text-white shadow-emerald-100' : 'bg-white border-slate-200 text-slate-300'}`}>
                                                {drop.status === 'COMPLETED' ? <CheckCircle2 size={12} /> : <CircleDot size={10} />}
                                            </div>
                                            <div className={`p-3 rounded-xl border transition-all ${drop.status === 'COMPLETED' ? 'bg-emerald-50/30 border-emerald-100' : 'bg-slate-50/30 border-slate-100'}`}>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className={`text-[11px] font-bold ${drop.status === 'COMPLETED' ? 'text-emerald-700' : 'text-slate-600'}`}>{drop.location}</p>
                                                        {drop.completedAt && <p className="text-[8px] text-emerald-500 font-mono mt-0.5">Time: {formatDate(drop.completedAt)}</p>}
                                                    </div>
                                                    {drop.podUrl && (
                                                        <div className="w-10 h-10 rounded-lg overflow-hidden border-2 border-white shadow-sm shrink-0 hover:scale-110 transition-transform cursor-pointer">
                                                            <img src={drop.podUrl} className="w-full h-full object-cover" alt="Point POD" />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Main POD Thumbnail (Final Destination) */}
                            {job.podImageUrls && job.podImageUrls.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-slate-100">
                                    <p className="text-[10px] font-bold text-slate-400 mb-2 uppercase flex items-center gap-2">
                                        <ShieldCheck size={14} className="text-emerald-500" />
                                        จุดส่งสินค้าปลายทาง (Final POD)
                                    </p>
                                    <div className="flex -space-x-2 overflow-hidden">
                                        {job.podImageUrls.map((url, i) => (
                                            <div key={i} className="w-12 h-12 rounded-xl border-2 border-white shadow-md overflow-hidden bg-slate-200">
                                                <img src={url} className="w-full h-full object-cover" alt="Final POD" onError={(e) => {
                                                    e.currentTarget.src = 'https://placehold.co/100?text=DOC';
                                                }} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </TimelineStep>

                    {/* Step 3: Billing */}
                    <TimelineStep
                        active={isCompleted}
                        completed={isBilled || isPaid}
                        icon={<Receipt size={14} />}
                        title="เอกสารวางบิล (Billing Document)"
                        date={job.billingDate}
                    >
                        {job.billingDocNo ? (
                            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">เลขที่ใบวางบิล</span>
                                    <span className="text-xs font-black text-indigo-700 font-mono">{job.billingDocNo}</span>
                                </div>
                                <p className="text-[10px] text-indigo-500">
                                    วันที่วางบิล: {formatDate(job.billingDate)}
                                </p>
                            </div>
                        ) : (
                            <p className="text-[10px] text-slate-400 italic">รอออกเอกสารวางบิล...</p>
                        )}
                    </TimelineStep>

                    {/* Step 4: Payment */}
                    <TimelineStep
                        active={isBilled}
                        completed={isPaid}
                        icon={<CreditCard size={14} />}
                        title="สถานะการจ่ายเงิน (Payment Status)"
                        isLast={true}
                        date={job.paymentDate}
                    >
                        {isPaid ? (
                            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                                    <ShieldCheck size={16} /> จ่ายเงินแล้ว (Paid & Secured)
                                </div>
                                <p className="text-[10px] text-emerald-600">
                                    วันที่จ่ายเงิน: {formatDate(job.paymentDate)}
                                </p>
                                {/* Could show Slip Thumbnail here if wanted */}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-slate-400 text-[10px] italic">
                                <Clock size={12} />
                                <span>รอการตรวจสอบการชำระเงิน...</span>
                            </div>
                        )}
                    </TimelineStep>

                </div>

                {/* Footer Actions */}
                <div className="bg-white border-t border-slate-100 p-4">
                    <button onClick={onClose} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-bold transition-all text-sm">
                        Close Timeline
                    </button>
                </div>

            </div>
        </div>
    );
};

export default JobTrackingModal;
