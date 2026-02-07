import React, { useState, useMemo } from 'react';
import { Job, JobStatus, AccountingStatus, ExtraChargeDetail, UserRole, PriceMatrix } from '../types';
import {
    CheckCircle, XCircle, AlertTriangle, FileText,
    Truck, MapPin, Calendar, DollarSign, Search,
    ChevronRight, ChevronDown, Lock, Eye, X, Edit3, Trash2, Plus, Save
} from 'lucide-react';
import Swal from 'sweetalert2';
import { formatThaiCurrency, roundHalfUp, formatDate } from '../utils/format';

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
    priceMatrix: PriceMatrix[];
}

const AccountingVerificationView: React.FC<AccountingVerificationViewProps> = ({ jobs, onUpdateJob, userRole, priceMatrix }) => {
    const [filterStatus, setFilterStatus] = useState<AccountingStatus | 'ALL'>(AccountingStatus.PENDING_REVIEW);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    
    // Extra Charges Edit State
    const [editingExtraCharges, setEditingExtraCharges] = useState(false);
    const [editedCharges, setEditedCharges] = useState<ExtraChargeDetail[]>([]);
    const [newCharge, setNewCharge] = useState({ type: '', amount: 0, reason: '' });

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

    const formatCurrency = (val: number) => `฿${formatThaiCurrency(val)}`;

    // Calculate Drop Fee and Financial Summary for selected job
    const getFinancialSummary = (job: Job) => {
        // Find matching price matrix
        const matchedPrice = priceMatrix.find(p =>
            p.origin?.trim() === job.origin?.trim() &&
            p.destination?.trim() === job.destination?.trim() &&
            p.truckType?.trim() === job.truckType?.trim() &&
            p.subcontractor?.trim() === job.subcontractor?.trim()
        );

        const dropCount = job.drops?.length || 0;
        const dropFeePerPoint = matchedPrice?.dropOffFee || 0;
        const totalDropFee = dropCount * dropFeePerPoint;
        
        const baseCost = job.cost || 0;
        const extraCharge = job.extraCharge || 0;
        const totalCost = baseCost + extraCharge; // Drop fee is usually included in cost
        
        const sellingPrice = job.sellingPrice || 0;
        const profit = sellingPrice - totalCost;
        const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;

        return {
            baseCost,
            dropCount,
            dropFeePerPoint,
            totalDropFee,
            extraCharge,
            totalCost,
            sellingPrice,
            profit,
            margin,
            paymentTerms: matchedPrice?.paymentType || 'CREDIT',
            creditDays: matchedPrice?.creditDays || 30
        };
    };

    // Extra Charges Management Functions
    const startEditingExtraCharges = () => {
        if (!selectedJob) return;
        setEditedCharges(selectedJob.extraCharges ? [...selectedJob.extraCharges] : []);
        setEditingExtraCharges(true);
    };

    const handleDeleteCharge = (chargeId: string) => {
        setEditedCharges(prev => prev.filter(c => c.id !== chargeId));
    };

    const handleEditChargeAmount = (chargeId: string, newAmount: number) => {
        setEditedCharges(prev => prev.map(c => 
            c.id === chargeId ? { ...c, amount: newAmount } : c
        ));
    };

    const handleAddCharge = () => {
        if (!newCharge.type.trim()) return;
        const newChargeItem: ExtraChargeDetail = {
            id: `EC-${Date.now()}`,
            type: newCharge.type,
            amount: newCharge.amount,
            reason: newCharge.reason || newCharge.type,
            status: 'PENDING'
        };
        setEditedCharges(prev => [...prev, newChargeItem]);
        setNewCharge({ type: '', amount: 0, reason: '' });
    };

    const handleSaveExtraCharges = () => {
        if (!selectedJob) return;
        
        const newTotalExtraCharge = editedCharges.reduce((sum, c) => sum + c.amount, 0);
        
        Swal.fire({
            title: 'บันทึกการแก้ไข Extra Charges',
            html: `
                <p>ยอด Extra Charges ใหม่: <strong>฿${formatThaiCurrency(newTotalExtraCharge)}</strong></p>
                <p class="text-sm text-gray-500 mt-2">จำนวนรายการ: ${editedCharges.length} รายการ</p>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10B981',
            cancelButtonColor: '#6B7280',
            confirmButtonText: 'บันทึก',
            cancelButtonText: 'ยกเลิก'
        }).then((result) => {
            if (result.isConfirmed) {
                const updatedJob: Job = {
                    ...selectedJob,
                    extraCharges: editedCharges,
                    extraCharge: newTotalExtraCharge
                };
                onUpdateJob(updatedJob, 'update', 'แก้ไข Extra Charges');
                setSelectedJob(updatedJob);
                setEditingExtraCharges(false);
                Swal.fire('บันทึกแล้ว!', 'แก้ไข Extra Charges เรียบร้อย', 'success');
            }
        });
    };

    const handleCancelEditCharges = () => {
        setEditingExtraCharges(false);
        setEditedCharges([]);
        setNewCharge({ type: '', amount: 0, reason: '' });
    };

    return (
        <div className="flex flex-col lg:flex-row h-auto lg:h-[calc(100vh-100px)] gap-4 lg:gap-6 animate-in fade-in duration-500">
            {/* Left Panel: Job List (Inbox) */}
            <div className={`w-full lg:w-1/3 flex flex-col gap-4 ${selectedJob ? 'hidden lg:flex' : 'flex'}`}>
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
                                    <span className="text-xs text-slate-400">{formatDate(job.dateOfService)}</span>
                                    <span className="text-sm font-black text-slate-800">{formatCurrency((job.cost || 0) + (job.extraCharge || 0))}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Right Panel: Detail View (Verification Panel) */}
            <div className={`w-full lg:w-2/3 bg-white rounded-2xl lg:rounded-[2.5rem] border border-slate-200 shadow-xl p-4 sm:p-6 flex flex-col lg:h-full overflow-hidden ${selectedJob ? 'flex' : 'hidden lg:flex'}`}>
                {selectedJob ? (
                    <>
                        {/* Mobile Back Button */}
                        <button
                            onClick={() => setSelectedJob(null)}
                            className="lg:hidden flex items-center gap-2 text-sm font-bold text-blue-600 mb-4 hover:text-blue-800 transition-colors"
                        >
                            <ChevronRight size={16} className="rotate-180" /> ย้อนกลับรายการ
                        </button>
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-slate-100">
                            <div className="min-w-0">
                                <h1 className="text-lg sm:text-2xl font-black text-slate-800 flex items-center gap-2 sm:gap-3">
                                    Job #{selectedJob.id}
                                    {selectedJob.accountingStatus === 'Approved' && <Lock size={18} className="text-emerald-500" />}
                                </h1>
                                <p className="text-slate-500 font-medium mt-1 flex items-center gap-2 flex-wrap text-xs sm:text-sm">
                                    <Truck size={14} /> {selectedJob.licensePlate} ({selectedJob.truckType})
                                    <span className="text-slate-300">|</span>
                                    <span className="text-slate-600 truncate">{selectedJob.subcontractor}</span>
                                </p>
                            </div>
                            <div className="text-left sm:text-right shrink-0">
                                <p className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">{formatCurrency((selectedJob.cost || 0) + (selectedJob.extraCharge || 0))}</p>
                                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Total Verified Cost</p>
                            </div>
                        </div>

                        {/* Content Scrollable */}
                        <div className="flex-1 overflow-y-auto pr-2 space-y-6">

                            {/* 1. Evidence Check */}
                            <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem]">
                                <h3 className="text-xs sm:text-sm font-black text-slate-700 uppercase tracking-wider sm:tracking-widest mb-3 sm:mb-4 flex items-center gap-2">
                                    <Eye size={14} /> หลักฐาน (Proof of Delivery)
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

                            {/* 2. Financial Breakdown - New Enhanced Layout */}
                            {(() => {
                                const summary = getFinancialSummary(selectedJob);
                                return (
                                    <div className="space-y-4">
                                        {/* Section Header */}
                                        <div className="flex items-center gap-2 mb-2">
                                            <DollarSign size={18} className="text-emerald-600" />
                                            <h3 className="text-sm font-black text-slate-700 uppercase tracking-wider">
                                                💰 สรุปค่าใช้จ่ายและรายรับ (Cost & Revenue Summary)
                                            </h3>
                                        </div>

                                        {/* Cost Breakdown - 3 Columns */}
                                        <div className="grid grid-cols-3 gap-4">
                                            {/* Base Cost */}
                                            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50">
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                                                    🚛 Base Cost (ค่าขนส่งหลัก)
                                                </h4>
                                                <p className="text-xl font-black text-slate-800">{formatCurrency(summary.baseCost)}</p>
                                                <div className="mt-2 text-[10px] text-slate-500 bg-white p-2 rounded-lg">
                                                    <p>Route: {selectedJob.origin} → {selectedJob.destination}</p>
                                                    <p className="flex items-center gap-1 mt-1">
                                                        <Lock size={10} /> Locked by System
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Drop Fee */}
                                            <div className={`p-4 rounded-2xl border ${summary.dropCount > 0 ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                                                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">
                                                    📍 Drop Fee (ค่าจุดแวะส่ง)
                                                </h4>
                                                {summary.dropCount > 0 ? (
                                                    <>
                                                        <p className="text-xl font-black text-blue-700">{formatCurrency(summary.totalDropFee)}</p>
                                                        <div className="mt-2 bg-white p-2 rounded-lg space-y-2">
                                                            {/* Drop-off Points List */}
                                                            <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                                                {selectedJob.drops?.map((drop, idx) => (
                                                                    <div key={idx} className="flex items-center gap-2 text-[10px] bg-slate-50 p-1.5 rounded">
                                                                        <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-[9px]">
                                                                            {idx + 1}
                                                                        </span>
                                                                        <span className="flex-1 font-medium text-slate-700 truncate">{drop.location}</span>
                                                                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${drop.status === 'Completed' || drop.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : drop.status === 'Pending' || drop.status === 'pending' ? 'bg-yellow-100 text-yellow-600' : 'bg-slate-100 text-slate-500'}`}>
                                                                            {drop.status === 'Completed' || drop.status === 'completed' ? '✅ ส่งแล้ว' : drop.status === 'Pending' || drop.status === 'pending' ? '⏳ รอส่ง' : drop.status || '-'}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="border-t border-slate-200 pt-2 flex justify-between text-xs">
                                                                <span className="text-slate-500">จำนวนจุด:</span>
                                                                <span className="font-black text-blue-600">{summary.dropCount} จุด</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs">
                                                                <span className="text-slate-500">ราคา/จุด:</span>
                                                                <span className="font-bold text-slate-700">{formatCurrency(summary.dropFeePerPoint)}</span>
                                                            </div>
                                                            <div className="flex justify-between text-xs font-black text-blue-700 bg-blue-50 p-1.5 rounded">
                                                                <span>รวม:</span>
                                                                <span>{summary.dropCount} × {formatCurrency(summary.dropFeePerPoint)} = {formatCurrency(summary.totalDropFee)}</span>
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="text-xl font-black text-slate-400">฿0.00</p>
                                                        <p className="mt-2 text-[10px] text-slate-400 italic">ไม่มีจุดแวะส่งเพิ่มเติม</p>
                                                    </>
                                                )}
                                            </div>

                                            {/* Extra Charges */}
                                            <div className={`p-4 rounded-2xl border ${summary.extraCharge !== 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                        ⚡ Extra Charges (ค่าใช้จ่ายพิเศษ)
                                                        {summary.extraCharge !== 0 && <AlertTriangle size={12} className="text-amber-500" />}
                                                    </h4>
                                                    {selectedJob.accountingStatus !== 'Approved' && !editingExtraCharges && (
                                                        <button
                                                            onClick={startEditingExtraCharges}
                                                            className="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-600 rounded font-bold hover:bg-blue-200 transition-all flex items-center gap-1"
                                                        >
                                                            <Edit3 size={10} /> แก้ไข
                                                        </button>
                                                    )}
                                                </div>
                                                
                                                {!editingExtraCharges ? (
                                                    <>
                                                        <p className={`text-xl font-black ${summary.extraCharge < 0 ? 'text-red-600' : summary.extraCharge > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                                                            {formatCurrency(summary.extraCharge)}
                                                        </p>
                                                        {selectedJob.extraCharges && selectedJob.extraCharges.length > 0 && (
                                                            <div className="mt-2 bg-white p-2 rounded-lg space-y-1 max-h-24 overflow-y-auto">
                                                                {selectedJob.extraCharges.map((charge, idx) => (
                                                                    <div key={idx} className="flex justify-between text-[10px]">
                                                                        <span className="text-slate-500">{charge.type}</span>
                                                                        <span className={`font-bold ${charge.amount < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                                                                            {formatCurrency(charge.amount)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="text-[10px] font-bold text-blue-600 bg-blue-50 p-1.5 rounded">
                                                            📝 โหมดแก้ไข
                                                        </div>
                                                        <div className="max-h-32 overflow-y-auto space-y-1">
                                                            {editedCharges.map((charge) => (
                                                                <div key={charge.id} className="bg-white p-2 rounded border border-slate-200 flex items-center gap-2">
                                                                    <span className="text-[10px] font-bold text-slate-600 flex-1 truncate">{charge.type}</span>
                                                                    <input
                                                                        type="number"
                                                                        value={charge.amount}
                                                                        onChange={(e) => handleEditChargeAmount(charge.id, Number(e.target.value))}
                                                                        title={`Edit amount for ${charge.type}`}
                                                                        placeholder="Amount"
                                                                        className="w-20 px-1.5 py-0.5 text-right text-xs font-bold border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                                                                    />
                                                                    <button 
                                                                        onClick={() => handleDeleteCharge(charge.id)} 
                                                                        title={`Delete ${charge.type}`}
                                                                        className="text-red-500 hover:bg-red-50 rounded p-0.5"
                                                                    >
                                                                        <Trash2 size={12} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="bg-slate-100 p-2 rounded border border-dashed border-slate-300">
                                                            <div className="flex gap-1">
                                                                <input type="text" placeholder="ประเภท" value={newCharge.type}
                                                                    onChange={(e) => setNewCharge(prev => ({ ...prev, type: e.target.value }))}
                                                                    className="flex-1 px-1.5 py-0.5 text-[10px] border border-slate-300 rounded outline-none" />
                                                                <input type="number" placeholder="฿" value={newCharge.amount || ''}
                                                                    onChange={(e) => setNewCharge(prev => ({ ...prev, amount: Math.max(0, Number(e.target.value)) }))}
                                                                    className="w-16 px-1.5 py-0.5 text-[10px] text-right border border-slate-300 rounded outline-none" />
                                                                <button onClick={handleAddCharge} disabled={!newCharge.type.trim()}
                                                                    title="Add new extra charge"
                                                                    className="px-1.5 bg-blue-500 text-white rounded text-[10px] disabled:opacity-50">
                                                                    <Plus size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="bg-amber-100 p-1.5 rounded flex justify-between items-center text-[10px]">
                                                            <span className="font-bold text-amber-700">ยอดรวมใหม่:</span>
                                                            <span className="font-black text-amber-800">{formatCurrency(editedCharges.reduce((sum, c) => sum + c.amount, 0))}</span>
                                                        </div>
                                                        <div className="flex gap-1">
                                                            <button onClick={handleCancelEditCharges}
                                                                className="flex-1 px-2 py-1 bg-slate-200 text-slate-600 rounded text-[10px] font-bold hover:bg-slate-300">
                                                                ยกเลิก
                                                            </button>
                                                            <button onClick={handleSaveExtraCharges}
                                                                className="flex-1 px-2 py-1 bg-emerald-500 text-white rounded text-[10px] font-bold hover:bg-emerald-600">
                                                                บันทึก
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Totals Row */}
                                        <div className="grid grid-cols-2 gap-4">
                                            {/* Total Cost */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-700 to-slate-800 text-white">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-slate-300 uppercase tracking-wider">
                                                            📤 Total Cost (ต้นทุนรวม)
                                                        </h4>
                                                        <p className="text-xs text-slate-400 mt-0.5">จ่ายให้รถร่วม</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-2xl font-black">{formatCurrency(summary.totalCost)}</p>
                                                        <p className="text-[10px] text-slate-400">
                                                            Base {formatCurrency(summary.baseCost)} + Extra {formatCurrency(summary.extraCharge)}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Total Revenue */}
                                            <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-[10px] font-black text-emerald-200 uppercase tracking-wider">
                                                            📥 Total Revenue (รายรับ)
                                                        </h4>
                                                        <p className="text-xs text-emerald-200 mt-0.5">รายรับจากลูกค้า</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-2xl font-black">{formatCurrency(summary.sellingPrice)}</p>
                                                        <p className="text-[10px] text-emerald-200">Selling Price</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Profit Row */}
                                        <div className={`p-4 rounded-2xl border-2 ${summary.profit >= 0 ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={`p-2 rounded-xl ${summary.profit >= 0 ? 'bg-emerald-100' : 'bg-red-100'}`}>
                                                        <DollarSign size={24} className={summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'} />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xs font-black text-slate-600 uppercase">
                                                            💵 Profit (กำไร)
                                                        </h4>
                                                        <p className={`text-[10px] ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                            Margin: {summary.margin.toFixed(1)}%
                                                        </p>
                                                    </div>
                                                </div>
                                                <p className={`text-3xl font-black ${summary.profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                    {formatCurrency(summary.profit)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Payment Terms Info */}
                                        <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-slate-500 uppercase">💳 Payment Terms:</span>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${summary.paymentTerms === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                                    {summary.paymentTerms === 'CASH' ? '💵 เงินสด' : `📅 เครดิต ${summary.creditDays} วัน`}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400">
                                                Subcontractor: {selectedJob.subcontractor || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })()}

                        </div>

                        {/* Actions Footer */}
                        <div className="pt-4 sm:pt-6 border-t border-slate-100 mt-auto">
                            {selectedJob.accountingStatus === 'Approved' ? (
                                <div className="bg-emerald-50 text-emerald-700 p-3 sm:p-4 rounded-2xl flex items-center justify-center gap-2 sm:gap-3 font-bold border border-emerald-100 text-xs sm:text-sm">
                                    <CheckCircle size={18} /> อนุมัติแล้ว (Verified & Approved)
                                </div>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                    <div className="flex-1 flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            placeholder="เหตุผลไม่อนุมัติ (Rejection Reason)..."
                                            value={rejectReason}
                                            onChange={(e) => setRejectReason(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl sm:rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition-all font-bold"
                                        />
                                        <button
                                            onClick={handleReject}
                                            className="px-6 py-3 bg-rose-100 text-rose-600 rounded-xl sm:rounded-2xl font-black hover:bg-rose-200 transition-all flex items-center justify-center gap-2 shrink-0 text-sm"
                                        >
                                            <XCircle size={18} /> Reject
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleApprove}
                                        className="px-6 sm:px-8 py-3 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black shadow-lg hover:bg-emerald-500 hover:shadow-emerald-200 transition-all flex items-center justify-center gap-2 shrink-0 text-sm"
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
