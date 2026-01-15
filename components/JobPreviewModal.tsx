
import React, { useRef } from 'react';
import { Job } from '../types';
import { X, Printer, MapPin, Truck, FileText } from 'lucide-react';
import { formatDate } from '../utils/format';

interface JobPreviewModalProps {
    job: Job;
    isOpen: boolean;
    onClose: () => void;
}

const JobPreviewModal: React.FC<JobPreviewModalProps> = ({ job, isOpen, onClose }) => {
    const printRef = useRef<HTMLDivElement>(null);

    if (!isOpen) return null;

    const handlePrint = () => {
        if (!printRef.current) return;
        window.print();
    };



    // Generate Document Number (e.g., JR-202601-001)
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const documentNumber = `JR-${yearMonth}-${job.id.split('-').pop() || job.id}`;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <style>{`
                @media print {
                    @page {
                        size: A4;
                        margin: 0mm; /* Use 0mm to let custom padding handle it */
                    }
                    html, body {
                        height: 100%;
                        overflow: visible !important;
                        background: white;
                    }
                    /* Disable transforms/animations to preventing clipping context issues */
                    * {
                        transition: none !important;
                        transform: none !important;
                        animation: none !important;
                        visibility: hidden; /* Default hide */
                    }
                    
                    /* Show only print area */
                    .print-area, .print-area * { 
                        visibility: visible; 
                    }
                    
                    .print-area {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        min-height: 100%;
                        background: white !important;
                        padding: 10mm !important; /* Standard print padding */
                        margin: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        zoom: 1; /* Reset zoom to standard */
                    }
                    
                    .no-print { display: none !important; }
                    
                    /* Typography fixes for print */
                    p, div, span, td, th {
                        color: black !important;
                        -webkit-print-color-adjust: exact;
                    }

                    /* Table handling */
                    tr { page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
            `}</style>

            <div className="bg-white w-full max-w-5xl max-h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                {/* Top Bar (No Print) */}
                <div className="px-8 py-5 border-b border-slate-100 flex items-center justify-between bg-white no-print">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Job Request Preview</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                ID: {job.id}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400" title="Close Preview">
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Size A4 Layout */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 scrollbar-thin">
                    <div ref={printRef} className="print-area bg-white shadow-2xl overflow-hidden border border-slate-200 mx-auto max-w-[210mm] min-h-[297mm] flex flex-col font-sans p-[10mm] relative">

                        {/* 1. Header: Logo Right, Company Info Left */}
                        <div className="flex justify-between items-start mb-2 pb-4 border-b-2 border-slate-900">
                            <div className="space-y-1">
                                <h1 className="text-lg font-bold text-slate-900 leading-tight">บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด</h1>
                                <p className="text-xs font-bold text-slate-600 uppercase">NEOSIAM LOGISTICS & TRANSPORT CO., LTD.</p>
                                <div className="text-[10px] text-slate-500 leading-relaxed font-medium pt-1">
                                    <p>159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000</p>
                                    <p>159/9-10 Village No.7, Bang Muang, Muang Nakhon Sawan, Nakhon Sawan 60000</p>
                                    <p>Tax ID: 0105552087673</p>
                                    <p>Tel: 056-275-841 Email: info@neosiamlogistics.com</p>
                                </div>
                            </div>
                            <img src="/logo.png" alt="NEOSIAM" className="h-[45px] w-auto object-contain mt-2" />
                        </div>

                        {/* 2. Document Title & Key Details Box */}
                        <div className="flex justify-between items-start mb-6 mt-4">
                            <div className="space-y-1 mt-2">
                                <h2 className="text-2xl font-bold text-slate-900 leading-none">ใบขอใช้รถ</h2>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">JOB REQUEST</h3>
                            </div>

                            <div className="border border-slate-400 rounded-sm text-xs w-[300px]">
                                <div className="grid grid-cols-[80px_1fr] border-b border-slate-200">
                                    <div className="bg-slate-100 p-1 pl-2 font-bold text-slate-700">เลขที่ No:</div>
                                    <div className="p-1 pl-2 font-medium text-slate-900">{documentNumber}</div>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] border-b border-slate-200">
                                    <div className="bg-slate-100 p-1 pl-2 font-bold text-slate-700">วันที่ Date:</div>
                                    <div className="p-1 pl-2 font-medium text-slate-900">{formatDate(new Date())}</div>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <div className="bg-slate-100 p-1 pl-2 font-bold text-slate-700">อ้างอิง Ref:</div>
                                    <div className="p-1 pl-2 font-medium text-slate-900">{job.referenceNo || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Job Details Section */}
                        <div className="flex flex-col gap-6 mb-8 text-xs">

                            {/* Service Specification & Shipment Details */}
                            <div className="grid grid-cols-2 gap-4">
                                {/* Service Spec */}
                                <div className="border border-slate-300 rounded-sm min-h-[120px]">
                                    <div className="bg-slate-100 px-3 py-1 font-bold text-slate-700 border-b border-slate-300">
                                        1. ข้อมูลงาน (Service Specification)
                                    </div>
                                    <div className="p-3 space-y-2">
                                        <div className="grid grid-cols-[100px_1fr] gap-2">
                                            <span className="text-slate-500">วันที่ให้บริการ:</span>
                                            <span className="font-bold text-slate-900">{formatDate(job.dateOfService)}</span>
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr] gap-2">
                                            <span className="text-slate-500">ประเภทรถ:</span>
                                            <span className="font-bold text-slate-900 uppercase">{job.truckType}</span>
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr] gap-2">
                                            <span className="text-slate-500">เลขที่อ้างอิง:</span>
                                            <span className="font-bold text-blue-600">{job.referenceNo || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Shipment Details */}
                                <div className="border border-slate-300 rounded-sm min-h-[120px]">
                                    <div className="bg-slate-100 px-3 py-1 font-bold text-slate-700 border-b border-slate-300">
                                        2. รายละเอียดสินค้า (Shipment Details)
                                    </div>
                                    <div className="p-3 space-y-2">
                                        <div className="grid grid-cols-[100px_1fr] gap-2">
                                            <span className="text-slate-500">รายละเอียดสินค้า:<br /><span className="text-[9px] uppercase font-bold">(Description)</span></span>
                                            <span className="font-bold text-slate-900">{job.productDetail || 'ไม่ระบุรายละเอียด'}</span>
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr] gap-2">
                                            <span className="text-slate-500">น้ำหนัก/ปริมาตร:</span>
                                            <span className="font-bold text-slate-900">{job.weightVolume || '-'}</span>
                                        </div>
                                        <div className="grid grid-cols-[100px_1fr] gap-2">
                                            <span className="text-slate-500">จำนวน:</span>
                                            <span className="font-bold text-slate-900">1 เที่ยว</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Routing Map */}
                            <div className="border border-slate-300 rounded-sm">
                                <div className="bg-slate-100 px-3 py-1 font-bold text-slate-700 border-b border-slate-300">
                                    3. เส้นทางการขนส่ง (Routing)
                                </div>
                                <div className="p-3 space-y-2">
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <span className="text-slate-500">ต้นทาง:<br /><span className="text-[9px] uppercase font-bold">(Origin)</span></span>
                                        <span className="font-bold text-slate-900">{job.origin}</span>
                                    </div>
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <span className="text-slate-500">ปลายทาง:<br /><span className="text-[9px] uppercase font-bold">(Destination)</span></span>
                                        <span className="font-bold text-slate-900">{job.destination}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Resources */}
                            <div className="border border-slate-300 rounded-sm">
                                <div className="bg-slate-100 px-3 py-1 font-bold text-slate-700 border-b border-slate-300">
                                    4. ข้อมูลรถและพนักงานขับรถ (Fleet & Driver Info)
                                </div>
                                <div className="p-4 grid grid-cols-3 gap-6">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold">ผู้รับจ้าง (Subcontractor)</p>
                                        <p className="text-xs font-bold text-slate-900">{job.subcontractor || 'รอจัดสรร'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold">ทะเบียนรถ (License Plate)</p>
                                        <p className="text-xs font-bold text-slate-900">{job.licensePlate || 'รอระบุ'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold">พนักงานขับรถ (Driver)</p>
                                        <p className="text-xs font-bold text-slate-900">{job.driverName || 'รอระบุ'}</p>
                                        {job.driverPhone && <p className="text-[10px] text-slate-500">{job.driverPhone}</p>}
                                    </div>
                                </div>
                            </div>

                            {/* 5. Additional Info (Remarks) */}
                            {job.remark && (
                                <div className="border border-slate-300 rounded-sm">
                                    <div className="bg-slate-100 px-3 py-1 font-bold text-slate-700 border-b border-slate-300">
                                        5. ข้อมูลเพิ่มเติม (Additional Info)
                                    </div>
                                    <div className="p-4 space-y-3">
                                        <div className="flex items-start gap-4">
                                            <span className="text-[10px] text-slate-500 font-bold uppercase w-24 shrink-0">หมายเหตุ (Remark)</span>
                                            <p className="text-xs font-medium text-slate-800 bg-slate-50 p-2 rounded w-full">{job.remark}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* 6. Signatures (Combined Operational & Administrative) */}
                        <div className="mt-auto space-y-6 pt-8">
                            {/* Row 1: Operational */}
                            <div className="grid grid-cols-3 gap-6 text-xs">
                                {/* Origin / Dispatcher */}
                                <div className="border border-slate-300 rounded-sm p-4 text-center min-h-[150px] flex flex-col justify-between">
                                    <p className="font-bold text-slate-900">ต้นทาง / ผู้จ่ายสินค้า<br /><span className="text-[9px] text-slate-500 font-normal">(Origin / Dispatcher)</span></p>
                                    <div className="space-y-1">
                                        <p className="text-slate-300">...........................................................</p>
                                        <p className="font-medium text-slate-900 mt-1">วันที่  ........./........./..........</p>
                                    </div>
                                </div>

                                {/* Driver */}
                                <div className="border border-slate-300 rounded-sm p-4 text-center min-h-[150px] flex flex-col justify-between">
                                    <p className="font-bold text-slate-900">พนักงานขับรถ<br /><span className="text-[9px] text-slate-500 font-normal">(Driver)</span></p>
                                    <div className="text-center py-2">
                                        {/* Leave blank for manual signature */}
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-slate-300">...........................................................</p>
                                        <p className="font-medium text-slate-900 mt-1">วันที่  ........./........./..........</p>
                                    </div>
                                </div>

                                {/* Destination / Receiver */}
                                <div className="border border-slate-300 rounded-sm p-4 text-center min-h-[150px] flex flex-col justify-between">
                                    <p className="font-bold text-slate-900">ปลายทาง / ผู้รับสินค้า<br /><span className="text-[9px] text-slate-500 font-normal">(Destination / Receiver)</span></p>
                                    <div className="space-y-1">
                                        <p className="text-slate-300">...........................................................</p>
                                        <p className="font-medium text-slate-900 mt-1">วันที่  ........./........./..........</p>
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Administrative */}
                            <div className="grid grid-cols-3 gap-6 text-xs">
                                {/* Requester */}
                                <div className="border border-slate-300 rounded-sm p-4 text-center min-h-[150px] flex flex-col justify-between">
                                    <p className="font-bold text-slate-900">ผู้ขอใช้รถ<br /><span className="text-[9px] text-slate-500 font-normal">(Requester)</span></p>
                                    <div className="space-y-1">
                                        <p className="text-slate-300">...........................................................</p>
                                        <p className="font-medium text-slate-900 mt-1">วันที่  ........./........./..........</p>
                                    </div>
                                </div>

                                {/* Approver */}
                                <div className="border border-slate-300 rounded-sm p-4 text-center min-h-[150px] flex flex-col justify-between">
                                    <p className="font-bold text-slate-900">ผู้อนุมัติ<br /><span className="text-[9px] text-slate-500 font-normal">(Authorized Signature)</span></p>
                                    <div className="space-y-1">
                                        <p className="text-slate-300">...........................................................</p>
                                        <p className="font-medium text-slate-900 mt-1">วันที่  ........./........./..........</p>
                                    </div>
                                </div>

                                {/* Accounting */}
                                <div className="border border-slate-300 rounded-sm p-4 text-center min-h-[150px] flex flex-col justify-between">
                                    <p className="font-bold text-slate-900">บัญชี / การเงิน<br /><span className="text-[9px] text-slate-500 font-normal">(Accounting / Finance)</span></p>
                                    <div className="space-y-1">
                                        <p className="text-slate-300">...........................................................</p>
                                        <p className="font-medium text-slate-900 mt-1">วันที่  ........./........./..........</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="text-[9px] text-right text-slate-300 mt-8">
                            FM-OP02-01 Job Request Form
                        </div>

                    </div>
                </div>

                {/* Footer UI Actions */}
                <div className="px-8 py-6 bg-white border-t border-slate-100 flex justify-end items-center no-print">
                    <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                        <Printer size={16} /> Print / Save PDF
                    </button>
                    <button onClick={onClose} className="ml-3 px-6 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-bold uppercase transition-all">
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JobPreviewModal;
