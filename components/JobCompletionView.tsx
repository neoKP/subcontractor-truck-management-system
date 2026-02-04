import React, { useState, useMemo } from 'react';
import { Job, JobStatus, UserRole, AuditLog, AccountingStatus } from '../types';
import { CheckCircle, Search, Calendar, Truck, User, MapPin, Clock, AlertCircle, TrendingUp, XCircle, Edit } from 'lucide-react';
import { formatDate } from '../utils/format';
import ConfirmationModal from './ConfirmationModal';

interface JobCompletionViewProps {
    jobs: Job[];
    user: { id: string; name: string; role: UserRole };
    onUpdateJob: (job: Job, logs?: AuditLog[]) => void;
    hidePrice?: boolean;
}

const JobCompletionView: React.FC<JobCompletionViewProps> = ({ jobs, user, onUpdateJob, hidePrice = false }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [filterView, setFilterView] = useState<'all' | 'rejected' | 'pending' | 'completed'>('all');

    // Categorize jobs
    const categorizedJobs = useMemo(() => {
        const assigned = jobs.filter(job => job.status === JobStatus.ASSIGNED);

        // Rejected jobs (accountingStatus = REJECTED)
        const rejected = assigned.filter(job =>
            job.accountingStatus === AccountingStatus.REJECTED
        );

        // Pending jobs (normal jobs waiting for completion)
        const pending = assigned.filter(job =>
            job.accountingStatus !== AccountingStatus.REJECTED
        );

        // Completed jobs (today)
        const today = new Date().toISOString().split('T')[0];
        const completed = jobs.filter(j => {
            if (j.status !== JobStatus.COMPLETED && j.status !== JobStatus.BILLED) return false;
            if (!j.actualArrivalTime) return false;
            const arrivalDate = new Date(j.actualArrivalTime).toISOString().split('T')[0];
            return arrivalDate === today;
        });

        return { rejected, pending, completed };
    }, [jobs]);

    // Filter by search and view
    const filteredJobs = useMemo(() => {
        let jobsToFilter: Job[] = [];

        if (filterView === 'rejected') {
            jobsToFilter = categorizedJobs.rejected;
        } else if (filterView === 'pending') {
            jobsToFilter = categorizedJobs.pending;
        } else if (filterView === 'completed') {
            jobsToFilter = categorizedJobs.completed;
        } else {
            jobsToFilter = [...categorizedJobs.rejected, ...categorizedJobs.pending];
        }

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            jobsToFilter = jobsToFilter.filter(job =>
                job.id.toLowerCase().includes(term) ||
                (job.licensePlate || '').toLowerCase().includes(term) ||
                (job.driverName || '').toLowerCase().includes(term) ||
                job.origin.toLowerCase().includes(term) ||
                job.destination.toLowerCase().includes(term)
            );
        }

        // Sort: Rejected first, then by arrival date
        return jobsToFilter.sort((a, b) => {
            // Rejected jobs first
            const aRejected = a.accountingStatus === AccountingStatus.REJECTED;
            const bRejected = b.accountingStatus === AccountingStatus.REJECTED;
            if (aRejected && !bRejected) return -1;
            if (!aRejected && bRejected) return 1;

            // Then by arrival date
            if (a.actualArrivalTime && b.actualArrivalTime) {
                return new Date(a.actualArrivalTime).getTime() - new Date(b.actualArrivalTime).getTime();
            }
            if (a.actualArrivalTime && !b.actualArrivalTime) return -1;
            if (!a.actualArrivalTime && b.actualArrivalTime) return 1;

            // Fallback: service date
            const aDate = a.dateOfService ? new Date(a.dateOfService).getTime() : 0;
            const bDate = b.dateOfService ? new Date(b.dateOfService).getTime() : 0;
            return aDate - bDate;
        });
    }, [categorizedJobs, searchTerm, filterView]);

    // Statistics
    const stats = {
        total: categorizedJobs.rejected.length + categorizedJobs.pending.length,
        rejected: categorizedJobs.rejected.length,
        pending: categorizedJobs.pending.length,
        completed: categorizedJobs.completed.length
    };

    const handleConfirm = (job: Job) => {
        setSelectedJob(job);
        setShowConfirmModal(true);
    };

    const handleEditRejected = (job: Job) => {
        const Swal = (window as any).Swal;
        if (!Swal) return;

        Swal.fire({
            title: '🔧 แก้ไขงานที่ถูก Reject',
            html: `
                <div style="text-align: left; padding: 20px;">
                    <!-- Job Info -->
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 16px; margin-bottom: 24px; color: white;">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div style="font-size: 24px;">📋</div>
                            <div>
                                <div style="font-size: 20px; font-weight: 900;">${job.id}</div>
                                <div style="font-size: 12px; opacity: 0.9;">${formatDate(job.dateOfService)}</div>
                            </div>
                        </div>
                        <div style="font-size: 14px; font-weight: 600; opacity: 0.95;">
                            📍 ${job.origin} → ${job.destination}
                        </div>
                    </div>

                    <!-- Rejection Reason -->
                    <div style="background: #fee2e2; border: 2px solid #fca5a5; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
                        <div style="display: flex; align-items: start; gap: 12px;">
                            <div style="font-size: 20px;">❌</div>
                            <div style="flex: 1;">
                                <div style="font-size: 12px; font-weight: 900; color: #991b1b; margin-bottom: 8px; text-transform: uppercase;">เหตุผลที่ปฏิเสธ:</div>
                                <div style="font-size: 14px; font-weight: 700; color: #b91c1c; line-height: 1.6;">
                                    "${job.accountingRemark || 'ไม่ระบุเหตุผล'}"
                                </div>
                                <div style="font-size: 11px; font-weight: 600; color: #dc2626; margin-top: 8px;">
                                    ปฏิเสธโดย: Accountant
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Current Info -->
                    <div style="background: #f1f5f9; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                        <div style="font-size: 12px; font-weight: 900; color: #475569; margin-bottom: 12px; text-transform: uppercase;">ข้อมูลปัจจุบัน:</div>
                        <div style="display: grid; gap: 8px; font-size: 13px;">
                            <div><span style="font-weight: 600; color: #64748b;">👤 ผู้ขอใช้รถ:</span> <span style="font-weight: 700; color: #1e293b;">${job.requestedByName || '-'}</span></div>
                            <div><span style="font-weight: 600; color: #64748b;">🚛 รถ:</span> <span style="font-weight: 700; color: #1e293b;">${job.truckType}</span></div>
                            <div><span style="font-weight: 600; color: #64748b;">🏢 Subcontractor:</span> <span style="font-weight: 700; color: #1e293b;">${job.subcontractor || '-'}</span></div>
                            <div><span style="font-weight: 600; color: #64748b;">👤 คนขับ:</span> <span style="font-weight: 700; color: #1e293b;">${job.driverName || '-'}</span></div>
                            <div><span style="font-weight: 600; color: #64748b;">📞 เบอร์:</span> <span style="font-weight: 700; color: #1e293b;">${job.driverPhone || '-'}</span></div>
                            <div><span style="font-weight: 600; color: #64748b;">🚗 ทะเบียน:</span> <span style="font-weight: 700; color: #1e293b;">${job.licensePlate || '-'}</span></div>
                            ${!hidePrice ? `<div><span style="font-weight: 600; color: #64748b;">💰 ราคา:</span> <span style="font-weight: 700; color: #1e293b;">฿${job.cost?.toLocaleString() || '0'}</span></div>` : ''}
                        </div>
                    </div>

                    <!-- Action Info -->
                    <div style="background: #fef3c7; border: 2px solid #fbbf24; border-radius: 12px; padding: 12px; margin-bottom: 16px;">
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #92400e;">
                            <span>⚠️</span>
                            <span>กรุณาแก้ไขข้อมูลตามเหตุผลที่ปฏิเสธ แล้วกดยืนยันเพื่อส่งกลับไปตรวจสอบใหม่</span>
                        </div>
                    </div>
                </div>
            `,
            width: '600px',
            showCancelButton: true,
            confirmButtonText: '✅ เปิด Job Confirmation เพื่อแก้ไข',
            cancelButtonText: '❌ ยกเลิก',
            confirmButtonColor: '#f97316',
            cancelButtonColor: '#64748b',
            customClass: {
                popup: 'rounded-3xl',
                title: 'text-2xl font-black',
                confirmButton: 'px-6 py-3 rounded-xl font-bold shadow-lg',
                cancelButton: 'px-6 py-3 rounded-xl font-bold'
            },
            didOpen: () => {
                // Add custom styling
                const popup = Swal.getPopup();
                if (popup) {
                    popup.style.borderRadius = '24px';
                }
            }
        }).then((result: any) => {
            if (result.isConfirmed) {
                // Open ConfirmationModal for editing
                setSelectedJob(job);
                setShowConfirmModal(true);
            }
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-600 rounded-xl text-white">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800">
                            ยืนยันการจบงาน (Job Completion)
                        </h2>
                        <p className="text-slate-500 font-medium text-[10px] md:text-sm mt-1">
                            รายการงานที่พร้อมยืนยันการเสร็จสิ้น
                        </p>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                        <p className="text-xl md:text-2xl font-black text-slate-800">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white p-3 md:p-4 rounded-xl border border-red-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-red-50 text-red-600 rounded-lg">
                        <XCircle size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-red-400 uppercase">Rejected</p>
                        <p className="text-xl md:text-2xl font-black text-red-600">{stats.rejected}</p>
                    </div>
                </div>

                <div className="bg-white p-3 md:p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-amber-50 text-amber-600 rounded-lg">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Pending</p>
                        <p className="text-xl md:text-2xl font-black text-amber-600">{stats.pending}</p>
                    </div>
                </div>

                <div className="bg-white p-3 md:p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Finished</p>
                        <p className="text-xl md:text-2xl font-black text-emerald-600">{stats.completed}</p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-4 md:p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="ค้นหา (Job ID, ทะเบียน, คนขับ)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                        />
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">แสดง:</p>
                        <button
                            onClick={() => setFilterView('all')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${filterView === 'all'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ทั้งหมด ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilterView('rejected')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${filterView === 'rejected'
                                ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            🔴 ถูก Reject ({stats.rejected})
                        </button>
                        <button
                            onClick={() => setFilterView('pending')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${filterView === 'pending'
                                ? 'bg-amber-600 text-white shadow-lg shadow-amber-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ⏳ รอยืนยัน ({stats.pending})
                        </button>
                        <button
                            onClick={() => setFilterView('completed')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${filterView === 'completed'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ✅ เสร็จวันนี้ ({stats.completed})
                        </button>
                    </div>
                </div>
            </div>

            {/* Jobs List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">
                            {filterView === 'rejected' && '🔴 งานที่ถูก Reject'}
                            {filterView === 'pending' && '⏳ งานรอยืนยัน'}
                            {filterView === 'completed' && '✅ งานที่เสร็จวันนี้'}
                            {filterView === 'all' && 'รายการงาน'}
                        </h3>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                            {filteredJobs.length} รายการ
                        </span>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {filteredJobs.length > 0 ? (
                        filteredJobs.map((job) => {
                            const isRejected = job.accountingStatus === AccountingStatus.REJECTED;
                            const isCompleted = job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED;

                            return (
                                <div
                                    key={job.id}
                                    className={`p-5 md:p-6 transition-colors border-b border-slate-100 ${isRejected
                                        ? 'bg-red-50/30 hover:bg-red-50/50 border-l-4 border-red-500'
                                        : isCompleted
                                            ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                                            : 'hover:bg-amber-50/30'
                                        }`}
                                >
                                    <div className="flex flex-col md:flex-row items-stretch md:items-start justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            {/* Job ID & Status Badge */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-sm font-black font-mono text-blue-600">#{job.id}</span>
                                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${isRejected
                                                    ? 'bg-red-100 text-red-700'
                                                    : isCompleted
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-amber-100 text-amber-700'
                                                    }`}>
                                                    {isRejected ? '🔴 ถูก Reject' : isCompleted ? '✅ เสร็จแล้ว' : '⏳ รอยืนยัน'}
                                                </span>
                                                <span className="text-xs text-slate-400 flex items-center gap-1">
                                                    <Calendar size={12} />
                                                    {formatDate(job.dateOfService)}
                                                </span>
                                            </div>

                                            {/* Rejection Reason Box */}
                                            {isRejected && (
                                                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
                                                    <div className="flex items-start gap-3">
                                                        <XCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                                                        <div className="flex-1">
                                                            <p className="text-xs font-black text-red-900 mb-2">❌ เหตุผลที่ปฏิเสธ:</p>
                                                            <p className="text-sm font-bold text-red-800 leading-relaxed mb-3">
                                                                "{job.accountingRemark || 'ไม่ระบุเหตุผล'}"
                                                            </p>
                                                            <div className="flex items-center gap-4 text-xs font-bold text-red-700">
                                                                <span>ปฏิเสธโดย: Accountant</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Truck Info */}
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Truck size={14} className="text-slate-400" />
                                                    <span className="text-sm font-bold text-slate-700">{job.truckType}</span>
                                                </div>
                                                <span className="text-xs text-slate-400">|</span>
                                                <span className="text-sm font-bold text-slate-600">
                                                    ทะเบียน: {job.licensePlate || '-'}
                                                </span>
                                            </div>

                                            {/* Route */}
                                            <div className="flex items-center gap-2">
                                                <MapPin size={14} className="text-blue-500" />
                                                <span className="text-xs font-bold text-slate-600">{job.origin}</span>
                                                <span className="text-xs text-slate-400">→</span>
                                                <MapPin size={14} className="text-orange-500" />
                                                <span className="text-xs font-bold text-slate-600">{job.destination}</span>
                                            </div>

                                            {/* Driver */}
                                            {job.driverName && (
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-slate-400" />
                                                    <span className="text-xs font-bold text-slate-600">
                                                        คนขับ: {job.driverName}
                                                        {job.driverPhone && (
                                                            <span className="text-slate-400 ml-1">({job.driverPhone})</span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Requested By */}
                                            {job.requestedByName && (
                                                <div className="flex items-center gap-2">
                                                    <User size={14} className="text-blue-500" />
                                                    <span className="text-xs font-bold text-slate-600">
                                                        ผู้ขอใช้รถ: {job.requestedByName}
                                                    </span>
                                                </div>
                                            )}

                                            {/* Arrival Date */}
                                            {job.actualArrivalTime && !isCompleted && (
                                                <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                                                    <CheckCircle size={14} className="text-emerald-600" />
                                                    <span className="text-xs font-black text-emerald-700">
                                                        ถึงแล้ว: {formatDate(job.actualArrivalTime)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex flex-col gap-2 shrink-0">
                                            {isRejected ? (
                                                <button
                                                    onClick={() => handleEditRejected(job)}
                                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                                                >
                                                    <Edit size={18} />
                                                    แก้ไขและส่งใหม่
                                                </button>
                                            ) : !isCompleted ? (
                                                <button
                                                    onClick={() => handleConfirm(job)}
                                                    className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-4 md:py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-sm shadow-lg shadow-emerald-100 transition-all active:scale-95 whitespace-nowrap"
                                                >
                                                    <CheckCircle size={18} />
                                                    ยืนยันจบงาน
                                                </button>
                                            ) : (
                                                <div className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm">
                                                    <CheckCircle size={18} />
                                                    เสร็จสมบูรณ์
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-slate-50 rounded-full">
                                    <CheckCircle size={32} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-400">
                                    {searchTerm ? 'ไม่พบงานที่ตรงกับการค้นหา' : 'ไม่มีงานในหมวดนี้'}
                                </p>
                                {!searchTerm && (
                                    <p className="text-xs text-slate-400">
                                        ลองเปลี่ยน Filter หรือค้นหางาน
                                    </p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && selectedJob && (
                <ConfirmationModal
                    job={selectedJob}
                    onClose={() => {
                        setShowConfirmModal(false);
                        setSelectedJob(null);
                    }}
                    onConfirm={onUpdateJob}
                    currentUser={user}
                />
            )}
        </div>
    );
};

export default JobCompletionView;
