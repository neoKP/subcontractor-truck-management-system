
import React from 'react';
import { Job, UserRole } from '../types';
import {
    X, CheckCircle, AlertTriangle, ShieldCheck, Truck,
    User, Phone, Hash, DollarSign, TrendingUp, FileText,
    Calendar, MapPin, Package, ArrowLeft
} from 'lucide-react';
import { formatDate, formatThaiCurrency } from '../utils/format';

interface ReviewConfirmModalProps {
    job: Job;
    editData: {
        subcontractor: string;
        truckType: string;
        driverName: string;
        driverPhone: string;
        licensePlate: string;
        cost: number;
        sellingPrice: number;
    };
    onConfirm: () => void;
    onEdit: () => void;
    onClose: () => void;
    user: { id: string; name: string; role: UserRole };
}

const ReviewConfirmModal: React.FC<ReviewConfirmModalProps> = ({
    job,
    editData,
    onConfirm,
    onEdit,
    onClose,
    user
}) => {
    const margin = editData.sellingPrice - editData.cost;
    const marginPercent = editData.cost > 0 ? ((margin / editData.cost) * 100).toFixed(1) : '0.0';

    // ตรวจสอบว่าข้อมูล Fleet Information ครบหรือไม่
    const isFleetInfoComplete = !!(
        editData.driverName &&
        editData.driverPhone &&
        editData.licensePlate
    );

    // ตรวจสอบว่าข้อมูลพื้นฐานครบหรือไม่
    const isDataComplete = !!(
        editData.subcontractor &&
        editData.truckType &&
        editData.cost > 0 &&
        isFleetInfoComplete
    );

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-gradient-to-br from-slate-50 to-white w-full max-w-3xl max-h-[95vh] rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border-2 border-white/50">

                {/* Header with Gradient */}
                <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-8 text-white overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>

                    <div className="relative z-10 flex justify-between items-start">
                        <div>
                            <div className="flex items-center gap-2 opacity-90 mb-2">
                                <ShieldCheck size={16} />
                                <span className="text-[11px] uppercase tracking-[0.2em] font-black">Review & Confirm</span>
                            </div>
                            <h2 className="text-3xl font-black tracking-tight mb-1">ตรวจทานข้อมูลก่อนยืนยัน</h2>
                            <p className="text-sm font-bold text-blue-100">กรุณาตรวจสอบความถูกต้องก่อนล็อกราคา</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 bg-white/10 hover:bg-white/20 rounded-2xl backdrop-blur-md transition-all"
                            title="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-8 space-y-6 scrollbar-thin">

                    {/* Job Information Card */}
                    <div className="bg-white rounded-[2rem] p-6 shadow-lg border border-slate-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 rounded-xl text-blue-600">
                                <FileText size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">รายละเอียดใบงาน</h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Job Information</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Job ID</p>
                                <p className="text-sm font-black text-slate-800 font-mono">{job.id}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Service Date</p>
                                <p className="text-sm font-bold text-slate-700">{formatDate(job.dateOfService)}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Requested By</p>
                                <p className="text-sm font-bold text-slate-700">{job.requestedByName || job.requestedBy}</p>
                            </div>
                            <div className="space-y-1 col-span-2">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <MapPin size={10} /> Route
                                </p>
                                <p className="text-sm font-black text-slate-800">{job.origin} → {job.destination}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                    <Package size={10} /> Weight
                                </p>
                                <p className="text-sm font-bold text-slate-700">{job.weightVolume || '-'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Assignment Details Card */}
                    <div className={`bg-gradient-to-br rounded-[2rem] p-6 shadow-lg border-2 ${isFleetInfoComplete
                            ? 'from-emerald-50 to-teal-50 border-emerald-100'
                            : 'from-orange-50 to-rose-50 border-orange-200'
                        }`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={`p-2 rounded-xl text-white shadow-lg ${isFleetInfoComplete
                                    ? 'bg-emerald-600 shadow-emerald-200'
                                    : 'bg-orange-500 shadow-orange-200'
                                }`}>
                                <Truck size={20} />
                            </div>
                            <div className="flex-1">
                                <h3 className={`text-sm font-black uppercase tracking-wider ${isFleetInfoComplete ? 'text-emerald-900' : 'text-orange-900'
                                    }`}>ข้อมูลการจัดรถ</h3>
                                <p className={`text-[10px] font-bold uppercase ${isFleetInfoComplete ? 'text-emerald-600' : 'text-orange-600'
                                    }`}>Assignment Details</p>
                            </div>
                            {!isFleetInfoComplete && (
                                <div className="px-3 py-1 bg-orange-500 text-white rounded-full text-[9px] font-black uppercase animate-pulse">
                                    ⚠️ ข้อมูลไม่ครบ
                                </div>
                            )}
                        </div>

                        {/* Subcontractor */}
                        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 mb-4 border border-emerald-100">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Subcontractor</p>
                                <div className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-[8px] font-black uppercase">
                                    Selected
                                </div>
                            </div>
                            <p className="text-lg font-black text-emerald-900">{editData.subcontractor}</p>
                            <p className="text-xs font-bold text-emerald-600 mt-1">Truck Type: {editData.truckType}</p>
                        </div>

                        {/* Fleet Information */}
                        <div className={`bg-white/80 backdrop-blur-sm rounded-2xl p-4 border-2 ${isFleetInfoComplete ? 'border-emerald-100' : 'border-orange-300'
                            }`}>
                            <div className="flex items-center justify-between mb-3">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isFleetInfoComplete ? 'text-emerald-700' : 'text-orange-700'
                                    }`}>Fleet Information</p>
                                {!isFleetInfoComplete && (
                                    <div className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-[8px] font-black uppercase">
                                        ⚠️ กรุณากรอกให้ครบ
                                    </div>
                                )}
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editData.driverName
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        <User size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Driver Name</p>
                                        <p className={`text-sm font-black ${editData.driverName ? 'text-slate-800' : 'text-orange-600 italic'
                                            }`}>{editData.driverName || 'ยังไม่ระบุ'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editData.driverPhone
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        <Phone size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">Phone Number</p>
                                        <p className={`text-sm font-black ${editData.driverPhone ? 'text-slate-800' : 'text-orange-600 italic'
                                            }`}>{editData.driverPhone || 'ยังไม่ระบุ'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${editData.licensePlate
                                            ? 'bg-emerald-100 text-emerald-600'
                                            : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        <Hash size={16} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-[9px] font-bold text-slate-400 uppercase">License Plate</p>
                                        <p className={`text-sm font-black ${editData.licensePlate ? 'text-slate-800' : 'text-orange-600 italic'
                                            }`}>{editData.licensePlate || 'ยังไม่ระบุ'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Pricing Information Card */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-[2rem] p-6 shadow-lg border-2 border-blue-100">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-200">
                                <DollarSign size={20} />
                            </div>
                            <div>
                                <h3 className="text-sm font-black text-blue-900 uppercase tracking-wider">ข้อมูลราคา</h3>
                                <p className="text-[10px] font-bold text-blue-600 uppercase">Pricing Information</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Cost */}
                            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-blue-100">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">Cost (ต้นทุน)</p>
                                    <div className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[8px] font-black">
                                        FROM MATRIX
                                    </div>
                                </div>
                                <p className="text-2xl font-black text-blue-900">฿{formatThaiCurrency(editData.cost)}</p>
                                <p className="text-xs font-bold text-blue-600 mt-1">ค่าจ้างรถร่วง (Subcontractor Cost)</p>
                            </div>

                            {/* Selling Price */}
                            {user.role !== UserRole.BOOKING_OFFICER && (
                                <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-indigo-100">
                                    <p className="text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2">Selling Price (ขาย)</p>
                                    <p className="text-2xl font-black text-indigo-900">฿{formatThaiCurrency(editData.sellingPrice)}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                        <TrendingUp size={12} className="text-emerald-600" />
                                        <p className="text-xs font-bold text-emerald-600">
                                            Margin: ฿{formatThaiCurrency(margin)} ({marginPercent}%)
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Warning Card */}
                    <div className="bg-gradient-to-br from-rose-50 to-orange-50 rounded-[2rem] p-6 shadow-lg border-2 border-rose-200">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-rose-500 rounded-2xl text-white shadow-lg shadow-rose-200 shrink-0">
                                <AlertTriangle size={24} />
                            </div>
                            <div className="flex-1">
                                <h3 className="text-sm font-black text-rose-900 uppercase tracking-wider mb-2">⚠️ คำเตือนสำคัญ</h3>
                                <div className="space-y-2 text-sm font-bold text-rose-800 leading-relaxed">
                                    <p>🔒 เมื่อกดยืนยัน ราคาจะถูก <span className="underline decoration-2">LOCK</span> ทันที และไม่สามารถแก้ไขได้</p>
                                    <p>📝 ข้อมูลจะถูกส่งไปยังฝ่ายบัญชีเพื่อตรวจสอบ</p>
                                    <p className="text-xs text-rose-600">* ยกเว้น Admin หรือกรณีที่ฝ่ายบัญชีปฏิเสธและส่งกลับมาแก้ไข</p>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>

                {/* Footer Actions */}
                <div className="bg-white border-t-2 border-slate-100 p-6 flex flex-col gap-4 shrink-0">
                    {/* Warning if data incomplete */}
                    {!isDataComplete && (
                        <div className="bg-orange-50 border-2 border-orange-200 rounded-2xl p-4 flex items-start gap-3">
                            <AlertTriangle size={20} className="text-orange-600 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-black text-orange-900 mb-1">กรุณากรอกข้อมูลให้ครบถ้วน</p>
                                <p className="text-xs font-bold text-orange-700">
                                    ต้องกรอก: ชื่อคนขับ, เบอร์โทร, และทะเบียนรถ ก่อนยืนยันและล็อกราคา
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-between items-center gap-4">
                        <button
                            onClick={onEdit}
                            className="flex items-center gap-2 px-8 py-4 rounded-2xl font-black text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all uppercase tracking-widest text-sm border-2 border-slate-200 hover:border-slate-300"
                        >
                            <ArrowLeft size={18} />
                            กลับไปแก้ไข (Edit)
                        </button>

                        <button
                            onClick={onConfirm}
                            disabled={!isDataComplete}
                            className={`flex items-center gap-2 px-12 py-4 rounded-2xl font-black shadow-xl transform transition-all uppercase tracking-widest text-sm ${isDataComplete
                                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-0.5 cursor-pointer'
                                    : 'bg-slate-300 text-slate-500 shadow-slate-200 cursor-not-allowed opacity-60'
                                }`}
                        >
                            <CheckCircle size={20} />
                            ยืนยันและล็อก (Confirm & Lock)
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ReviewConfirmModal;
