
import React, { useState, useEffect } from 'react';
import { Job, JobStatus, UserRole, AuditLog, PriceMatrix, AccountingStatus } from '../types';
import { MASTER_DATA } from '../constants';
import { AlertTriangle, Info, X, Lock } from 'lucide-react';

interface DispatcherActionModalProps {
  job: Job;
  onClose: () => void;
  onSave: (job: Job, logs?: AuditLog[]) => void;
  user: { id: string; name: string; role: UserRole };
  priceMatrix: PriceMatrix[];
  logs: AuditLog[];
  logsLoaded: boolean;
}

const DispatcherActionModal: React.FC<DispatcherActionModalProps> = ({ job, onClose, onSave, user, priceMatrix, logs, logsLoaded }) => {
  const [editData, setEditData] = useState({
    subcontractor: job.subcontractor || '',
    truckType: job.truckType,
    driverName: job.driverName || '',
    driverPhone: job.driverPhone || '',
    licensePlate: job.licensePlate || '',
    cost: job.cost || 0
  });

  const isActuallyLocked = job.isBaseCostLocked && user.role !== UserRole.ADMIN;
  const isAdminOverride = job.isBaseCostLocked && user.role === UserRole.ADMIN;

  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [priceCalculated, setPriceCalculated] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use stateful price matrix for lookup
  const calculatePriceLive = (origin: string, destination: string, truckType: string, sub: string): number => {
    const match = priceMatrix.find(
      p => p.origin.includes(origin) && p.destination.includes(destination) && p.truckType === truckType && p.subcontractor === sub
    );
    if (match) return match.basePrice;

    return 0; // Return 0 if no match found in matrix
  };

  // Track the fields that trigger a price recalculation within this session
  const [sessionPriceKeys, setSessionPriceKeys] = useState({
    sub: job.subcontractor || '',
    truck: job.truckType
  });

  // Auto-recalculate price when sub or truckType changes
  useEffect(() => {
    const hasSubChanged = editData.subcontractor !== sessionPriceKeys.sub;
    const hasTruckChanged = editData.truckType !== sessionPriceKeys.truck;

    // Only auto-recalculate if the subcontractor or truck type has changed DURING this session
    // This prevents overwriting manual negotiated prices on mount or other unrelated re-renders
    if (hasSubChanged || hasTruckChanged) {
      if (editData.subcontractor && editData.truckType) {
        const newPrice = calculatePriceLive(job.origin, job.destination, editData.truckType, editData.subcontractor);
        setEditData(prev => ({ ...prev, cost: newPrice }));
        if (newPrice > 0) {
          setPriceCalculated(true);
          setTimeout(() => setPriceCalculated(false), 2000);
        }
      }
      // Update session values so we don't recalculate again until another real change
      setSessionPriceKeys({
        sub: editData.subcontractor,
        truck: editData.truckType
      });
    }
  }, [editData.subcontractor, editData.truckType, sessionPriceKeys, job.origin, job.destination, priceMatrix]);

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

    // 🔒 2. Double-Deduction Alert System
    // Check if this job was updated recently (within 1 minute)
    if (logs && logs.length > 0) {
      const recentLog = logs.find(l =>
        l.jobId === job.id &&
        (new Date().getTime() - new Date(l.timestamp).getTime() < 60000) // 1 minute window
      );

      if (recentLog) {
        const result = await (window as any).Swal.fire({
          title: '⚠️ Double-Action Warning',
          html: `ระบบพบว่ามีการบันทึกข้อมูลสำหรับใบงาน <b>#${job.id}</b> เมื่อสักครู่นี้...<br/><br/>(โดย: ${recentLog.userName})<br/><br/>คุณแน่ใจหรือไม่ว่าต้องการบันทึกซ้ำ?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#f59e0b',
          cancelButtonColor: '#64748b',
          confirmButtonText: 'ยืนยันบันทึกซ้ำ (Confirm)',
          cancelButtonText: 'ยกเลิก (Cancel)',
          customClass: { popup: 'rounded-[2rem]' },
          footer: '<span class="text-xs text-slate-400">Double-Entry Protection System Active</span>'
        });

        if (!result.isConfirmed) {
          return;
        }
      }
    }

    const matrixPrice = calculatePriceLive(job.origin, job.destination, editData.truckType, editData.subcontractor);
    const hasChanged =
      (job.status !== JobStatus.NEW_REQUEST && (
        job.subcontractor !== editData.subcontractor ||
        job.truckType !== editData.truckType ||
        job.licensePlate !== editData.licensePlate ||
        job.cost !== editData.cost
      )) ||
      (job.status === JobStatus.NEW_REQUEST && editData.subcontractor && editData.cost !== matrixPrice);

    if (hasChanged && !showReason) {
      setShowReason(true);
    } else {
      finalizeSave();
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
      const matrixPrice = calculatePriceLive(job.origin, job.destination, editData.truckType, editData.subcontractor);

      // Log the assignment
      logs.push(createLog('Assignment', 'Unassigned', `${editData.subcontractor} (${editData.truckType})`, 'New Job Assignment'));

      // Log the initial price
      logs.push(createLog('Cost (Price)', '0', editData.cost.toString(), finalReason || 'Initial Pricing'));

      if (editData.cost !== matrixPrice) {
        // Log the override detail without string prefixes for consistency
        logs.push(createLog('Price Override', matrixPrice.toString(), editData.cost.toString(), finalReason || 'Price Negotiation'));
      }
    } else {
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
      status: job.status === JobStatus.NEW_REQUEST ? JobStatus.ASSIGNED : job.status
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

  return (
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
          <div className="flex gap-4 p-5 bg-blue-50/50 rounded-3xl border border-blue-100/50">
            <div className="bg-white p-3 rounded-2xl shadow-sm border border-blue-100 text-blue-600">
              <Info size={20} />
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-black text-blue-900 uppercase tracking-wider">รายละเอียดใบงาน (Service Ticket Details)</p>
              <div className="flex flex-wrap gap-y-1 gap-x-4">
                <div className="text-[11px] font-bold text-slate-500 uppercase">ID: <span className="text-slate-900 font-mono font-black">{job.id}</span></div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Route: <span className="text-slate-900">{job.origin} → {job.destination}</span></div>
                <div className="text-[11px] font-bold text-slate-500 uppercase">Weight: <span className="text-slate-900">{job.weightVolume}</span></div>
              </div>
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
                  p.origin.includes(job.origin) &&
                  p.destination.includes(job.destination) &&
                  p.truckType === editData.truckType
                )
                .sort((a, b) => a.basePrice - b.basePrice)
                .slice(0, 3)
                .map((rec, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setEditData({ ...editData, subcontractor: rec.subcontractor })}
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
                      <p className="text-sm font-black text-emerald-600">฿{(Number(rec.basePrice) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-[9px] font-black text-slate-300 uppercase">กดเพื่อเลือก (Select This)</p>
                    </div>
                  </button>
                ))
              }
              {priceMatrix.filter(p => p.origin.includes(job.origin) && p.destination.includes(job.destination) && p.truckType === editData.truckType).length === 0 && (
                <div className="text-[11px] font-bold text-slate-400 italic p-3 border border-dashed border-slate-200 rounded-xl text-center">
                  ไม่พบข้อมูลราคากลางสำหรับเส้นทางและประเภทรถนี้ (No pricing records found)
                </div>
              )}
            </div>
          </div>

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
                      .map((s, idx) => (
                        <button
                          key={`${s}-${idx}`}
                          type="button"
                          className="w-full text-left px-5 py-3 hover:bg-blue-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0 flex items-center justify-between group"
                          onClick={() => {
                            setEditData({ ...editData, subcontractor: s });
                            document.getElementById('sub-dropdown')?.classList.add('hidden');
                          }}
                        >
                          {s}
                          <span className="text-[10px] text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity uppercase font-black">Select</span>
                        </button>
                      ))}
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
                <option value="">-- เลือกประเภทรถ --</option>
                {MASTER_DATA.truckTypes.map((t, idx) => <option key={`${t}-${idx}`} value={t}>{t}</option>)}
              </select>
            </div>

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
                  disabled={isSubmitting || isActuallyLocked}
                  className={`w-full px-10 py-3 rounded-xl border font-bold text-lg transition-all ${isActuallyLocked ? 'bg-slate-50 border-slate-100 text-slate-400' : (priceCalculated ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-800 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none')}`}
                  value={editData.cost || ''}
                  onChange={e => {
                    const val = parseFloat(e.target.value);
                    setEditData({ ...editData, cost: val });
                    setPriceCalculated(false);
                  }}
                />
                {priceCalculated && !isActuallyLocked && (
                  <div className="absolute -top-6 right-0 text-[10px] font-black text-emerald-600 animate-bounce">✓ AUTO-CALCULATED</div>
                )}
                {isActuallyLocked && (
                  <div className="absolute -top-6 right-0 text-[10px] font-black text-rose-600 flex items-center gap-1"><Lock size={10} /> ราคานี้ผ่านการตรวจสอบแล้ว (AUDITED VALUE)</div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="driver-input" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">ชื่อคนขับ (Driver Name)</label>
              <input
                id="driver-input"
                disabled={isSubmitting}
                type="text"
                placeholder="ชื่อ-นามสกุล"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                value={editData.driverName}
                onChange={e => setEditData({ ...editData, driverName: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="driver-phone-input" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">เบอร์โทรศัพท์ (Driver Phone)</label>
              <input
                id="driver-phone-input"
                disabled={isSubmitting}
                type="tel"
                placeholder="0xx-xxx-xxxx"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                value={editData.driverPhone}
                onChange={e => setEditData({ ...editData, driverPhone: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="plate-input" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">ทะเบียนรถ (License Plate)</label>
              <input
                id="plate-input"
                disabled={isSubmitting}
                type="text"
                placeholder="ตัวอย่าง 70-1234"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                value={editData.licensePlate}
                onChange={e => setEditData({ ...editData, licensePlate: e.target.value })}
              />
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
        </div>

        <div className="bg-slate-50 px-8 py-6 flex justify-end gap-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-3 rounded-xl font-black text-slate-500 hover:bg-white hover:text-slate-800 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
          >
            ย้อนกลับ (Go Back)
          </button>
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
              showReason ? 'ยืนยันการเปลี่ยนแปลง (Confirm)' : 'อัปเดตข้อมูล (Update & Lock)'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DispatcherActionModal;
