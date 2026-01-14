import React, { useState } from 'react';
import { X, Upload, Calendar, DollarSign, FileCheck } from 'lucide-react';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (date: string, file: File | null) => Promise<void>;
    totalAmount: number;
    jobCount: number;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSubmit, totalAmount, jobCount }) => {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [file, setFile] = useState<File | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await onSubmit(date, file);
            onClose();
        } catch (error) {
            console.error('Payment Error', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">Record Payment</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">บันทึกการจ่ายเงิน</p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Summary Card */}
                    <div className="bg-emerald-50 rounded-2xl p-6 border border-emerald-100 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Total to Pay ({jobCount} Jobs)</p>
                            <p className="text-3xl font-black text-slate-900">฿{totalAmount.toLocaleString()}</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                            <DollarSign size={24} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* Date Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Payment Date (วันที่โอน)</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    aria-label="Payment Date"
                                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-slate-700 transition-all"
                                />
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            </div>
                        </div>

                        {/* File Upload */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-700">Payment Slip (หลักฐานการโอน) <span className="text-rose-500">*</span></label>
                            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 hover:bg-slate-50 hover:border-emerald-200 transition-all text-center cursor-pointer relative group">
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    required
                                    onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                                    aria-label="Upload Payment Slip"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <div className="flex flex-col items-center gap-2">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${file ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500'}`}>
                                        {file ? <FileCheck size={24} /> : <Upload size={24} />}
                                    </div>
                                    {file ? (
                                        <div>
                                            <p className="text-sm font-bold text-emerald-700">{file.name}</p>
                                            <p className="text-xs text-emerald-500 font-medium">Click to change</p>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm font-bold text-slate-600">Click to upload slip</p>
                                            <p className="text-xs text-slate-400 font-medium">JPG, PNG or PDF</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !file}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase tracking-widest shadow-xl shadow-emerald-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>Recording...</>
                        ) : (
                            <>
                                <FileCheck size={20} /> Confirm Payment
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PaymentModal;
