import React, { useState, useMemo } from 'react';
import { Job, JobStatus, AccountingStatus, ExtraChargeDetail, UserRole } from '../types';
import {
    CheckCircle, XCircle, AlertTriangle, FileText,
    Truck, MapPin, Calendar, DollarSign, Search,
    ChevronRight, ChevronDown, Lock, Eye, X
} from 'lucide-react';
import Swal from 'sweetalert2';

const dataURItoBlob = (dataURI: string) => {
    try {
        if (!dataURI.startsWith('data:')) return null;
        const splitData = dataURI.split(',');
        if (splitData.length < 2) return null;
        const byteString = atob(splitData[1]);
        const mimeString = splitData[0].split(':')[1].split(';')[0];
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], { type: mimeString });
    } catch (e) {
        console.error('Blob conversion failed', e);
        return null;
    }
};

interface AccountingVerificationViewProps {
    jobs: Job[];
    onUpdateJob: (updatedJob: Job, action: 'approve' | 'reject' | 'update', reason?: string) => void;
    userRole: UserRole;
}

const AccountingVerificationView: React.FC<AccountingVerificationViewProps> = ({ jobs, onUpdateJob, userRole }) => {
    const [filterStatus, setFilterStatus] = useState<AccountingStatus | 'ALL'>(AccountingStatus.PENDING_REVIEW);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    // Filter jobs: Only Completed jobs are relevant for accounting
    const accountingJobs = useMemo(() => {
        return jobs.filter(job => {
            // Must be completed or billed
            const isRelevantState = job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED;
            if (!isRelevantState) return false;

            // Search filter
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                job.id.toLowerCase().includes(searchLower) ||
                (job.licensePlate || '').toLowerCase().includes(searchLower) ||
                (job.subcontractor || '').toLowerCase().includes(searchLower);

            // Status filter
            const statusMatch = filterStatus === 'ALL'
                ? true
                : (job.accountingStatus || AccountingStatus.PENDING_REVIEW) === filterStatus;

            // If filtering for PENDING_REVIEW, treat undefined/null as PENDING
            if (filterStatus === AccountingStatus.PENDING_REVIEW) {
                return (job.accountingStatus === AccountingStatus.PENDING_REVIEW || !job.accountingStatus) && matchesSearch;
            }

            return statusMatch && matchesSearch;
        }).sort((a, b) => new Date(b.dateOfService).getTime() - new Date(a.dateOfService).getTime());
    }, [jobs, filterStatus, searchTerm]);

    const handleApprove = () => {
        if (!selectedJob) return;

        Swal.fire({
            title: 'ยืนยันการอนุมัติ (Confirm Approval)',
            text: `คุณต้องการอนุมัติ Job #${selectedJob.id} ใช่หรือไม่? ข้อมูลจะถูกล็อกบางส่วนหลังการอนุมัติ`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#6B7280',
            confirmButtonText: 'ยืนยันอนุมัติ',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                onUpdateJob(selectedJob, 'approve');
                setSelectedJob(null);
                Swal.fire('Approved!', 'อนุมัติงานเรียบร้อยแล้ว', 'success');
            }
        });
    };

    const handleReject = () => {
        if (!selectedJob) return;
        if (!rejectReason.trim()) {
            Swal.fire('Error', 'กรุณาระบุเหตุผลที่ไม่อนุมัติ (Reason is required)', 'error');
            return;
        }

        Swal.fire({
            title: 'ยืนยันการตีกลับ (Confirm Reject)',
            text: `คุณต้องการส่งคืนงาน #${selectedJob.id} ให้แก้ไขใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#EF4444',
            cancelButtonColor: '#6B7280',
            confirmButtonText: 'ยืนยันตีกลับ',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                onUpdateJob(selectedJob, 'reject', rejectReason);
                setSelectedJob(null);
                setRejectReason('');
                Swal.fire('Rejected!', 'ส่งคืนงานเรียบร้อยแล้ว', 'success');
            }
        });
    };

    const formatCurrency = (val: number) => `฿${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return (
        <div className="flex h-[calc(100vh-100px)] gap-6 animate-in fade-in duration-500">
            {/* Left Panel: Job List (Inbox) */}
            <div className="w-1/3 flex flex-col gap-4">
                {/* Search & Filter */}
                <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-200">
                    <h2 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
                        <CheckCircle className="text-blue-600" />
                        ตรวจสอบงาน (Verification)
                    </h2>
                    <div className="flex gap-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
                        {[
                            { id: AccountingStatus.PENDING_REVIEW, label: 'รอตรวจ', icon: <AlertTriangle size={14} /> },
                            { id: AccountingStatus.APPROVED, label: 'อนุมัติแล้ว', icon: <CheckCircle size={14} /> },
                            { id: AccountingStatus.REJECTED, label: 'แก้ไข', icon: <XCircle size={14} /> },
                            { id: 'ALL', label: 'ทั้งหมด', icon: <FileText size={14} /> },
                        ].map(status => (
                            <button
                                key={status.id}
                                onClick={() => setFilterStatus(status.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1 transition-all ${filterStatus === status.id
                                    ? 'bg-slate-800 text-white shadow-md'
                                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                    }`}
                            >
                                {status.icon} {status.label}
                            </button>
                        ))}
                    </div>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="ค้นหา Job ID, ทะเบียนรถ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {/* Job List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {accountingJobs.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                            <CheckCircle size={48} className="mx-auto mb-2 text-slate-300" />
                            <p className="text-slate-400 font-bold">ไม่มีงานที่ต้องตรวจสอบ</p>
                        </div>
                    ) : (
                        accountingJobs.map(job => (
                            <div
                                key={job.id}
                                onClick={() => setSelectedJob(job)}
                                className={`p-4 rounded-[1.5rem] border cursor-pointer transition-all hover:scale-[1.02] active:scale-95 ${selectedJob?.id === job.id
                                    ? 'bg-blue-50 border-blue-500 shadow-lg ring-2 ring-blue-200'
                                    : 'bg-white border-slate-200 hover:shadow-md'
                                    }`}
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <span className="text-xs font-black text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">#{job.id}</span>
                                    <div className="flex items-center gap-2">
                                        {(job.extraCharge || 0) > 0 && <span className="text-[10px] bg-amber-100 text-amber-600 font-bold px-2 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle size={10} /> Extra</span>}
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${job.accountingStatus === 'Approved' ? 'bg-emerald-100 text-emerald-600' :
                                            job.accountingStatus === 'Rejected' ? 'bg-rose-100 text-rose-600' :
                                                'bg-slate-100 text-slate-500'
                                            }`}>
                                            {job.accountingStatus || 'Pending'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-600">
                                    <MapPin size={12} className="text-blue-500" />
                                    <span className="truncate max-w-[120px]">{job.origin}</span>
                                    <span className="text-slate-300">→</span>
                                    <span className="truncate max-w-[120px]">{job.destination}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                    <span className="text-xs text-slate-400">{new Date(job.dateOfService).toLocaleDateString('th-TH')}</span>
                                    <span className="text-sm font-black text-slate-800">{formatCurrency((job.cost || 0) + (job.extraCharge || 0))}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Detail View (Verification Panel) */}
            <div className="w-2/3 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-6 flex flex-col h-full overflow-hidden">
                {selectedJob ? (
                    <>
                        {/* Header */}
                        <div className="flex justify-between items-start mb-6 pb-6 border-b border-slate-100">
                            <div>
                                <h1 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                    Job #{selectedJob.id}
                                    {selectedJob.accountingStatus === 'Approved' && <Lock size={20} className="text-emerald-500" />}
                                </h1>
                                <p className="text-slate-500 font-medium mt-1 flex items-center gap-2">
                                    <Truck size={16} /> {selectedJob.licensePlate} ({selectedJob.truckType})
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-600">{selectedJob.subcontractor}</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-3xl font-black text-slate-900 tracking-tight">{formatCurrency((selectedJob.cost || 0) + (selectedJob.extraCharge || 0))}</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Verified Cost</p>
                            </div>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto pr-2 space-y-6">

                            {/* 1. Evidence Check */}
                            <div className="bg-slate-50 p-6 rounded-[2rem]">
                                <h3 className="text-sm font-black text-slate-700 uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <Eye size={16} /> หลักฐานการจบงาน (Proof of Delivery)
                                </h3>
                                {selectedJob.podImageUrls && selectedJob.podImageUrls.length > 0 ? (
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        {selectedJob.podImageUrls.map((url, idx) => {
                                            const isPdf = url.startsWith('data:application/pdf');
                                            return (
                                                <div key={idx} className="aspect-square rounded-2xl overflow-hidden bg-white shadow-sm border border-slate-200 group relative flex items-center justify-center">
                                                    {isPdf ? (
                                                        <div className="flex flex-col items-center gap-2 text-slate-400">
                                                            <FileText size={40} className="text-red-500" />
                                                            <span className="text-[10px] font-black uppercase">PDF Document</span>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={url || 'https://placehold.co/400x400/f1f5f9/cbd5e1?text=No+Data'}
                                                            alt="POD Evidence"
                                                            loading="lazy"
                                                            className="w-full h-full object-cover transition-transform group-hover:scale-110 bg-slate-100"
                                                            onError={(e) => {
                                                                const target = e.target as HTMLImageElement;
                                                                // Prevent infinite loop if placeholder fails
                                                                if (!target.src.includes('placehold.co')) {
                                                                    target.src = 'https://placehold.co/400x400/f8fafc/cbd5e1?text=Load+Error';
                                                                    target.className = "w-full h-full object-contain p-4 bg-slate-50 opacity-50";
                                                                }
                                                            }}
                                                        />
                                                    )}
                                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                                                        <button
                                                            onClick={() => {
                                                                setPreviewImage(url);
                                                            }}
                                                            className="text-white bg-white/20 backdrop-blur-md p-2 rounded-full hover:bg-white/40 shadow-xl"
                                                            title="เปิดดูแบบเต็มหน้าจอ (View Full Screen)"
                                                        >
                                                            <Eye size={20} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-300">
                                        <p className="text-slate-400 italic">ไม่พบรูปภาพ POD (No Evidence Uploaded)</p>
                                    </div>
                                )}
                            </div>

                            {/* 2. Financial Breakdown */}
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-6 rounded-[2rem] border border-slate-200">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4">Base Cost (ค่าขนส่งปกติ)</h4>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-slate-600 font-bold">Standard Rate</span>
                                        <span className="text-slate-900 font-black text-lg">{formatCurrency(selectedJob.cost || 0)}</span>
                                    </div>
                                    <div className="bg-slate-100 p-3 rounded-xl text-xs text-slate-500">
                                        <p>Route: {selectedJob.origin} - {selectedJob.destination}</p>
                                        <p>Locked by System</p>
                                    </div>
                                </div>

                                <div className={`p-6 rounded-[2rem] border ${selectedJob.extraCharge ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center gap-2">
                                        Extra Charges (ค่าใช้จ่ายพิเศษ)
                                        {selectedJob.extraCharge ? <AlertTriangle size={14} className="text-amber-500" /> : null}
                                    </h4>
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-slate-600 font-bold">Amount</span>
                                        <span className="text-slate-900 font-black text-lg">{formatCurrency(selectedJob.extraCharge || 0)}</span>
                                    </div>
                                    {selectedJob.extraCharges && selectedJob.extraCharges.length > 0 && (
                                        <div className="space-y-2 mt-4">
                                            {selectedJob.extraCharges.map((charge, idx) => (
                                                <div key={idx} className="bg-white/50 p-2 rounded-lg text-xs flex justify-between items-center">
                                                    <span>{charge.type}</span>
                                                    <span className="font-bold">{formatCurrency(charge.amount)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                        </div>

                        {/* Actions Footer */}
                        <div className="pt-6 border-t border-slate-100 mt-auto">
                            {selectedJob.accountingStatus === 'Approved' ? (
                                <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl flex items-center justify-center gap-3 font-bold border border-emerald-100">
                                    <CheckCircle /> งานนี้ได้รับการอนุมัติแล้ว (Verified & Approved)
                                </div>
                            ) : (
                                <div className="flex gap-4">
                                    <div className="flex-1 flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="ระบุเหตุผลกรณีไม่อนุมัติ (Reason for Rejection)..."
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-bold"
                                        />
                                        <button
                                            onClick={handleReject}
                                            className="px-6 py-3 bg-rose-100 text-rose-600 rounded-2xl font-black hover:bg-rose-200 transition-all flex items-center gap-2"
                                        >
                                            <XCircle size={18} /> Reject
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleApprove}
                                        className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-black shadow-lg hover:bg-emerald-500 hover:shadow-emerald-200 transition-all flex items-center gap-2"
                                    >
                                        <CheckCircle size={18} /> Approve
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-300 opacity-60">
                        <FileText size={80} className="mb-4" />
                        <p className="text-lg font-bold">เลือกรายการทางซ้ายเพื่อตรวจสอบ</p>
                        <p className="text-sm">Select a job to verify</p>
                    </div>
                )}
            </div>

            {/* Image Preview Modal (Lightbox) */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewImage(null)}>
                    <button
                        onClick={() => setPreviewImage(null)}
                        className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-full"
                        aria-label="Close Preview"
                        title="Close Preview"
                    >
                        <X size={32} />
                    </button>
                    {previewImage && (previewImage.startsWith('data:application/pdf') || previewImage.endsWith('.pdf')) ? (() => {
                        const blob = dataURItoBlob(previewImage);
                        const displayUrl = blob ? URL.createObjectURL(blob) : previewImage;
                        return (
                            <div className="w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden relative">
                                <iframe
                                    src={displayUrl}
                                    className="w-full h-full"
                                    title="PDF Document Preview"
                                />
                                <div className="absolute bottom-6 right-6 z-10">
                                    <a
                                        href={previewImage}
                                        download="document.pdf"
                                        className="px-6 py-3 bg-slate-900 text-white rounded-xl text-sm font-black shadow-lg hover:bg-black transition-all flex items-center gap-2"
                                    >
                                        <FileText size={16} /> Download
                                    </a>
                                </div>
                            </div>
                        );
                    })() : (
                        <img
                            src={previewImage || ''}
                            alt="Full Preview"
                            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default AccountingVerificationView;
