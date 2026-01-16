import React, { useState, useMemo } from 'react';
import { Job, JobStatus, UserRole, AccountingStatus, AuditLog, PriceMatrix } from '../types';
import { Search, TrendingUp, Clock, CheckCircle, XCircle, AlertCircle, User, MapPin, Truck, Calendar, Edit, UserPlus, CheckSquare, FileText, Trash2 } from 'lucide-react';
import { formatDate, formatThaiCurrency } from '../utils/format';
import DispatcherActionModal from './DispatcherActionModal';
import Swal from 'sweetalert2';

interface DispatcherDashboardProps {
    jobs: Job[];
    onUpdateJob: (job: Job) => void;
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
    const [searchTerm, setSearchTerm] = useState('');
    const [filterView, setFilterView] = useState<'all' | 'pending' | 'assigned' | 'completed' | 'rejected'>('all');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showActionModal, setShowActionModal] = useState(false);

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
        let jobsToFilter: Job[] = [];

        if (filterView === 'pending') {
            jobsToFilter = categorizedJobs.pending;
        } else if (filterView === 'assigned') {
            jobsToFilter = categorizedJobs.assigned;
        } else if (filterView === 'rejected') {
            jobsToFilter = categorizedJobs.rejected;
        } else if (filterView === 'completed') {
            jobsToFilter = categorizedJobs.completed;
        } else {
            jobsToFilter = jobs;
        }

        // Apply search filter
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

        // Sort: Rejected first, then Pending, then Assigned, then Completed
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
    }, [jobs, categorizedJobs, searchTerm, filterView]);

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

        if (!job.subcontractor) {
            missingFields.push('🏢 Subcontractor');
        }
        if (!job.driverName) {
            missingFields.push('👤 ชื่อพนักงานขับรถ');
        }
        if (!job.licensePlate) {
            missingFields.push('🚗 ทะเบียนรถ');
        }
        if (!job.driverPhone) {
            missingFields.push('📱 เบอร์โทรศัพท์');
        }

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
                        <div style="
                            margin-top: 20px;
                            padding: 15px;
                            background: #dbeafe;
                            border-radius: 8px;
                            border-left: 4px solid #3b82f6;
                        ">
                            <p style="
                                margin: 0;
                                font-size: 14px;
                                color: #1e40af;
                                font-weight: 600;
                            ">
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
                width: '600px',
                customClass: {
                    popup: 'swal2-popup-modern',
                    title: 'swal2-title-modern',
                    htmlContainer: 'swal2-html-modern'
                }
            }).then((result) => {
                if (result.isConfirmed) {
                    // เปิด DispatcherActionModal เพื่อแก้ไข
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
                    <div style="
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                        padding: 20px;
                        border-radius: 12px;
                        margin-bottom: 20px;
                    ">
                        <p style="margin: 0; font-size: 18px; font-weight: bold;">
                            📦 Job ID: ${job.id}
                        </p>
                        <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">
                            📅 ${formatDate(job.dateOfService)}
                        </p>
                    </div>
                    
                    <div style="
                        background: #f0fdf4;
                        padding: 15px;
                        border-radius: 8px;
                        border-left: 4px solid #10b981;
                        margin-bottom: 15px;
                    ">
                        <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: bold; color: #065f46;">
                            ✅ ข้อมูลครบถ้วน:
                        </p>
                        <ul style="margin: 0; padding-left: 20px; color: #047857;">
                            <li>🏢 Subcontractor: <strong>${job.subcontractor}</strong></li>
                            <li>👤 พนักงานขับรถ: <strong>${job.driverName}</strong></li>
                            <li>🚗 ทะเบียน: <strong>${job.licensePlate}</strong></li>
                            <li>📱 เบอร์โทร: <strong>${job.driverPhone}</strong></li>
                        </ul>
                    </div>

                    <p style="
                        text-align: center;
                        font-size: 15px;
                        color: #374151;
                        font-weight: 600;
                        margin: 20px 0 0 0;
                    ">
                        🚀 คุณต้องการดำเนินการต่อไปยังขั้นตอนยืนยันการปิดงานหรือไม่?
                    </p>
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
            // TODO: เปิด Job Completion Modal
            alert(`✅ ดำเนินการต่อไปยัง Job Completion Modal\nJob ID: ${job.id}`);
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
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">Total</p>
                        <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-amber-400 uppercase">Pending</p>
                        <p className="text-2xl font-black text-amber-600">{stats.pending}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Truck size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-blue-400 uppercase">Assigned</p>
                        <p className="text-2xl font-black text-blue-600">{stats.assigned}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-red-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-lg">
                        <XCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-red-400 uppercase">Rejected</p>
                        <p className="text-2xl font-black text-red-600">{stats.rejected}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-emerald-400 uppercase">Completed</p>
                        <p className="text-2xl font-black text-emerald-600">{stats.completed}</p>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-purple-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                        <TrendingUp size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-purple-400 uppercase">Value</p>
                        <p className="text-lg font-black text-purple-600">฿{formatThaiCurrency(stats.totalValue)}</p>
                    </div>
                </div>
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
                    <div className="flex items-center gap-3 flex-wrap">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">แสดง:</p>
                        <button
                            onClick={() => setFilterView('all')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'all'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ทั้งหมด ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilterView('pending')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'pending'
                                ? 'bg-amber-600 text-white shadow-lg shadow-amber-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ⏳ รอดำเนินการ ({stats.pending})
                        </button>
                        <button
                            onClick={() => setFilterView('assigned')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'assigned'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            🚛 กำลังดำเนินการ ({stats.assigned})
                        </button>
                        <button
                            onClick={() => setFilterView('rejected')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'rejected'
                                ? 'bg-red-600 text-white shadow-lg shadow-red-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            🔴 ถูก Reject ({stats.rejected})
                        </button>
                        <button
                            onClick={() => setFilterView('completed')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'completed'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ✅ เสร็จสิ้น ({stats.completed})
                        </button>
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
                    {filteredJobs.length > 0 ? (
                        filteredJobs.map((job) => {
                            const isRejected = job.accountingStatus === AccountingStatus.REJECTED;
                            const isPending = job.status === JobStatus.NEW_REQUEST || job.status === JobStatus.PENDING_PRICING;
                            const isAssigned = job.status === JobStatus.ASSIGNED && !isRejected;
                            const isCompleted = job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED;

                            return (
                                <div
                                    key={job.id}
                                    className={`p-6 transition-colors ${isRejected
                                        ? 'bg-red-50/30 hover:bg-red-50/50 border-l-4 border-red-500'
                                        : isPending
                                            ? 'bg-amber-50/30 hover:bg-amber-50/50 border-l-4 border-amber-500'
                                            : isCompleted
                                                ? 'bg-emerald-50/30 hover:bg-emerald-50/50'
                                                : 'hover:bg-blue-50/30'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 space-y-3">
                                            {/* Job ID & Status Badge */}
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <span className="text-sm font-black font-mono text-blue-600">#{job.id}</span>
                                                <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${isRejected
                                                    ? 'bg-red-100 text-red-700'
                                                    : isPending
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : isCompleted
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                    {isRejected ? '🔴 Rejected' : isPending ? '⏳ Pending' : isCompleted ? '✅ Completed' : '🚛 Assigned'}
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
                                                            <p className="text-sm font-bold text-red-800 leading-relaxed">
                                                                "{job.accountingRemark || 'ไม่ระบุเหตุผล'}"
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Requested By */}
                                            {job.requestedByName && (
                                                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 w-fit">
                                                    <User size={14} className="text-purple-500" />
                                                    <span className="text-xs font-black text-purple-700">ผู้ขอใช้รถ:</span>
                                                    <span className="text-xs font-black text-purple-900">{job.requestedByName}</span>
                                                </div>
                                            )}

                                            {/* Job Details Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Route</p>
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                                                        <MapPin size={12} className="text-blue-500" />
                                                        <span>{job.origin}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 mt-1">
                                                        <MapPin size={12} className="text-orange-500" />
                                                        <span>{job.destination}</span>
                                                    </div>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Subcontractor</p>
                                                    <p className={`text-sm font-black ${job.subcontractor ? 'text-slate-800' : 'text-orange-600 italic'}`}>
                                                        {job.subcontractor || '❌ ยังไม่ระบุ'}
                                                    </p>
                                                    <p className="text-xs font-bold text-slate-500 mt-1">{job.truckType}</p>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Driver & Fleet</p>
                                                    <p className={`text-sm font-black ${job.driverName ? 'text-slate-800' : 'text-orange-600 italic'}`}>
                                                        {job.driverName || '❌ ยังไม่ระบุ'}
                                                    </p>
                                                    <p className={`text-xs font-bold ${job.licensePlate ? 'text-slate-500' : 'text-orange-600 italic'} mt-1`}>
                                                        {job.licensePlate || '❌ ยังไม่ระบุ'}
                                                    </p>
                                                </div>

                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase mb-1">Cost</p>
                                                    <p className="text-lg font-black text-blue-600">฿{formatThaiCurrency(job.cost || 0)}</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        {user.role === UserRole.ACCOUNTANT ? (
                                            <div className="flex flex-col gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleEditJob(job)}
                                                    className="flex items-center gap-2 px-6 py-3 bg-slate-600 hover:bg-slate-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                                                >
                                                    <FileText size={18} />
                                                    ดูรายละเอียด
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-2 shrink-0">
                                                <button
                                                    onClick={() => handleEditJob(job)}
                                                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                                                >
                                                    <Edit size={18} />
                                                    แก้ไข
                                                </button>

                                                {isPending && (
                                                    <button
                                                        onClick={() => handleEditJob(job)}
                                                        className="flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                                                    >
                                                        <UserPlus size={18} />
                                                        Assign
                                                    </button>
                                                )}

                                                {isAssigned && job.driverName && job.licensePlate && (
                                                    <button
                                                        onClick={() => handleQuickComplete(job)}
                                                        className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                                                    >
                                                        <CheckSquare size={18} />
                                                        Complete
                                                    </button>
                                                )}

                                                {user.role === UserRole.ADMIN && (
                                                    <button
                                                        onClick={() => handleDeleteJob(job)}
                                                        className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-rose-50 text-rose-600 border-2 border-rose-100 hover:border-rose-200 rounded-xl font-bold text-sm shadow-sm transition-all active:scale-95 whitespace-nowrap mt-2"
                                                    >
                                                        <Trash2 size={18} />
                                                        ลบงาน
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-12 text-center">
                            <div className="flex flex-col items-center gap-3">
                                <div className="p-4 bg-slate-50 rounded-full">
                                    <AlertCircle size={32} className="text-slate-300" />
                                </div>
                                <p className="font-bold text-slate-400">
                                    {searchTerm ? 'ไม่พบงานที่ตรงกับการค้นหา' : 'ไม่มีงานในหมวดนี้'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Action Modal */}
            {showActionModal && selectedJob && (
                <DispatcherActionModal
                    job={selectedJob}
                    user={user}
                    priceMatrix={priceMatrix}
                    logs={logs}
                    logsLoaded={logsLoaded}
                    onClose={() => {
                        setShowActionModal(false);
                        setSelectedJob(null);
                    }}
                    onSave={(updatedJob) => {
                        onUpdateJob(updatedJob);
                        setShowActionModal(false);
                        setSelectedJob(null);
                    }}
                />
            )}
        </div>
    );
};

export default DispatcherDashboard;
