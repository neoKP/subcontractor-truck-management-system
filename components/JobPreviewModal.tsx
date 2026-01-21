
import React, { useRef } from 'react';
import { Job } from '../types';
import { X, Printer, FileText } from 'lucide-react';
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
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
                        padding: 12mm !important;
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
                        <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-lg active:scale-95">
                            <Printer size={16} /> PRINT (1 PAGE)
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400" title="Close Preview">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-2 md:p-8 bg-slate-200/50 scrollbar-thin print:p-0 print:bg-white">
                    <div ref={printRef} className="print-area bg-white shadow-2xl mx-auto w-[210mm] h-[297mm] flex flex-col font-sans p-[10mm] border border-slate-100">

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
                            <img src="/logo.png" alt="NEOSIAM" className="h-[40px] w-auto object-contain mt-1" />
                        </div>

                        {/* 2. Title & Doc Info */}
                        <div className="flex justify-between items-center mb-2 mt-1">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 leading-none">ใบขอใช้รถ</h2>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">JOB REQUEST FORM</h3>
                            </div>

                            <div className="border border-slate-300 rounded overflow-hidden text-[10px] w-[220px]">
                                <div className="grid grid-cols-[70px_1fr] border-b border-slate-200">
                                    <div className="bg-slate-50 px-2 py-1 font-bold text-slate-600 border-r border-slate-200">เลขที่ No:</div>
                                    <div className="px-2 py-1 font-black text-slate-900">{documentNumber}</div>
                                </div>
                                <div className="grid grid-cols-[70px_1fr] border-b border-slate-200">
                                    <div className="bg-slate-50 px-2 py-1 font-bold text-slate-600 border-r border-slate-200">วันที่ Date:</div>
                                    <div className="px-2 py-1 font-medium text-slate-900">{formatDate(new Date())}</div>
                                </div>
                                <div className="grid grid-cols-[70px_1fr]">
                                    <div className="bg-slate-50 px-2 py-1 font-bold text-slate-600 border-r border-slate-200">อ้างอิง Ref:</div>
                                    <div className="px-2 py-1 font-bold text-slate-900">{job.referenceNo || '-'}</div>
                                </div>
                            </div>
                        </div>

                        {/* Main Body - Allowed to grow slightly but will be clipped if too huge */}
                        <div className="space-y-2 flex-1 overflow-hidden">

                            {/* Section 1 & 2 */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="border border-slate-300 rounded">
                                    <div className="bg-slate-50 px-3 py-1 font-bold text-slate-700 text-[10px] border-b border-slate-300 flex justify-between">
                                        <span>1. ข้อมูลงาน (SERVICE SPEC)</span>
                                    </div>
                                    <div className="p-2 space-y-1.5 text-[10px]">
                                        <div className="flex justify-between border-b border-slate-100 pb-1">
                                            <span className="text-slate-500">วันที่ให้บริการ:</span>
                                            <span className="font-bold">{formatDate(job.dateOfService)}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-1">
                                            <span className="text-slate-500">ประเภทรถ:</span>
                                            <span className="font-bold uppercase text-slate-900">{job.truckType}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">ผู้ขอใช้รถ:</span>
                                            <span className="font-bold underline">{job.requestedByName || '-'}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border border-slate-300 rounded">
                                    <div className="bg-slate-50 px-3 py-1 font-bold text-slate-700 text-[10px] border-b border-slate-300">
                                        2. รายละเอียดสินค้า (SHIPMENT)
                                    </div>
                                    <div className="p-2 space-y-1.5 text-[10px]">
                                        <div className="flex items-start gap-2 border-b border-slate-100 pb-1">
                                            <span className="text-slate-500 shrink-0">สินค้า:</span>
                                            <span className="font-bold leading-tight">{job.productDetail || 'ไม่ระบุ'}</span>
                                        </div>
                                        <div className="flex justify-between border-b border-slate-100 pb-1">
                                            <span className="text-slate-500">น้ำหนัก/ปริมาตร:</span>
                                            <span className="font-bold">{job.weightVolume ? `${job.weightVolume} กก.` : '-'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500">จำนวน/Type:</span>
                                            <span className="font-bold">1 เที่ยว (Single Trip)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Routing */}
                            <div className="border border-slate-300 rounded">
                                <div className="bg-slate-50 px-3 py-1 font-bold text-slate-700 text-[10px] border-b border-slate-300">
                                    3. เส้นทางการขนส่ง (ROUTING)
                                </div>
                                <div className="p-3 text-[10px]">
                                    <div className="flex items-center gap-3">
                                        {/* Visual Route Indicator */}
                                        <div className="flex flex-col items-center h-full">
                                            <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-emerald-600 flex items-center justify-center">
                                                <span className="text-white text-[6px] font-black">A</span>
                                            </div>
                                            <div className="w-0.5 h-6 bg-slate-300 my-1"></div>
                                            <div className="w-3 h-3 rounded-full bg-rose-500 border-2 border-rose-600 flex items-center justify-center">
                                                <span className="text-white text-[6px] font-black">B</span>
                                            </div>
                                        </div>
                                        {/* Route Details */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                                                <span className="text-slate-500 font-bold">ต้นทาง (ORIGIN):</span>
                                                <span className="font-black text-slate-900">{job.origin}</span>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <span className="text-slate-500 font-bold">ปลายทาง (DESTINATION):</span>
                                                <span className="font-black text-slate-900">{job.destination}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>


                            {/* Section 4: Fleet Info */}
                            <div className="border border-slate-300 rounded">
                                <div className="bg-slate-50 px-3 py-1 font-bold text-slate-700 text-[10px] border-b border-slate-300">
                                    4. ข้อมูลคนขับและบริษัทรถร่วม (FLEET & DRIVER)
                                </div>
                                <div className="p-2 grid grid-cols-3 gap-4 text-center divide-x divide-slate-100">
                                    <div className="px-2">
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Subcontractor</p>
                                        <p className="text-[10px] font-black text-slate-900">{job.subcontractor || 'รอการจัดรถ'}</p>
                                    </div>
                                    <div className="px-2">
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">License Plate</p>
                                        <p className="text-[10px] font-black text-slate-900">{job.licensePlate || 'รอระบุเลขทะเบียน'}</p>
                                    </div>
                                    <div className="px-2">
                                        <p className="text-[8px] text-slate-400 font-bold uppercase">Driver Name & Tel</p>
                                        <p className="text-[10px] font-black text-slate-900">{job.driverName || 'รอระบุรายชื่อ'}</p>
                                        <p className="text-[9px] font-bold text-slate-500">{job.driverPhone || ''}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section 5: Remarks - Scalable area */}
                            <div className="border border-slate-300 rounded bg-slate-50/30 flex flex-col min-h-[60px] max-h-[120px]">
                                <div className="bg-slate-50 px-3 py-1 font-bold text-slate-700 text-[10px] border-b border-slate-300 shrink-0">
                                    5. หมายเหตุและข้อกำหนดเพิ่มเติม (REMARKS)
                                </div>
                                <div className="p-2 overflow-y-auto">
                                    <p className="text-[10px] font-medium text-slate-700 leading-relaxed italic">
                                        {job.remark || '- ไม่มีข้อมูลเพิ่มเติม -'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 6. Signatures: Pinned to Bottom using mt-auto */}
                        <div className="mt-auto pt-3 space-y-2">
                            <div className="grid grid-cols-3 gap-2">
                                <div className="border border-slate-300 rounded p-2 text-center h-[115px] flex flex-col justify-between">
                                    <p className="text-[9px] font-bold text-slate-900">ต้นทาง / ผู้จ่ายสินค้า<br /><span className="text-[7px] text-slate-400 font-normal uppercase">(Dispatcher)</span></p>
                                    <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto"></div>
                                    <p className="text-[8px] font-medium">วันที่ ____/____/____</p>
                                </div>
                                <div className="border border-slate-300 rounded p-2 text-center h-[115px] flex flex-col justify-between">
                                    <p className="text-[9px] font-bold text-slate-900">พนักงานขับรถ<br /><span className="text-[7px] text-slate-400 font-normal uppercase">(Driver)</span></p>
                                    <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto"></div>
                                    <p className="text-[8px] font-medium">วันที่ ____/____/____</p>
                                </div>
                                <div className="border border-slate-300 rounded p-2 text-center h-[115px] flex flex-col justify-between">
                                    <p className="text-[9px] font-bold text-slate-900">ปลายทาง / ผู้รับสินค้า<br /><span className="text-[7px] text-slate-400 font-normal uppercase">(Receiver)</span></p>
                                    <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto"></div>
                                    <p className="text-[8px] font-medium">วันที่ ____/____/____</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2">
                                <div className="border border-slate-300 rounded p-2 text-center h-[115px] flex flex-col justify-between bg-slate-50/50">
                                    <p className="text-[9px] font-bold text-slate-900">ผู้ขอใช้รถ<br /><span className="text-[7px] text-slate-400 font-normal uppercase">(Requester)</span></p>
                                    <p className="text-[9px] font-black text-slate-900">{job.requestedByName}</p>
                                    <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto"></div>
                                    <p className="text-[8px] font-medium">วันที่ ____/____/____</p>
                                </div>
                                <div className="border border-slate-300 rounded p-2 text-center h-[115px] flex flex-col justify-between">
                                    <p className="text-[9px] font-bold text-slate-900">ผู้อนุมัติ<br /><span className="text-[7px] text-slate-400 font-normal uppercase">(Authorized)</span></p>
                                    <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto"></div>
                                    <p className="text-[8px] font-medium">วันที่ ____/____/____</p>
                                </div>
                                <div className="border border-slate-300 rounded p-2 text-center h-[115px] flex flex-col justify-between">
                                    <p className="text-[9px] font-bold text-slate-900">บัญชี / การเงิน<br /><span className="text-[7px] text-slate-400 font-normal uppercase">(Accountant)</span></p>
                                    <div className="border-b border-dotted border-slate-400 w-4/5 mx-auto"></div>
                                    <p className="text-[8px] font-medium">วันที่ ____/____/____</p>
                                </div>
                            </div>



                            <div className="flex justify-between items-center text-[7px] font-black text-slate-300 uppercase tracking-widest pt-2">
                                <span>FM-OP02-01 REV.00 (21/01/2026)</span>
                                <span>COPYRIGHT BY NEOSIAM LOGISTICS</span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default JobPreviewModal;
