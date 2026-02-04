
import React, { useState, useEffect } from 'react';
import { Job, JobStatus, UserRole, AuditLog, PriceMatrix, AccountingStatus } from '../types';
import { MASTER_DATA } from '../constants';
import { AlertTriangle, Info, X, Lock, CheckCircle, User, Phone, Hash, CircleDot, DollarSign, Wallet, FileText, Clock, AlertCircle, Calendar, TrendingUp, ShieldCheck, MapPin, Upload, Camera, CheckCircle2, ClipboardCheck, CircleDollarSign } from 'lucide-react';
import { formatThaiCurrency, roundHalfUp } from '../utils/format';
import ReviewConfirmModal from './ReviewConfirmModal';

interface DispatcherActionModalProps {
  job: Job;
  onClose: () => void;
  onSave: (job: Job, logs?: AuditLog[]) => void;
  user: { id: string; name: string; role: UserRole };
  priceMatrix: PriceMatrix[];
  logs: AuditLog[];
  logsLoaded: boolean;
}
const Swal = (window as any).Swal;

const DispatcherActionModal: React.FC<DispatcherActionModalProps> = ({ job, onClose, onSave, user, priceMatrix, logs, logsLoaded }) => {
  // Use Firebase data only - single source of truth

  const [editData, setEditData] = useState({
    subcontractor: job.subcontractor || '',
    truckType: job.truckType,
    driverName: job.driverName || '',
    driverPhone: job.driverPhone || '',
    licensePlate: job.licensePlate || '',
    cost: job.cost || 0,
    sellingPrice: job.sellingPrice || 0,
    origin: job.origin,
    destination: job.destination,
    drops: job.drops || [] as { location: string; status: 'PENDING' | 'COMPLETED'; podUrl?: string; completedAt?: string }[]
  });

  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [showOriginList, setShowOriginList] = useState(false);
  const [showDestList, setShowDestList] = useState(false);

  const isViewOnly = user.role === UserRole.ACCOUNTANT;
  const hidePrice = [UserRole.BOOKING_OFFICER, UserRole.FIELD_OFFICER].includes(user.role);
  const isActuallyLocked = (job.isBaseCostLocked &&
    user.role !== UserRole.ADMIN &&
    job.accountingStatus !== AccountingStatus.REJECTED &&
    job.accountingStatus !== AccountingStatus.PENDING_REVIEW) || isViewOnly;
  const isAdminOverride = job.isBaseCostLocked && user.role === UserRole.ADMIN && !isViewOnly;

  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [priceCalculated, setPriceCalculated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [isContractPrice, setIsContractPrice] = useState(false);
  const [showDropList, setShowDropList] = useState<boolean[]>([]);

  // Intelligence: Extract locations from Price Matrix
  const masterPricingOrigins = React.useMemo(() => Array.from(new Set(priceMatrix.map(p => p.origin))) as string[], [priceMatrix]);
  const masterPricingDests = React.useMemo(() => Array.from(new Set(priceMatrix.map(p => p.destination))) as string[], [priceMatrix]);

  const allKnownOrigins = React.useMemo(() => Array.from(new Set([...MASTER_DATA.locations, ...masterPricingOrigins])) as string[], [masterPricingOrigins]);
  const allKnownDests = React.useMemo(() => Array.from(new Set([...MASTER_DATA.locations, ...masterPricingDests])) as string[], [masterPricingDests]);

  const filteredOrigins = React.useMemo(() => allKnownOrigins
    .filter(l => l.toLowerCase().includes(originQuery.toLowerCase()))
    .sort((a, b) => {
      const aHas = masterPricingOrigins.includes(a);
      const bHas = masterPricingOrigins.includes(b);
      return aHas === bHas ? 0 : aHas ? -1 : 1;
    }), [allKnownOrigins, originQuery, masterPricingOrigins]);

  const filteredDests = React.useMemo(() => allKnownDests
    .filter(l => l.toLowerCase().includes(destQuery.toLowerCase()))
    .sort((a, b) => {
      const aHas = masterPricingDests.includes(a);
      const bHas = masterPricingDests.includes(b);
      return aHas === bHas ? 0 : aHas ? -1 : 1;
    }), [allKnownDests, destQuery, masterPricingDests]);

  const highlightMatch = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === query.toLowerCase()
            ? <span key={i} className="text-blue-600 underline decoration-2">{part}</span>
            : part
        )}
      </>
    );
  };

  // Use stateful price matrix for lookup
  const findContractMatch = (origin: string, destination: string, truckType: string, sub: string) => {
    return priceMatrix.find(p => {
      const originMatch = (p.origin || '').trim() === (origin || '').trim();
      const destMatch = (p.destination || '').trim() === (destination || '').trim();
      const truckMatch = (p.truckType || '').trim() === (truckType || '').trim();
      const subMatch = (p.subcontractor || '').trim() === (sub || '').trim();
      return originMatch && destMatch && truckMatch && subMatch;
    });
  };

  const calculatePriceLive = (origin: string, destination: string, truckType: string, sub: string, dropCount: number): { cost: number; revenue: number } | null => {
    const match = findContractMatch(origin, destination, truckType, sub);
    if (match) {
      const dropFeeTotal = dropCount * (match.dropOffFee || 0);
      return {
        cost: (match.basePrice || 0) + dropFeeTotal,
        revenue: (match.sellingBasePrice || 0) + dropFeeTotal
      };
    }
    return null;
  };

  // Track the fields that trigger a price recalculation within this session
  const [sessionPriceKeys, setSessionPriceKeys] = useState({
    sub: job.subcontractor || '',
    truck: job.truckType
  });

  // Auto-recalculate price when sub, truckType, origin or destination changes
  useEffect(() => {
    const hasSubChanged = editData.subcontractor !== sessionPriceKeys.sub;
    const hasTruckChanged = editData.truckType !== sessionPriceKeys.truck;
    const hasOriginChanged = editData.origin !== job.origin;
    const hasDestChanged = editData.destination !== job.destination;

    // Check for contract match regardless of session changes for UI feedback
    const matchedData = calculatePriceLive(editData.origin, editData.destination, editData.truckType, editData.subcontractor, editData.drops.length);
    const currentContractPrice = matchedData?.cost || 0;
    const currentContractRevenue = matchedData?.revenue || 0;

    setIsContractPrice(currentContractPrice > 0 && editData.cost === currentContractPrice);

    // Only auto-recalculate if the subcontractor, truck type, or route has changed DURING this session
    if (hasSubChanged || hasTruckChanged || hasOriginChanged || hasDestChanged) {
      if (editData.subcontractor && editData.truckType && editData.origin && editData.destination) {
        if (currentContractPrice > 0 || (hasOriginChanged || hasDestChanged)) {
          setEditData(prev => ({
            ...prev,
            cost: currentContractPrice,
            sellingPrice: currentContractRevenue > 0 ? currentContractRevenue : prev.sellingPrice
          }));
          if (currentContractPrice > 0) {
            setPriceCalculated(true);
            setTimeout(() => setPriceCalculated(false), 2000);
          }
        }
      }
      // Update session values so we don't recalculate again until another real change
      setSessionPriceKeys({
        sub: editData.subcontractor,
        truck: editData.truckType
      });
    }
  }, [editData.subcontractor, editData.truckType, editData.origin, editData.destination, sessionPriceKeys, job.origin, job.destination, priceMatrix, editData.cost, editData.drops.length]);

  const handleSaveAttempt = async () => {
    if (isSubmitting) return;

    // 🔒 1. Loading Guard System
    if (!logsLoaded) {
      if (typeof (window as any).Swal !== 'undefined') {
        (window as any).Swal.fire({
          title: 'System Loading / กำลังโหลดข้อมูล',
          text: 'ระบบกำลังโหลดข้อมูลประวัติ กรุณารอสักครู่แล้วลองใหม่ (System is loading history data, please wait...)',
          icon: 'warning',
          confirmButtonColor: '#2563eb',
          customClass: { popup: 'rounded-[2rem]' }
        });
      }
      return;
    }

    // 🔒 3. Strict Verification Guard (User Requested Rule)
    const priceValid = !!findContractMatch(editData.origin, editData.destination, editData.truckType, editData.subcontractor);
    // POD validation moved to Job Confirmation step
    const infoValid = !!(editData.driverName && editData.driverPhone && editData.licensePlate && (editData.cost || 0) > 0);

    // Only block if we're trying to move towards confirmation
    if (!priceValid || !infoValid) {
      const missing = [];
      if (!priceValid) missing.push('● ราคาจองต้องตรงกับต้นทุนใน Master Pricing');
      if (!infoValid) missing.push('● ข้อมูลคนขับ/ทะเบียน/ค่าจ้าง ต้องระบุให้ครบ');

      if (typeof (window as any).Swal !== 'undefined') {
        (window as any).Swal.fire({
          title: 'ไม่สามารถส่งตรวจทานได้ / Validation Failed',
          html: `<div class="text-left bg-rose-50 p-4 rounded-2xl border border-rose-100 mt-2">
                   <p class="font-black text-rose-900 mb-2 uppercase text-[10px] tracking-widest">สิ่งที่ต้องแก้ไข:</p>
                   <div class="text-rose-700 text-xs font-bold leading-loose">${missing.join('<br/>')}</div>
                 </div>`,
          icon: 'error',
          confirmButtonColor: '#e11d48',
          confirmButtonText: 'กลับไปแก้ไข (Fix Errors)',
          customClass: { popup: 'rounded-[2rem]' }
        });
      }
      return;
    }

    const matrixPriceData = calculatePriceLive(editData.origin, editData.destination, editData.truckType, editData.subcontractor, editData.drops.length);
    const matrixPrice = matrixPriceData?.cost || 0;
    const hasChanged =
      (job.status !== JobStatus.NEW_REQUEST && (
        job.subcontractor !== editData.subcontractor ||
        job.truckType !== editData.truckType ||
        job.licensePlate !== editData.licensePlate ||
        job.cost !== editData.cost ||
        job.origin !== editData.origin ||
        job.destination !== editData.destination
      )) ||
      (job.status === JobStatus.NEW_REQUEST && editData.subcontractor && editData.cost !== matrixPrice);

    if (hasChanged && !showReason) {
      setShowReason(true);
    } else {
      // 🔒 3. Open Review & Confirm Modal
      console.log('🔍 Opening ReviewConfirmModal...');
      setShowReviewModal(true);
    }
  };

  const finalizeSave = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Simulate API Delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    const logs: AuditLog[] = [];
    const finalReason = reason === 'อื่นๆ (ระบุเอง)' ? customReason : reason;

    if (job.status === JobStatus.NEW_REQUEST) {
      const matrixPrice = calculatePriceLive(editData.origin, editData.destination, editData.truckType, editData.subcontractor, editData.drops.length);

      // Log the assignment
      logs.push(createLog('Assignment', 'Unassigned', `${editData.subcontractor} (${editData.truckType})`, 'New Job Assignment'));

      // Log the initial price
      logs.push(createLog('Cost (Price)', '0', editData.cost.toString(), finalReason || 'Initial Pricing'));

      if (editData.cost !== matrixPrice) {
        // Log the override detail without string prefixes for consistency
        logs.push(createLog('Price Override', matrixPrice.toString(), editData.cost.toString(), finalReason || 'Price Negotiation'));
      }
    } else {
      if (job.origin !== editData.origin) {
        logs.push(createLog('Origin', job.origin, editData.origin, finalReason));
      }
      if (job.destination !== editData.destination) {
        logs.push(createLog('Destination', job.destination, editData.destination, finalReason));
      }
      if (job.subcontractor !== editData.subcontractor) {
        logs.push(createLog('Subcontractor', job.subcontractor || 'None', editData.subcontractor, finalReason));
      }
      if (job.truckType !== editData.truckType) {
        logs.push(createLog('Truck Type', job.truckType, editData.truckType, finalReason));
      }
      if (job.licensePlate !== editData.licensePlate) {
        logs.push(createLog('License Plate', job.licensePlate || 'None', editData.licensePlate, finalReason));
      }
      if (job.cost !== editData.cost) {
        logs.push(createLog('Cost (Price)', (job.cost || 0).toString(), editData.cost.toString(), finalReason));
      }
    }
    const updatedJob: Job = {
      ...job,
      ...editData,
      cost: editData.cost || 0,
      sellingPrice: editData.sellingPrice || 0,
      status: job.status === JobStatus.NEW_REQUEST ? JobStatus.ASSIGNED : job.status,
      // Auto-reset accounting status if it was rejected to notify accounting to check again
      accountingStatus: job.accountingStatus === AccountingStatus.REJECTED
        ? AccountingStatus.PENDING_REVIEW
        : job.accountingStatus
    };

    onSave(updatedJob, logs);

    // Show Success Alert
    if (typeof (window as any).Swal !== 'undefined') {
      (window as any).Swal.fire({
        title: 'Updated! / บันทึกข้อมูลแล้ว',
        text: 'Job details have been updated successfully. / บันทึกข้อมูลการจัดรถเรียบร้อยแล้ว',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        customClass: {
          popup: 'rounded-[2rem]'
        }
      });
    }

    setIsSubmitting(false);
    onClose();
  };

  const createLog = (field: string, oldVal: string, newVal: string, r: string): AuditLog => ({
    id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    jobId: job.id,
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    timestamp: new Date().toISOString(),
    field,
    oldValue: oldVal.toString(),
    newValue: newVal.toString(),
    reason: r
  });

  // Global Status Checks
  const isMasterPriceMatched = !!findContractMatch(editData.origin, editData.destination, editData.truckType, editData.subcontractor);
  const isFleetInfoComplete = editData.driverName && editData.driverPhone && editData.licensePlate && (editData.cost || 0) > 0;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
        <div className="glass rounded-[2.5rem] shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-slate-900 shrink-0"></div>
          <div className="bg-slate-50/50 px-8 py-6 flex items-center justify-between border-b border-white/20 shrink-0">
            <div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight leading-none">การจัดการข้อมูลการจัดรถ (Job Assignment & Costing)</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">Operational Control Center / ศูนย์ควบคุมการดำเนินงาน</p>
            </div>
            <button
              onClick={onClose}
              className="p-3 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-2xl transition-all"
              title="ปิด (Close)"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 pt-6 space-y-6 scrollbar-thin">
            <div className="bg-blue-50/50 rounded-3xl border border-blue-100/50">
              <div className="flex gap-4 p-5">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-blue-100 text-blue-600 self-start">
                  <Info size={20} />
                </div>
                <div className="flex-1 space-y-4">
                  <p className="text-[11px] font-black text-blue-900 uppercase tracking-wider">รายละเอียดใบงาน & เส้นทาง (Ticket & Route)</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 relative">
                      <label htmlFor="origin-edit-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทาง (Origin)</label>
                      <input
                        id="origin-edit-input"
                        title="แก้ไขต้นทาง (Edit Origin)"
                        placeholder="พิมพ์เพื่อค้นหาต้นทาง..."
                        type="text"
                        disabled={isActuallyLocked}
                        className="w-full px-3 py-2 rounded-xl border border-blue-100 bg-white/80 font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={originQuery !== '' ? originQuery : editData.origin}
                        onChange={e => {
                          const val = e.target.value;
                          setOriginQuery(val);
                          setEditData(prev => ({ ...prev, origin: val }));
                        }}
                        onFocus={() => { if (!isActuallyLocked) { setOriginQuery(''); setShowOriginList(true); } }}
                        onBlur={() => setTimeout(() => { setShowOriginList(false); setOriginQuery(''); }, 200)}
                      />
                      {showOriginList && (
                        <div className="absolute z-[120] left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-200">
                          {filteredOrigins.some(l => masterPricingOrigins.includes(l)) && (
                            <div className="px-4 py-1 bg-blue-50/50 text-[8px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-50">
                              🎯 Contract Locations
                            </div>
                          )}
                          {filteredOrigins.map((l, i) => {
                            const isMaster = masterPricingOrigins.includes(l);
                            return (
                              <button
                                key={i}
                                type="button"
                                className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${isMaster ? 'hover:bg-blue-50 text-blue-900 bg-blue-50/10' : 'hover:bg-slate-50 text-slate-700'}`}
                                onClick={() => { setEditData(prev => ({ ...prev, origin: l })); setOriginQuery(''); setShowOriginList(false); }}
                              >
                                <div className="flex items-center gap-2">
                                  {isMaster && <ShieldCheck size={10} className="text-emerald-500" />}
                                  {highlightMatch(l, originQuery)}
                                </div>
                                {isMaster && <span className="text-[8px] font-black text-emerald-600 uppercase">Master</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 relative">
                      <label htmlFor="dest-edit-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ปลายทาง (Destination)</label>
                      <input
                        id="dest-edit-input"
                        title="แก้ไขปลายทาง (Edit Destination)"
                        placeholder="พิมพ์เพื่อค้นหาปลายทาง..."
                        type="text"
                        disabled={isActuallyLocked}
                        className="w-full px-3 py-2 rounded-xl border border-blue-100 bg-white/80 font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                        value={destQuery !== '' ? destQuery : editData.destination}
                        onChange={e => {
                          const val = e.target.value;
                          setDestQuery(val);
                          setEditData(prev => ({ ...prev, destination: val }));
                        }}
                        onFocus={() => { if (!isActuallyLocked) { setDestQuery(''); setShowDestList(true); } }}
                        onBlur={() => setTimeout(() => { setShowDestList(false); setDestQuery(''); }, 200)}
                      />
                      {showDestList && (
                        <div className="absolute z-[120] left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1 animate-in fade-in zoom-in-95 duration-200">
                          {filteredDests.some(l => masterPricingDests.includes(l)) && (
                            <div className="px-4 py-1 bg-emerald-50 text-[8px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50">
                              🎯 Verified Destinations
                            </div>
                          )}
                          {filteredDests.map((l, i) => {
                            const isMaster = masterPricingDests.includes(l);
                            return (
                              <button
                                key={i}
                                type="button"
                                className={`w-full text-left px-4 py-2 text-xs font-bold transition-colors flex items-center justify-between ${isMaster ? 'hover:bg-blue-50 text-blue-900 bg-emerald-50/10' : 'hover:bg-slate-50 text-slate-700'}`}
                                onClick={() => { setEditData(prev => ({ ...prev, destination: l })); setDestQuery(''); setShowDestList(false); }}
                              >
                                <div className="flex items-center gap-2">
                                  {isMaster && <ShieldCheck size={10} className="text-emerald-500" />}
                                  {highlightMatch(l, destQuery)}
                                </div>
                                {isMaster && <span className="text-[8px] font-black text-emerald-600 uppercase">Master</span>}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Drop Points Section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">จุดแวะส่งสินค้า (Drop-off Points)</label>
                      {!isActuallyLocked && (
                        <button
                          type="button"
                          onClick={() => setEditData(prev => ({ ...prev, drops: [...(prev.drops || []), { location: '', status: 'PENDING' }] }))}
                          className="text-[9px] font-black text-blue-600 uppercase hover:underline"
                        >
                          + เพิ่มจุดส่งสินค้า
                        </button>
                      )}
                    </div>
                    {editData.drops && editData.drops.length > 0 && (
                      <div className="space-y-2">
                        {editData.drops.map((drop, index) => (
                          <div key={index} className="relative group animate-in slide-in-from-left-2 duration-200">
                            <input
                              type="text"
                              disabled={isActuallyLocked}
                              placeholder={`จุดส่งสินค้าที่ ${index + 1}...`}
                              className={`w-full px-3 py-2 rounded-xl border font-bold text-xs outline-none focus:ring-2 focus:ring-blue-100 transition-all ${isActuallyLocked ? 'border-slate-100 bg-slate-50 text-slate-400' : 'border-blue-100 bg-white/80 text-slate-800'}`}
                              value={drop.location}
                              onFocus={() => { if (!isActuallyLocked) { const newList = [...showDropList]; newList[index] = true; setShowDropList(newList); } }}
                              onBlur={() => setTimeout(() => { const newList = [...showDropList]; newList[index] = false; setShowDropList(newList); }, 200)}
                              onChange={e => {
                                const newValue = e.target.value;
                                setEditData(prev => {
                                  const newDrops = [...(prev.drops || [])];
                                  newDrops[index] = { ...newDrops[index], location: newValue };
                                  return { ...prev, drops: newDrops };
                                });
                              }}
                            />
                            {showDropList[index] && (
                              <div className="absolute z-[120] left-0 right-0 mt-1 bg-white border border-slate-100 rounded-xl shadow-xl max-h-40 overflow-y-auto py-1">
                                {allKnownDests.filter(l => l.toLowerCase().includes(drop.location.toLowerCase())).map((l, i) => (
                                  <button
                                    key={i}
                                    type="button"
                                    className="w-full text-left px-4 py-2 text-[10px] font-bold hover:bg-blue-50 text-slate-700 transition-colors flex items-center justify-between"
                                    onClick={() => {
                                      setEditData(prev => {
                                        const newDrops = [...(prev.drops || [])];
                                        newDrops[index] = { ...newDrops[index], location: l };
                                        return { ...prev, drops: newDrops };
                                      });
                                    }}
                                  >
                                    <div className="flex items-center gap-2">
                                      {masterPricingDests.includes(l) && <ShieldCheck size={10} className="text-emerald-500" />}
                                      {highlightMatch(l, drop.location)}
                                    </div>
                                    {masterPricingDests.includes(l) && <span className="text-[7px] font-black text-emerald-600 uppercase">Master</span>}
                                  </button>
                                ))}
                              </div>
                            )}

                            {/* Drop Point Status & Tools */}
                            <div className="flex items-center gap-2 mt-2 px-1">
                              <button
                                type="button"
                                disabled={isActuallyLocked}
                                onClick={() => {
                                  if (drop.status !== 'COMPLETED' && !drop.podUrl) {
                                    if (typeof Swal !== 'undefined') {
                                      Swal.fire({
                                        icon: 'warning',
                                        title: 'ต้องอัปโหลดหลักฐาน POD ก่อน',
                                        text: `กรุณาถ่ายรูปหรืออัปโหลดหลักฐานส่งสินค้าสำหรับจุดนี้ เพื่อยืนยันการจบงาน`,
                                        confirmButtonText: 'รับทราบ',
                                        confirmButtonColor: '#3b82f6',
                                        customClass: { popup: 'rounded-[1.5rem]' }
                                      });
                                    } else {
                                      alert('กรุณาอัปโหลดหลักฐาน POD ก่อนกดจบงานในแต่ละจุด');
                                    }
                                    return;
                                  }

                                  setEditData(prev => {
                                    const newDrops = [...(prev.drops || [])];
                                    const isDone = newDrops[index].status === 'COMPLETED';
                                    newDrops[index] = {
                                      ...newDrops[index],
                                      status: isDone ? 'PENDING' : 'COMPLETED',
                                      completedAt: isDone ? undefined : new Date().toISOString()
                                    };
                                    return { ...prev, drops: newDrops };
                                  });
                                }}
                                className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg border text-[9px] font-black uppercase transition-all shadow-sm active:scale-95 ${drop.status === 'COMPLETED' ? 'bg-emerald-600 border-emerald-600 text-white' : drop.podUrl ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-blue-300'}`}
                              >
                                {drop.status === 'COMPLETED' ? <CheckCircle2 size={12} /> : drop.podUrl ? <Camera size={12} /> : <CircleDot size={12} />}
                                {drop.status === 'COMPLETED' ? 'Job Completed' : drop.podUrl ? 'Ready to Confirm' : 'POD Required'}
                              </button>

                              <div className="relative">
                                <input
                                  type="file"
                                  id={`drop-pod-${index}`}
                                  className="hidden"
                                  accept="image/*"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      const reader = new FileReader();
                                      reader.onloadend = () => {
                                        setEditData(prev => {
                                          const newDrops = [...(prev.drops || [])];
                                          newDrops[index] = { ...newDrops[index], podUrl: reader.result as string, status: 'COMPLETED' as const };
                                          return { ...prev, drops: newDrops };
                                        });
                                      };
                                      reader.readAsDataURL(file);
                                    }
                                  }}
                                />
                                <label
                                  htmlFor={`drop-pod-${index}`}
                                  className={`p-2 rounded-lg border flex items-center justify-center cursor-pointer transition-all ${drop.podUrl ? 'bg-blue-50 border-blue-100 text-blue-600' : 'bg-white border-slate-100 text-slate-400 hover:text-blue-500'}`}
                                >
                                  {drop.podUrl ? <CheckCircle size={12} /> : <Camera size={12} />}
                                </label>
                              </div>
                            </div>
                            {!isActuallyLocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newDrops = (editData.drops || []).filter((_, i) => i !== index);
                                  setEditData(prev => ({ ...prev, drops: newDrops }));
                                }}
                                title="Remove drop point"
                                className="absolute right-2 top-0.5 text-slate-300 hover:text-rose-500 p-1 transition-colors"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-y-1 gap-x-4 pt-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Ticket ID: <span className="text-slate-900 font-mono font-black">{job.id}</span></div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">Weight: <span className="text-slate-900">{job.weightVolume}</span></div>
                    {isActuallyLocked && <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-0.5 rounded border border-rose-100">ROUTE LOCKED BY ACCOUNTING</span>}
                  </div>
                </div>
              </div>
            </div>

            {/* Dashboard Status Bar */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${isMasterPriceMatched ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isMasterPriceMatched ? 'bg-emerald-600' : 'bg-slate-400'} text-white`}>
                    <ShieldCheck size={14} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-tight ${isMasterPriceMatched ? 'text-emerald-700' : 'text-slate-500'}`}>สถานะราคากลาง</p>
                    <p className={`text-[9px] font-bold ${isMasterPriceMatched ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {isMasterPriceMatched ? 'Verified Master Price ✓' : 'Custom / No Contract'}
                    </p>
                  </div>
                </div>
                {isMasterPriceMatched && <CheckCircle2 size={16} className="text-emerald-500" />}
              </div>

              <div className={`flex items-center justify-between p-3 rounded-2xl border-2 transition-all ${isFleetInfoComplete ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100 animate-pulse'}`}>
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-lg ${isFleetInfoComplete ? 'bg-blue-600' : 'bg-orange-500'} text-white`}>
                    <ClipboardCheck size={14} />
                  </div>
                  <div>
                    <p className={`text-[10px] font-black uppercase tracking-tight ${isFleetInfoComplete ? 'text-blue-700' : 'text-orange-700'}`}>ความครบถ้วนของงาน</p>
                    <p className={`text-[9px] font-bold ${isFleetInfoComplete ? 'text-blue-600' : 'text-orange-600'}`}>
                      {isFleetInfoComplete ? 'Ready to Verify ✅' : 'Information Incomplete ⚠️'}
                    </p>
                  </div>
                </div>
                {!isFleetInfoComplete && <AlertCircle size={16} className="text-orange-500" />}
              </div>
            </div>

            {/* Accounting Rejection Remark */}
            {job.accountingStatus === AccountingStatus.REJECTED && (
              <div className="flex gap-4 p-5 bg-rose-50 rounded-3xl border border-rose-100 animate-pulse">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-rose-100 text-rose-600">
                  <AlertTriangle size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] font-black text-rose-900 uppercase tracking-wider">เหตุผลที่ฝ่ายบัญชีให้แก้ไข (Accounting Correction Required)</p>
                  <p className="text-sm font-bold text-rose-700 leading-tight">
                    {job.accountingRemark || 'ไม่ได้ระบุหมายเหตุ (No specific remark provided)'}
                  </p>
                </div>
              </div>
            )}

            {/* Smart Recommendation System */}
            {!hidePrice && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                    Smart Recommendation / แนะนำบริษัทที่ราคาถูกที่สุด
                  </label>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {priceMatrix
                    .filter(p =>
                      p.origin === editData.origin &&
                      p.destination === editData.destination &&
                      p.truckType === editData.truckType
                    )

                    // Group by subcontractor and pick the lowest basePrice
                    .reduce((unique, item) => {
                      const existing = unique.find(u => u.subcontractor === item.subcontractor);
                      if (!existing) {
                        unique.push(item);
                      } else if (item.basePrice < existing.basePrice) {
                        const idx = unique.indexOf(existing);
                        unique[idx] = item;
                      }
                      return unique;
                    }, [] as PriceMatrix[])
                    .sort((a, b) => a.basePrice - b.basePrice)

                    .map((rec, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          setEditData({
                            ...editData,
                            subcontractor: rec.subcontractor,
                            cost: rec.basePrice,
                            sellingPrice: rec.sellingBasePrice || editData.sellingPrice
                          });
                          setPriceCalculated(true);
                          setTimeout(() => setPriceCalculated(false), 2000);
                        }}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all group ${editData.subcontractor === rec.subcontractor ? 'border-emerald-500 bg-emerald-50' : 'border-slate-50 bg-slate-50/50 hover:border-blue-200 hover:bg-white'}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black ${index === 0 ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-100' : 'bg-slate-200 text-slate-500'}`}>
                            {index + 1}
                          </div>
                          <div className="text-left">
                            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{rec.subcontractor}</p>
                            <p className="text-[10px] font-bold text-slate-400">ราคาตรงตามเส้นทาง (Perfect Match for Route)</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-emerald-600">฿{formatThaiCurrency(Number(rec.basePrice) || 0)}</p>
                          <p className="text-[9px] font-black text-slate-300 uppercase">กดเพื่อเลือก (Select This)</p>
                        </div>
                      </button>
                    ))
                  }
                  {priceMatrix.filter(p => p.origin === editData.origin && p.destination === editData.destination && p.truckType === editData.truckType).length === 0 && (

                    <div className="text-[11px] font-bold text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-xl text-center">
                      ไม่พบข้อมูลราคากลางสำหรับเส้นทางและประเภทรถนี้ (No pricing records found)
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5">
              <div className="col-span-2 space-y-1.5 relative">
                <label htmlFor="sub-search" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  บริษัทรถร่วม (Subcontractor) {isActuallyLocked && <span className="text-rose-500 font-black tracking-widest ml-2 px-1.5 py-0.5 bg-rose-50 rounded border border-rose-100">ล็อกโดยฝ่ายบัญชี (LOCKED)</span>}
                  {isAdminOverride && <span className="text-blue-500 font-black tracking-widest ml-2 px-1.5 py-0.5 bg-blue-50 rounded border border-blue-100">แอดมินกำลังแก้ไข (ADMIN OVERRIDE)</span>}
                </label>
                <div className="relative group">
                  <input
                    id="sub-search"
                    autoComplete="off"
                    disabled={isSubmitting || isActuallyLocked}
                    type="text"
                    className={`w-full px-4 py-3 rounded-xl border font-bold pr-10 transition-all ${isActuallyLocked ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-800 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none'}`}
                    placeholder="Search/ค้นหา หรือเลือกบริษัท..."
                    value={editData.subcontractor}
                    onChange={e => {
                      const val = e.target.value;
                      setEditData({ ...editData, subcontractor: val });
                    }}
                    onFocus={() => {
                      if (!isActuallyLocked) {
                        const dropdown = document.getElementById('sub-dropdown');
                        if (dropdown) dropdown.classList.remove('hidden');
                      }
                    }}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                  </div>

                  {!isActuallyLocked && (
                    <div
                      id="sub-dropdown"
                      className="hidden absolute z-[110] left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl max-h-64 overflow-y-auto scrollbar-thin animate-in fade-in slide-in-from-top-2 duration-200"
                    >
                      {MASTER_DATA.subcontractors
                        .filter(s => s.toLowerCase().includes((editData.subcontractor || '').toLowerCase()))
                        .map((s, idx) => {
                          const hasContract = findContractMatch(editData.origin, editData.destination, editData.truckType, s);
                          return (
                            <button
                              key={`${s}-${idx}`}
                              type="button"
                              className={`w-full text-left px-5 py-3 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between group ${hasContract ? 'hover:bg-emerald-50 bg-emerald-50/20' : 'hover:bg-blue-50'}`}
                              onClick={() => {
                                setEditData({ ...editData, subcontractor: s });
                                document.getElementById('sub-dropdown')?.classList.add('hidden');
                              }}
                            >
                              <div className="flex flex-col">
                                <span className="text-sm font-black text-slate-800 uppercase tracking-tighter">{s}</span>
                                {hasContract && <span className="text-[8px] font-black text-emerald-600 uppercase">Master Pricing Verified ✓</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                {hasContract && (
                                  <div className="px-2 py-0.5 bg-white border border-emerald-200 rounded text-[9px] font-black text-emerald-600 flex items-center gap-1 shadow-sm">
                                    <CircleDollarSign size={10} /> ฿ PRICE SET
                                  </div>
                                )}
                                <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase font-black tracking-widest">Select</span>
                              </div>
                            </button>
                          );
                        })}
                      {MASTER_DATA.subcontractors.filter(s => s.toLowerCase().includes((editData.subcontractor || '').toLowerCase())).length === 0 && (
                        <div className="p-5 text-center">
                          <p className="text-xs font-bold text-slate-400">ไม่พบข้อมูลบริษัท / No match found</p>
                          <button
                            type="button"
                            className="mt-2 text-[10px] font-black text-blue-600 uppercase hover:underline"
                            onClick={() => document.getElementById('sub-dropdown')?.classList.add('hidden')}
                          >
                            Use this custom name
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="truck-type-select" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                  ประเภทรถ (Truck Type) {isActuallyLocked && <span className="text-rose-600 ml-1">●</span>}
                </label>
                <select
                  id="truck-type-select"
                  title="ประเภทรถ (Truck Type)"
                  className={`w-full px-4 py-3 rounded-xl border font-bold transition-all ${isActuallyLocked ? 'bg-slate-50 border-slate-100 text-slate-400 cursor-not-allowed' : 'border-slate-200 bg-white text-slate-800 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none select-none appearance-none'}`}
                  value={editData.truckType}
                  disabled={isSubmitting || isActuallyLocked}
                  onChange={e => setEditData({ ...editData, truckType: e.target.value })}
                >
                  {MASTER_DATA.truckTypes.map((t, idx) => {
                    const hasContract = findContractMatch(editData.origin, editData.destination, t, editData.subcontractor);
                    return (
                      <option key={`${t}-${idx}`} value={t} className={hasContract ? 'font-black text-emerald-600' : ''}>
                        {t} {hasContract ? ' (Verified Contract ฿)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {!hidePrice && (
                <div className="space-y-1.5 relative">
                  <label htmlFor="cost-input" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">
                    ค่าจ้างรถร่วม (Subcontractor Cost) {isActuallyLocked && <span className="text-rose-600 ml-1">🔒</span>}
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-black">฿</div>
                    <input
                      id="cost-input"
                      title="ค่าจ้างรถร่วม (Subcontractor Cost)"
                      placeholder="0.00"
                      type="number"
                      disabled={isSubmitting || isActuallyLocked || (isContractPrice && user.role !== UserRole.ADMIN)}
                      className={`w-full px-10 py-3 rounded-xl border font-bold text-lg transition-all ${isActuallyLocked ? 'bg-slate-50 border-slate-100 text-slate-400' : (priceCalculated ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-800 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none')}`}
                      value={editData.cost || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value);
                        setEditData({ ...editData, cost: val });
                        setPriceCalculated(false);
                      }}
                    />
                    {isContractPrice && !isActuallyLocked && (
                      <div className="absolute -top-6 left-0 flex items-center gap-1.5 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <CheckCircle size={10} /> MATCHED CONTRACT PRICE (ราคาตรงตามสัญญา)
                      </div>
                    )}
                    {!isContractPrice && editData.cost > 0 && !isActuallyLocked && (
                      <div className="absolute -top-6 left-0 flex items-center gap-1.5 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
                        <AlertCircle size={10} /> NEGOTIATED PRICE (ราคาพิเศษ/ต่อรอง)
                      </div>
                    )}
                    {priceCalculated && !isActuallyLocked && (
                      <div className="absolute -top-6 right-0 text-[10px] font-black text-emerald-600 animate-bounce">✓ AUTO-SYNCED</div>
                    )}
                    {isActuallyLocked && (
                      <div className="absolute -top-6 right-0 text-[10px] font-black text-rose-600 flex items-center gap-1"><Lock size={10} /> ราคานี้ผ่านการตรวจสอบแล้ว (AUDITED VALUE)</div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Fleet & Driver Information Section */}
            <div className="bg-slate-100/50 rounded-[2rem] p-6 space-y-5 border border-slate-200/50">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-slate-900 text-white rounded-lg">
                    <User size={14} />
                  </div>
                  <h4 className="text-[11px] font-black text-slate-800 uppercase tracking-[0.15em]">ข้อมูลคนขับและทะเบียน (Fleet Assignment)</h4>
                </div>

                {(!editData.driverName || !editData.driverPhone || !editData.licensePlate || (editData.cost || 0) <= 0) ? (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-600 rounded-full border border-orange-200 animate-pulse">
                    <CircleDot size={10} className="fill-orange-600" />
                    <span className="text-[9px] font-black uppercase tracking-widest">ข้อมูลไม่สมบูรณ์</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full border border-emerald-200">
                    <CheckCircle size={10} />
                    <span className="text-[9px] font-black uppercase tracking-widest">ข้อมูลครบถ้วน</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label htmlFor="driver-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <User size={10} /> ชื่อคนขับ (Driver Name)
                  </label>
                  <input
                    id="driver-input"
                    disabled={isSubmitting}
                    type="text"
                    placeholder="พิมพ์ชื่อพนักงานขับรถ... (Specify driver name)"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800 bg-white placeholder:text-slate-300 placeholder:font-medium"
                    value={editData.driverName}
                    onChange={e => setEditData({ ...editData, driverName: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="driver-phone-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Phone size={10} /> เบอร์โทรศัพท์ (Phone)
                  </label>
                  <input
                    id="driver-phone-input"
                    disabled={isSubmitting}
                    type="tel"
                    placeholder="0xx-xxx-xxxx"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800 bg-white placeholder:text-slate-300 placeholder:font-medium text-sm"
                    value={editData.driverPhone}
                    onChange={e => setEditData({ ...editData, driverPhone: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="plate-input" className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-1">
                    <Hash size={10} /> ทะเบียนรถ (License Plate)
                  </label>
                  <input
                    id="plate-input"
                    disabled={isSubmitting}
                    type="text"
                    placeholder="Ex. 70-1234"
                    className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-black text-slate-800 bg-white placeholder:text-slate-300 placeholder:font-medium"
                    value={editData.licensePlate}
                    onChange={e => setEditData({ ...editData, licensePlate: e.target.value })}
                  />
                </div>
              </div>
            </div>

          </div>

          {showReason && (
            <div className="bg-orange-50 border-2 border-dashed border-orange-200 p-6 rounded-2xl animate-in slide-in-from-top-4 duration-300">
              <div className="flex items-center gap-3 text-orange-800 font-black mb-4">
                <AlertTriangle size={20} className="text-orange-500" />
                <span className="uppercase text-xs tracking-widest">Reason for Change (จำเป็นต้องระบุ)</span>
              </div>
              <div className="space-y-3">
                <select
                  id="reason-select"
                  required
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-xl border border-orange-300 focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all font-bold text-slate-800 bg-white"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  title="Select Reason for Change"
                >
                  <option value="">-- กรูณาเลือกเหตุผล --</option>
                  {MASTER_DATA.reasons.map((r, idx) => <option key={`${r}-${idx}`} value={r}>{r}</option>)}
                </select>
                {reason === 'อื่นๆ (ระบุเอง)' && (
                  <textarea
                    id="custom-reason-input"
                    disabled={isSubmitting}
                    placeholder="ไประบุรายละเอียดเพิ่มเติมที่นี่..."
                    className="w-full px-4 py-3 rounded-xl border border-orange-300 focus:ring-4 focus:ring-orange-100 focus:border-orange-500 outline-none transition-all font-medium text-slate-800 bg-white text-sm"
                    rows={2}
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    title="Custom Reason Details"
                  />
                )}
              </div>
            </div>
          )}
        </div >

        <div className="bg-slate-50 px-8 py-6 flex justify-end gap-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-3 rounded-xl font-black text-slate-500 hover:bg-white hover:text-slate-800 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
          >
            {isViewOnly ? 'ปิดหน้าต่าง (Close)' : 'ย้อนกลับ (Go Back)'}
          </button>
          {!isViewOnly && (
            <button
              onClick={showReason ? finalizeSave : handleSaveAttempt}
              disabled={isSubmitting || !editData.subcontractor || (showReason && !reason)}
              className="bg-blue-600 disabled:bg-slate-300 hover:bg-blue-700 text-white px-10 py-3 rounded-xl font-black shadow-xl shadow-blue-200 disabled:shadow-none transform hover:-translate-y-0.5 transition-all text-xs uppercase tracking-widest relative overflow-hidden"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  กำลังบันทึก (Saving...)
                </div>
              ) : (
                showReason ? 'ยืนยันการเปลี่ยนแปลง (Confirm)' : 'ตรวจทาน (Review & Confirm)'
              )}
            </button>
          )}
        </div>
      </div >

      {/* Review & Confirm Modal */}
      {
        showReviewModal && (
          <ReviewConfirmModal
            job={job}
            editData={editData}
            user={user}
            priceMatrix={priceMatrix}
            onConfirm={() => {
              setShowReviewModal(false);
              finalizeSave();
            }}
            onEdit={() => {
              setShowReviewModal(false);
            }}
            onClose={() => {
              setShowReviewModal(false);
            }}
          />
        )
      }
    </>
  );
};

export default DispatcherActionModal;
