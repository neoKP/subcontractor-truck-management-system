
import React, { useState } from 'react';
import { Job, JobStatus, PriceMatrix } from '../types';
import { X, Printer, CheckCircle, Receipt, Calendar, FileText, MapPin } from 'lucide-react';
import Swal from 'sweetalert2';
import { formatThaiCurrency, roundHalfUp, formatDate } from '../utils/format';

/**
 * Helper: Converts a number to Thai Baht text.
 * (Moved outside component for better performance)
 */
const bahtText = (num: number): string => {
    if (!num || num <= 0) return "ศูนย์บาทถ้วน";
    const ThaiNumber = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
    const ThaiUnit = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];
    const read = (nStr: string): string => {
        let res = "";
        for (let i = 0; i < nStr.length; i++) {
            const digit = parseInt(nStr[i]);
            const pos = nStr.length - i - 1;
            if (digit !== 0) {
                if (pos === 1 && digit === 1) res += "";
                else if (pos === 1 && digit === 2) res += "ยี่";
                else if (pos === 0 && digit === 1 && nStr.length > 1) res += "เอ็ด";
                else res += ThaiNumber[digit];
                res += ThaiUnit[pos];
            }
        }
        return res;
    };
    const convert = (numStr: string): string => {
        let res = "";
        let parts = [];
        while (numStr.length > 0) {
            parts.push(numStr.slice(-6));
            numStr = numStr.slice(0, -6);
        }
        for (let i = parts.length - 1; i >= 0; i--) {
            res += read(parts[i]);
            if (i > 0) res += "ล้าน";
        }
        return res;
    };
    const str = num.toFixed(2);
    const [intPart, decPart] = str.split('.');
    let result = "";
    const intNum = parseInt(intPart);
    const decNum = parseInt(decPart);
    if (intNum > 0) result += convert(intPart) + "บาท";
    if (decNum > 0) result += convert(decPart) + "สตางค์";
    else if (intNum > 0) result += "ถ้วน";
    else if (decNum === 0 && intNum === 0) return "ศูนย์บาทถ้วน";
    else if (intNum === 0 && decNum > 0) result = convert(decPart) + "สตางค์";
    return result;
};

