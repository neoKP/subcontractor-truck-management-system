
import React, { useRef, useState } from 'react';
import { Job, JobStatus } from '../types';
import { X, Printer, CheckCircle, Receipt, Edit2 } from 'lucide-react';

/**
 * Converts a number to Thai Baht text.
 * Logic: 
 * - If no satang (decimal is .00), append "บาทถ้วน".
 * - If there are satang, read the satang and omit "ถ้วน".
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

    // Split millions for large numbers
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

    if (intNum > 0) {
        result += convert(intPart) + "บาท";
    }

    if (decNum > 0) {
        result += convert(decPart) + "สตางค์";
    } else if (intNum > 0) {
        result += "ถ้วน";
    } else if (decNum === 0 && intNum === 0) {
        return "ศูนย์บาทถ้วน";
    } else if (intNum === 0 && decNum > 0) {
        result = convert(decPart) + "สตางค์";
    }

    return result;
};

interface InvoicePreviewModalProps {
    jobs: Job[];
    onClose: () => void;
    onBatchConfirm?: (jobs: Job[]) => void;
    existingDocNo?: string;
    existingDate?: string;
    readOnly?: boolean;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
    jobs,
    onClose,
    onBatchConfirm,
    existingDocNo,
    existingDate,
    readOnly = false
}) => {
    const mainJob = jobs[0];
    const printRef = useRef<HTMLDivElement>(null);

    const [vatRate, setVatRate] = useState<string | number>(7);
    const [applyVat, setApplyVat] = useState(false);
    const [isEditingVat, setIsEditingVat] = useState(false);
    const [whtRate, setWhtRate] = useState<string | number>(1);
    const [applyWht, setApplyWht] = useState(true);
    const [isEditingWht, setIsEditingWht] = useState(false);
    const [dueDate, setDueDate] = useState(() => {
        if (existingDate) {
            const d = new Date(existingDate);
            d.setDate(d.getDate() + 30);
            return d;
        }
        const d = new Date();
        d.setDate(d.getDate() + 30);
        return d;
    });
    const [isEditingDueDate, setIsEditingDueDate] = useState(false);

    if (!mainJob) return null;

    const handlePrint = () => {
        if (!printRef.current) return;
        window.print();
    };

    // Calculate Totals for all jobs
    const subtotal = jobs.reduce((sum, j) => sum + (Number(j.cost) || 0) + (Number(j.extraCharge) || 0), 0);
    const vatAmount = applyVat ? (subtotal * Number(vatRate)) / 100 : 0;
    const whtAmount = applyWht ? (subtotal * Number(whtRate)) / 100 : 0;
    const billTotal = subtotal + vatAmount;
    const netTotal = subtotal + vatAmount - whtAmount;

    // Generate Document Number (e.g., BA-202601-048) OR use existing
    const now = existingDate ? new Date(existingDate) : new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
    const documentNumber = existingDocNo || `BA-${yearMonth}-${mainJob.id.split('-').pop()}`;
    const issueDate = existingDate ? new Date(existingDate) : new Date();

    const finalizeBilled = () => {
        if (readOnly || !onBatchConfirm) return;
        const updatedJobs = jobs.map(j => ({
            ...j,
            status: JobStatus.BILLED,
            billingDocNo: documentNumber,
            billingDate: issueDate.toISOString()
        }));
        onBatchConfirm(updatedJobs);
        onClose();
    };

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
                            <Receipt size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Billing Acknowl. Preview</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                                {jobs.length} Items Selected
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400" title="Close Preview">
                        <X size={20} />
                    </button>
                </div>

                {/* Content - Size A4 Layout */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50 scrollbar-thin">
                    <div ref={printRef} className="print-area bg-white shadow-2xl overflow-hidden border border-slate-200 mx-auto max-w-[210mm] min-h-[297mm] flex flex-col font-sans p-[10mm]">

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
                                <h2 className="text-2xl font-bold text-slate-900 leading-none">ใบรับวางบิล</h2>
                                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">BILLING ACKNOWLEDGEMENT</h3>
                            </div>

                            <div className="border border-slate-400 rounded-sm text-xs w-[300px]">
                                <div className="grid grid-cols-[80px_1fr] border-b border-slate-200">
                                    <div className="bg-slate-100 p-1 pl-2 font-bold text-slate-700">เลขที่ No:</div>
                                    <div className="p-1 pl-2 font-medium text-slate-900">{documentNumber}</div>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] border-b border-slate-200">
                                    <div className="bg-slate-100 p-1 pl-2 font-bold text-slate-700">วันที่ Date:</div>
                                    <div className="p-1 pl-2 font-medium text-slate-900">{issueDate.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                                </div>
                                <div className="grid grid-cols-[80px_1fr] border-b border-slate-200">
                                    <div className="bg-slate-100 p-1 pl-2 font-bold text-slate-700">ครบกำหนด Due:</div>
                                    <div className="p-1 pl-2 font-medium text-slate-900 flex items-center gap-2 group relative">
                                        {dueDate.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                        <button onClick={() => setIsEditingDueDate(true)} className="no-print opacity-0 group-hover:opacity-100" aria-label="Edit Due Date"><Edit2 size={10} /></button>
                                        {isEditingDueDate && (
                                            <input type="date" aria-label="Due Date Input" className="no-print absolute left-0 top-0 w-full h-full opacity-0 cursor-pointer" onKeyDown={(e) => e.preventDefault()} onChange={e => { setDueDate(new Date(e.target.value)); setIsEditingDueDate(false); }} />
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-[80px_1fr]">
                                    <div className="bg-slate-100 p-1 pl-2 font-bold text-slate-700">อ้างอิง Ref:</div>
                                    <div className="p-1 pl-2 font-medium text-slate-900">-</div>
                                </div>
                            </div>
                        </div>

                        {/* 3. Info Boxes: Vendor vs Branch Info */}
                        <div className="flex gap-4 mb-4 text-xs">
                            {/* Left Box: Vendor Info */}
                            <div className="flex-1 border border-slate-300 rounded-sm min-h-[120px]">
                                <div className="bg-slate-100 px-3 py-1 font-bold text-slate-700 border-b border-slate-300">
                                    ผู้รับจ้าง (Subcontractor)
                                </div>
                                <div className="p-3 space-y-2">
                                    <p className="font-bold text-slate-900 text-sm">{mainJob.subcontractor || 'General Subcontractor'}</p>
                                    <div className="text-slate-400 text-[10px] space-y-4 pt-1">
                                        <p>ที่อยู่ (Address): ....................................................................................................</p>
                                        <p>...................................................................................................................................</p>
                                        <p>เลขประจำตัวผู้เสียภาษี (Tax ID): ..............................................................</p>
                                    </div>
                                </div>
                            </div>

                            {/* Right Box: Branch/Logistics Info */}
                            <div className="flex-1 border border-slate-300 rounded-sm min-h-[120px]">
                                <div className="bg-slate-100 px-3 py-1 font-bold text-slate-700 border-b border-slate-300">
                                    เงื่อนไข / สถานที่ (Conditions / Location)
                                </div>
                                <div className="p-3 space-y-1">
                                    <p className="font-bold text-slate-900">สำนักงานใหญ่ (Head Office)</p>
                                    <p className="text-slate-500">159/9-10 หมู่ 7 ต.บางม่วง อ.เมืองนครสวรรค์ จ.นครสวรรค์ 60000</p>
                                    <p className="text-slate-500 pt-2 font-bold">เงื่อนไขการวางบิล:</p>
                                    <p className="text-slate-500">ทุกวันจันทร์ - ศุกร์ (08:30 - 16:30)</p>
                                </div>
                            </div>
                        </div>

                        {/* 4. Table with Borders */}
                        <div className="flex-1 mb-4">
                            <table className="w-full border-collapse border border-slate-300 text-xs">
                                <thead>
                                    <tr className="bg-slate-50 text-slate-900 text-center font-bold">
                                        <th className="border border-slate-300 py-2 w-12">ลำดับ<br /><span className="text-[9px] font-normal uppercase">No.</span></th>
                                        <th className="border border-slate-300 py-2">รายการสินค้า / รายละเอียด<br /><span className="text-[9px] font-normal uppercase">Description</span></th>
                                        <th className="border border-slate-300 py-2 w-16">จำนวน<br /><span className="text-[9px] font-normal uppercase">Qty</span></th>
                                        <th className="border border-slate-300 py-2 w-16">หน่วย<br /><span className="text-[9px] font-normal uppercase">Unit</span></th>
                                        <th className="border border-slate-300 py-2 w-24">ราคา/หน่วย<br /><span className="text-[9px] font-normal uppercase">Unit Price</span></th>
                                        <th className="border border-slate-300 py-2 w-28">จำนวนเงิน<br /><span className="text-[9px] font-normal uppercase">Amount</span></th>
                                    </tr>
                                </thead>
                                <tbody className="align-top text-slate-700">
                                    {jobs.map((j, idx) => (
                                        <React.Fragment key={j.id}>
                                            <tr className="hover:bg-slate-50/50">
                                                <td className="border-r border-slate-300 px-2 py-2 text-center">{idx + 1}</td>
                                                <td className="border-r border-slate-300 px-2 py-2">
                                                    <p className="font-bold text-slate-900">ค่าขนส่งสินค้า (Transportation Fee)</p>
                                                    <p className="text-[10px] text-slate-500 pt-1">Route: {j.origin} - {j.destination}</p>
                                                    <p className="text-[10px] text-slate-500">Date: {new Date(j.dateOfService).toLocaleDateString('th-TH')}</p>
                                                    <p className="text-[10px] text-slate-500">Truck: {j.truckType} {j.licensePlate ? `(${j.licensePlate})` : ''}</p>
                                                </td>
                                                <td className="border-r border-slate-300 px-2 py-2 text-center">1</td>
                                                <td className="border-r border-slate-300 px-2 py-2 text-center">เที่ยว</td>
                                                <td className="border-r border-slate-300 px-2 py-2 text-right">{Number(j.cost).toFixed(2)}</td>
                                                <td className="px-2 py-2 text-right font-medium">{Number(j.cost).toFixed(2)}</td>
                                            </tr>
                                            {Number(j.extraCharge) > 0 && (
                                                <tr className="hover:bg-slate-50/50">
                                                    <td className="border-r border-slate-300 text-center py-1"></td>
                                                    <td className="border-r border-slate-300 px-2 py-1 text-slate-600 italic">
                                                        - ค่าใช้จ่ายเพิ่มเติม (Extra Charge)
                                                    </td>
                                                    <td className="border-r border-slate-300 px-2 py-1 text-center">1</td>
                                                    <td className="border-r border-slate-300 px-2 py-1 text-center">รายการ</td>
                                                    <td className="border-r border-slate-300 px-2 py-1 text-right">{Number(j.extraCharge).toFixed(2)}</td>
                                                    <td className="px-2 py-1 text-right font-medium">{Number(j.extraCharge).toFixed(2)}</td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    ))}
                                    {/* Spacer Row to fill height if needed or keep structure */}
                                    <tr className="h-full"><td className="border-r border-slate-300"></td><td className="border-r border-slate-300"></td><td className="border-r border-slate-300"></td><td className="border-r border-slate-300"></td><td className="border-r border-slate-300"></td><td></td></tr>
                                </tbody>
                            </table>
                        </div>

                        {/* 5. Footer Summary */}
                        <div className="grid grid-cols-[1fr_300px] gap-6 text-xs mb-8">
                            <div className="space-y-4">
                                <div>
                                    <p className="font-bold text-slate-900 mb-1">หมายเหตุ / Remarks:</p>
                                    <div className="p-2 border border-slate-200 rounded-sm min-h-[60px] text-slate-500 text-[10px]">
                                        - ได้รับใบแจ้งหนี้/ใบกำกับภาษี ครบถ้วนถูกต้อง<br />
                                        - การจ่ายเงินโอนเข้าบัญชีผู้รับจ้าง ตามรอบการจ่ายเงินของบริษัท
                                    </div>
                                </div>
                                {/* Baht Text Box */}
                                <div className="border border-slate-300 rounded-md p-2 text-center bg-slate-50">
                                    <p className="font-bold text-slate-800 text-sm">({bahtText(netTotal)})</p>
                                </div>
                            </div>

                            <div className="space-y-0 text-right">
                                <div className="flex justify-between items-center py-2 px-1 border-b border-slate-200">
                                    <span className="font-medium text-slate-600">รวมเป็นเงิน (Subtotal)</span>
                                    <span className="font-bold text-slate-900">{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-1 border-b border-slate-200 group relative">
                                    <div className="flex items-center gap-1 font-medium text-slate-600">
                                        <input type="checkbox" aria-label="Apply VAT" checked={applyVat} onChange={(e) => setApplyVat(e.target.checked)} className="no-print accent-blue-600" />
                                        <span onClick={() => { if (applyVat) setIsEditingVat(true) }} className="cursor-pointer">ภาษีมูลค่าเพิ่ม (VAT {applyVat ? vatRate : 0}%)</span>
                                        {isEditingVat && (
                                            <div className="absolute left-0 bottom-8 z-10 bg-white border shadow-md p-2 flex gap-2 no-print">
                                                <input value={vatRate} aria-label="VAT Rate" onChange={e => setVatRate(e.target.value)} className="w-10 border text-center" />
                                                <button onClick={() => setIsEditingVat(false)} className="text-blue-600 font-bold">OK</button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-bold text-slate-900">{vatAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-1 border-b border-slate-200 group relative">
                                    <div className="flex items-center gap-1 font-medium text-slate-600">
                                        <input type="checkbox" aria-label="Apply WHT" checked={applyWht} onChange={(e) => setApplyWht(e.target.checked)} className="no-print accent-red-600" />
                                        <span onClick={() => { if (applyWht) setIsEditingWht(true) }} className="cursor-pointer">หัก ณ ที่จ่าย (WHT {applyWht ? whtRate : 0}%)</span>
                                        {isEditingWht && (
                                            <div className="absolute left-0 bottom-8 z-10 bg-white border shadow-md p-2 flex gap-2 no-print">
                                                <input value={whtRate} aria-label="WHT Rate" onChange={e => setWhtRate(e.target.value)} className="w-10 border text-center" />
                                                <button onClick={() => setIsEditingWht(false)} className="text-blue-600 font-bold">OK</button>
                                            </div>
                                        )}
                                    </div>
                                    <span className="font-bold text-slate-900">{whtAmount > 0 ? `- ${whtAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ` : '0.00'}</span>
                                </div>
                                <div className="flex justify-between items-center py-2 px-1 bg-slate-100 mt-2 rounded-sm border border-slate-200">
                                    <span className="font-black text-slate-900 uppercase text-xs">ยอดเงินสุทธิ (Net Total)</span>
                                    <span className="font-black text-slate-900 text-sm underline decoration-double underline-offset-2">{netTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                            </div>
                        </div>

                        {/* 6. Signatures */}
                        <div className="grid grid-cols-2 gap-10 mt-auto pt-4 text-xs">
                            <div className="text-center space-y-8">
                                <div className="relative pt-6">
                                    <p className="font-medium text-slate-900">ผู้จัดทำ (Prepared By)</p>
                                </div>
                                <div className="space-y-1 pt-6">
                                    <p className="text-slate-400">...........................................................</p>
                                    <p className="font-medium text-slate-900 mt-2">วันที่  ........./........./..........</p>
                                </div>
                            </div>
                            <div className="text-center space-y-8">
                                <div className="relative pt-6">
                                    <p className="font-medium text-slate-900">ผู้มีอำนาจลงนาม / ผู้อนุมัติ (Authorized Signature)</p>
                                </div>
                                <div className="space-y-1 pt-6">
                                    <p className="text-slate-400">...........................................................</p>
                                    <p className="font-medium text-slate-900 mt-2">วันที่  ........./........./..........</p>
                                </div>
                            </div>
                        </div>

                        <div className="text-[9px] text-right text-slate-300 mt-4">
                            FM-AC01-02 Billing Acceptance Form
                        </div>

                    </div>
                </div>

                {/* Footer UI Actions */}
                <div className="px-8 py-6 bg-white border-t border-slate-100 flex justify-between items-center no-print">
                    <div className="flex flex-col gap-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            {jobs.length} Job References Linked to this Acknowledgement (BA)
                        </p>
                        {!readOnly && (
                            <p className="text-[9px] font-bold text-blue-500">
                                * คลิกไอคอน <Edit2 size={10} className="inline mx-1" /> ในตัวเอกสารเพื่อแก้ไข เลขที่ใบวางบิล/ใบกำกับภาษี ของรถร่วมก่อนพิมพ์
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handlePrint} className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">
                            <Printer size={16} /> Print / Save PDF
                        </button>
                        {!readOnly && onBatchConfirm && (
                            <button onClick={finalizeBilled} className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100">
                                <CheckCircle size={16} /> Confirm & Issue Acknowledgement ({jobs.length})
                            </button>
                        )}
                        {readOnly && (
                            <button onClick={onClose} className="flex items-center gap-2 px-8 py-3 bg-slate-100 text-slate-600 rounded-xl text-xs font-black uppercase hover:bg-slate-200 transition-all">
                                Close
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default InvoicePreviewModal;
