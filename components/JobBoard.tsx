
import React, { useState } from 'react';
import { Job, JobStatus, UserRole, AuditLog, PriceMatrix, JOB_STATUS_LABELS, ACCOUNTING_STATUS_LABELS } from '../types';
import { Calendar, MapPin, Package, Hash, Lock, CheckCircle, Edit3, Filter, Truck, Printer, LayoutDashboard, Receipt, XCircle, Search, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import DispatcherActionModal from './DispatcherActionModal';
import ConfirmationModal from './ConfirmationModal';
import JobPreviewModal from './JobPreviewModal';
import BookingEditModal from './BookingEditModal';

interface JobBoardProps {
  jobs: Job[];
  user: { id: string; name: string; role: UserRole };
  onUpdateJob: (job: Job, logs?: AuditLog[]) => void;
  onDeleteJob?: (jobId: string) => void;

  priceMatrix: PriceMatrix[];
  logs: AuditLog[];
  logsLoaded: boolean;
}

const JobBoard: React.FC<JobBoardProps> = ({ jobs, user, onUpdateJob, priceMatrix, onDeleteJob, logs, logsLoaded }) => {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showDispatcherModal, setShowDispatcherModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [filter, setFilter] = useState<JobStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>(
    user.role === UserRole.DISPATCHER ? 'kanban' : 'table'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 800);
  };

  const filteredJobs = jobs.filter(j => {
    // Status filter
    if (filter !== 'ALL' && j.status !== filter) return false;

    // Search filter
    const searchMatch = !searchTerm ||
      j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      j.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (j.driverName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (j.licensePlate || '').toLowerCase().includes(searchTerm.toLowerCase());

    return searchMatch;
  });

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = filteredJobs.slice().reverse().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAction = (job: Job) => {
    setSelectedJob(job);

    // If it's a Booking Officer, show the restricted edit modal ONLY for pending jobs
    if (user.role === UserRole.BOOKING_OFFICER) {
      if (job.status !== JobStatus.NEW_REQUEST) {
        if (typeof (window as any).Swal !== 'undefined') {
          (window as any).Swal.fire({
            title: 'Locked / ข้อมูลถูกล็อก',
            text: 'Booking Officers can only edit jobs in "New Request" status. / เจ้าหน้าที่ Booking สามารถแก้ไขได้เฉพาะงานที่สถานะเป็น "รอรถ" เท่านั้น',
            icon: 'warning',
            confirmButtonColor: '#2563eb',
            customClass: { popup: 'rounded-[2rem]' }
          });
        }
        return;
      }
      setShowBookingModal(true);
      return;
    }

    // Lock editing for Completed/Billed jobs unless the user is Admin or Accountant
    const isLocked = [JobStatus.COMPLETED, JobStatus.BILLED].includes(job.status);
    const canOverride = [UserRole.ADMIN, UserRole.ACCOUNTANT].includes(user.role);

    if (isLocked && !canOverride) {
      if (typeof (window as any).Swal !== 'undefined') {
        (window as any).Swal.fire({
          title: 'Locked / ข้อมูลถูกล็อก',
          text: 'This job is completed and locked. Only Admin/Account can edit. / งานนี้จบงานแล้ว ข้อมูลถูกล็อกให้เฉพาะผู้ดูแลหรือบัญชีแก้ไขเท่านั้น',
          icon: 'info',
          confirmButtonColor: '#0f172a',
          customClass: { popup: 'rounded-[2rem]' }
        });
      }
      return;
    }

    // Block actions on Pending Pricing jobs unless Admin/Accountant
    if (job.status === JobStatus.PENDING_PRICING && ![UserRole.ADMIN, UserRole.ACCOUNTANT].includes(user.role)) {
      if (typeof (window as any).Swal !== 'undefined') {
        (window as any).Swal.fire({
          title: 'Locked for Pricing / รอตรวจสอบราคา',
          text: 'This job is pending pricing review. Please contact Admin/Accounting to add master price. / งานนี้ติดสถานะรอตรวจสอบราคา กรุณาแจ้ง Admin ให้เพิ่มราคากลางก่อนจัดรถ',
          icon: 'warning',
          confirmButtonColor: '#f59e0b',
          customClass: { popup: 'rounded-[2rem]' }
        });
      }
      return;
    }

    setShowDispatcherModal(true);
  };

  const handleConfirmAction = (job: Job) => {
    setSelectedJob(job);
    setShowConfirmModal(true);
  };

  const handlePreview = (job: Job) => {
    setSelectedJob(job);
    setShowPreviewModal(true);
  };

  const getStatusStyle = (status: JobStatus) => {
    switch (status) {
      case JobStatus.NEW_REQUEST: return 'bg-orange-100 text-orange-700 border-orange-200';
      case JobStatus.PENDING_PRICING: return 'bg-yellow-100 text-yellow-700 border-yellow-200'; // New Style
      case JobStatus.ASSIGNED: return 'bg-blue-100 text-blue-700 border-blue-200';
      case JobStatus.COMPLETED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case JobStatus.BILLED: return 'bg-slate-100 text-slate-600 border-slate-200';
      case JobStatus.CANCELLED: return 'bg-rose-100 text-rose-700 border-rose-200';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const handleCancelJob = async (job: Job) => {
    if (typeof (window as any).Swal === 'undefined') return;

    const { value: reason } = await (window as any).Swal.fire({
      title: 'Cancel Job? / ยืนยันยกเลิกงาน',
      text: 'Please provide a reason for cancellation. / กรุณาระบุเหตุผลในการยกเลิก',
      input: 'textarea',
      inputPlaceholder: 'Reason for cancellation...',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Cancel it! / ยืนยันยกเลิก',
      customClass: { popup: 'rounded-[2rem]' }
    });

    if (reason) {
      const log: AuditLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        jobId: job.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        timestamp: new Date().toISOString(),
        field: 'Status',
        oldValue: job.status,
        newValue: JobStatus.CANCELLED,
        reason: reason
      };

      onUpdateJob({ ...job, status: JobStatus.CANCELLED }, [log]);

      (window as any).Swal.fire({
        title: 'Cancelled!',
        text: 'The job has been cancelled. / ยกเลิกใบงานเรียบร้อยแล้ว',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-[2rem]' }
      });
    }
  };

  const handleExportArchive = () => {
    if (filteredJobs.length === 0) {
      if (typeof (window as any).Swal !== 'undefined') {
        (window as any).Swal.fire({
          title: 'No Data / ไม่มีข้อมูล',
          text: 'There are no jobs to export in the current view. / ไม่พบข้อมูลใบงานที่สามารถส่งออกได้ในขณะนี้',
          icon: 'warning',
          confirmButtonColor: '#2563eb',
          customClass: { popup: 'rounded-[2rem]' }
        });
      }
      return;
    }

    // Define CSV Headers
    const headers = [
      'Job ID', 'Date of Service', 'Origin', 'Destination', 'Truck Type',
      'Subcontractor', 'Driver', 'License Plate', 'Cost', 'Extra Charge',
      'Total', 'Status', 'Accounting Status'
    ];

    // Map data to CSV rows
    const rows = filteredJobs.map(job => [
      job.id,
      job.dateOfService,
      `"${job.origin}"`,
      `"${job.destination}"`,
      job.truckType,
      job.subcontractor || '-',
      job.driverName || '-',
      job.licensePlate || '-',
      job.cost || 0,
      job.extraCharge || 0,
      (job.cost || 0) + (job.extraCharge || 0),
      job.status,
      job.accountingStatus || 'Pending'
    ]);

    // Construct CSV content
    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // Create a blob and download link
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `job_archive_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (typeof (window as any).Swal !== 'undefined') {
      (window as any).Swal.fire({
        title: 'Export Success! / ส่งออกสำเร็จ',
        text: 'Your CSV file is being downloaded. / ระบบกำลังดาวน์โหลดไฟล์ CSV ให้คุณครับ',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-[2rem]' }
      });
    }
  };

  const renderKanban = () => {
    const columns = [
      { status: JobStatus.PENDING_PRICING, label: 'Pricing Review / รอราคา', color: 'bg-yellow-500' },
      { status: JobStatus.NEW_REQUEST, label: 'Unassigned / รอรถ', color: 'bg-orange-500' },
      { status: JobStatus.ASSIGNED, label: 'In Progress / กำลังไป', color: 'bg-blue-500' },
      { status: JobStatus.COMPLETED, label: 'Finished / เสร็จแล้ว', color: 'bg-emerald-500' },
      { status: JobStatus.CANCELLED, label: 'Cancelled / ยกเลิก', color: 'bg-rose-500' }
    ];

    return (
      <div className="flex lg:grid lg:grid-cols-3 gap-6 overflow-x-auto pb-4 px-2 snap-x lg:snap-none scrollbar-none lg:overflow-x-visible items-start">
        {columns.map(col => {
          const columnJobs = jobs.filter(j => j.status === col.status && (!searchTerm ||
            j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
            j.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
            j.destination.toLowerCase().includes(searchTerm.toLowerCase())
          ));
          return (
            <div key={col.status} className="bg-slate-100/60 rounded-3xl p-4 flex flex-col h-[calc(100vh-280px)] min-h-[500px] min-w-[300px] md:min-w-[340px] lg:min-w-0 snap-center border border-slate-200/40">
              <div className="flex items-center justify-between px-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.color}`}></div>
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{col.label}</h3>
                </div>
                <span className="bg-white px-2 py-0.5 rounded-lg text-[10px] font-black text-slate-400 border border-slate-200">
                  {columnJobs.length}
                </span>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {columnJobs.slice().reverse().map(job => (
                  <div
                    key={job.id}
                    className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 transition-all group relative active:scale-95 hover-lift ${user.role !== UserRole.BOOKING_OFFICER ? 'hover:shadow-md hover:border-blue-200 cursor-pointer' : ''} ${job.status === JobStatus.CANCELLED ? 'opacity-60 grayscale-[0.5]' : ''}`}
                    onClick={() => handleAction(job)}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="text-[10px] font-black font-mono text-blue-600">#{job.id}</span>
                      <span className="text-[9px] font-bold text-slate-400">{new Date(job.dateOfService).toLocaleDateString('th-TH')}</span>
                    </div>
                    <h4 className={`text-xs font-black text-slate-800 mb-1 leading-tight ${job.status === JobStatus.CANCELLED ? 'line-through decoration-rose-500 decoration-2' : ''}`}>
                      {job.truckType} {job.productDetail ? `/ ${job.productDetail}` : ''}
                    </h4>
                    <div className={`space-y-1.5 mb-4 ${job.status === JobStatus.CANCELLED ? 'line-through opacity-50' : ''}`}>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                        <MapPin size={10} className="text-blue-500" /> {job.origin}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600">
                        <MapPin size={10} className="text-orange-500" /> {job.destination}
                      </div>
                    </div>

                    {/* Locked Message for Pending Pricing */}
                    {job.status === JobStatus.PENDING_PRICING && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4 flex items-center gap-2">
                        <Lock size={12} className="text-yellow-600" />
                        <span className="text-[9px] font-black text-yellow-700 uppercase tracking-wide">Locked: Pricing Review Needed</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                          {job.weightVolume || <span className="text-slate-300 italic">No Weight Info</span>}
                        </span>
                      </div>
                      {job.status === JobStatus.NEW_REQUEST && user.role === UserRole.BOOKING_OFFICER && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelJob(job); }}
                          className="bg-rose-500 hover:bg-rose-600 text-white p-2 rounded-xl transition-all shadow-lg shadow-rose-100 active:scale-90 tap-spark"
                          title="Cancel Job / ยกเลิกงาน"
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                      {col.status === JobStatus.ASSIGNED && user.role !== UserRole.BOOKING_OFFICER && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleConfirmAction(job); }}
                          className="bg-emerald-500 hover:bg-emerald-600 text-white p-2 rounded-xl transition-all shadow-lg shadow-emerald-100 active:scale-90 tap-spark"
                          title="Confirm Job / ยืนยันจบงาน"
                          aria-label={`Confirm job ${job.id}`}
                        >
                          <CheckCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderTable = () => {
    const totalCost = filteredJobs.reduce((sum, j) => sum + (j.cost || 0), 0);
    const totalExtra = filteredJobs.reduce((sum, j) => sum + (j.extraCharge || 0), 0);

    return (
      <div className="space-y-8">
        {/* Bento Grid Summary Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
          <div className={`${user.role === UserRole.BOOKING_OFFICER ? 'md:col-span-3' : 'md:col-span-2'} glass p-8 rounded-[2.5rem] flex flex-col justify-between hover-lift group relative overflow-hidden`}>
            <div className="absolute -right-4 -top-4 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl group-hover:bg-blue-500/10 transition-colors"></div>
            <div className="flex items-center justify-between mb-8">
              <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200 group-hover:scale-110 transition-transform">
                <LayoutDashboard size={24} />
              </div>
              <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">Operations Hub</span>
            </div>
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">งานทั้งหมด (Total Service Requests)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-slate-900 leading-none">{filteredJobs.length}</span>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">รายการที่กำลังดำเนินการ (Active)</span>
              </div>
            </div>
          </div>

          {user.role !== UserRole.BOOKING_OFFICER && (
            <div className="glass p-8 rounded-[2.5rem] flex flex-col justify-between hover-lift group">
              <div className="w-12 h-12 bg-emerald-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-emerald-100 group-hover:rotate-12 transition-transform">
                <Receipt size={24} />
              </div>
              <div className="mt-8">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1 text-xs">ยอดรวมค่าใช้จ่าย (Total Settlement)</span>
                <span className="text-3xl font-black text-emerald-600 tracking-tight">฿{(Number(totalCost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}

          <div className="glass p-8 rounded-[2.5rem] flex flex-col justify-between hover-lift group">
            <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-100 group-hover:-rotate-12 transition-transform">
              <Truck size={24} />
            </div>
            <div className="mt-8">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest block mb-1">งานที่รอรถ (Waiting Assignment)</span>
              <span className="text-3xl font-black text-slate-900 tracking-tight">
                {jobs.filter(j => j.status === JobStatus.NEW_REQUEST).length} <span className="text-xs text-orange-500">งาน (Jobs)</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-4 glass p-4 md:p-5 rounded-[2rem] sticky top-0 z-20 mb-6">
          <div className="flex items-center gap-3 px-2 flex-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <div className="relative flex-1 max-w-xs">
              <input
                type="text"
                placeholder="ค้นหา Job ID, เส้นทาง, ทะเบียน..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-[11px] font-bold"
                value={searchTerm}
                onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            </div>
            <p className="hidden md:block text-[10px] items-center font-black text-slate-500 uppercase tracking-widest">การตรวจสอบสถานะงานแบบ Real-Time (Live Monitoring)</p>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-white hover:border-blue-400 transition-all shadow-sm flex items-center justify-center gap-2 tap-spark" title="Filter Records">
              <Filter size={16} className="text-blue-500" /> ตัวกรอง (Filter)
            </button>
            <button
              onClick={handleExportArchive}
              className="flex-1 md:flex-none px-6 py-4 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 flex items-center justify-center tap-spark"
              title="Export CSV Data"
            >
              ส่งออกข้อมูล (Export Archive)
            </button>
          </div>
        </div>

        <div className="hidden xl:block bg-white rounded-[2.5rem] border border-slate-200/80 overflow-hidden shadow-2xl shadow-slate-200/20">
          <div className="overflow-x-auto overflow-y-auto max-h-[700px] scrollbar-thin">
            <table className="w-full text-left border-collapse table-auto min-w-full">
              <thead className="sticky top-0 z-10 shadow-sm border-b border-slate-100">
                <tr className="bg-slate-900 text-white">
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest w-48">รหัสงาน / สถานะ (SERVICE ID / STATUS)</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest min-w-[300px]">เส้นทาง (ROUTE)</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest min-w-[250px]">รถ-สินค้า (FLEET-PRODUCT)</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest w-64">ผู้รับงาน (ASSIGN)</th>
                  {user.role !== UserRole.BOOKING_OFFICER && (
                    <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest w-40 text-right">ค่าขนส่ง (SETTLEMENT)</th>
                  )}
                  <th className="px-8 py-6 text-[10px] font-black uppercase tracking-widest w-36 text-center">จัดการ (MANAGE)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedJobs.length === 0 ? (
                  <tr><td colSpan={6} className="px-8 py-32 text-center text-slate-300 font-black uppercase tracking-widest">No operations found</td></tr>
                ) : (
                  paginatedJobs.map(job => (
                    <tr
                      key={job.id}
                      className={`transition-colors group hover-lift ${user.role !== UserRole.BOOKING_OFFICER ? 'hover:bg-blue-50/20 cursor-pointer' : ''} ${job.status === JobStatus.CANCELLED ? 'opacity-50 grayscale bg-slate-50/50' : ''}`}
                      onClick={() => handleAction(job)}
                    >
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-black text-blue-600 font-mono tracking-tight">#{job.id}</span>
                          <div className="flex flex-wrap gap-1">
                            <span className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase text-center border shadow-sm ${getStatusStyle(job.status)} animate-status`}>
                              {JOB_STATUS_LABELS[job.status]}
                            </span>
                            {job.status === JobStatus.COMPLETED && job.accountingStatus && (
                              <span className={`inline-block px-3 py-1.5 rounded-xl text-[9px] font-black uppercase text-center border shadow-sm ${job.accountingStatus === 'Approved'
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : job.accountingStatus === 'Rejected'
                                  ? 'bg-rose-600 text-white border-rose-700 shadow-rose-100' // ดำเนินการปรับเป็นสีแดงเข้มตามที่ระบุ
                                  : 'bg-amber-100 text-amber-700 border-amber-200'
                                }`}>
                                บัญชี: {ACCOUNTING_STATUS_LABELS[job.accountingStatus as any] || job.accountingStatus}
                              </span>
                            )}
                            {job.isBaseCostLocked && (
                              <span className="inline-flex items-center justify-center w-6 h-6 bg-slate-900 text-white rounded-lg" title="Locked by Accounting">
                                <Lock size={10} />
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className={`flex flex-col gap-2 ${job.status === JobStatus.CANCELLED ? 'line-through decoration-rose-500' : ''}`}>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                            <span className="text-[13px] font-black text-slate-800">{job.origin}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></div>
                            <span className="text-[13px] font-black text-slate-800">{job.destination}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-black uppercase mt-2">{new Date(job.dateOfService).toLocaleDateString('th-TH', { dateStyle: 'long' })}</span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="bg-slate-50/80 p-4 rounded-3xl border border-slate-100 group-hover:bg-white transition-all">
                          <span className="block text-[11px] font-black text-slate-800 mb-1">{job.truckType}</span>
                          <span className="block text-[10px] text-slate-500 font-bold leading-relaxed">
                            {job.productDetail || <span className="text-slate-300 italic">No description / ไม่ระบุรายละเอียด</span>}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        {job.subcontractor ? (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-600 font-black text-xs border border-blue-500/20">{job.subcontractor.slice(0, 2)}</div>
                            <div>
                              <span className="block text-xs font-black text-slate-800">{job.subcontractor}</span>
                              <span className="block text-[10px] font-mono font-bold text-blue-500 uppercase">{job.licensePlate}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-[10px] font-black italic text-slate-300 uppercase tracking-widest animate-pulse">Pending</div>
                        )}
                      </td>
                      {user.role !== UserRole.BOOKING_OFFICER && (
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-lg font-black text-slate-900 leading-none mb-1">฿{(Number(job.cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            <span className="text-[9px] font-black text-slate-300 uppercase">Settlement</span>
                          </div>
                        </td>
                      )}
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2">
                          {job.status === JobStatus.ASSIGNED && user.role !== UserRole.BOOKING_OFFICER && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleConfirmAction(job); }}
                              className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 active:scale-90 tap-spark"
                              title="Confirm Job / ยืนยันจบงาน"
                              aria-label="Confirm Completion"
                            >
                              <CheckCircle size={16} />
                            </button>
                          )}
                          {job.status === JobStatus.NEW_REQUEST && user.role === UserRole.BOOKING_OFFICER && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancelJob(job); }}
                              className="p-3 bg-rose-50 border border-slate-100 text-rose-500 hover:bg-rose-100 rounded-2xl transition-all shadow-sm active:scale-90 tap-spark"
                              title="Cancel Job / ยกเลิกงาน"
                            >
                              <XCircle size={16} />
                            </button>
                          )}
                          {(user.role !== UserRole.BOOKING_OFFICER || job.status === JobStatus.NEW_REQUEST) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleAction(job); }}
                              className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-500 rounded-2xl transition-all shadow-sm active:scale-90 tap-spark"
                              title="Edit Record"
                              aria-label="Edit Job"
                            >
                              <Edit3 size={16} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); handlePreview(job); }}
                            className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-500 rounded-2xl transition-all shadow-sm active:scale-90 tap-spark"
                            title="Print Request / พิมพ์ใบขอใช้รถ"
                          >
                            <Printer size={16} />
                          </button>
                          {/* ADMIN DELETE BUTTON */}
                          {user.role === UserRole.ADMIN && onDeleteJob && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                Swal.fire({
                                  title: 'ยืนยันการลบข้อมูล (Admin Password Required)',
                                  html: `คุณกำลังจะลบ Job <span class="text-rose-600 font-black">#${job.id}</span> ถาวร!<br/><br/>กรุณาป้อนรหัสผ่าน Admin เพื่อยืนยัน`,
                                  input: 'password',
                                  icon: 'warning',
                                  showCancelButton: true,
                                  confirmButtonColor: '#ef4444',
                                  cancelButtonColor: '#1e293b',
                                  confirmButtonText: 'ยืนยันลบข้อมูล',
                                  cancelButtonText: 'ยกเลิก',
                                  customClass: { popup: 'rounded-[2rem]' },
                                  preConfirm: (value) => {
                                    if (value !== 'sansan856') {
                                      Swal.showValidationMessage('รหัสผ่านไม่ถูกต้อง (Incorrect Password)');
                                    }
                                  }
                                }).then((result) => {
                                  if (result.isConfirmed) {
                                    onDeleteJob(job.id);
                                    Swal.fire('ลบข้อมูลแล้ว', 'ข้อมูลถูกลบออกจากระบบอย่างสมบูรณ์', 'success');
                                  }
                                });
                              }}
                              className="p-3 bg-white border border-slate-200 text-rose-300 hover:text-rose-600 hover:border-rose-500 rounded-2xl transition-all shadow-sm active:scale-90 tap-spark"
                              title="Delete Record (Admin)"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Table Pagination */}
          {totalPages > 1 && (
            <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                หน้า {currentPage} จาก {totalPages} ({paginatedJobs.length} จาก {filteredJobs.length} รายการ)
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-30 transition-all"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-[10px] font-black uppercase hover:bg-slate-50 disabled:opacity-30 transition-all"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mobile/Tablet Card Layout */}
        <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
          {filteredJobs.slice().reverse().map(job => (
            <div
              key={job.id}
              className={`bg-white rounded-[2rem] p-6 border border-slate-200 shadow-xl shadow-slate-200/20 active:scale-[0.98] transition-all hover-lift ${user.role !== UserRole.BOOKING_OFFICER ? 'cursor-pointer' : ''} ${job.status === JobStatus.CANCELLED ? 'opacity-50 grayscale select-none' : ''}`}
              onClick={() => handleAction(job)}
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-black text-blue-600 font-mono">#{job.id}</span>
                  {![UserRole.BOOKING_OFFICER, UserRole.DISPATCHER, UserRole.ACCOUNTANT].includes(user.role) && (
                    <span className={`inline-block px-3 py-1 rounded-lg text-[9px] font-black uppercase text-center border ${getStatusStyle(job.status)} animate-status`}>
                      {job.status}
                    </span>
                  )}
                </div>
                {user.role !== UserRole.BOOKING_OFFICER && (
                  <div className="text-right">
                    <span className="block text-xl font-black text-slate-900 leading-none">฿{(Number(job.cost) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1 block">Cost Value</span>
                  </div>
                )}
              </div>

              <div className="space-y-4 mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <div className="w-px h-6 bg-slate-100"></div>
                    <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                  </div>
                  <div className={`flex-1 space-y-3 ${job.status === JobStatus.CANCELLED ? 'line-through decoration-rose-500 opacity-50' : ''}`}>
                    <span className="block text-[13px] font-black text-slate-800">{job.origin}</span>
                    <span className="block text-[13px] font-black text-slate-800">{job.destination}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-2 text-[10px] font-black text-slate-400 uppercase tracking-widest border-t border-slate-50">
                  <Calendar size={12} className="text-blue-500/50" /> {new Date(job.dateOfService).toLocaleDateString('th-TH')}
                </div>
              </div>

              <div className={`bg-slate-50/80 rounded-2xl p-4 mb-6 border border-slate-100/50 ${job.status === JobStatus.CANCELLED ? 'grayscale' : ''}`}>
                <div className="flex items-center gap-3 mb-2">
                  <Truck size={14} className="text-slate-400" />
                  <span className={`text-[11px] font-black text-slate-800 uppercase ${job.status === JobStatus.CANCELLED ? 'line-through decoration-slate-400' : ''}`}>{job.truckType}</span>
                </div>
                <p className={`text-[10px] text-slate-500 font-bold ${job.status === JobStatus.CANCELLED ? 'line-through decoration-slate-300' : ''}`}>
                  {job.productDetail || <span className="text-slate-300 italic">No description</span>}
                </p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <div className="flex items-center gap-2">
                  {job.subcontractor ? (
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">{job.subcontractor.slice(0, 2)}</div>
                      <span className="text-[10px] font-black text-slate-700">{job.licensePlate}</span>
                    </div>
                  ) : (
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest italic animate-pulse px-3 py-1 bg-slate-50 rounded-lg">Wait Assignment</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {job.status === JobStatus.ASSIGNED && user.role !== UserRole.BOOKING_OFFICER && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleConfirmAction(job); }}
                      className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-100 active:scale-90 tap-spark"
                      title="Confirm Job / ยืนยันจบงาน" aria-label="Confirm Completion"
                    >
                      <CheckCircle size={14} />
                    </button>
                  )}
                  {job.status === JobStatus.NEW_REQUEST && user.role === UserRole.BOOKING_OFFICER && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCancelJob(job); }}
                      className="p-3 bg-rose-50 border border-slate-100 text-rose-500 rounded-xl active:scale-90 tap-spark"
                      title="Cancel Job / ยกเลิกงาน"
                    >
                      <XCircle size={14} />
                    </button>
                  )}
                  {(user.role !== UserRole.BOOKING_OFFICER || job.status === JobStatus.NEW_REQUEST) && (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleAction(job); }}
                      className="p-3 bg-white border border-slate-200 text-slate-400 rounded-xl active:scale-90 tap-spark"
                      title="Edit Job"
                      aria-label="Edit Job"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePreview(job); }}
                    className="p-3 bg-white border border-slate-200 text-indigo-400 rounded-xl active:scale-90 tap-spark"
                    title="Print Preview"
                  >
                    <Printer size={14} />
                  </button>
                  {user.role === UserRole.ADMIN && onDeleteJob && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        Swal.fire({
                          title: 'ยืนยันการลบข้อมูล (Admin Password Required)',
                          html: `คุณกำลังจะลบ Job <span class="text-rose-600 font-black">#${job.id}</span> ถาวร!<br/><br/>กรุณาป้อนรหัสผ่าน Admin เพื่อยืนยัน`,
                          input: 'password',
                          icon: 'warning',
                          showCancelButton: true,
                          confirmButtonColor: '#ef4444',
                          cancelButtonColor: '#1e293b',
                          confirmButtonText: 'ยืนยันลบข้อมูล',
                          cancelButtonText: 'ยกเลิก',
                          customClass: { popup: 'rounded-[2rem]' },
                          preConfirm: (value) => {
                            if (value !== 'sansan856') {
                              Swal.showValidationMessage('รหัสผ่านไม่ถูกต้อง (Incorrect Password)');
                            }
                          }
                        }).then((result) => {
                          if (result.isConfirmed) {
                            onDeleteJob(job.id);
                            Swal.fire('ลบข้อมูลแล้ว', 'ข้อมูลถูกลบออกจากระบบอย่างสมบูรณ์', 'success');
                          }
                        });
                      }}
                      className="p-3 bg-white border border-slate-200 text-rose-400 rounded-xl active:scale-90 tap-spark"
                      title="Delete Record"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-8 select-none">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 px-1">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tight leading-tight">
            {user.role === UserRole.BOOKING_OFFICER ? 'รายการขอรถ (Requests Board)' : 'แดชบอร์ดงานขนส่ง (Operations Dashboard)'}
          </h2>
          <div className="flex items-center gap-3 mt-2">
            <div className="h-1 w-8 bg-blue-600 rounded-full"></div>
            <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-[10px]">การติดตามงานแบบ Real-Time (Live Monitoring)</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 md:gap-4">
          <div className="bg-slate-100/80 p-1.5 rounded-2xl flex items-center shadow-inner border border-slate-200 transition-all focus-within:ring-4 focus-within:ring-slate-100">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'kanban' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              title="Kanban View" aria-label="Switch to Kanban View"
            >
              คัมบัง (Kanban)
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'table' ? 'bg-white text-blue-600 shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
              title="List View" aria-label="Switch to Table View"
            >
              ตาราง (List)
            </button>
          </div>

          <div className="bg-white p-1.5 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className={`p-2.5 rounded-xl transition-all ${isLoading ? 'bg-slate-100 text-blue-600 animate-spin' : 'text-slate-400 hover:bg-slate-50'}`}
              title="Refresh Data"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /></svg>
            </button>
            <div className="w-px h-6 bg-slate-100 mx-1"></div>
            {(['ALL', JobStatus.PENDING_PRICING, JobStatus.NEW_REQUEST, JobStatus.ASSIGNED, JobStatus.COMPLETED] as const).map((s, idx) => (
              <button
                key={`${s}-${idx}`}
                onClick={() => setFilter(s)}
                className={`px-3 md:px-4 py-2 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-tighter transition-all ${filter === s ? 'bg-slate-900 text-white shadow-xl scale-105' : 'text-slate-400 hover:bg-slate-50'}`}
                title={`Filter by ${s}`} aria-label={`Filter by ${s}`}
              >
                {s === JobStatus.NEW_REQUEST ? 'NEW' : s === JobStatus.PENDING_PRICING ? 'PRICE' : s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="animate-in fade-in zoom-in-95 duration-500">
        {isLoading ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 h-48 skeleton"></div>
              <div className="h-48 skeleton"></div>
              <div className="h-48 skeleton"></div>
            </div>
            <div className="h-20 skeleton"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-24 skeleton w-full"></div>
              ))}
            </div>
          </div>
        ) : (
          viewMode === 'kanban' ? renderKanban() : renderTable()
        )}
      </div>

      {showDispatcherModal && selectedJob && (
        <DispatcherActionModal
          job={selectedJob}
          onClose={() => setShowDispatcherModal(false)}
          onSave={onUpdateJob}
          user={user}
          priceMatrix={priceMatrix}
          logs={logs}
          logsLoaded={logsLoaded}
        />
      )}

      {showConfirmModal && selectedJob && (
        <ConfirmationModal
          job={selectedJob}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={onUpdateJob}
        />
      )}
      {showPreviewModal && selectedJob && (
        <JobPreviewModal
          job={selectedJob}
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
      {showBookingModal && selectedJob && (
        <BookingEditModal
          job={selectedJob}
          onClose={() => setShowBookingModal(false)}
          onSave={onUpdateJob}
          user={user}
          priceMatrix={priceMatrix}
        />
      )}
    </div>
  );
};

export default JobBoard;
