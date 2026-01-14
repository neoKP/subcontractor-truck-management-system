
import React, { useState, useMemo } from 'react';
import { Job, JobStatus, UserRole, AccountingStatus, AuditLog, JOB_STATUS_LABELS, ACCOUNTING_STATUS_LABELS } from '../types';
import { DollarSign, ExternalLink, FileCheck, Info, TrendingUp, CheckCircle, XCircle, Lock, AlertCircle, History, Receipt } from 'lucide-react';
import InvoicePreviewModal from './InvoicePreviewModal';

interface BillingViewProps {
  jobs: Job[];
  user: { id: string; name: string; role: UserRole };
  onUpdateJob: (job: Job, logs?: AuditLog[]) => void;
}

const BillingView: React.FC<BillingViewProps> = ({ jobs, user, onUpdateJob }) => {
  const [activeFilter, setActiveFilter] = useState<AccountingStatus | 'ALL' | 'PENDING_BILL'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoiceJobs, setSelectedInvoiceJobs] = useState<Job[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);

  // New Filters
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterSub, setFilterSub] = useState('ALL');

  const itemsPerPage = 10;

  const uniqueSubs = useMemo(() => Array.from(new Set(jobs.map(j => j.subcontractor))).filter(Boolean).sort(), [jobs]);


  const filteredJobs = jobs.filter(j => {
    if (j.status === JobStatus.CANCELLED) return false;
    if (j.status !== JobStatus.COMPLETED && j.status !== JobStatus.BILLED) return false;

    // Search filter
    const searchMatch = !searchTerm ||
      j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (j.subcontractor || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!searchMatch) return false;

    // Date Range Filter
    const jobDate = j.dateOfService.split('T')[0];
    if (filterDateStart && jobDate < filterDateStart) return false;
    if (filterDateEnd && jobDate > filterDateEnd) return false;

    // Subcontractor Filter
    if (filterSub !== 'ALL' && j.subcontractor !== filterSub) return false;

    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PENDING_BILL') return j.status === JobStatus.COMPLETED && j.accountingStatus === AccountingStatus.APPROVED;
    return j.accountingStatus === activeFilter;
  });

  const totalPages = Math.ceil(filteredJobs.length / itemsPerPage);
  const paginatedJobs = filteredJobs.slice().reverse().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const totalRevenue = filteredJobs.reduce((sum, j) => sum + (j.cost || 0), 0);
  const totalExtra = filteredJobs.reduce((sum, j) => sum + (j.extraCharge || 0), 0);
  const totalFinal = totalRevenue + totalExtra;

  const handleAccountingAction = async (job: Job, action: AccountingStatus) => {
    if (typeof (window as any).Swal === 'undefined') return;

    // MANDATORY DOCUMENT RULE FOR APPROVAL
    if (action === AccountingStatus.APPROVED && (!job.podImageUrls || job.podImageUrls.length === 0)) {
      (window as any).Swal.fire({
        title: 'Block: No Documentation / ไม่อนุญาต: ขาดเอกสาร',
        text: 'ไม่สามารถอนุมัติงานนี้ได้เนื่องจากไม่มีเอกสารประกอบ (POD) กรุณาตรวจสอบอีกครั้ง',
        icon: 'warning',
        confirmButtonColor: '#e11d48',
        customClass: { popup: 'rounded-[1.5rem]' }
      });
      return;
    }

    let reason = '';
    if (action === AccountingStatus.REJECTED || action === AccountingStatus.LOCKED) {
      const { value: text } = await (window as any).Swal.fire({
        title: action === AccountingStatus.REJECTED ? 'Reason for Rejection / ระบุเหตุผลที่ปฏิเสธ' : 'Confirm Final Lock / ยืนยันปิดงานถาวร',
        input: 'textarea',
        inputLabel: action === AccountingStatus.REJECTED ? 'Why is this job being rejected?' : 'Optional final remarks for this job',
        inputPlaceholder: 'Type your message here...',
        showCancelButton: true,
        confirmButtonColor: action === AccountingStatus.REJECTED ? '#e11d48' : '#0f172a',
        customClass: { popup: 'rounded-[2rem]' }
      });
      if (text === undefined) return; // Cancelled
      reason = text;
    }

    const log: AuditLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      jobId: job.id,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      timestamp: new Date().toISOString(),
      field: 'Accounting Status',
      oldValue: job.accountingStatus || 'None',
      newValue: action,
      reason: reason || `Updated to ${action}`
    };

    const updatedJob: Job = {
      ...job,
      accountingStatus: action,
      accountingRemark: reason || job.accountingRemark,
      isBaseCostLocked: action === AccountingStatus.APPROVED || action === AccountingStatus.LOCKED
    };

    onUpdateJob(updatedJob, [log]);

    (window as any).Swal.fire({
      icon: 'success',
      title: 'Updated!',
      text: `Job status moved to ${action}`,
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: 'rounded-[2rem]' }
    });
  };

  const handleBillJob = async (job: Job) => {
    if (typeof (window as any).Swal === 'undefined') return;

    if (!job.podImageUrls || job.podImageUrls.length === 0) {
      (window as any).Swal.fire({
        title: 'Block: Missing POD / ไม่อนุญาต: ขาดหลักฐาน',
        text: 'ไม่สามารถออกใบวางบิลได้เนื่องจากไม่มีข้อมูลรูปภาพหรือ PDF ประกอบงาน (POD)',
        icon: 'error',
        confirmButtonColor: '#e11d48',
        customClass: { popup: 'rounded-[1.5rem]' }
      });
      return;
    }

    setSelectedInvoiceJobs([job]);
    setShowInvoiceModal(true);
  };

  const handleBatchBill = () => {
    if (selectedJobIds.length === 0) return;

    const selectedJobs = jobs.filter(j => selectedJobIds.includes(j.id));

    // Validation: All must have POD
    const missingPod = selectedJobs.filter(j => !j.podImageUrls || j.podImageUrls.length === 0);
    if (missingPod.length > 0) {
      (window as any).Swal.fire({
        title: 'Missing Documentation',
        text: `Some selected jobs (${missingPod.length}) are missing POD documents.`,
        icon: 'error'
      });
      return;
    }

    // Validation: Same Subcontractor
    const subcontractors = new Set(selectedJobs.map(j => j.subcontractor));
    if (subcontractors.size > 1) {
      (window as any).Swal.fire({
        title: 'Multiple Subcontractors',
        text: 'You can only batch invoice jobs from the same subcontractor.',
        icon: 'warning'
      });
      return;
    }

    setSelectedInvoiceJobs(selectedJobs);
    setShowInvoiceModal(true);
  };

  const base64ToBlob = (base64: string) => {
    try {
      const parts = base64.split(';base64,');
      if (parts.length < 2) return null;
      const contentType = parts[0].split(':')[1];
      const raw = window.atob(parts[1]);
      const rawLength = raw.length;
      const uInt8Array = new Uint8Array(rawLength);
      for (let i = 0; i < rawLength; ++i) {
        uInt8Array[i] = raw.charCodeAt(i);
      }
      return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
      console.error("Error converting base64 to blob", e);
      return null;
    }
  };

  const getAccStatusBadge = (status?: AccountingStatus) => {
    switch (status) {
      case AccountingStatus.PENDING_REVIEW: return 'bg-amber-100 text-amber-700 border-amber-200';
      case AccountingStatus.APPROVED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case AccountingStatus.REJECTED: return 'bg-rose-600 text-white border-rose-700 shadow-sm';
      case AccountingStatus.LOCKED: return 'bg-slate-900 text-white border-slate-900 shadow-lg';
      default: return 'bg-slate-100 text-slate-400 border-slate-200';
    }
  };

  return (
    <div className="space-y-8">
      {/* Filters & Navigation */}
      <div className="flex flex-wrap items-center gap-3">
        {(['ALL', 'PENDING_BILL', AccountingStatus.PENDING_REVIEW, AccountingStatus.APPROVED, AccountingStatus.REJECTED, AccountingStatus.LOCKED] as const).map(f => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeFilter === f ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400 active:scale-95'}`}
          >
            {f === 'ALL' ? 'ทั้งหมด (All Records)' :
              f === 'PENDING_BILL' ? '🔔 รอรับวางบิล (Pending Acknowledgement)' :
                ACCOUNTING_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-600 rounded-lg text-white"><TrendingUp size={20} /></div>
            <span className="text-[10px] font-black text-emerald-600 uppercase">ยอดรวมตัวกรอง (Filtered Volume)</span>
          </div>
          <p className="text-3xl font-black text-slate-900">฿{(Number(totalFinal) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="text-xs text-emerald-700 font-bold mt-1">Sum of visible jobs / รวมตามตัวกรอง</p>
        </div>

        <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-600 rounded-lg text-white"><AlertCircle size={20} /></div>
            <span className="text-[10px] font-black text-amber-600 uppercase">รอตรวจสอบ (Pending Review)</span>
          </div>
          <p className="text-3xl font-black text-slate-900">
            {jobs.filter(j => j.accountingStatus !== AccountingStatus.APPROVED && j.accountingStatus !== AccountingStatus.LOCKED && j.status === JobStatus.COMPLETED).length}
          </p>
          <p className="text-xs text-amber-700 font-bold mt-1">Jobs awaiting verification / งานรอตรวจ</p>
        </div>

        <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-indigo-600 rounded-lg text-white"><Receipt size={20} /></div>
            <span className="text-[10px] font-black text-indigo-600 uppercase">พร้อมดำเนินการต่อ (Ready to Proceed)</span>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-3xl font-black text-slate-900">
                {jobs.filter(j => j.accountingStatus === AccountingStatus.APPROVED && j.status === JobStatus.COMPLETED).length}
              </p>
              <p className="text-[9px] text-indigo-700 font-black uppercase mt-1">Ready for Acknowledgement</p>
            </div>
            <div className="w-px h-10 bg-indigo-200"></div>
            <div>
              <p className="text-3xl font-black text-slate-900">
                {jobs.filter(j => j.status === JobStatus.BILLED && j.accountingStatus !== AccountingStatus.LOCKED).length}
              </p>
              <p className="text-[9px] text-indigo-700 font-black uppercase mt-1">Ready for Lock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 bg-white sticky top-0 z-20 backdrop-blur-md bg-white/90 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">การตรวจสอบและควบคุมการเงิน (Financial Audit Control)</h3>
              <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase">SoD Enabled</span>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <input
                  type="text"
                  placeholder="ค้นหา Job ID หรือบริษัท..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-bold"
                  value={searchTerm}
                  onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                />
                <TrendingUp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" size={16} />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:inline">{filteredJobs.length} ใบงาน (Jobs)</span>
            </div>
          </div>

          {/* Extended Filters Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2 px-3 bg-white py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">From</span>
              <input
                type="date"
                value={filterDateStart}
                onChange={(e) => setFilterDateStart(e.target.value)}
                aria-label="Filter Start Date"
                className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2 px-3 bg-white py-1.5 rounded-xl border border-slate-200">
              <span className="text-[10px] font-bold text-slate-400 uppercase">To</span>
              <input
                type="date"
                value={filterDateEnd}
                onChange={(e) => setFilterDateEnd(e.target.value)}
                aria-label="Filter End Date"
                className="bg-transparent text-xs font-black text-slate-700 outline-none cursor-pointer"
              />
            </div>
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            <select
              value={filterSub}
              onChange={(e) => setFilterSub(e.target.value)}
              aria-label="Filter Subcontractor"
              className="px-4 py-1.5 rounded-xl border border-slate-200 text-xs font-black text-slate-700 outline-none cursor-pointer bg-white hover:border-blue-500 transition-colors"
            >
              <option value="ALL">All Subcontractors (ทั้งหมด)</option>
              {uniqueSubs.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            {(filterDateStart || filterDateEnd || filterSub !== 'ALL') && (
              <button
                onClick={() => { setFilterDateStart(''); setFilterDateEnd(''); setFilterSub('ALL'); }}
                className="ml-auto text-[10px] font-bold text-rose-500 hover:text-rose-700 flex items-center gap-1 bg-white px-3 py-1.5 rounded-xl border border-rose-100 hover:border-rose-300 transition-all shadow-sm"
              >
                <History size={12} /> Clear Filters
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto max-h-[700px] scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10 text-[10px] font-black uppercase text-slate-400 bg-slate-50/50 border-b border-slate-100 shadow-sm">
              <tr>
                <th className="px-4 py-5 w-10">
                  <input
                    type="checkbox"
                    title="เลือกทั้งหมด"
                    aria-label="Select all jobs"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedJobIds.length > 0 && paginatedJobs.every(j => selectedJobIds.includes(j.id))}
                    onChange={(e) => {
                      if (e.target.checked) {
                        const newIds = Array.from(new Set([...selectedJobIds, ...paginatedJobs.map(j => j.id)]));
                        setSelectedJobIds(newIds);
                      } else {
                        setSelectedJobIds(selectedJobIds.filter(id => !paginatedJobs.find(j => j.id === id)));
                      }
                    }}
                  />
                </th>
                <th className="px-8 py-5">รายละเอียดงาน (JOB DETAILS)</th>
                <th className="px-8 py-5">รายละเอียดราคา (PRICE BREAKDOWN)</th>
                <th className="px-8 py-5 text-center">สถานะบัญชี (ACC. STATUS)</th>
                <th className="px-8 py-5 text-center">เอกสารประกอบ (DOCUMENTATION)</th>
                <th className="px-8 py-5 text-right">การจัดการ (AUDIT ACTIONS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedJobs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center text-slate-400 font-black uppercase tracking-widest italic opacity-50">
                    No records found matching current audit criteria
                  </td>
                </tr>
              ) : (
                paginatedJobs.map(job => (
                  <tr key={job.id} className={`hover:bg-slate-50/50 transition-colors group ${selectedJobIds.includes(job.id) ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-4 py-6">
                      <input
                        type="checkbox"
                        title="เลือกแถวนี้"
                        aria-label={`Select job ${job.id}`}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedJobIds.includes(job.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedJobIds([...selectedJobIds, job.id]);
                          else setSelectedJobIds(selectedJobIds.filter(id => id !== job.id));
                        }}
                      />
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-900 font-mono text-base">#{job.id}</div>
                      <div className="text-[10px] text-slate-500 font-black uppercase tracking-tighter mt-1">{job.subcontractor}</div>
                      <div className="flex items-center gap-1.5 mt-2 bg-white border border-slate-100 rounded-lg px-2 py-1 w-fit">
                        <History size={10} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-400">{new Date(job.dateOfService).toLocaleDateString('th-TH')}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-8 min-w-[180px]">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">BASE:</span>
                          <span className="font-black text-slate-700 text-lg">฿{(Number(job.cost) || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center gap-8">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">EXTRA:</span>
                          <span className="font-bold text-amber-600">+ ฿{(Number(job.extraCharge) || 0).toLocaleString()}</span>
                        </div>
                        <div className="pt-2 mt-1 border-t border-slate-100 flex justify-between items-center gap-8">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">TOTAL:</span>
                          <span className="font-black text-slate-900 text-xl tracking-tight">฿{(Number(job.cost || 0) + Number(job.extraCharge || 0)).toLocaleString()}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-xl text-[10px] font-black uppercase border shadow-sm ${getAccStatusBadge(job.accountingStatus)}`}>
                          {job.accountingStatus ? ACCOUNTING_STATUS_LABELS[job.accountingStatus] : 'รอการตรวจสอบ (Pending)'}
                        </span>
                        {job.accountingRemark && (
                          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 max-w-[200px]">
                            <p className="text-[10px] text-slate-500 font-medium italic leading-tight">“{job.accountingRemark}”</p>
                          </div>
                        )}
                        {job.status === JobStatus.BILLED && (
                          <span className="flex items-center justify-center gap-1 text-[9px] font-black text-emerald-600 uppercase tracking-widest mt-1">
                            <FileCheck size={12} /> รับวางบิลเรียบร้อย (Acknowledged)
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-2 justify-center max-w-[160px] mx-auto">
                        {job.podImageUrls && job.podImageUrls.length > 0 ? (
                          job.podImageUrls.map((base64Url, idx) => {
                            const isPdf = base64Url.startsWith('data:application/pdf');
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (typeof (window as any).Swal !== 'undefined') {
                                    const blob = base64ToBlob(base64Url);
                                    if (!blob) return;
                                    const blobUrl = URL.createObjectURL(blob);
                                    (window as any).Swal.fire({
                                      title: `POD Verify #${job.id}`,
                                      html: isPdf
                                        ? `<iframe src="${blobUrl}" width="100%" height="500px" style="border:none; border-radius: 12px; margin-bottom: 20px;"></iframe>`
                                        : `<div style="margin-bottom: 20px;"><img src="${blobUrl}" style="max-width: 100%; border-radius: 12px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1);" /></div>`,
                                      width: isPdf ? '800px' : '650px',
                                      confirmButtonText: 'Done',
                                      confirmButtonColor: '#2563eb',
                                      customClass: { popup: 'rounded-[2rem]' },
                                      didClose: () => URL.revokeObjectURL(blobUrl)
                                    });
                                  }
                                }}
                                className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center border border-indigo-100 shadow-sm group/pod active:scale-90"
                                title="View POD"
                              >
                                <Receipt size={24} className="group-hover/pod:scale-110 transition-transform" />
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-4 py-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-400 text-[10px] font-black uppercase tracking-widest leading-tight text-center max-w-[100px]">
                            NO<br />DOCUMENT
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        {/* Accounting Actions (Only for PENDING or REJECTED) */}
                        {user.role === UserRole.ACCOUNTANT || user.role === UserRole.ADMIN ? (
                          <div className="flex items-center gap-2">
                            {job.accountingStatus !== AccountingStatus.APPROVED && job.accountingStatus !== AccountingStatus.LOCKED && (
                              <>
                                <button
                                  onClick={() => handleAccountingAction(job, AccountingStatus.APPROVED)}
                                  className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all border border-emerald-100 flex items-center justify-center shadow-sm"
                                  title="Approve / อนุมัติ"
                                >
                                  <CheckCircle size={20} />
                                </button>
                                <button
                                  onClick={() => handleAccountingAction(job, AccountingStatus.REJECTED)}
                                  className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white transition-all border border-rose-100 flex items-center justify-center shadow-sm"
                                  title="Reject / ปฏิเสธ"
                                >
                                  <XCircle size={20} />
                                </button>
                              </>
                            )}

                            {job.accountingStatus === AccountingStatus.APPROVED && job.status === JobStatus.COMPLETED && (
                              <button
                                onClick={() => handleBillJob(job)}
                                className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex flex-col items-center gap-1 min-w-[120px]"
                              >
                                <span>ออกใบรับวางบิล</span>
                                <span className="opacity-80">(ACKNOWLEDGE BILL)</span>
                              </button>
                            )}

                            {job.status === JobStatus.BILLED && job.accountingStatus !== AccountingStatus.LOCKED && (
                              <button
                                onClick={() => handleAccountingAction(job, AccountingStatus.LOCKED)}
                                className="w-10 h-10 rounded-xl bg-slate-100 text-slate-400 hover:bg-slate-900 hover:text-white transition-all border border-slate-200 flex items-center justify-center shadow-sm"
                                title="Final Lock / ปิดงานถาวร"
                              >
                                <Lock size={18} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-slate-300 uppercase italic">Access Restricted (Audit Only)</span>
                        )}

                        {job.accountingStatus === AccountingStatus.LOCKED && (
                          <span className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-[0.2em]">
                            <Lock size={12} /> SECURE
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="px-8 py-6 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              หน้า {currentPage} จาก {totalPages} (Showing {paginatedJobs.length} of {filteredJobs.length} jobs)
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Floating Batch Action */}
      {selectedJobIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[50] animate-in slide-in-from-bottom-10 duration-500">
          <div className="bg-slate-900 text-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-6 border border-slate-700 backdrop-blur-xl bg-slate-900/90">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Selected Jobs</span>
              <span className="text-lg font-black">{selectedJobIds.length} ใบงาน</span>
            </div>
            <div className="h-8 w-px bg-slate-700"></div>
            <button
              onClick={handleBatchBill}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center gap-2"
            >
              <Receipt size={16} /> Acknowledge Batch Billing
            </button>
            <button
              onClick={() => setSelectedJobIds([])}
              className="text-[10px] font-black uppercase text-slate-500 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Invoice Preview Modal */}
      {showInvoiceModal && selectedInvoiceJobs.length > 0 && (
        <InvoicePreviewModal
          jobs={selectedInvoiceJobs}
          onClose={() => {
            setShowInvoiceModal(false);
            setSelectedInvoiceJobs([]);
          }}
          onBatchConfirm={(updatedJobs) => {
            updatedJobs.forEach(uj => onUpdateJob(uj));
            setShowInvoiceModal(false);
            setSelectedInvoiceJobs([]);
            setSelectedJobIds([]);
          }}
        />
      )}
    </div>
  );
};

export default BillingView;

