
import React, { useState } from 'react';
import { Job, UserRole, AuditLog } from '../types';
import { MASTER_DATA, PRICE_MATRIX } from '../constants';
import { X, Edit3, MapPin, Truck, ShieldAlert, BadgeCheck, Zap, ShieldCheck } from 'lucide-react';

interface BookingEditModalProps {
    job: Job;
    onClose: () => void;
    onSave: (job: Job, logs?: AuditLog[]) => void;
    user: { id: string; name: string; role: UserRole };
}

const BookingEditModal: React.FC<BookingEditModalProps> = ({ job, onClose, onSave, user }) => {
    // Pricing Intelligence Logic
    const findContractMatch = (origin: string, dest: string, truck: string, sub?: string) => {
        if (!origin || !dest || !truck) return null;

        // Find all matches for this route/truck
        const matches = PRICE_MATRIX.filter(p => {
            const originMatch = p.origin.includes(origin) || origin.includes(p.origin);
            const destMatch = p.destination.includes(dest) || dest.includes(p.destination);
            const truckMatch = p.truckType === truck;
            return originMatch && destMatch && truckMatch;
        });

        if (sub && sub !== '') {
            return matches.find(m => m.subcontractor === sub) || null;
        }

        // Return first available match if no subcontractor is specified
        return matches.length > 0 ? matches[0] : null;
    };

    const [editData, setEditData] = useState(() => {
        const initialSub = job.subcontractor || '';
        const contract = findContractMatch(job.origin, job.destination, job.truckType, initialSub)
            || findContractMatch(job.origin, job.destination, job.truckType);

        return {
            origin: job.origin,
            destination: job.destination,
            truckType: job.truckType,
            subcontractor: initialSub,
            cost: job.cost || (contract ? contract.basePrice : 0)
        };
    });

    const allMatches = PRICE_MATRIX.filter(p => {
        const originMatch = p.origin.includes(editData.origin) || editData.origin.includes(p.origin);
        const destMatch = p.destination.includes(editData.destination) || editData.destination.includes(p.destination);
        const truckMatch = p.truckType === editData.truckType;
        return originMatch && destMatch && truckMatch;
    });

    const activeContract = findContractMatch(editData.origin, editData.destination, editData.truckType, editData.subcontractor)
        || findContractMatch(editData.origin, editData.destination, editData.truckType);

    const hasContractPrice = activeContract !== null;

    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSave = async () => {
        if (isSubmitting) return;

        const hasChanged =
            job.origin !== editData.origin ||
            job.destination !== editData.destination ||
            job.truckType !== editData.truckType ||
            (job.subcontractor || '') !== editData.subcontractor;

        if (!hasChanged) {
            onClose();
            return;
        }

        if (!reason.trim()) {
            if (typeof (window as any).Swal !== 'undefined') {
                (window as any).Swal.fire({
                    title: 'Required Reason',
                    text: 'Please provide a reason for the modification. / กรุณาระบุเหตุผลในการแก้ไข',
                    icon: 'warning',
                    confirmButtonColor: '#2563eb',
                    customClass: { popup: 'rounded-[1.5rem]' }
                });
            }
            return;
        }

        setIsSubmitting(true);
        await new Promise(resolve => setTimeout(resolve, 800));

        const logs: AuditLog[] = [];
        const createLog = (field: string, oldVal: string, newVal: string): AuditLog => ({
            id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            jobId: job.id,
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            timestamp: new Date().toISOString(),
            field,
            oldValue: oldVal.toString(),
            newValue: newVal.toString(),
            reason: reason
        });

        if (job.origin !== editData.origin) {
            logs.push(createLog('Origin', job.origin, editData.origin));
        }
        if (job.destination !== editData.destination) {
            logs.push(createLog('Destination', job.destination, editData.destination));
        }
        if (job.truckType !== editData.truckType) {
            logs.push(createLog('Truck Type', job.truckType, editData.truckType));
        }
        if ((job.subcontractor || '') !== editData.subcontractor) {
            logs.push(createLog('Subcontractor', job.subcontractor || 'None', editData.subcontractor || 'None'));
        }

        const updatedJob: Job = {
            ...job,
            origin: editData.origin,
            destination: editData.destination,
            truckType: editData.truckType,
            subcontractor: editData.subcontractor,
            cost: editData.cost
        };

        onSave(updatedJob, logs);

        if (typeof (window as any).Swal !== 'undefined') {
            (window as any).Swal.fire({
                title: 'Updated!',
                text: 'The job request has been updated. / แก้ไขข้อมูลเรียบร้อยแล้ว',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false,
                customClass: { popup: 'rounded-[1.5rem]' }
            });
        }

        setIsSubmitting(false);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Fixed Header */}
                <div className="bg-blue-600 px-8 py-6 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center text-white">
                            <Edit3 size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Edit Job Request</h3>
                            <p className="text-[10px] text-blue-100 font-bold uppercase tracking-widest">Job ID: #{job.id}</p>
                        </div>
                    </div>
                    <button onClick={onClose} title="Close Modal" className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto px-8 pt-8 pb-12 space-y-6 scrollbar-thin scrollbar-thumb-slate-200">
                    <div className="grid grid-cols-1 gap-5">
                        <div className="space-y-2">
                            <label htmlFor="origin-select" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MapPin size={12} className="text-blue-500" /> Origin / ต้นทาง
                            </label>
                            <select
                                id="origin-select"
                                name="origin"
                                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                                value={editData.origin}
                                title="Select Origin"
                                onChange={e => {
                                    const newOrigin = e.target.value;
                                    const contract = findContractMatch(newOrigin, editData.destination, editData.truckType, editData.subcontractor)
                                        || findContractMatch(newOrigin, editData.destination, editData.truckType);
                                    const newPrice = contract ? contract.basePrice : editData.cost;
                                    setEditData({ ...editData, origin: newOrigin, cost: newPrice });
                                }}
                            >
                                {MASTER_DATA.locations.map((loc, idx) => (
                                    <option key={`${loc}-${idx}`} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="destination-select" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MapPin size={12} className="text-orange-500" /> Destination / ปลายทาง
                            </label>
                            <select
                                id="destination-select"
                                name="destination"
                                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                                value={editData.destination}
                                title="Select Destination"
                                onChange={e => {
                                    const newDest = e.target.value;
                                    const contract = findContractMatch(editData.origin, newDest, editData.truckType, editData.subcontractor)
                                        || findContractMatch(editData.origin, newDest, editData.truckType);
                                    const newPrice = contract ? contract.basePrice : editData.cost;
                                    setEditData({ ...editData, destination: newDest, cost: newPrice });
                                }}
                            >
                                {MASTER_DATA.locations.map((loc, idx) => (
                                    <option key={`${loc}-${idx}`} value={loc}>{loc}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="truck-type-select" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Truck size={12} className="text-slate-600" /> Truck Type / ประเภทรถ
                            </label>
                            <select
                                id="truck-type-select"
                                name="truckType"
                                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                                value={editData.truckType}
                                title="Select Truck Type"
                                onChange={e => {
                                    const newTruck = e.target.value;
                                    const contract = findContractMatch(editData.origin, editData.destination, newTruck, editData.subcontractor)
                                        || findContractMatch(editData.origin, editData.destination, newTruck);
                                    const newPrice = contract ? contract.basePrice : editData.cost;
                                    setEditData({ ...editData, truckType: newTruck, cost: newPrice });
                                }}
                            >
                                {MASTER_DATA.truckTypes.map((type, idx) => (
                                    <option key={`${type}-${idx}`} value={type}>{type}</option>
                                ))}
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="subcontractor-select" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Truck size={12} className="text-emerald-500" /> Subcontractor / บริษัทรถร่วม
                            </label>
                            <select
                                id="subcontractor-select"
                                name="subcontractor"
                                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all"
                                value={editData.subcontractor}
                                title="Select Subcontractor"
                                onChange={e => {
                                    const newSub = e.target.value;
                                    const contract = findContractMatch(editData.origin, editData.destination, editData.truckType, newSub)
                                        || findContractMatch(editData.origin, editData.destination, editData.truckType);
                                    const newPrice = contract ? contract.basePrice : editData.cost;
                                    setEditData({ ...editData, subcontractor: newSub, cost: newPrice });
                                }}
                            >
                                <option value="">Waiting Assignment / รอจัดสรร</option>
                                {MASTER_DATA.subcontractors.map((sub, idx) => (
                                    <option key={`${sub}-${idx}`} value={sub}>{sub}</option>
                                ))}
                            </select>
                        </div>

                        {/* Premium Pricing Intelligence Indicator */}
                        <div className={`p-6 rounded-[2rem] border-2 transition-all duration-500 scale-100 ${hasContractPrice ? 'bg-emerald-50 border-emerald-100 shadow-lg shadow-emerald-100/50' : 'bg-rose-50 border-rose-100 shadow-lg shadow-rose-100/50'}`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${hasContractPrice ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-rose-500 text-white shadow-lg shadow-rose-200'}`}>
                                        {hasContractPrice ? <Zap size={20} /> : <ShieldAlert size={20} />}
                                    </div>
                                    <div>
                                        <h3 className={`text-sm font-black uppercase tracking-widest ${hasContractPrice ? 'text-emerald-700' : 'text-rose-700'}`}>
                                            Pricing Intelligence / ระบบตรวจสอบราคาอัจฉริยะ
                                        </h3>
                                        <p className={`text-[10px] font-bold ${hasContractPrice ? 'text-emerald-600' : 'text-rose-600'}`}>
                                            Auto-checking Subcontractor Master Pricing Table
                                        </p>
                                    </div>
                                </div>
                                <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${hasContractPrice ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                                    {hasContractPrice ? 'Price Found / พบข้อมูล' : 'No Data / ไม่พบข้อมูลราคา'}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-6 items-center">
                                <div className="space-y-2">
                                    <div className={`text-xs font-medium leading-relaxed ${hasContractPrice ? 'text-emerald-800' : 'text-rose-800'}`}>
                                        {hasContractPrice ? (
                                            <>
                                                <strong className="flex items-center gap-2 text-sm mb-1">
                                                    <BadgeCheck size={16} className="text-emerald-500" /> พบราคาในระบบมาตรฐาน
                                                </strong>
                                                เส้นทางนี้ (<strong>{editData.origin}</strong> → <strong>{editData.destination}</strong>) มีราคาที่ตกลงไว้ใน Master Table แล้วสำหรับรถประเภท <strong>{editData.truckType}</strong> จำนวน <strong>{allMatches.length}</strong> รายการ.
                                            </>
                                        ) : (
                                            <>
                                                <strong className="flex items-center gap-2 text-sm mb-1">
                                                    <ShieldAlert size={16} className="text-rose-500" /> ไม่พบข้อมูลราคามาตรฐาน
                                                </strong>
                                                ขออภัย เส้นทางและประเภทรถนี้ ยังไม่ได้ถูกกำหนดราคาไว้ในระบบ Master Table ฝ่ายจัดรถอาจต้องทำการต่อรองราคาเป็นกรณีพิเศษ (Spot Rate).
                                            </>
                                        )}
                                    </div>
                                </div>

                                {hasContractPrice && (
                                    <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100 flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Available Subcontractors</div>
                                            {/* Cost hidden for security as requested */}
                                            <div className="text-right">
                                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-tight leading-none mb-1">Standard Cost</p>
                                                <div className="flex items-center gap-1 text-emerald-700 font-black">
                                                    <span className="text-xs uppercase bg-emerald-100 px-2 py-0.5 rounded-md">Verified</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            {allMatches.slice(0, 3).map((p, idx) => (
                                                <div key={idx} className="flex justify-between items-center text-xs">
                                                    <span className={`font-bold ${p.subcontractor === editData.subcontractor ? 'text-blue-600' : 'text-slate-700'}`}>
                                                        {p.subcontractor}
                                                        {p.subcontractor === editData.subcontractor && <span className="ml-2 px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded-md text-[8px] uppercase">Selected</span>}
                                                    </span>
                                                    <span className="font-black text-emerald-600 flex items-center gap-1">
                                                        <ShieldCheck size={12} /> Applied
                                                    </span>
                                                </div>
                                            ))}
                                            {allMatches.length > 3 && <div className="text-[10px] text-center text-emerald-400 font-bold italic pt-1 border-t border-emerald-50">And {allMatches.length - 3} more contract options available...</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-100">
                            <label htmlFor="reason-input" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                Reason for Change / เหตุผลการแก้ไข
                            </label>
                            <textarea
                                id="reason-input"
                                name="reason"
                                className="w-full p-4 rounded-xl border border-slate-200 bg-white font-medium text-slate-700 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all min-h-[100px]"
                                placeholder="ระบุเหตุผลการแก้ไข เช่น เปลี่ยนจุดรับสินค้าเนื่องจาก..."
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Fixed Footer */}
                <div className="bg-slate-50 p-6 flex justify-end gap-3 shrink-0 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-black text-slate-400 uppercase tracking-widest text-[10px] hover:bg-white hover:text-slate-600 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSubmitting}
                        className="bg-blue-600 px-8 py-3 rounded-xl font-black text-white uppercase tracking-widest text-[10px] shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {isSubmitting ? 'Updating...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BookingEditModal;
