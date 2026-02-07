
import React, { useRef, useState } from 'react';
import { Job } from '../types';
import { X, Printer, FileText, Download, Loader2 } from 'lucide-react';
import { formatDate } from '../utils/format';
import { generateJobRequestPDF } from './JobRequestPDF';

interface JobPreviewModalProps {
    job: Job;
    isOpen: boolean;
    onClose: () => void;
}

const JobPreviewModal: React.FC<JobPreviewModalProps> = ({ job, isOpen, onClose }) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

    if (!isOpen) return null;

    const handlePrint = () => {
        if (!printRef.current) return;
        window.print();
    };

    const handleDownloadPDF = async () => {
        setIsGeneratingPDF(true);
        try {
            await generateJobRequestPDF(job);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('เกิดข้อผิดพลาดในการสร้าง PDF');
        } finally {
            setIsGeneratingPDF(false);
        }
    };

    // Generate Document Number (e.g., JR-202601-001)
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const documentNumber = `JR-${yearMonth}-${job.id.split('-').pop() || job.id}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    html, body {
                        width: 210mm;
                        height: 297mm;
                        overflow: hidden !important;
                        background: white;
                        margin: 0;
                        padding: 0;
                    }
                    * {
                        transition: none !important;
                        transform: none !important;
                        animation: none !important;
                        visibility: hidden;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    
                    .print-area, .print-area * { 
                        visibility: visible; 
                    }
                    
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 210mm;
                        height: 297mm;
                        background: white !important;
                        padding: 10mm 15mm !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        display: flex !important;
                        flex-direction: column !important;
                        overflow: hidden !important;
                    }
                    
                    .no-print { display: none !important; }

                    /* Tighten things up for 1 page rule */
                    .section-gap { margin-bottom: 4mm; }
                }
            `}</style>

            <div className="bg-white w-full max-w-5xl h-full md:h-[95vh] rounded-none md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Top Bar (No Print) */}
                <div className="px-8 py-4 border-b border-slate-100 flex items-center justify-between bg-white no-print shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Job Request Preview (A4 1-Page)</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                PREVIEWING DOCUMENT: {documentNumber}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={isGeneratingPDF}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isGeneratingPDF ? (
                                <><Loader2 size={16} className="animate-spin" /> กำลังสร้าง...</>
                            ) : (
                                <><Download size={16} /> PDF (คมชัด)</>
                            )}
                        </button>
                        <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                            <Printer size={16} /> PRINT
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400" title="Close Preview">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-2 md:p-8 bg-slate-200/50 scrollbar-thin print:p-0 print:bg-white">
                    <div ref={printRef} className="print-area bg-white shadow-2xl mx-auto w-[210mm] h-[297mm] flex flex-col font-sans pt-[10mm] pb-[10mm] pl-[15mm] pr-[15mm] border border-slate-100">

                        {/* 1. Header: Logo & Company */}
                        <div className="flex justify-between items-start pb-4 border-b-2 border-slate-900 section-gap">
                            <div className="space-y-0.5">
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด</h1>
                                <p className="text-[10px] font-bold text-slate-600 uppercase">NEOSIAM LOGISTICS & TRANSPORT CO., LTD.</p>
                                <div className="text-[9px] text-slate-500 leading-tight font-medium pt-1">
                                    <p>159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000</p>
                                    <p>Tax ID: 0105552087673 | Tel: 056-275-841</p>
                                </div>
                            </div>
                            <div className="w-[100px] flex justify-end">
                                <img src="/logo.png" alt="NEOSIAM" className="h-[65px] w-auto object-contain" />
                            </div>
                        </div>

                        {/* 2. Title & Doc Info */}
                        <div className="flex justify-between items-center mb-2 mt-1">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 leading-none">ใบขอใช้รถ</h2>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">JOB REQUEST FORM</h3>
                            </div>

                            <div className="border border-[#cbd5e1] overflow-hidden text-[11px] w-[205px]">
                                <div className="grid grid-cols-[85px_1fr] border-b border-[#e2e8f0]">
                                    <div className="bg-[#f8fafc] px-2 py-1.5 font-bold text-[#64748b] border-r border-[#e2e8f0]">เลขที่ No:</div>
                                    <div className="px-2 py-1.5 font-bold text-[#1e293b]">{documentNumber}</div>
                                </div>
                                <div className="grid grid-cols-[85px_1fr] border-b border-[#e2e8f0]">
                                    <div className="bg-[#f8fafc] px-2 py-1.5 font-bold text-[#64748b] border-r border-[#e2e8f0]">วันที่ Date:</div>
                                    <div className="px-2 py-1.5 font-bold text-[#1e293b]">{formatDate(new Date())}</div>
                                </div>
                                <div className="grid grid-cols-[85px_1fr]">
                                    <div className="bg-[#f8fafc] px-2 py-1.5 font-bold text-[#64748b] border-r border-[#e2e8f0]">อ้างอิง Ref:</div>
                                    <div className="px-2 py-1.5 font-bold text-[#1e293b]">{job.referenceNo || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Main Body - Allowed to grow slightly but will be clipped if too huge */}
                        <div className="space-y-2 flex-1 overflow-hidden">

                            {/* Section 1 & 2 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="border border-[#cbd5e1]">
                                    <div className="bg-[#f8fafc] px-3 py-1.5 font-bold text-[#1e293b] text-[10px] border-b border-[#cbd5e1]">
                                        1. ข้อมูลงาน (SERVICE SPEC)
                                    </div>
                                    <div className="p-2 space-y-1 text-[11px]">
                                        <div className="flex border-b border-[#f1f5f9] pb-1">
                                            <span className="text-[#64748b] w-[100px]">วันที่ให้บริการ:</span>
                                            <span className="font-bold text-[#1e293b]">{formatDate(job.dateOfService)}</span>
                                        </div>
                                        <div className="flex border-b border-[#f1f5f9] pb-1">
                                            <span className="text-[#64748b] w-[100px]">ประเภทรถ:</span>
                                            <span className="font-bold text-[#1e293b]">{job.truckType}</span>
                                        </div>
                                        <div className="flex">
                                            <span className="text-[#64748b] w-[100px]">ผู้ขอใช้รถ:</span>
                                            <span className="font-bold text-[#1e293b]">{job.requestedByName || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-[#cbd5e1]">
                                    <div className="bg-[#f8fafc] px-3 py-1.5 font-bold text-[#1e293b] text-[10px] border-b border-[#cbd5e1]">
                                        2. รายละเอียดสินค้า (SHIPMENT)
                                    </div>
                                    <div className="p-2 space-y-1 text-[11px]">
                                        <div className="flex border-b border-[#f1f5f9] pb-1">
                                            <span className="text-[#64748b] w-[100px]">สินค้า:</span>
                                            <span className="font-bold text-[#1e293b]">{job.productDetail || 'ไม่ระบุ'}</span>
                                        </div>
                                        <div className="flex border-b border-[#f1f5f9] pb-1">
                                            <span className="text-[#64748b] w-[100px]">น้ำหนัก/ปริมาตร:</span>
                                            <span className="font-bold text-[#1e293b]">{job.weightVolume ? `${job.weightVolume} กก.` : '-'}</span>
                                        </div>
                                        <div className="flex">
                                            <span className="text-[#64748b] w-[100px]">จำนวน/Type:</span>
                                            <span className="font-bold text-[#1e293b]">1 เที่ยว (Single Trip)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Routing - Compact Horizontal */}
                            <div className="border border-[#cbd5e1]">
                                <div className="bg-[#f8fafc] px-3 py-1.5 font-bold text-[#1e293b] text-[10px] border-b border-[#cbd5e1]">
                                    3. เส้นทางการขนส่ง (ROUTING)
                                </div>
                                <div className="p-2 text-[11px] flex flex-wrap items-center gap-1">
                                    {/* Origin */}
                                    <span className="text-[#64748b] font-bold">ต้นทาง:</span>
                                    <span className="font-bold text-[#1e293b]">{job.origin}</span>
                                    <span className="text-[#94a3b8] mx-1">→</span>
                                    
                                    {/* Drop-off Points - Horizontal */}
                                    {job.drops && job.drops.length > 0 && (
                                        <>
                                            <span className="text-[#64748b] font-bold">จุดแวะ({job.drops.length}):</span>
                                            <span className="font-bold text-[#1e293b]">
                                                {job.drops.map((drop, idx) => (
                                                    <span key={idx} className="inline-block mr-2">
                                                        {idx + 1}.{typeof drop === 'string' ? drop : drop.location}
                                                    </span>
                                                ))}
                                            </span>
                                            <span className="text-[#94a3b8] mx-1">→</span>
                                        </>
                                    )}
                                    
                                    {/* Destination */}
                                    <span className="text-[#64748b] font-bold">ปลายทาง:</span>
                                    <span className="font-bold text-[#1e293b]">{job.destination}</span>
                                </div>
                            </div>


                            {/* Section 4: Fleet Info */}
                            <div className="border border-[#cbd5e1]">
                                <div className="bg-[#f8fafc] px-3 py-1.5 font-bold text-[#1e293b] text-[10px] border-b border-[#cbd5e1]">
                                    4. ข้อมูลคนขับและบริษัทรถร่วม (FLEET & DRIVER)
                                </div>
                                <div className="flex border-b border-[#f1f5f9] divide-x divide-[#f1f5f9]">
                                    <div className="flex-1 p-2 text-center">
                                        <p className="text-[9px] text-[#64748b] font-bold uppercase mb-1">Subcontractor</p>
                                        <p className="text-[11px] font-bold text-[#1e293b] leading-tight">{job.subcontractor || 'รอการจัดรถ'}</p>
                                    </div>
                                    <div className="flex-1 p-2 text-center">
                                        <p className="text-[9px] text-[#64748b] font-bold uppercase mb-1">License Plate</p>
                                        <p className="text-[11px] font-bold text-[#1e293b] leading-tight">{job.licensePlate || 'รอระบุเลขทะเบียน'}</p>
                                    </div>
                                    <div className="flex-1 p-2 text-center">
                                        <p className="text-[9px] text-[#64748b] font-bold uppercase mb-1">Driver Name & Tel</p>
                                        <p className="text-[11px] font-bold text-[#1e293b] leading-tight">{job.driverName || 'รอระบุรายชื่อ'}</p>
                                        {job.driverPhone && <p className="text-[10px] font-medium text-[#64748b] mt-1">{job.driverPhone}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* Section 5: Remarks - Scalable area */}
                            <div className="border border-[#cbd5e1] bg-[#f8fafc]/50 flex flex-col min-h-[50px] max-h-[100px]">
                                <div className="bg-[#f8fafc] px-3 py-1.5 font-bold text-[#1e293b] text-[10px] border-b border-[#cbd5e1] shrink-0">
                                    5. หมายเหตุและข้อกำหนดเพิ่มเติม (REMARKS)
                                </div>
                                <div className="p-2 overflow-y-auto">
                                    <p className="text-[11px] text-[#475569] leading-relaxed">
                                        {job.remark || '- ไม่มีข้อมูลเพิ่มเติม -'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 6. Signatures: Pinned to Bottom using mt-auto */}
                        <div className="mt-auto pt-3 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="border border-[#cbd5e1] p-2 text-center h-[95px] flex flex-col justify-between items-center">
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-[#1e293b] leading-tight">ต้นทาง / ผู้จ่ายสินค้า</p>
                                        <p className="text-[7px] text-[#64748b] font-black uppercase tracking-tighter">(DISPATCHER)</p>
                                    </div>
                                    <div className="border-b border-dotted border-[#94a3b8] w-[85%] mx-auto mb-2"></div>
                                    <p className="text-[8px] font-medium text-[#1e293b]">วันที่ ____/____/____</p>
                                </div>
                                <div className="border border-[#cbd5e1] p-2 text-center h-[95px] flex flex-col justify-between items-center">
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-[#1e293b] leading-tight">พนักงานขับรถ</p>
                                        <p className="text-[7px] text-[#64748b] font-black uppercase tracking-tighter">(DRIVER)</p>
                                    </div>
                                    <div className="border-b border-dotted border-[#94a3b8] w-[85%] mx-auto mb-2"></div>
                                    <p className="text-[8px] font-medium text-[#1e293b]">วันที่ ____/____/____</p>
                                </div>
                                <div className="border border-[#cbd5e1] p-2 text-center h-[95px] flex flex-col justify-between items-center">
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-[#1e293b] leading-tight">ปลายทาง / ผู้รับสินค้า</p>
                                        <p className="text-[7px] text-[#64748b] font-black uppercase tracking-tighter">(RECEIVER)</p>
                                    </div>
                                    <div className="border-b border-dotted border-[#94a3b8] w-[85%] mx-auto mb-2"></div>
                                    <p className="text-[8px] font-medium text-[#1e293b]">วันที่ ____/____/____</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="border border-[#cbd5e1] p-2 text-center h-[95px] flex flex-col justify-between bg-[#f8fafc]/50 items-center">
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-[#1e293b] leading-tight">ผู้ขอใช้รถ</p>
                                        <p className="text-[7px] text-[#64748b] font-black uppercase tracking-tighter">(REQUESTER)</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-[#1e293b]">{job.requestedByName}</p>
                                        <p className="text-[8px] font-medium text-[#1e293b]">วันที่ ____/____/____</p>
                                    </div>
                                </div>
                                <div className="border border-[#cbd5e1] p-2 text-center h-[95px] flex flex-col justify-between items-center">
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-[#1e293b] leading-tight">ผู้อนุมัติ</p>
                                        <p className="text-[7px] text-[#64748b] font-black uppercase tracking-tighter">(AUTHORIZED)</p>
                                    </div>
                                    <div className="border-b border-dotted border-[#94a3b8] w-[85%] mx-auto mb-2"></div>
                                    <p className="text-[8px] font-medium text-[#1e293b]">วันที่ ____/____/____</p>
                                </div>
                                <div className="border border-[#cbd5e1] p-2 text-center h-[95px] flex flex-col justify-between items-center">
                                    <div className="text-center">
                                        <p className="text-[9px] font-bold text-[#1e293b] leading-tight">บัญชี / การเงิน</p>
                                        <p className="text-[7px] text-[#64748b] font-black uppercase tracking-tighter">(ACCOUNTANT)</p>
                                    </div>
                                    <div className="border-b border-dotted border-[#94a3b8] w-[85%] mx-auto mb-2"></div>
                                    <p className="text-[8px] font-medium text-[#1e293b]">วันที่ ____/____/____</p>
                                </div>
                            </div>



                            <div className="flex justify-between items-center text-[7px] font-bold text-[#94a3b8] uppercase tracking-widest pt-2">
                                <span>FM-OP01-08 REV.00</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobPreviewModal;
