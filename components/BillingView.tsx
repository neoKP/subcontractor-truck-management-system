
import React, { useState, useMemo } from 'react';
import { Job, JobStatus, AccountingStatus, UserRole, AuditLog, JOB_STATUS_LABELS, ACCOUNTING_STATUS_LABELS, PriceMatrix } from '../types';
import { formatThaiCurrency, roundHalfUp, formatDate } from '../utils/format';
import { DollarSign, ExternalLink, FileCheck, Info, TrendingUp, CheckCircle, XCircle, Lock, AlertCircle, History, Receipt } from 'lucide-react';
import InvoicePreviewModal from './InvoicePreviewModal';
import PaymentModal from './PaymentModal';
import BillingFinancialDashboard from './BillingFinancialDashboard';
import { Download, CreditCard, FileText } from 'lucide-react';

interface BillingViewProps {
  jobs: Job[];
  user: { id: string; name: string; role: UserRole };
  onUpdateJob: (job: Job, logs?: AuditLog[]) => void;
  priceMatrix?: PriceMatrix[];
}

const BillingView: React.FC<BillingViewProps> = ({ jobs, user, onUpdateJob, priceMatrix = [] }) => {
  const [viewTab, setViewTab] = useState<'VERIFICATION' | 'TO_BILL' | 'TO_PAY' | 'PAID'>('VERIFICATION');
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'REJECTED'>('ALL'); // Only for VERIFICATION tab

  // Invoice Modal State
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoiceJobs, setSelectedInvoiceJobs] = useState<Job[]>([]);
  const [isInvoiceViewMode, setIsInvoiceViewMode] = useState(false);

  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTargetJobs, setPaymentTargetJobs] = useState<Job[]>([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);

  // New Filters
  const [filterDateStart, setFilterDateStart] = useState('');
  const [filterDateEnd, setFilterDateEnd] = useState('');
  const [filterSub, setFilterSub] = useState('ALL');

  const itemsPerPage = 10;

  const uniqueSubs = useMemo(() => Array.from(new Set(jobs.map(j => j.subcontractor))).filter(Boolean).sort(), [jobs]);


  const filteredJobs = jobs.filter(j => {
    if (j.status === JobStatus.CANCELLED) return false;
    // Base Check: Must be Completed or Billed
    if (j.status !== JobStatus.COMPLETED && j.status !== JobStatus.BILLED) return false;

    // Search filter
    const searchMatch = !searchTerm ||
      j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (j.subcontractor || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (!searchMatch) return false;

    // Date Range Filter
    if (!j.dateOfService) return false;
    const jobDate = (j.dateOfService || '').split('T')[0];
    if (filterDateStart && jobDate < filterDateStart) return false;
    if (filterDateEnd && jobDate > filterDateEnd) return false;

    // Subcontractor Filter
    if (filterSub !== 'ALL' && j.subcontractor !== filterSub) return false;

    // --- NEW 4-TAB LOGIC ---
    if (viewTab === 'VERIFICATION') {
      // Tab 1: VERIFICATION - Show jobs waiting for review (Pending or Rejected)
      const isPending = j.status === JobStatus.COMPLETED &&
        (j.accountingStatus === AccountingStatus.PENDING_REVIEW || !j.accountingStatus || j.accountingStatus === AccountingStatus.REJECTED);

      if (!isPending) return false;

      // Sub-filter: Show only rejected if selected
      if (activeFilter === 'REJECTED') return j.accountingStatus === AccountingStatus.REJECTED;

      return true;

    } else if (viewTab === 'TO_BILL') {
      // Tab 2: TO BILL - Show only APPROVED jobs ready to bill (not yet BILLED)
      return j.status === JobStatus.COMPLETED && j.accountingStatus === AccountingStatus.APPROVED;

    } else if (viewTab === 'TO_PAY') {
      // Tab 3: TO PAY - Show only BILLED jobs that haven't been PAID yet
      return j.status === JobStatus.BILLED && j.accountingStatus !== AccountingStatus.PAID && j.accountingStatus !== AccountingStatus.LOCKED;

    } else {
      // Tab 4: PAID - Show only jobs that have been PAID or LOCKED
      return j.accountingStatus === AccountingStatus.PAID || j.accountingStatus === AccountingStatus.LOCKED;
    }
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
        title: 'Missing Documentation / เอกสารไม่ครบ',
        text: `Some selected jobs (${missingPod.length}) are missing POD documents.\n(งานจำนวน ${missingPod.length} รายการ ขาดเอกสารประกอบ POD)`,
        icon: 'error',
        confirmButtonText: 'OK / รับทราบ',
        customClass: { popup: 'rounded-[1.5rem]' }
      });
      return;
    }

    // Validation: Same Subcontractor
    const subcontractors = new Set(selectedJobs.map(j => j.subcontractor));
    if (subcontractors.size > 1) {
      (window as any).Swal.fire({
        title: 'Multiple Subcontractors / เลือกผู้รับเหมาหลายราย',
        text: 'You can only batch invoice jobs from the same subcontractor.\n(ไม่สามารถทำรายการพร้อมกันได้ กรุณาเลือกงานจากผู้รับเหมาเจ้าเดียวกันเท่านั้น)',
        icon: 'warning',
        confirmButtonText: 'OK / รับทราบ',
        customClass: { popup: 'rounded-[1.5rem]' }
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

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const compressImage = async (file: File): Promise<string> => {
    // If not an image (e.g. PDF), fallback to normal Base64
    if (!file.type.startsWith('image/')) {
      return fileToBase64(file);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      img.src = objectUrl;

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Resize logic: Max Width 1280px (Keep aspect ratio)
          const MAX_WIDTH = 1200;
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context unavailable');

          ctx.drawImage(img, 0, 0, width, height);

          // Convert to WebP with 0.8 quality (High quality, low size)
          // This typically reduces 5MB -> ~300-500KB
          const compressedDataUrl = canvas.toDataURL('image/webp', 0.8);

          URL.revokeObjectURL(objectUrl);
          resolve(compressedDataUrl);
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          // Fallback to original if canvas fails
          resolve(fileToBase64(file));
        }
      };

      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      };
    });
  };

  const handleOpenPaymentModal = (jobsToPay: Job[]) => {
    setPaymentTargetJobs(jobsToPay);
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (date: string, file: File | null) => {
    console.log('🔵 PAYMENT STARTED:', { jobCount: paymentTargetJobs.length, jobIds: paymentTargetJobs.map(j => j.id), date });
    let slipUrl = '';
    if (file) {
      // Use the new compression function
      try {
        slipUrl = await compressImage(file);
      } catch (error) {
        console.error("Compression failed, using original", error);
        slipUrl = await fileToBase64(file);
      }
    }

    const logs: AuditLog[] = [];

    paymentTargetJobs.forEach(job => {
      console.log(`🔄 Processing Job ${job.id}: Current status=${job.status}, AccStatus=${job.accountingStatus}`);

      const updatedJob: Job = {
        ...job,
        accountingStatus: AccountingStatus.PAID,
        paymentDate: date,
        paymentSlipUrl: slipUrl,
        isBaseCostLocked: true
      };

      console.log(`✅ Updated Job ${job.id}: New AccStatus=${updatedJob.accountingStatus}, PaymentDate=${updatedJob.paymentDate}`);

      const log: AuditLog = {
        id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        jobId: job.id,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        timestamp: new Date().toISOString(),
        field: 'Payment',
        oldValue: job.accountingStatus || 'Unpaid',
        newValue: 'PAID',
        reason: `Payment Recorded: ${date}`
      };

      logs.push(log);
      onUpdateJob(updatedJob, [log]);
    });

    // Close modal and reset state
    setShowPaymentModal(false);
    setPaymentTargetJobs([]);

    // Auto-switch to READY filter to show only unpaid jobs
    setActiveFilter('READY');

    (window as any).Swal.fire({
      icon: 'success',
      title: 'บันทึกสำเร็จ!',
      text: `บันทึกการจ่ายเงินสำหรับ ${paymentTargetJobs.length} รายการเรียบร้อยแล้ว`,
      timer: 2000,
      showConfirmButton: false
    });
  };

  const downloadPaymentReport = () => {
    const headers = ['Job ID', 'Date', 'Subcontractor', 'Origin', 'Drop-off Points', 'Destination', 'Cost', 'Extra', 'Total', 'Payment Date', 'Status'];
    const rows = filteredJobs.map(j => [
      j.id,
      formatDate(j.dateOfService),
      j.subcontractor || '-',
      `"${j.origin}"`,
      `"${j.drops && j.drops.length > 0 ? j.drops.map(d => d.location).join('; ') : '-'}"`,
      `"${j.destination}"`,
      j.cost || 0,
      j.extraCharge || 0,
      (j.cost || 0) + (j.extraCharge || 0),
      j.paymentDate ? formatDate(j.paymentDate) : '-',
      j.accountingStatus || '-'
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `payment_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="space-y-10">
      {/* Power BI Inspired Header Dashboard */}
      <section>
        <div className="mb-8 font-display">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">
            Billing & Financial <span className="text-gradient">Command Center</span>
          </h2>
          <p className="text-sm text-slate-400 font-bold uppercase tracking-widest mt-1">
            Management console for end-to-end financial workflows
          </p>
        </div>

        <BillingFinancialDashboard
          jobs={jobs}
          activeStage={viewTab}
          onStageSelect={(stage) => {
            setViewTab(stage);
            setActiveFilter('ALL');
            setCurrentPage(1);
          }}
        />
      </section>

      {/* Action Bar & Sub-Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm">
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full animate-pulse ${viewTab === 'VERIFICATION' ? 'bg-slate-400' :
            viewTab === 'TO_BILL' ? 'bg-indigo-600' :
              viewTab === 'TO_PAY' ? 'bg-amber-500' : 'bg-emerald-500'
            }`}></div>
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-[0.3em] font-display">
            Active Stream: <span className="text-blue-600">{viewTab.replace('_', ' ')}</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Sub-Filters - Only for VERIFICATION tab */}
          {viewTab === 'VERIFICATION' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
              <button
                onClick={() => setActiveFilter('ALL')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                All Review
              </button>
              <button
                onClick={() => setActiveFilter('REJECTED')}
                className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeFilter === 'REJECTED' ? 'bg-rose-600 text-white shadow-lg' : 'text-rose-400 hover:text-rose-600'}`}
              >
                Rejected Items
              </button>
            </div>
          )}

          {/* Export button for PAID tab */}
          {viewTab === 'PAID' && (
            <button
              onClick={downloadPaymentReport}
              className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100 flex items-center gap-2"
            >
              <Download size={14} /> Settlement Export
            </button>
          )}

          {/* Batch Actions for TO_BILL */}
          {viewTab === 'TO_BILL' && selectedJobIds.length > 0 && (
            <button
              onClick={handleBatchBill}
              className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-indigo-600 text-white shadow-lg shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-2 animate-in zoom-in duration-200"
            >
              <Receipt size={14} /> Batch Acknowledge ({selectedJobIds.length})
            </button>
          )}

          {/* Batch Actions for TO_PAY */}
          {viewTab === 'TO_PAY' && selectedJobIds.length > 0 && (
            <button
              onClick={() => handleOpenPaymentModal(jobs.filter(j => selectedJobIds.includes(j.id)))}
              className="px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-amber-600 text-white shadow-lg shadow-amber-100 hover:bg-amber-700 flex items-center gap-2 animate-in zoom-in duration-200"
            >
              <CreditCard size={14} /> Batch Pay Now ({selectedJobIds.length})
            </button>
          )}
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
                      {job.requestedByName && (
                        <div className="flex items-center gap-1.5 mt-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 w-fit">
                          <span className="text-[9px] font-bold text-indigo-600">👤 {job.requestedByName}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-2 bg-white border border-slate-100 rounded-lg px-2 py-1 w-fit">
                        <History size={10} className="text-slate-400" />
                        <span className="text-[9px] font-bold text-slate-400">{formatDate(job.dateOfService)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="space-y-1">
                        <div className="flex justify-between items-center gap-8 min-w-[180px]">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">BASE:</span>
                          <span className="font-black text-slate-700 text-lg">฿{formatThaiCurrency(Number(job.cost) || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center gap-8">
                          <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter">EXTRA:</span>
                          <span className="font-bold text-amber-600">+ ฿{formatThaiCurrency(Number(job.extraCharge) || 0)}</span>
                        </div>
                        <div className="pt-2 mt-1 border-t border-slate-100 flex justify-between items-center gap-8">
                          <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">TOTAL:</span>
                          <span className="font-black text-slate-900 text-xl tracking-tight">฿{formatThaiCurrency(Number(job.cost || 0) + Number(job.extraCharge || 0))}</span>
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
                      <div className="flex flex-col gap-2 relative z-10">
                        {/* POD / Evidence Display */}
                        {job.podImageUrls && job.podImageUrls.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {job.podImageUrls.map((url, idx) => {
                              const isPdf = url.startsWith('data:application/pdf');
                              return (
                                <button
                                  key={idx}
                                  onClick={() => {
                                    if ((window as any).Swal) {
                                      if (isPdf) {
                                        const base64Content = url.split(',')[1];
                                        const byteCharacters = atob(base64Content);
                                        const byteNumbers = new Array(byteCharacters.length);
                                        for (let i = 0; i < byteCharacters.length; i++) {
                                          byteNumbers[i] = byteCharacters.charCodeAt(i);
                                        }
                                        const byteArray = new Uint8Array(byteNumbers);
                                        const blob = new Blob([byteArray], { type: 'application/pdf' });
                                        const blobUrl = URL.createObjectURL(blob);

                                        (window as any).Swal.fire({
                                          html: `<iframe src="${blobUrl}" width="100%" height="600px" style="border:none; border-radius: 8px;"></iframe>`,
                                          showConfirmButton: false,
                                          width: '800px',
                                          showCloseButton: true,
                                          willClose: () => URL.revokeObjectURL(blobUrl)
                                        });
                                      } else {
                                        (window as any).Swal.fire({
                                          imageUrl: url,
                                          imageAlt: 'POD',
                                          showConfirmButton: false,
                                          width: 'auto',
                                          background: 'transparent',
                                          backdrop: 'rgba(0,0,0,0.8)',
                                          showCloseButton: true
                                        });
                                      }
                                    }
                                  }}
                                  className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 hover:scale-110 transition-transform overflow-hidden shadow-sm relative flex items-center justify-center group"
                                  title={`View POD ${idx + 1}`}
                                >
                                  {isPdf ? (
                                    <FileText size={16} className="text-rose-500" />
                                  ) : (
                                    <img
                                      src={url}
                                      alt={`POD ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic flex items-center gap-1">
                            <AlertCircle size={12} /> No POD
                          </span>
                        )}

                        {/* Billing Doc Reference */}
                        {job.billingDocNo && (
                          <div className="mt-1 pt-2 border-t border-slate-100">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-1">Billing Ref:</span>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-700 font-mono bg-slate-100 px-1.5 py-0.5 rounded">{job.billingDocNo}</span>
                              <button
                                onClick={() => {
                                  const relatedJobs = jobs.filter(j => j.billingDocNo === job.billingDocNo);
                                  setSelectedInvoiceJobs(relatedJobs.length > 0 ? relatedJobs : [job]);
                                  setShowInvoiceModal(true);
                                  setIsInvoiceViewMode(true);
                                }}
                                className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-blue-600 transition-colors"
                                title="View Billing Acknowledgement"
                              >
                                <Receipt size={14} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Payment Slip - Show in PAID tab */}
                        {viewTab === 'PAID' && job.paymentSlipUrl && (
                          <div className="mt-1 pt-2 border-t border-slate-100">
                            <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Payment Slip:</span>
                            <button
                              onClick={async () => {
                                try {
                                  const response = await fetch(job.paymentSlipUrl!);
                                  const blob = await response.blob();
                                  const url = URL.createObjectURL(blob);

                                  (window as any).Swal.fire({
                                    title: 'สลิปการจ่ายเงิน',
                                    html: `
                                      <div class="space-y-2">
                                        <p class="text-sm text-slate-600">Job ID: <strong>${job.id}</strong></p>
                                        <p class="text-sm text-slate-600">Payment Date: <strong>${job.paymentDate ? formatDate(job.paymentDate) : 'N/A'}</strong></p>
                                        <img src="${url}" class="max-w-full h-auto rounded-lg shadow-lg" />
                                      </div>
                                    `,
                                    width: '600px',
                                    showCloseButton: true,
                                    showConfirmButton: false,
                                    customClass: { popup: 'rounded-[2rem]' },
                                    didClose: () => {
                                      URL.revokeObjectURL(url);
                                    }
                                  });
                                } catch (error) {
                                  console.error('Error loading payment slip:', error);
                                  (window as any).Swal.fire({
                                    icon: 'error',
                                    title: 'ไม่สามารถโหลดสลิปได้',
                                    text: 'กรุณาลองใหม่อีกครั้ง',
                                  });
                                }
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors border border-emerald-200"
                              title="View Payment Slip"
                            >
                              <CreditCard size={14} /> ดูสลิปการจ่าย
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-right">
                      <div className="flex flex-col gap-2 items-end">
                        {/* Accounting Actions (Only for PENDING or REJECTED) */}
                        {user.role === UserRole.ACCOUNTANT || user.role === UserRole.ADMIN ? (
                          <div className="flex items-center gap-2">
                            {job.accountingStatus !== AccountingStatus.APPROVED &&
                              job.accountingStatus !== AccountingStatus.LOCKED &&
                              job.accountingStatus !== AccountingStatus.PAID && (
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

                            {/* Manual Lock button removed to enforce Payment Slip requirement */}
                          </div>
                        ) : (
                          <span className="text-[10px] font-black text-slate-300 uppercase italic">Access Restricted (Audit Only)</span>
                        )}

                        {/* Payment Actions - Show in TO_PAY tab */}
                        {viewTab === 'TO_PAY' && job.status === JobStatus.BILLED && job.accountingStatus !== AccountingStatus.PAID && job.accountingStatus !== AccountingStatus.LOCKED && (
                          <button
                            onClick={() => handleOpenPaymentModal([job])}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex flex-col items-center gap-1 min-w-[120px]"
                          >
                            <span>แจ้งชำระเงิน</span>
                            <span className="opacity-80">(TO PAY)</span>
                          </button>
                        )}

                        {job.accountingStatus === AccountingStatus.PAID && (
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-[10px] font-black uppercase tracking-[0.2em] border border-emerald-200">
                              <CreditCard size={12} /> PAID & LOCKED
                            </div>
                            {job.paymentDate && <span className="text-[9px] font-bold text-slate-400">Date: {formatDate(job.paymentDate)}</span>}
                          </div>
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
      {
        selectedJobIds.length > 0 && (
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
        )
      }

      {/* Invoice Preview Modal */}
      {
        showInvoiceModal && selectedInvoiceJobs.length > 0 && (
          <InvoicePreviewModal
            jobs={selectedInvoiceJobs}
            readOnly={isInvoiceViewMode}
            existingDocNo={isInvoiceViewMode ? selectedInvoiceJobs[0]?.billingDocNo : undefined}
            existingDate={isInvoiceViewMode ? selectedInvoiceJobs[0]?.billingDate : undefined}
            priceMatrix={priceMatrix}
            onClose={() => {
              setShowInvoiceModal(false);
              setSelectedInvoiceJobs([]);
              setIsInvoiceViewMode(false);
            }}
            onBatchConfirm={(updatedJobs) => {
              updatedJobs.forEach(uj => onUpdateJob(uj));
              setShowInvoiceModal(false);
              setSelectedInvoiceJobs([]);
              setSelectedJobIds([]);
              setIsInvoiceViewMode(false);
            }}
          />
        )
      }

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        onSubmit={handleConfirmPayment}
        totalAmount={paymentTargetJobs.reduce((sum, j) => sum + (j.cost || 0) + (j.extraCharge || 0), 0)}
        jobCount={paymentTargetJobs.length}
      />
    </div>
  );
};

export default BillingView;