interface InvoicePreviewModalProps {
    jobs: Job[];
    onClose: () => void;
    onBatchConfirm?: (jobs: Job[]) => void;
    existingDocNo?: string;
    existingDate?: string;
    readOnly?: boolean;
    priceMatrix?: PriceMatrix[];
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
    jobs,
    onClose,
    onBatchConfirm,
    existingDocNo,
    existingDate,
    readOnly = false,
    priceMatrix = []
}) => {
    const mainJob = jobs[0];
    
    // Get Payment Terms from PriceMatrix
    const getPaymentTerms = () => {
        if (!mainJob || priceMatrix.length === 0) return { paymentType: 'CREDIT', creditDays: 30 };
        
        const matched = priceMatrix.find(p =>
            p.origin?.trim() === mainJob.origin?.trim() &&
            p.destination?.trim() === mainJob.destination?.trim() &&
            p.truckType?.trim() === mainJob.truckType?.trim() &&
            p.subcontractor?.trim() === mainJob.subcontractor?.trim()
        );
        
        return {
            paymentType: matched?.paymentType || 'CREDIT',
            creditDays: matched?.creditDays || 30
        };
    };
    
    const paymentTerms = getPaymentTerms();
    const [applyVat, setApplyVat] = useState(false);
    const [vatRate] = useState(7);
    const [whtRate] = useState(1);
    const [applyWht, setApplyWht] = useState(false);
    const isPrintingRef = React.useRef(false);

    // Guard: If no jobs, show a friendly message (User's suggestion #1)
    if (!jobs || jobs.length === 0 || !mainJob) {
        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">
                <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm mx-4">
                    <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <X size={32} />
                    </div>
                    <h2 className="text-xl font-black text-slate-900 mb-2">ไม่พบข้อมูลงาน</h2>
                    <p className="text-slate-500 mb-6">กรุณาเลือกงานที่ต้องการวางบิลก่อนทำรายการ</p>
                    <button onClick={onClose} className="w-full py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all">
                        ตกลง / ปิดหน้าต่าง
                    </button>
                </div>
            </div>
        );
    }

    // Direct Print Command - Using New Window for Isolation
    const doPrint = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (isPrintingRef.current) return;
        isPrintingRef.current = true;

        // Get the print content
        const printContent = document.querySelector('.print-section');
        if (!printContent) {
            alert('ไม่พบเนื้อหาที่จะพิมพ์');
            isPrintingRef.current = false;
            return;
        }

        // Create new window for printing
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        if (!printWindow) {
            alert('กรุณาอนุญาตให้เบราว์เซอร์เปิดหน้าต่างใหม่');
            isPrintingRef.current = false;
            return;
        }

        // Write content to new window
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ใบรับวางบิล - ${documentNumber}</title>
                <script src="https://cdn.tailwindcss.com"></script>
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 0mm;
                    }
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    body {
                        font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
                        background: white;
                        margin: 0;
                        padding: 0;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                    }
                    .page-break {
                        page-break-after: always;
                        break-after: page;
                    }
                    .no-print {
                        display: none !important;
                    }
                    @media print {
                        body {
                            width: 210mm;
                            margin: 0;
                        }
                        .no-print {
                            display: none !important;
                        }
                    }
                </style>
            </head>
            <body>
                ${printContent.innerHTML}
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            window.print();
                        }, 800);
                    };
                </script>
            </body>
            </html>
        `);

        printWindow.document.close();

        // Wait for content to load, then print
        setTimeout(() => {
            printWindow.focus();
            printWindow.print();
            setTimeout(() => {
                printWindow.close();
                isPrintingRef.current = false;
            }, 500);
        }, 250);
    };

    const [referenceNo, setReferenceNo] = useState('');
    const [customDueDate, setCustomDueDate] = useState(() => {
        const d = new Date(existingDate ? new Date(existingDate) : new Date());
        d.setDate(d.getDate() + 30);
        return d.toISOString().split('T')[0];
    });

    const subtotal = roundHalfUp(jobs.reduce((sum, j) => sum + (Number(j.cost) || 0) + (Number(j.extraCharge) || 0), 0));
    const vatAmount = applyVat ? roundHalfUp((subtotal * vatRate) / 100) : 0;
    const whtAmount = applyWht ? roundHalfUp((subtotal * whtRate) / 100) : 0;
    const netTotal = roundHalfUp(subtotal + vatAmount - whtAmount);

    const issueDate = existingDate ? new Date(existingDate) : new Date();
    const documentNumber = existingDocNo || `BA-${issueDate.getFullYear()}${String(issueDate.getMonth() + 1).padStart(2, '0')}-${mainJob.id.split('-').pop()}`;
    const currentDate = formatDate(issueDate);
    const dueDateStr = formatDate(customDueDate);

    const finalizeBilled = () => {
        if (readOnly || !onBatchConfirm) return;

        if (!referenceNo) {
            Swal.fire({
                icon: 'error',
                title: 'ข้อมูลไม่ครบถ้วน',
                text: 'กรุณาระบุเลขที่ใบวางบิลเอกสารอ้างอิง (Reference No) ก่อนยืนยัน',
                confirmButtonColor: '#3085d6',
                confirmButtonText: 'ตกลง'
            });
            return;
        }

        Swal.fire({
            title: 'ยืนยันการบันทึก?',
            text: `ต้องการบันทึกการวางบิลเลขที่ ${documentNumber} หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#64748b',
            confirmButtonText: 'ยืนยันและบันทึก',
            cancelButtonText: 'ยกเลิก',
            reverseButtons: true
        }).then((result) => {
            if (result.isConfirmed) {
                const updatedJobs = jobs.map(j => ({
                    ...j,
                    status: JobStatus.BILLED,
                    billingDocNo: documentNumber,
                    billingDate: issueDate.toISOString(),
                    referenceNo: referenceNo
                }));
                onBatchConfirm(updatedJobs);

                Swal.fire({
                    icon: 'success',
                    title: 'บันทึกสำเร็จ!',
                    text: 'ระบบได้บันทึกข้อมูลการวางบิลเรียบร้อยแล้ว',
                    timer: 2000,
                    showConfirmButton: false
                }).then(() => {
                    onClose();
                });
            }
        });
    };

    const ITEMS_PER_PAGE = 10;
    const jobChunks = [];
    for (let i = 0; i < jobs.length; i += ITEMS_PER_PAGE) {
        jobChunks.push(jobs.slice(i, i + ITEMS_PER_PAGE));
    }

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-0 md:p-4 bg-slate-900/70 backdrop-blur-sm print:bg-white print:p-0 print:block print:static print:h-auto print:backdrop-blur-none">
            <style>{`
                @media print {
                    @page { 
                        size: A4 portrait; 
                        margin: 0mm; 
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        color-adjust: exact !important;
                    }
                    
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        background: white !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        overflow: visible !important;
                    }

                    /* Hide all except print section */
                    body > div:first-child {
                        background: white !important;
                        backdrop-filter: none !important;
                    }
                    
                    .no-print {
                        display: none !important;
                    }
                    
                    /* Ensure print section is visible */
                    .print-section {
                        display: block !important;
                        visibility: visible !important;
                        position: relative !important;
                        margin: 0 auto !important;
                        width: 210mm !important;
                        background: white !important;
                    }
                    
                    .print-section * {
                        visibility: visible !important;
                    }
                    
                    .page-break {
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                }
            `}</style>

            <div className="bg-white md:rounded-2xl shadow-2xl w-full max-w-5xl h-full md:h-[95vh] flex flex-col overflow-hidden print:shadow-none print:h-auto print:overflow-visible print:bg-transparent">
                {/* Header Toolbar */}
                <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shadow-lg no-print">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600 p-2 rounded-lg shadow-inner"><Receipt size={24} /></div>
                        <div>
                            <h2 className="font-bold text-lg leading-none uppercase tracking-wide">Billing Preview</h2>
                            <p className="text-[10px] text-slate-400 mt-1">{jobs.length} items • {jobChunks.length} pages</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-4 bg-slate-700/50 px-4 py-2 rounded-xl border border-white/10 mr-4">
                            <div className="flex flex-col">
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Reference No (พิมพ์เข้า)</label>
                                <input
                                    type="text"
                                    title="เลขที่ใบวางบิลเอกสารอ้างอิง"
                                    placeholder="ระบุเลขที่ใบวางบิล..."
                                    value={referenceNo}
                                    onChange={(e) => setReferenceNo(e.target.value)}
                                    className="bg-transparent text-white font-bold text-sm focus:outline-none placeholder:text-slate-500 w-44"
                                />
                            </div>
                            <div className="h-8 w-px bg-white/10"></div>
                            <div className="flex flex-col">
                                <label className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Due Date (แก้ไขได้)</label>
                                <input
                                    type="date"
                                    title="กำหนดชำระเงิน"
                                    value={customDueDate}
                                    onChange={(e) => setCustomDueDate(e.target.value)}
                                    className="bg-transparent text-white font-bold text-sm focus:outline-none [color-scheme:dark]"
                                />
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={doPrint}
                            className="bg-white text-slate-900 px-6 py-2 rounded-lg font-black flex items-center gap-2 hover:bg-slate-100 transition-all active:scale-95 shadow-xl scale-105"
                        >
                            <Printer size={20} /> PRINT / SAVE PDF
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 hover:bg-white/10 rounded-full transition-colors"
                            aria-label="Close"
                        >
                            <X size={32} />
                        </button>
                    </div>
                </div>

                {/* Preview Paper Area */}
                <div className="flex-1 overflow-y-auto bg-slate-200 p-4 md:p-8 print:p-0 print:bg-white print:overflow-visible border-0">
                    <div className="print-section mx-auto">
                        {jobChunks.map((chunk, pageIndex) => (
                            <div key={pageIndex} className={`w-[210mm] h-[297mm] overflow-hidden bg-white mx-auto shadow-sm p-[15mm] flex flex-col relative mb-8 last:mb-0 print:mb-0 print:shadow-none print:w-[210mm] print:h-[297mm] ${pageIndex < jobChunks.length - 1 ? 'page-break' : ''}`}>

                                {/* Header */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex-1">
                                        <h1 className="text-xl font-black text-slate-900 leading-tight whitespace-nowrap">บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด</h1>
                                        <p className="text-[11px] font-bold text-slate-500 mb-1">NEOSIAM LOGISTICS & TRANSPORT CO., LTD.</p>
                                        <div className="text-[10px] text-slate-500 leading-tight">
                                            <p>159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000</p>
                                            <p>Tax ID: 0105552087673 | Tel: 056-275-841</p>
                                        </div>
                                    </div>
                                    <div className="w-32">
                                        <img
                                            src="/logo.png"
                                            alt="Logo"
                                            className="w-full object-contain"
                                            loading="eager"
                                            onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
                                        />
                                    </div>
                                </div>
                                <div className="border-b-2 border-slate-950 mb-6"></div>

                                {/* Title & Meta */}
                                <div className="flex justify-between items-end mb-6">
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-900 uppercase">ใบรับวางบิล</h2>
                                        <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase">Billing Acknowledgement</p>
                                    </div>
                                    <div className="border-l-4 border-slate-900 pl-4 py-1 text-[11px] min-w-[200px]">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500 font-bold">เลขที่ No:</span>
                                            <span className="font-black underline">{documentNumber}</span>
                                        </div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500 font-bold">เอกสารอ้างอิง Ref:</span>
                                            <span className="font-black text-red-600 underline">{referenceNo || '________________'}</span>
                                        </div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500 font-bold">วันที่ Date:</span>
                                            <span className="font-medium">{currentDate}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-500 font-bold">กำหนด Due:</span>
                                            <span className="font-black text-blue-700">{dueDateStr}</span>
                                        </div>
                                        <div className="flex justify-between mt-1 pt-1 border-t border-slate-200">
                                            <span className="text-slate-500 font-bold">💳 เงื่อนไข:</span>
                                            <span className={`font-black ${paymentTerms.paymentType === 'CASH' ? 'text-green-600' : 'text-purple-600'}`}>
                                                {paymentTerms.paymentType === 'CASH' ? '💵 เงินสด' : `📅 เครดิต ${paymentTerms.creditDays} วัน`}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Subcon Info */}
                                <div className="grid grid-cols-2 gap-4 mb-6 text-[11px]">
                                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Subcontractor</p>
                                        <p className="text-sm font-black text-slate-900">{mainJob.subcontractor || '-'}</p>
                                    </div>
                                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                                        <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Company Info</p>
                                        <p className="font-bold text-[10px]">บริษัท นีโอสยาม โลจิสติกส์ แอนด์ ทรานสปอร์ต จำกัด</p>
                                        <p className="text-[9px] text-slate-500 leading-tight">159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000</p>
                                    </div>
                                </div>

                                {/* Table */}
                                <div className="flex-1">
                                    <table className="w-full border-collapse text-[10.5px]">
                                        <thead>
                                            <tr className="bg-slate-800 text-white text-center print:bg-slate-800 print:text-white">
                                                <th className="border border-slate-600 p-2 w-10">#</th>
                                                <th className="border border-slate-600 p-2 text-left">รายละเอียดบริการ (Description)</th>
                                                <th className="border border-slate-600 p-2 w-14">จำนวน</th>
                                                <th className="border border-slate-600 p-2 w-24">ราคาต่อหน่วย</th>
                                                <th className="border border-slate-600 p-2 w-24">รวมเงิน</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {chunk.map((j, idx) => (
                                                <React.Fragment key={j.id}>
                                                    <tr className="even:bg-slate-50 print:even:bg-slate-50">
                                                        <td className="border border-slate-200 p-2 text-center text-slate-400">{(pageIndex * ITEMS_PER_PAGE) + idx + 1}</td>
                                                        <td className="border border-slate-200 p-2 leading-relaxed">
                                                            <div className="font-bold text-slate-900 underline decoration-slate-200">ค่าระวางขนส่ง: {j.origin} - {j.destination}</div>
                                                            <div className="text-[9px] text-slate-500 font-medium">
                                                                Service: {formatDate(j.dateOfService)} | Truck: {j.licensePlate} ({j.truckType})
                                                            </div>
                                                        </td>
                                                        <td className="border border-slate-200 p-2 text-center">1 Trip</td>
                                                        <td className="border border-slate-200 p-2 text-right">{formatThaiCurrency(Number(j.cost))}</td>
                                                        <td className="border border-slate-200 p-2 text-right font-black">{formatThaiCurrency(Number(j.cost))}</td>
                                                    </tr>
                                                    {Number(j.extraCharge) > 0 && (
                                                        <tr className="bg-yellow-50/30 print:bg-yellow-50">
                                                            <td className="border border-slate-200 p-2"></td>
                                                            <td className="border border-slate-200 p-2 italic text-slate-600">- Extra Charge / ค่าใช้จ่ายเพิ่มเติม</td>
                                                            <td className="border border-slate-200 p-2 text-center">1 Job</td>
                                                            <td className="border border-slate-200 p-2 text-right">{formatThaiCurrency(Number(j.extraCharge))}</td>
                                                            <td className="border border-slate-200 p-2 text-right font-bold text-slate-800">{formatThaiCurrency(Number(j.extraCharge))}</td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Summary */}
                                {pageIndex === jobChunks.length - 1 && (
                                    <div className="mt-6 border-t-2 border-slate-900 pt-6">
                                        <div className="flex justify-between items-start gap-12">
                                            <div className="flex-1 space-y-4">
                                                <div className="bg-slate-50 border border-slate-200 rounded p-3 min-h-[80px]">
                                                    <p className="text-[9px] font-black text-slate-400 uppercase mb-2">Remarks / หมายเหตุ</p>
                                                    <p className="text-[10px] text-slate-500 leading-relaxed italic">
                                                        1. ได้รับเอกสารพัสดุเป็นที่เรียบร้อยและถูกต้องตามเงื่อนไขการวางบิล<br />
                                                        2. การรับชำระเงินจะดำเนินการตามรอบบัญชีที่บริษัทกำหนดไว้
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-slate-900 text-white rounded text-center font-black text-xs shadow-md tracking-wider print:bg-slate-900 print:text-white">
                                                    ({bahtText(netTotal)})
                                                </div>
                                            </div>
                                            <div className="w-[220px] text-[11px] space-y-2">
                                                <div className="flex justify-between text-slate-600">
                                                    <span className="font-bold">รวมเงินก่อนภาษี (Subtotal)</span>
                                                    <span className="font-black text-slate-900">{formatThaiCurrency(subtotal)}</span>
                                                </div>

                                                {/* UI Only Switches */}
                                                <div className="no-print space-y-2 pb-2 mb-2 border-b border-dashed">
                                                    <label className="flex items-center justify-between text-slate-500 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                        <div className="flex items-center gap-2">
                                                            <input type="checkbox" checked={applyVat} onChange={e => setApplyVat(e.target.checked)} className="w-4 h-4 rounded text-blue-600" />
                                                            <span className="font-bold">VAT {vatRate}%</span>
                                                        </div>
                                                        <span className="font-black text-slate-900 underline decoration-dotted">{formatThaiCurrency(vatAmount)}</span>
                                                    </label>
                                                    <label className="flex items-center justify-between text-slate-500 cursor-pointer hover:bg-slate-100 p-1 rounded">
                                                        <div className="flex items-center gap-2">
                                                            <input type="checkbox" checked={applyWht} onChange={e => setApplyWht(e.target.checked)} className="w-4 h-4 rounded text-red-600" />
                                                            <span className="font-bold text-red-600">WHT {whtRate}%</span>
                                                        </div>
                                                        <span className="font-black text-red-600">-{formatThaiCurrency(whtAmount)}</span>
                                                    </label>
                                                </div>

                                                {/* Print Static Values */}
                                                <div className="hidden print:block space-y-1">
                                                    {applyVat && (
                                                        <div className="flex justify-between text-slate-600">
                                                            <span>VAT {vatRate}%</span>
                                                            <span className="font-bold">{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    )}
                                                    {applyWht && (
                                                        <div className="flex justify-between text-slate-600">
                                                            <span>WHT {whtRate}%</span>
                                                            <span className="font-bold text-slate-900">-{whtAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    )}
                                                    {!applyVat && !applyWht && (
                                                        <div className="flex justify-between text-slate-400 italic text-[10px]">
                                                            <span>ไม่มีภาษี (No Tax Applied)</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex justify-between border-t-2 border-slate-900 pt-3 mt-2 bg-slate-50 p-2 rounded shadow-inner print:bg-slate-50">
                                                    <div className="flex flex-col text-left">
                                                        <span className="font-black text-slate-900 text-xs text-blue-800 print:text-blue-800 leading-tight">ยอดเงินสุทธิ</span>
                                                        <span className="text-[10px] font-black text-blue-800 print:text-blue-800 leading-none">(NET TOTAL)</span>
                                                    </div>
                                                    <span className="text-sm font-black text-blue-800 underline decoration-double underline-offset-4 print:text-blue-800">{formatThaiCurrency(netTotal)}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-16 mt-16 text-center text-[11px]">
                                            <div className="space-y-4">
                                                <div className="border-b-2 border-slate-300 w-full mb-2 h-10"></div>
                                                <p className="font-black text-slate-900 uppercase">ผู้รับวางบิล (Receiver Signature)</p>
                                                <p className="text-[10px] text-slate-400">Date: ______/______/______</p>
                                            </div>
                                            <div className="space-y-4">
                                                <div className="border-b-2 border-slate-300 w-full mb-2 h-10"></div>
                                                <p className="font-black text-slate-900 uppercase">ผู้วางบิล / ผู้รับเงิน (Authorized By)</p>
                                                <p className="text-[10px] text-slate-400">Date: {currentDate}</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="absolute bottom-4 right-[15mm] text-[10px] font-bold text-slate-500">หน้า {pageIndex + 1} จาก {jobChunks.length}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer Toolbar */}
                <div className="bg-slate-100 border-t border-slate-200 px-8 py-6 flex justify-between items-center no-print">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-8 py-3 bg-white border border-slate-300 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all active:scale-95"
                    >
                        CANCEL / CLOSE
                    </button>

                    {!readOnly && (
                        <div className="flex gap-4">
                            <button
                                type="button"
                                onClick={doPrint}
                                className="px-8 py-3 bg-slate-800 text-white rounded-xl font-black flex items-center gap-3 hover:bg-slate-900 transition-all shadow-xl active:scale-95 border-b-4 border-slate-950"
                            >
                                <Printer size={22} />
                                PRINT DOCUMENT
                            </button>

                            <button
                                type="button"
                                onClick={finalizeBilled}
                                className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black flex items-center gap-3 hover:bg-emerald-700 transition-all shadow-xl active:scale-95 border-b-4 border-emerald-900"
                            >
                                <CheckCircle size={22} />
                                CONFIRM & RECORD ({jobs.length})
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default InvoicePreviewModal;
