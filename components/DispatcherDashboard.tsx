import React, { useState, useMemo } from 'react';
import { Job, JobStatus, UserRole, AccountingStatus, AuditLog, PriceMatrix } from '../types';
import { Search, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, User, MapPin, Truck, Calendar, Edit, UserPlus, CheckSquare, FileText, Trash2, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, formatThaiCurrency } from '../utils/format';
import DispatcherActionModal from './DispatcherActionModal';
import ConfirmationModal from './ConfirmationModal';
import Swal from 'sweetalert2';

interface DispatcherDashboardProps {
    jobs: Job[];
    onUpdateJob: (job: Job, logs?: AuditLog[]) => void;
    onDeleteJob: (jobId: string) => void;
    user: { id: string; name: string; role: UserRole };
    priceMatrix?: PriceMatrix[];
    logs?: AuditLog[];
    logsLoaded?: boolean;
}

const DispatcherDashboard: React.FC<DispatcherDashboardProps> = ({
    jobs,
    onUpdateJob,
    onDeleteJob,
    user,
    priceMatrix = [],
    logs = [],
    logsLoaded = false
}) => {
    // Date Range State
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(firstDay);
    const [endDate, setEndDate] = useState(lastDay);

    const [searchTerm, setSearchTerm] = useState('');
    const [filterView, setFilterView] = useState<'all' | 'pending' | 'assigned' | 'completed' | 'rejected'>('all');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showActionModal, setShowActionModal] = useState(false);
    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [selectedJobForCompletion, setSelectedJobForCompletion] = useState<Job | null>(null);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 20;

    const hidePrice = [UserRole.BOOKING_OFFICER, UserRole.FIELD_OFFICER].includes(user.role);

    // Categorize jobs
    const categorizedJobs = useMemo(() => {
        const pending = jobs.filter(job =>
            job.status === JobStatus.NEW_REQUEST ||
            job.status === JobStatus.PENDING_PRICING
        );
        const assigned = jobs.filter(job =>
            job.status === JobStatus.ASSIGNED &&
            job.accountingStatus !== AccountingStatus.REJECTED
        );
        const rejected = jobs.filter(job =>
            job.accountingStatus === AccountingStatus.REJECTED
        );
        const completed = jobs.filter(job =>
            job.status === JobStatus.COMPLETED ||
            job.status === JobStatus.BILLED
        );

        return { pending, assigned, rejected, completed };
    }, [jobs]);

    // Filter jobs
    const filteredJobs = useMemo(() => {
        let jobsToFilter = [...jobs];

        // 1. Filter by Date Range (dateOfService)
        if (startDate || endDate) {
            jobsToFilter = jobsToFilter.filter(job => {
                const serviceDate = job.dateOfService.split('T')[0];
                if (startDate && serviceDate < startDate) return false;
                if (endDate && serviceDate > endDate) return false;
                return true;
            });
        }

        // 2. Apply Category Filter
        if (filterView === 'pending') {
            jobsToFilter = jobsToFilter.filter(j => j.status === JobStatus.NEW_REQUEST || j.status === JobStatus.PENDING_PRICING);
        } else if (filterView === 'assigned') {
            jobsToFilter = jobsToFilter.filter(j => j.status === JobStatus.ASSIGNED && j.accountingStatus !== AccountingStatus.REJECTED);
        } else if (filterView === 'rejected') {
            jobsToFilter = jobsToFilter.filter(j => j.accountingStatus === AccountingStatus.REJECTED);
        } else if (filterView === 'completed') {
            jobsToFilter = jobsToFilter.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED);
        }

        // 3. Apply Search Filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            jobsToFilter = jobsToFilter.filter(job =>
                job.id.toLowerCase().includes(term) ||
                (job.requestedByName || '').toLowerCase().includes(term) ||
                (job.subcontractor || '').toLowerCase().includes(term) ||
                (job.driverName || '').toLowerCase().includes(term) ||
                (job.licensePlate || '').toLowerCase().includes(term) ||
                job.origin.toLowerCase().includes(term) ||
                job.destination.toLowerCase().includes(term)
            );
        }

        // 4. Sort
        return jobsToFilter.sort((a, b) => {
            const aRejected = a.accountingStatus === AccountingStatus.REJECTED;
            const bRejected = b.accountingStatus === AccountingStatus.REJECTED;
            if (aRejected && !bRejected) return -1;
            if (!aRejected && bRejected) return 1;

            const statusOrder = {
                [JobStatus.NEW_REQUEST]: 1,
                [JobStatus.PENDING_PRICING]: 1,
                [JobStatus.ASSIGNED]: 2,
                [JobStatus.COMPLETED]: 3,
                [JobStatus.BILLED]: 4,
                [JobStatus.CANCELLED]: 99
            };

            const aOrder = statusOrder[a.status] || 99;
            const bOrder = statusOrder[b.status] || 99;

            if (aOrder !== bOrder) return aOrder - bOrder;

            return new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime();
        });
    }, [jobs, searchTerm, filterView, startDate, endDate]);

    // Paginated Jobs
    const paginatedJobs = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredJobs.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredJobs, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);

    // Reset to page 1 when filters change
    useMemo(() => {
        setCurrentPage(1);
    }, [searchTerm, filterView, startDate, endDate]);

    // Statistics
    const stats = {
        total: jobs.length,
        pending: categorizedJobs.pending.length,
        assigned: categorizedJobs.assigned.length,
        rejected: categorizedJobs.rejected.length,
        completed: categorizedJobs.completed.length,
        totalValue: jobs.reduce((sum, job) => sum + (job.cost || 0), 0)
    };

    const handleEditJob = (job: Job) => {
        setSelectedJob(job);
        setShowActionModal(true);
    };

    const handleDeleteJob = async (job: Job) => {
        const result = await Swal.fire({
            title: 'ยืนยันการลบข้อมูล?',
            html: `คุณกำลังจะลบงาน <b class="text-rose-600">#${job.id}</b><br/>ข้อมูลที่ลบแล้วไม่สามารถกู้คืนได้!`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#e11d48',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'ใช่, ลบเลย!',
            cancelButtonText: 'ยกเลิก',
            customClass: {
                popup: 'rounded-3xl',
                confirmButton: 'rounded-xl font-bold px-8 py-3',
                cancelButton: 'rounded-xl font-bold px-8 py-3'
            }
        });

        if (result.isConfirmed) {
            onDeleteJob(job.id);
            await Swal.fire({
                title: 'ลบสำเร็จ!',
                text: 'ข้อมูลงานถูกนำออกจากระบบแล้ว',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                customClass: {
                    popup: 'rounded-3xl'
                }
            });
        }
    };

    const handleQuickComplete = async (job: Job) => {
        // ตรวจสอบข้อมูลที่จำเป็น
        const missingFields: string[] = [];

        if (!job.subcontractor) missingFields.push('🏢 Subcontractor');
        if (!job.driverName) missingFields.push('👤 ชื่อพนักงานขับรถ');
        if (!job.licensePlate) missingFields.push('🚗 ทะเบียนรถ');
        if (!job.driverPhone) missingFields.push('📱 เบอร์โทรศัพท์');

        // ถ้าข้อมูลไม่ครบ แสดง SweetAlert2
        if (missingFields.length > 0) {
            await Swal.fire({
                icon: 'warning',
                title: '⚠️ ข้อมูลไม่ครบถ้วน',
                html: `
                    <div style="text-align: left; padding: 20px;">
                        <p style="font-size: 16px; font-weight: bold; color: #d97706; margin-bottom: 15px;">
                            📋 กรุณากรอกข้อมูลต่อไปนี้ก่อนยืนยันปิดงาน:
                        </p>
                        <ul style="list-style: none; padding: 0; margin: 0;">
                            ${missingFields.map(field => `
                                <li style="
                                    padding: 12px 16px;
                                    margin: 8px 0;
                                    background: #fef3c7;
                                    border-left: 4px solid #f59e0b;
                                    border-radius: 8px;
                                    font-size: 15px;
                                    font-weight: 600;
                                    color: #92400e;
                                ">
                                    ❌ ${field}
                                </li>
                            `).join('')}
                        </ul>
                        <div style="margin-top: 20px; padding: 15px; background: #dbeafe; border-radius: 8px; border-left: 4px solid #3b82f6;">
                            <p style="margin: 0; font-size: 14px; color: #1e40af; font-weight: 600;">
                                💡 คลิกปุ่ม "แก้ไข" เพื่อเพิ่มข้อมูลที่ขาดหายไป
                            </p>
                        </div>
                    </div>
                `,
                confirmButtonText: '🔧 แก้ไขข้อมูล',
                confirmButtonColor: '#3b82f6',
                showCancelButton: true,
                cancelButtonText: 'ปิด',
                cancelButtonColor: '#6b7280',
                width: '600px'
            }).then((result) => {
                if (result.isConfirmed) {
                    handleEditJob(job);
                }
            });
            return;
        }

        // ถ้าข้อมูลครบ แสดง confirmation
        const result = await Swal.fire({
            icon: 'question',
            title: '✅ ยืนยันการปิดงาน',
            html: `
                <div style="text-align: left; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
                        <p style="margin: 0; font-size: 18px; font-weight: bold;">📦 Job ID: ${job.id}</p>
                        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">📅 ${formatDate(job.dateOfService)}</p>
                    </div>
                    
                    <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; border-left: 4px solid #10b981; margin-bottom: 15px;">
                        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #065f46;">✅ ข้อมูลครบถ้วน:</p>
                        <ul style="margin: 0; padding-left: 20px; color: #047857;">
                            <li>🏢 Subcontractor: <strong>${job.subcontractor}</strong></li>
                            <li>👤 พนักงานขับรถ: <strong>${job.driverName}</strong></li>
                            <li>🚗 ทะเบียน: <strong>${job.licensePlate}</strong></li>
                            <li>📱 เบอร์โทร: <strong>${job.driverPhone}</strong></li>
                        </ul>
                    </div>
                    <p style="text-align: center; font-size: 15px; color: #374151; font-weight: 600; margin: 20px 0 0 0;">🚀 ยืนยันปิดงาน?</p>
                </div>
            `,
            confirmButtonText: '✅ ยืนยันปิดงาน',
            confirmButtonColor: '#10b981',
            showCancelButton: true,
            cancelButtonText: 'ยกเลิก',
            cancelButtonColor: '#6b7280',
            width: '600px'
        });

        if (result.isConfirmed) {
            setSelectedJobForCompletion(job);
            setShowCompletionModal(true);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-600 rounded-xl text-white">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-800">
                            DISPATCHER DASHBOARD {user.role === UserRole.ACCOUNTANT && <span className="text-sm font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full ml-2">VIEW ONLY</span>}
                        </h2>
                        <p className="text-slate-500 font-medium text-sm mt-1">
                            {user.role === UserRole.ACCOUNTANT ? 'เรียกดูและติดตามงานทั้งหมดในระบบ' : 'จัดการและติดตามงานทั้งหมด'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Statistics Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                        <TrendingUp size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Total</p>
                        <p className="text-xl font-black text-slate-800">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-sm flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg shrink-0">
                        <Clock size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-amber-400 uppercase">Pending</p>
                        <p className="text-xl font-black text-amber-600">{stats.pending}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-sm flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg shrink-0">
                        <Truck size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-blue-400 uppercase">Assigned</p>
                        <p className="text-xl font-black text-blue-600">{stats.assigned}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-red-200 shadow-sm flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-red-50 text-red-600 rounded-lg shrink-0">
                        <XCircle size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-red-400 uppercase">Rejected</p>
                        <p className="text-xl font-black text-red-600">{stats.rejected}</p>
                    </div>
                </div>

                <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                        <CheckCircle size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">Completed</p>
                        <p className="text-xl font-black text-emerald-600">{stats.completed}</p>
                    </div>
                </div>

                {!hidePrice && (
                    <div className="bg-white p-3 rounded-xl border border-purple-200 shadow-sm flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-lg shrink-0">
                            <TrendingUp size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-bold text-purple-400 uppercase">Value</p>
                            <p className="text-sm font-black text-purple-600 truncate" title={`฿${formatThaiCurrency(stats.totalValue)}`}>
                                ฿{formatThaiCurrency(stats.totalValue)}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex flex-col gap-4">
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="ค้นหา (Job ID, ผู้ขอใช้รถ, Subcontractor, คนขับ, เส้นทาง)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-blue-100 focus:border-blue-400 outline-none transition-all"
                        />
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-2">Status:</p>
                            <button
                                onClick={() => setFilterView('all')}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${filterView === 'all' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                ทั้งหมด ({filteredJobs.length})
                            </button>
                            <button
                                onClick={() => setFilterView('pending')}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${filterView === 'pending' ? 'bg-amber-500 text-white shadow-lg shadow-amber-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                ⏳ รอดำเนินการ
                            </button>
                            <button
                                onClick={() => setFilterView('assigned')}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${filterView === 'assigned' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                🚛 กำลังวิ่ง
                            </button>
                            <button
                                onClick={() => setFilterView('rejected')}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${filterView === 'rejected' ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                🔴 Reject
                            </button>
                            <button
                                onClick={() => setFilterView('completed')}
                                className={`px-4 py-2 rounded-xl font-bold text-xs transition-all ${filterView === 'completed' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'}`}
                            >
                                ✅ เสร็จสิ้น
                            </button>
                        </div>

                        <div className="flex items-center gap-3">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mr-2">Service Date:</p>
                            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    title="วันที่เริ่มต้น"
                                    className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
                                />
                                <span className="text-slate-300">|</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    title="วันที่สิ้นสุด"
                                    className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer"
                                />
                            </div>
                            <button
                                onClick={() => { setStartDate(''); setEndDate(''); }}
                                className="p-2 text-slate-400 hover:text-rose-500 transition-colors"
                                title="Clear Dates"
                            >
                                <XCircle size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Jobs List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between">
                        <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">
                            {filterView === 'pending' && '⏳ งานรอดำเนินการ'}
                            {filterView === 'assigned' && '🚛 งานกำลังดำเนินการ'}
                            {filterView === 'rejected' && '🔴 งานที่ถูก Reject'}
                            {filterView === 'completed' && '✅ งานที่เสร็จสิ้น'}
                            {filterView === 'all' && 'รายการงานทั้งหมด'}
                        </h3>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">
                            {filteredJobs.length} รายการ
                        </span>
                    </div>
                </div>

                <div className="divide-y divide-slate-100">
                    {paginatedJobs.length > 0 ? (
                        paginatedJobs.map((job) => {
                            const isRejected = job.accountingStatus === AccountingStatus.REJECTED;
                            const isPending = job.status === JobStatus.NEW_REQUEST || job.status === JobStatus.PENDING_PRICING;
                            const isAssigned = job.status === JobStatus.ASSIGNED && !isRejected;
                            const isCompleted = job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED;

                            return (
                                <div
                                    key={job.id}
                                    className={`p-4 md:p-6 transition-colors ${isRejected ? 'bg-rose-50/30 border-l-4 border-rose-500' : isPending ? 'bg-amber-50/30 border-l-4 border-amber-500' : isCompleted ? 'bg-emerald-50/30 border-l-4 border-emerald-500' : 'hover:bg-blue-50/30 border-l-4 border-blue-500'}`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                                        <div className="flex-1 space-y-4">
                                            {/* ID & Status */}
                                            <div className="flex items-center justify-between lg:justify-start gap-3">
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm md:text-base font-black font-mono text-blue-600">#{job.id}</span>
                                                    <span className={`px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase tracking-widest ${isRejected ? 'bg-rose-100 text-rose-700' : isPending ? 'bg-amber-100 text-amber-700' : isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {isRejected ? '🔴 Rejected' : isPending ? '⏳ Pending' : isCompleted ? '✅ Completed' : '🚛 Assigned'}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] md:text-xs text-slate-400 font-bold flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded">
                                                    <Calendar size={12} />
                                                    {formatDate(job.dateOfService)}
                                                </div>
                                            </div>

                                            {/* Reason */}
                                            {isRejected && (
                                                <div className="bg-rose-100/50 border border-rose-200 rounded-xl p-3 md:p-4">
                                                    <p className="text-[10px] font-black text-rose-900 mb-1 uppercase tracking-wider">เหตุผลที่ตีกลับ:</p>
                                                    <p className="text-xs font-bold text-rose-800">{job.accountingRemark || 'ไม่ระบุเหตุผล'}</p>
                                                </div>
                                            )}

                                            {/* Details */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">Route</p>
                                                    <p className="text-xs font-bold text-slate-700 truncate">From: {job.origin}</p>
                                                    <p className="text-xs font-bold text-slate-700 truncate">To: {job.destination}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">Subcontractor</p>
                                                    <p className="text-xs font-black text-slate-800">{job.subcontractor || '-'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{job.truckType}</p>
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">Driver</p>
                                                    <p className="text-xs font-black text-slate-800">{job.driverName || '-'}</p>
                                                    <p className="text-[10px] font-bold text-slate-400">{job.licensePlate || '-'}</p>
                                                </div>
                                                {!hidePrice && (
                                                    <div className="space-y-1">
                                                        <p className="text-[10px] font-black text-slate-400 uppercase">Financials</p>
                                                        <p className="text-base font-black text-blue-600">฿{formatThaiCurrency(job.cost || 0)}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-row lg:flex-col gap-2 w-full lg:w-48 pt-4 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                                            {user.role === UserRole.ACCOUNTANT ? (
                                                <button onClick={() => handleEditJob(job)} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"><FileText size={16} /> View Details</button>
                                            ) : (
                                                <>
                                                    <div className="flex flex-row lg:flex-col gap-2 flex-1">
                                                        <button onClick={() => handleEditJob(job)} className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"><Edit size={16} /> Edit</button>
                                                        {isAssigned && job.driverName && job.licensePlate && (
                                                            <button onClick={() => handleQuickComplete(job)} className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md transition-all active:scale-95"><CheckSquare size={16} /> Complete</button>
                                                        )}
                                                    </div>
                                                    {user.role === UserRole.ADMIN && (
                                                        <button onClick={() => handleDeleteJob(job)} className="flex items-center justify-center gap-2 px-4 py-2 text-rose-600 border border-rose-100 hover:bg-rose-50 rounded-xl font-bold text-[10px] transition-all"><Trash2 size={14} /> Delete Job</button>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-12 text-center">
                            <AlertCircle size={32} className="text-slate-300 mx-auto mb-3" />
                            <p className="font-bold text-slate-400">{searchTerm ? 'ไม่พบงานที่ตรงกับการค้นหา' : 'ไม่มีงานในหมวดนี้'}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                    <p className="text-xs font-bold text-slate-400">หน้า {currentPage} จาก {totalPages}</p>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border border-slate-200 disabled:opacity-30" title="หน้าก่อนหน้า (Previous Page)"><ChevronLeft size={18} /></button>
                        <div className="flex items-center gap-1">
                            {[...Array(totalPages)].map((_, i) => (
                                <button key={i + 1} onClick={() => setCurrentPage(i + 1)} className={`w-10 h-10 rounded-lg text-xs font-black ${currentPage === i + 1 ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`} title={`หน้า ${i + 1}`}>{i + 1}</button>
                            ))}
                        </div>
                        <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border border-slate-200 disabled:opacity-30" title="หน้าถัดไป (Next Page)"><ChevronRight size={18} /></button>
                    </div>
                </div>
            )}

            {/* Modals */}
            {showActionModal && selectedJob && (
                <DispatcherActionModal
                    job={selectedJob}
                    user={user}
                    priceMatrix={priceMatrix}
                    logs={logs}
                    logsLoaded={logsLoaded}
                    onClose={() => { setShowActionModal(false); setSelectedJob(null); }}
                    onSave={(updatedJob) => { onUpdateJob(updatedJob); setShowActionModal(false); setSelectedJob(null); }}
                />
            )}
            {showCompletionModal && selectedJobForCompletion && (
                <ConfirmationModal
                    job={selectedJobForCompletion}
                    onClose={() => { setShowCompletionModal(false); setSelectedJobForCompletion(null); }}
                    onConfirm={(job, newLogs) => { onUpdateJob(job, newLogs); setShowCompletionModal(false); setSelectedJobForCompletion(null); }}
                    currentUser={user}
                />
            )}
        </div>
    );
};

export default DispatcherDashboard;
