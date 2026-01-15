import React, { useState, useMemo } from 'react';
import { Job, JobStatus, UserRole, AccountingStatus, AuditLog, PriceMatrix } from '../types';
import { AlertCircle, CheckCircle, Clock, FileText, MapPin, Truck, Zap, AlertTriangle, Eye, Calendar, Edit3, X, Trash2, Search, Filter, ChevronDown } from 'lucide-react';
import JobPreviewModal from './JobPreviewModal';
import BookingEditModal from './BookingEditModal';

interface BookingOfficerDashboardProps {
    jobs: Job[];
    user: { id: string; name: string; role: UserRole };
    onShowCreateForm: () => void;
    onUpdateJob?: (job: Job, logs?: AuditLog[]) => void;
    onDeleteJob?: (jobId: string) => void;
    priceMatrix?: PriceMatrix[];
}

const getJobColor = (job: Job) => {
    if (job.accountingStatus === AccountingStatus.REJECTED) return 'border-rose-200 bg-rose-50';
    if (job.status === JobStatus.PENDING_PRICING) return 'border-amber-200 bg-amber-50';
    if (job.status === JobStatus.COMPLETED) return 'border-emerald-200 bg-emerald-50';
    return 'border-blue-200 bg-blue-50';
};

const JobCard: React.FC<{ job: Job; onClick: (job: Job) => void }> = ({ job, onClick }) => (
    <div
        className={`rounded-xl p-4 border-2 transition-all hover:shadow-lg cursor-pointer group ${getJobColor(job)}`}
        onClick={() => onClick(job)}
    >
        {/* Job Header */}
        <div className="flex items-start justify-between mb-2">
            <div className="font-mono font-black text-slate-900 text-sm">#{job.id}</div>
            {/* Status Badges - Styled like reference images */}
            {job.accountingStatus === AccountingStatus.REJECTED && (
                <div className="px-2.5 py-1 bg-rose-100 border border-rose-300 rounded-full">
                    <span className="text-[8px] font-bold text-rose-700 block text-center">ต้องแก้ไข</span>
                    <span className="text-[6px] font-bold text-rose-600 block text-center">(REJECTED)</span>
                </div>
            )}
            {job.status === JobStatus.PENDING_PRICING && job.accountingStatus !== AccountingStatus.REJECTED && (
                <div className="px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-full">
                    <span className="text-[8px] font-bold text-amber-700 block text-center">รอตรวจสอบราคา</span>
                    <span className="text-[6px] font-bold text-amber-600 block text-center">(PENDING PRICING)</span>
                </div>
            )}
            {job.status === JobStatus.NEW_REQUEST && job.accountingStatus !== AccountingStatus.REJECTED && (
                <div className="px-2.5 py-1 bg-rose-100 border border-rose-300 rounded-full">
                    <span className="text-[8px] font-bold text-rose-700 block text-center">ใหม่</span>
                    <span className="text-[6px] font-bold text-rose-600 block text-center">(NEW REQUEST)</span>
                </div>
            )}
            {(job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED) && (
                <div className="px-2.5 py-1 bg-teal-100 border border-teal-300 rounded-full">
                    <span className="text-[8px] font-bold text-teal-700 block text-center">เสร็จสิ้น</span>
                    <span className="text-[6px] font-bold text-teal-600 block text-center">(COMPLETED)</span>
                </div>
            )}
            {job.status === JobStatus.ASSIGNED && (
                <div className="px-2.5 py-1 bg-blue-100 border border-blue-300 rounded-full">
                    <span className="text-[8px] font-bold text-blue-700 block text-center">กำลังวิ่ง</span>
                    <span className="text-[6px] font-bold text-blue-600 block text-center">(ASSIGNED)</span>
                </div>
            )}
        </div>

        {/* Requester Info with Line */}
        <div className="border-t border-slate-200 pt-2 mb-3">
            {job.requestedByName && (
                <div className="text-[9px] font-bold text-indigo-600 mb-1">
                    👤 ผู้ขอใช้รถ: {job.requestedByName}
                </div>
            )}
            <div className="text-[10px] text-slate-500 font-bold">
                📅 วันที่: {new Date(job.dateOfService).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
        </div>

        {/* Route */}
        <div className="space-y-1.5 mb-3">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-xs font-bold text-slate-700 truncate">{job.origin}</span>
            </div>
            <div className="flex items-center gap-2 pl-1">
                <div className="w-0.5 h-3 bg-slate-300"></div>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                <span className="text-xs font-bold text-slate-700 truncate">{job.destination}</span>
            </div>
        </div>

        {/* Details */}
        <div className="flex items-center gap-2 mb-2">
            <Truck size={12} className="text-slate-400" />
            <span className="text-[10px] font-bold text-slate-600">{job.truckType}</span>
        </div>

        {job.subcontractor && (
            <div className="px-2 py-1 bg-white/70 rounded-lg border border-slate-200 mt-2">
                <span className="text-[10px] font-bold text-slate-700">🚛 {job.subcontractor}</span>
            </div>
        )}

        {job.accountingRemark && job.accountingStatus === AccountingStatus.REJECTED && (
            <div className="mt-2 p-2 bg-rose-100 border border-rose-200 rounded-lg shadow-sm">
                <p className="text-[9px] font-bold text-rose-700 italic leading-tight">💬 {job.accountingRemark}</p>
            </div>
        )}

        {/* Hover Effect */}
        <div className="mt-3 opacity-0 group-hover:opacity-100 transition-opacity flex justify-center">
            <div className="flex items-center gap-1 text-[9px] font-black text-blue-600 uppercase bg-white px-3 py-1 rounded-full shadow-sm">
                <Eye size={10} />
                ดูรายละเอียด
            </div>
        </div>
    </div>
);

const BookingOfficerDashboard: React.FC<BookingOfficerDashboardProps> = ({ jobs, user, onShowCreateForm, onUpdateJob, onDeleteJob, priceMatrix = [] }) => {
    const [viewMode, setViewMode] = useState<'mine' | 'all'>('mine');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [editJob, setEditJob] = useState<Job | null>(null);

    // Completed jobs filter states
    const [completedFilter, setCompletedFilter] = useState<'30days' | '60days' | '90days' | 'all'>('30days');
    const [completedSearch, setCompletedSearch] = useState('');
    const [showCompletedDropdown, setShowCompletedDropdown] = useState(false);

    // Filter jobs based on view mode
    const filteredJobs = useMemo(() => {
        if (viewMode === 'mine') {
            return jobs.filter(j => j.requestedBy === user.id);
        }
        return jobs;
    }, [jobs, viewMode, user.id]);

    // Categorize jobs
    const pendingJobs = useMemo(() =>
        filteredJobs.filter(j =>
            j.status === JobStatus.NEW_REQUEST ||
            j.status === JobStatus.PENDING_PRICING
        ),
        [filteredJobs]
    );

    const inProgressJobs = useMemo(() =>
        filteredJobs.filter(j => j.status === JobStatus.ASSIGNED),
        [filteredJobs]
    );

    // Filter completed jobs by date range and search
    const completedJobs = useMemo(() => {
        const now = new Date();
        let daysAgo = 30;
        if (completedFilter === '60days') daysAgo = 60;
        else if (completedFilter === '90days') daysAgo = 90;
        else if (completedFilter === 'all') daysAgo = 9999;

        const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        return filteredJobs
            .filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED)
            .filter(j => {
                if (!j.dateOfService) return true; // Include jobs without date
                const jobDate = new Date(j.dateOfService);
                return jobDate >= cutoffDate;
            })
            .filter(j => {
                if (!completedSearch.trim()) return true;
                const searchLower = completedSearch.toLowerCase();
                return (j.id && j.id.toLowerCase().includes(searchLower)) ||
                    (j.origin && j.origin.toLowerCase().includes(searchLower)) ||
                    (j.destination && j.destination.toLowerCase().includes(searchLower)) ||
                    (j.subcontractor && j.subcontractor.toLowerCase().includes(searchLower));
            });
    }, [filteredJobs, completedFilter, completedSearch]);

    // Get total completed count (for display)
    const totalCompletedCount = useMemo(() =>
        filteredJobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED).length,
        [filteredJobs]
    );

    const rejectedJobs = useMemo(() =>
        filteredJobs.filter(j => j.accountingStatus === AccountingStatus.REJECTED),
        [filteredJobs]
    );

    // Check if job can be edited - ONLY own jobs (for Booking Officer) or ANY job (for Dispatcher)
    const canEditJob = (job: Job) => {
        const isPendingStatus = job.status === JobStatus.NEW_REQUEST || job.status === JobStatus.PENDING_PRICING;
        const isRejected = job.accountingStatus === AccountingStatus.REJECTED;
        const isEditableStatus = isPendingStatus || isRejected;

        const isOwnJob = job.requestedBy === user.id;
        const isDispatcher = user.role === UserRole.DISPATCHER;

        // Dispatcher can edit any job, Booking Officer can only edit own jobs
        return isEditableStatus && (isOwnJob || isDispatcher);
    };

    // Handler for saving edited job
    const handleSaveEditedJob = (updatedJob: Job, logs?: AuditLog[]) => {
        if (!onUpdateJob) return;

        const isRejectedJob = editJob?.accountingStatus === AccountingStatus.REJECTED;

        if (isRejectedJob) {
            const jobToSubmit: Job = {
                ...updatedJob,
                accountingStatus: AccountingStatus.PENDING_REVIEW,
                accountingRemark: undefined
            };

            const resubmitLog: AuditLog = {
                id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                jobId: updatedJob.id,
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                timestamp: new Date().toISOString(),
                field: 'Accounting Status',
                oldValue: 'Rejected',
                newValue: 'Pending Review (Resubmitted)',
                reason: 'Booking Officer corrected and resubmitted for review'
            };

            const allLogs = logs ? [...logs, resubmitLog] : [resubmitLog];
            onUpdateJob(jobToSubmit, allLogs);

            if (typeof (window as any).Swal !== 'undefined') {
                (window as any).Swal.fire({
                    title: 'ส่งแก้ไขสำเร็จ!',
                    text: 'งานถูกส่งกลับไปให้ฝ่ายบัญชีตรวจสอบใหม่แล้ว',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    customClass: { popup: 'rounded-[2rem]' }
                });
            }
        } else {
            onUpdateJob(updatedJob, logs);

            if (typeof (window as any).Swal !== 'undefined') {
                (window as any).Swal.fire({
                    title: 'บันทึกสำเร็จ!',
                    text: 'ข้อมูลงานถูกอัปเดตเรียบร้อยแล้ว',
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false,
                    customClass: { popup: 'rounded-[2rem]' }
                });
            }
        }

        setEditJob(null);
    };

    // Handler for cancelling/deleting a job - ONLY own jobs
    const handleCancelJob = (job: Job) => {
        if (!onDeleteJob) return;

        // Check ownership - can only cancel own jobs (or any job for DISPATCHER)
        const isOwnJob = job.requestedBy === user.id;
        const isDispatcher = user.role === UserRole.DISPATCHER;

        if (!isOwnJob && !isDispatcher) {
            if (typeof (window as any).Swal !== 'undefined') {
                (window as any).Swal.fire({
                    title: 'ไม่สามารถยกเลิกได้',
                    text: 'คุณสามารถยกเลิกได้เฉพาะงานที่คุณสร้างเองเท่านั้น',
                    icon: 'warning',
                    confirmButtonColor: '#2563eb'
                });
            }
            return;
        }

        if (job.status !== JobStatus.NEW_REQUEST && job.status !== JobStatus.PENDING_PRICING) {
            if (typeof (window as any).Swal !== 'undefined') {
                (window as any).Swal.fire({
                    title: 'ไม่สามารถยกเลิกได้',
                    text: 'สามารถยกเลิกได้เฉพาะงานที่ยังไม่ถูกจัดรถเท่านั้น',
                    icon: 'warning',
                    confirmButtonColor: '#2563eb'
                });
            }
            return;
        }

        if (typeof (window as any).Swal !== 'undefined') {
            (window as any).Swal.fire({
                title: 'ยืนยันยกเลิกงาน?',
                html: `<p class="text-sm text-slate-600">คุณต้องการยกเลิกงาน <strong>${job.id}</strong> ใช่หรือไม่?</p>
                       <p class="text-xs text-rose-600 mt-2">⚠️ การยกเลิกจะไม่สามารถย้อนกลับได้</p>`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e11d48',
                cancelButtonColor: '#64748b',
                confirmButtonText: 'ใช่, ยกเลิกงาน',
                cancelButtonText: 'ไม่, กลับไป',
                customClass: { popup: 'rounded-[2rem]' }
            }).then((result: any) => {
                if (result.isConfirmed) {
                    onDeleteJob(job.id);
                    if (typeof (window as any).Swal !== 'undefined') {
                        (window as any).Swal.fire({
                            title: 'ยกเลิกแล้ว!',
                            text: 'งานถูกยกเลิกเรียบร้อยแล้ว',
                            icon: 'success',
                            timer: 1500,
                            showConfirmButton: false,
                            customClass: { popup: 'rounded-[2rem]' }
                        });
                    }
                }
            });
        }
    };

    return (
        <div className="space-y-6">
            {/* Personalized Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-6 text-white shadow-xl">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-black mb-1">สวัสดี {user.name} 👋</h1>
                        <p className="text-sm text-blue-100 font-medium">ระบบจัดการใบขอรถของคุณ</p>
                    </div>
                    <button
                        onClick={onShowCreateForm}
                        className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-black text-sm shadow-lg hover:shadow-xl transition-all hover:scale-105 active:scale-95"
                    >
                        + สร้างใบขอรถใหม่
                    </button>
                </div>
            </div>

            {/* Summary Dashboard */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: 'รอจัดรถ', count: pendingJobs.length, icon: FileText, color: 'amber' },
                    { label: 'กำลังวิ่ง', count: inProgressJobs.length, icon: Clock, color: 'blue' },
                    { label: 'เสร็จสิ้น', count: completedJobs.length, icon: CheckCircle, color: 'emerald' },
                    { label: 'ต้องแก้ไข', count: rejectedJobs.length, icon: AlertCircle, color: 'rose' },
                ].map((item, idx) => (
                    <div key={idx} className={`bg-white rounded-2xl p-5 border-2 border-${item.color}-200 shadow-sm`}>
                        <div className="flex items-center gap-3 mb-2">
                            <div className={`p-2 bg-${item.color}-100 rounded-xl`}>
                                <item.icon className={`text-${item.color}-600`} size={20} />
                            </div>
                            <div className="text-3xl font-black text-slate-900">{item.count}</div>
                        </div>
                        <div className={`text-xs font-black text-${item.color}-600 uppercase tracking-wider`}>{item.label}</div>
                    </div>
                ))}
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
                <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    {[
                        { id: 'mine', label: '👤 งานของฉัน' },
                        { id: 'all', label: '👥 งานทั้งหมด' }
                    ].map((mode) => (
                        <button
                            key={mode.id}
                            onClick={() => setViewMode(mode.id as 'mine' | 'all')}
                            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${viewMode === mode.id
                                ? 'bg-white text-blue-600 shadow-sm border border-blue-100'
                                : 'text-slate-400 hover:text-slate-600'
                                }`}
                        >
                            {mode.label}
                        </button>
                    ))}
                </div>
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                    {filteredJobs.length} รายการ (Found)
                </div>
            </div>

            {/* Alert Section - Rejected Jobs */}
            {rejectedJobs.length > 0 && (
                <div className="bg-rose-50 border-2 border-rose-200 rounded-3xl p-6 shadow-lg">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-500 rounded-xl">
                                <AlertTriangle className="text-white" size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-rose-700 uppercase">🚨 งานที่ต้องแก้ไขเร่งด่วน</h3>
                                <p className="text-[10px] text-rose-600 font-medium">งานถูกตีกลับจากฝ่ายบัญชี กรุณาตรวจสอบและแก้ไขข้อมูล</p>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {rejectedJobs.map(job => (
                            <div key={job.id} className="rounded-xl p-4 border-2 border-rose-300 bg-white shadow-md hover:shadow-lg transition-all">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="font-mono font-black text-slate-900 text-sm">#{job.id}</div>
                                        <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                            {new Date(job.dateOfService).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                                        </div>
                                    </div>
                                    <div className="px-2 py-1 bg-rose-500 text-white text-[8px] font-black rounded-lg uppercase animate-pulse">
                                        ต้องแก้ไข
                                    </div>
                                </div>

                                <div className="space-y-1.5 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                        <span className="text-xs font-bold text-slate-700 truncate">{job.origin}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                        <span className="text-xs font-bold text-slate-700 truncate">{job.destination}</span>
                                    </div>
                                </div>

                                {job.accountingRemark && (
                                    <div className="p-3 bg-rose-100 border border-rose-200 rounded-xl mb-3">
                                        <p className="text-[10px] font-black text-rose-700 uppercase tracking-tight mb-1">💬 เหตุผลที่ถูกตีกลับ:</p>
                                        <p className="text-xs font-bold text-rose-800 leading-tight">{job.accountingRemark}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => setSelectedJob(job)}
                                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
                                    >
                                        <Eye size={12} />
                                        ดู
                                    </button>
                                    {onUpdateJob && (
                                        <button
                                            onClick={() => setEditJob(job)}
                                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 transition-all shadow-lg"
                                        >
                                            <Edit3 size={12} />
                                            แก้ไข
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 3-Column Kanban */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Column 1: Pending */}
                <div className="space-y-4">
                    <div className="bg-amber-100 rounded-2xl p-4 border-2 border-amber-300">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-amber-500 rounded-xl">
                                <FileText className="text-white" size={18} />
                            </div>
                            <h3 className="text-sm font-black text-amber-800 uppercase">📝 รอจัดรถ</h3>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {pendingJobs.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs font-medium italic border-2 border-dashed border-slate-200 rounded-2xl">
                                ไม่มีงานรอดำเนินการ
                            </div>
                        ) : (
                            pendingJobs.map(job => (
                                <div
                                    key={job.id}
                                    className={`rounded-xl p-4 border-2 transition-all hover:shadow-lg bg-white ${job.status === JobStatus.PENDING_PRICING ? 'border-amber-200' : 'border-blue-200'
                                        }`}
                                >
                                    {/* Job Header */}
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="font-mono font-black text-slate-900 text-sm">#{job.id}</div>
                                            <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                                                {new Date(job.dateOfService).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                                            </div>
                                        </div>
                                        {/* Status Badge - Styled like reference images */}
                                        {job.status === JobStatus.PENDING_PRICING ? (
                                            <div className="px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-full">
                                                <span className="text-[9px] font-bold text-amber-700 leading-tight block text-center">รอตรวจสอบราคา</span>
                                                <span className="text-[7px] font-bold text-amber-600 block text-center">(PENDING PRICING)</span>
                                            </div>
                                        ) : (
                                            <div className="px-3 py-1.5 bg-rose-100 border border-rose-300 rounded-full">
                                                <span className="text-[9px] font-bold text-rose-700 leading-tight block text-center">ใหม่</span>
                                                <span className="text-[7px] font-bold text-rose-600 block text-center">(NEW REQUEST)</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Route */}
                                    <div className="space-y-1.5 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                            <span className="text-xs font-bold text-slate-700 truncate">{job.origin}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                            <span className="text-xs font-bold text-slate-700 truncate">{job.destination}</span>
                                        </div>
                                    </div>

                                    {/* Details */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <Truck size={12} className="text-slate-400" />
                                        <span className="text-[10px] font-bold text-slate-600">{job.truckType}</span>
                                    </div>

                                    {/* Driver Info */}
                                    {(job.driverName || job.licensePlate) && (
                                        <div className="px-2 py-1.5 bg-slate-50 rounded-lg border border-slate-100 mt-2">
                                            <div className="text-[9px] text-slate-500 font-bold">
                                                {job.driverName && <span>👤 {job.driverName}</span>}
                                                {job.driverName && job.licensePlate && <span className="mx-1">|</span>}
                                                {job.licensePlate && <span>🚛 {job.licensePlate}</span>}
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    {canEditJob(job) && onUpdateJob && (
                                        <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                                            <button
                                                onClick={() => setSelectedJob(job)}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-all"
                                            >
                                                <Eye size={10} />
                                                ดู
                                            </button>
                                            <button
                                                onClick={() => setEditJob(job)}
                                                className="flex-1 flex items-center justify-center gap-1 py-2 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-blue-700 transition-all"
                                            >
                                                <Edit3 size={10} />
                                                แก้ไข
                                            </button>
                                            {onDeleteJob && (
                                                <button
                                                    onClick={() => handleCancelJob(job)}
                                                    className="flex items-center justify-center gap-1 py-2 px-3 bg-rose-100 text-rose-600 rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-rose-500 hover:text-white transition-all"
                                                    title="ยกเลิกงาน"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Column 2: In Progress */}
                <div className="space-y-4">
                    <div className="bg-blue-100 rounded-2xl p-4 border-2 border-blue-300">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-xl">
                                <Clock className="text-white" size={18} />
                            </div>
                            <h3 className="text-sm font-black text-blue-800 uppercase">⏳ กำลังวิ่ง</h3>
                        </div>
                    </div>
                    <div className="space-y-3 max-h-[600px] overflow-y-auto">
                        {inProgressJobs.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs font-medium italic border-2 border-dashed border-slate-200 rounded-2xl">
                                ไม่มีงานกำลังดำเนินการ
                            </div>
                        ) : (
                            inProgressJobs.map(job => <JobCard key={job.id} job={job} onClick={setSelectedJob} />)
                        )}
                    </div>
                </div>

                {/* Column 3: Completed - Enhanced with Filters */}
                <div className="space-y-4">
                    <div className="bg-emerald-100 rounded-2xl p-4 border-2 border-emerald-300">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-emerald-500 rounded-xl">
                                    <CheckCircle className="text-white" size={18} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-emerald-800 uppercase">✅ เสร็จสิ้น</h3>
                                    <p className="text-[9px] text-emerald-600 font-bold">
                                        แสดง {completedJobs.length} จาก {totalCompletedCount} รายการ
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Filter Dropdown */}
                        <div className="flex gap-2 mb-2">
                            <div className="relative flex-1">
                                <button
                                    onClick={() => setShowCompletedDropdown(!showCompletedDropdown)}
                                    className="w-full flex items-center justify-between px-3 py-2 bg-white border border-emerald-200 rounded-xl text-[10px] font-bold text-emerald-700 hover:bg-emerald-50 transition-all"
                                >
                                    <span className="flex items-center gap-1.5">
                                        <Filter size={12} />
                                        {completedFilter === '30days' && '30 วันล่าสุด'}
                                        {completedFilter === '60days' && '60 วันล่าสุด'}
                                        {completedFilter === '90days' && '90 วันล่าสุด'}
                                        {completedFilter === 'all' && 'ทั้งหมด'}
                                    </span>
                                    <ChevronDown size={12} className={`transition-transform ${showCompletedDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showCompletedDropdown && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-emerald-200 rounded-xl shadow-lg z-20 overflow-hidden">
                                        {[
                                            { id: '30days', label: '30 วันล่าสุด' },
                                            { id: '60days', label: '60 วันล่าสุด' },
                                            { id: '90days', label: '90 วันล่าสุด' },
                                            { id: 'all', label: 'ทั้งหมด' }
                                        ].map(opt => (
                                            <button
                                                key={opt.id}
                                                onClick={() => {
                                                    setCompletedFilter(opt.id as any);
                                                    setShowCompletedDropdown(false);
                                                }}
                                                className={`w-full px-3 py-2 text-left text-[10px] font-bold transition-all ${completedFilter === opt.id
                                                    ? 'bg-emerald-100 text-emerald-700'
                                                    : 'text-slate-600 hover:bg-emerald-50'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Search Box */}
                        <div className="relative">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-400" />
                            <input
                                type="text"
                                placeholder="ค้นหา Job ID, ต้นทาง, ปลายทาง..."
                                value={completedSearch}
                                onChange={(e) => setCompletedSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white border border-emerald-200 rounded-xl text-[10px] font-bold text-slate-700 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-emerald-300"
                            />
                            {completedSearch && (
                                <button
                                    onClick={() => setCompletedSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    title="ล้างการค้นหา"
                                    aria-label="ล้างการค้นหา"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                        {completedJobs.length === 0 ? (
                            <div className="text-center py-12 text-slate-400 text-xs font-medium italic border-2 border-dashed border-slate-200 rounded-2xl">
                                {completedSearch ? `ไม่พบงาน "${completedSearch}"` : 'ยังไม่มีงานเสร็จสิ้นในช่วงเวลานี้'}
                            </div>
                        ) : (
                            completedJobs.map(job => <JobCard key={job.id} job={job} onClick={setSelectedJob} />)
                        )}
                    </div>
                </div>
            </div>

            {/* Job Preview Modal */}
            {selectedJob && (
                <JobPreviewModal
                    job={selectedJob}
                    isOpen={true}
                    onClose={() => setSelectedJob(null)}
                />
            )}

            {/* Edit Modal for Jobs */}
            {editJob && onUpdateJob && (
                <BookingEditModal
                    job={editJob}
                    onClose={() => setEditJob(null)}
                    onSave={handleSaveEditedJob}
                    user={user}
                    priceMatrix={priceMatrix}
                />
            )}
        </div>
    );
};

export default BookingOfficerDashboard;
