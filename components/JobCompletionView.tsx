
import React, { useState, useMemo } from 'react';
import { Job, JobStatus, UserRole, AuditLog } from '../types';
import { CheckCircle, Search, Calendar, Truck, User, MapPin, Clock, AlertCircle, TrendingUp } from 'lucide-react';
import { formatDate } from '../utils/format';
import ConfirmationModal from './ConfirmationModal';

interface JobCompletionViewProps {
    jobs: Job[];
    user: { id: string; name: string; role: UserRole };
    onUpdateJob: (job: Job, logs?: AuditLog[]) => void;
}

const JobCompletionView: React.FC<JobCompletionViewProps> = ({ jobs, user, onUpdateJob }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);

    // Filter jobs that are ready for completion
    const pendingJobs = useMemo(() => {
        return jobs.filter(job => {
            // Only show ASSIGNED jobs (removed actualArrivalDate requirement)
            if (job.status !== JobStatus.ASSIGNED) return false;

            // Search filter
            if (searchTerm) {
                const term = searchTerm.toLowerCase();
                return (
                    job.id.toLowerCase().includes(term) ||
                    (job.licensePlate || '').toLowerCase().includes(term) ||
                    (job.driverName || '').toLowerCase().includes(term) ||
                    job.origin.toLowerCase().includes(term) ||
                    job.destination.toLowerCase().includes(term)
                );
            }

            return true;
        }).sort((a, b) => {
            // Sort by Actual Arrival Date (oldest first), then by dateOfService
            if (a.actualArrivalDate && b.actualArrivalDate) {
                const dateA = new Date(a.actualArrivalDate).getTime();
                const dateB = new Date(b.actualArrivalDate).getTime();
                if (dateA !== dateB) return dateA - dateB;
            }
            // If one has arrival date and other doesn't, prioritize the one with arrival date
            if (a.actualArrivalDate && !b.actualArrivalDate) return -1;
            if (!a.actualArrivalDate && b.actualArrivalDate) return 1;

            // Fallback: sort by service date
            const serviceA = new Date(a.dateOfService).getTime();
            const serviceB = new Date(b.dateOfService).getTime();
            return serviceA - serviceB;
        });
    }, [jobs, searchTerm]);

    // Calculate stats for today
    const todayStats = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        const completedToday = jobs.filter(j => {
            if (j.status !== JobStatus.COMPLETED && j.status !== JobStatus.BILLED) return false;
            if (!j.actualArrivalDate) return false;
            const arrivalDate = new Date(j.actualArrivalDate).toISOString().split('T')[0];
            return arrivalDate === today;
        });

        return {
            pending: pendingJobs.length,
            completedToday: completedToday.length,
            total: pendingJobs.length + completedToday.length
        };
    }, [jobs, pendingJobs]);

    const handleConfirm = (job: Job) => {
        setSelectedJob(job);
        setShowConfirmModal(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-600 rounded-xl text-white">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">
                            ยืนยันการจบงาน (Job Completion Confirmation)
                        </h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">
                            รายการงานที่พร้อมยืนยันการเสร็จสิ้น
                        </p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">รอยืนยัน (Pending)</p>
                        <p className="text-2xl font-black text-slate-800">{todayStats.pending}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">ยืนยันแล้ววันนี้ (Completed Today)</p>
                        <p className="text-2xl font-black text-slate-800">{todayStats.completedToday}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">ทั้งหมดวันนี้ (Total Today)</p>
                        <p className="text-2xl font-black text-slate-800">{todayStats.total}</p>
                    </div>
                </div>
            </div>

            {/* Search Box */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="ค้นหา (Job ID, ทะเบียน, คนขับ, เส้นทาง)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all"
                    />
                </div>
            </div>

            {/* Jobs List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">
                            งานที่รอยืนยัน (Pending Confirmation)
                        </h3>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                            {pendingJobs.length} รายการ
                        </span>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {pendingJobs.length > 0 ? (
                        pendingJobs.map((job) => (
                            <div
                                key={job.id}
                                className="p-6 hover:bg-emerald-50/30 transition-colors group"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 space-y-3">
                                        {/* Job ID & Date */}
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm font-black font-mono text-blue-600">#{job.id}</span>
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <Calendar size={12} />
                                                {formatDate(job.dateOfService)}
                                            </span>
                                        </div>

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
                                        {job.actualArrivalDate && (
                                            <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-lg w-fit">
                                                <CheckCircle size={14} className="text-emerald-600" />
                                                <span className="text-xs font-black text-emerald-700">
                                                    ถึงแล้ว: {formatDate(job.actualArrivalDate)}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm Button */}
                                    <button
                                        onClick={() => handleConfirm(job)}
                                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                                    >
                                        <CheckCircle size={18} />
                                        ยืนยันจบงาน
                                    </button>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-slate-50 rounded-full">
                                    <CheckCircle size={32} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-400">
                                    {searchTerm ? 'ไม่พบงานที่ตรงกับการค้นหา' : 'ไม่มีงานที่รอยืนยัน'}
                                </p>
                                {!searchTerm && (
                                    <p className="text-xs text-slate-400">
                                        งานที่พร้อมยืนยันจะแสดงที่นี่
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
