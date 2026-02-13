
import React, { useState } from 'react';
import { Job, JobStatus, UserRole } from '../types';
import { MASTER_DATA } from '../constants';
import { Truck, MapPin, ClipboardCheck, ArrowRight, ArrowLeft, CheckCircle2, Zap, Search, Info, AlertTriangle, ShieldCheck, LayoutPanelTop } from 'lucide-react';
import { formatDate } from '../utils/format';
import { PriceMatrix } from '../types';

interface JobRequestFormProps {
  onSubmit: (job: Job) => void;
  existingJobs: Job[];
  priceMatrix: PriceMatrix[];
  onShowSummary: () => void;
  user: { id: string; name: string; role: UserRole };
}

declare const Swal: any;

const JobRequestForm: React.FC<JobRequestFormProps> = ({ onSubmit, existingJobs, priceMatrix, onShowSummary, user }) => {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    dateOfService: '',
    origin: '',
    destination: '',
    truckType: '',
    productDetail: '',
    weightVolume: '',
    remark: '',
    referenceNo: '',
    subcontractor: '',
    driverName: '',
    driverPhone: '',
    licensePlate: '',
    cost: 0,
    drops: [] as { location: string; status: 'PENDING' | 'COMPLETED'; podUrl?: string; completedAt?: string }[],
    paymentType: '' as '' | 'CASH' | 'CREDIT',
    paymentAccount: '',
  });

  const [showOriginList, setShowOriginList] = useState(false);
  const [showDestList, setShowDestList] = useState(false);
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [showDropList, setShowDropList] = useState<boolean[]>([]);

  const filteredLocations = (query: string) => {
    return MASTER_DATA.locations.filter(l =>
      l.toLowerCase().includes(query.toLowerCase())
    );
  };

  // Intelligence: Extract locations from Price Matrix to prioritize
  const masterPricingOrigins = Array.from(new Set(priceMatrix.map(p => p.origin))) as string[];
  const masterPricingDests = Array.from(new Set(priceMatrix.map(p => p.destination))) as string[];

  const allKnownOrigins = Array.from(new Set([...MASTER_DATA.locations, ...masterPricingOrigins])) as string[];
  const allKnownDests = Array.from(new Set([...MASTER_DATA.locations, ...masterPricingDests])) as string[];

  const filteredOrigins = allKnownOrigins
    .filter(l => l.toLowerCase().includes(originQuery.toLowerCase()))
    .sort((a, b) => {
      const aHas = masterPricingOrigins.includes(a);
      const bHas = masterPricingOrigins.includes(b);
      return aHas === bHas ? 0 : aHas ? -1 : 1;
    });

  const filteredDests = allKnownDests
    .filter(l => l.toLowerCase().includes(destQuery.toLowerCase()))
    .sort((a, b) => {
      const aHas = masterPricingDests.includes(a);
      const bHas = masterPricingDests.includes(b);
      return aHas === bHas ? 0 : aHas ? -1 : 1;
    });

  // Function to highlight match
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

  /* 
     HANDLE FORM SUBMISSION (Enter Key)
     - Step 1 & 2: Enter -> Next Step
     - Step 3: Enter -> NOTHING (Force user to click Save button)
  */
  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      if (step === 1 && isStep1Valid) nextStep();
      else if (step === 2 && isStep2Valid) nextStep();
    }
    // If step === 3, do nothing on Enter. User must click key.
  };

  const handleSave = async () => {
    // No need to check step < 3 here as this is bound to the save button

    if (isSubmitting) return;

    // CASH jobs require payment account
    if (formData.paymentType === 'CASH' && !(formData.paymentAccount || '').trim()) {
      if (typeof Swal !== 'undefined') {
        Swal.fire({
          title: 'ข้อมูลไม่ครบ / Missing Info',
          text: 'งานนี้เป็นเงินสด กรุณาระบุเลขที่บัญชีที่ต้องชำระเงินก่อนบันทึก',
          icon: 'warning',
          confirmButtonColor: '#e11d48',
          customClass: { popup: 'rounded-[2rem]' }
        });
      }
      return;
    }

    setIsSubmitting(true);

    // Simulate API Delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const currentYear = new Date().getFullYear();

    // Calculate sequence number for the current year
    const yearPrefix = `JRS-${currentYear}-`;
    const yearJobs = existingJobs.filter(j => j.id.startsWith(yearPrefix));

    let nextSeq = 1;
    if (yearJobs.length > 0) {
      const maxSeq = Math.max(...yearJobs.map(j => {
        const seqPart = j.id.split('-')[2];
        return parseInt(seqPart, 10) || 0;
      }));
      nextSeq = maxSeq + 1;
    }

    const formattedSeq = nextSeq.toString().padStart(4, '0');

    // Check for pricing availability
    const matchedPricing = priceMatrix.find(p =>
      (p.origin || '').trim() === (formData.origin || '').trim() &&
      (p.destination || '').trim() === (formData.destination || '').trim() &&
      (p.truckType || '').trim() === (formData.truckType || '').trim()
    );
    const hasPricing = !!matchedPricing;
    const initialStatus = hasPricing ? JobStatus.NEW_REQUEST : JobStatus.PENDING_PRICING;

    // Clean up string data entries before creating job
    const cleanFormData = {
      ...formData,
      origin: (formData.origin || '').trim(),
      destination: (formData.destination || '').trim(),
      subcontractor: (formData.subcontractor || '').trim(),
      truckType: (formData.truckType || '').trim(),
      driverName: (formData.driverName || '').trim(),
      licensePlate: (formData.licensePlate || '').trim(),
    };

    const newJob: Job = {
      ...cleanFormData,
      id: `${yearPrefix}${formattedSeq}`,
      status: initialStatus,
      cost: hasPricing ? (matchedPricing?.basePrice ?? 0) + ((formData.drops?.length || 0) * (matchedPricing?.dropOffFee || 0)) : 0,
      sellingPrice: hasPricing ? (matchedPricing?.sellingBasePrice ?? 0) + ((formData.drops?.length || 0) * (matchedPricing?.dropOffFee || 0)) : 0,
      requestedBy: user.id,
      requestedByName: user.name,
      createdAt: new Date().toISOString(), // Add creation timestamp
    };

    // Show Success Alert and wait for user to click OK
    if (typeof Swal !== 'undefined') {
      await Swal.fire({
        title: hasPricing ? 'Success! / บันทึกสำเร็จ' : 'Saved for Review / ส่งตรวจสอบราคา',
        html: hasPricing
          ? 'Job request has been created. / สร้างรายการงานเรียบร้อยแล้ว'
          : 'Job saved but <b>Locked for Pricing Review</b>.<br/>Please notify Admin to add master price.<br/><br/>บันทึกงานแล้ว แต่สถานะเป็น <b>"รอตรวจสอบราคา"</b><br/>โปรดแจ้ง Admin ให้เพิ่มราคากลางก่อนจัดรถ',
        icon: hasPricing ? 'success' : 'warning',
        confirmButtonText: 'OK / ตกลง',
        confirmButtonColor: hasPricing ? '#2563eb' : '#f59e0b',
        customClass: {
          popup: 'rounded-[2rem]',
          confirmButton: 'rounded-xl px-10 py-3 font-bold uppercase tracking-widest text-xs'
        }
      });
    }

    onSubmit(newJob);
    setIsSubmitting(false);

    // Auto-open summary board after brief delay to let user digest success alert
    setTimeout(() => {
      onShowSummary();
    }, 200);
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const isStep1Valid = formData.dateOfService && formData.truckType;
  const isStep2Valid = formData.origin && formData.destination;

  // Rule: Check if pricing exists for the given combination
  const currentMatchedPricing = priceMatrix.find(p =>
    (p.origin || '').trim() === (formData.origin || '').trim() &&
    (p.destination || '').trim() === (formData.destination || '').trim() &&
    (p.truckType || '').trim() === (formData.truckType || '').trim()
  );
  const canSaveJob = !!currentMatchedPricing;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Wizard Progress Header */}
      <div className="flex items-center justify-between mb-8 sm:mb-12 relative px-2 sm:px-4">
        <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-100 -translate-y-1/2 z-0"></div>
        <div
          className={`absolute top-1/2 left-0 h-1 bg-blue-500 -translate-y-1/2 z-0 transition-all duration-500 ${step === 1 ? 'w-0' : step === 2 ? 'w-1/2' : 'w-full'
            }`}
        ></div>

        {[
          { icon: Truck, label: 'ข้อมูลรถ (Fleet Info)' },
          { icon: MapPin, label: 'เส้นทาง (Route)' },
          { icon: ClipboardCheck, label: 'ตรวจทาน (Review)' }
        ].map((s, i) => {
          const num = i + 1;
          const isActive = step === num;
          const isDone = step > num;
          const Icon = s.icon;

          return (
            <div key={num} className="relative z-10 flex flex-col items-center">
              <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-110' : isDone ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-slate-100 text-slate-300'}`}>
                {isDone ? <CheckCircle2 size={20} /> : <Icon size={20} />}
              </div>
              <span className={`absolute -bottom-6 sm:-bottom-8 whitespace-nowrap text-[8px] sm:text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100">
        <form onSubmit={onFormSubmit} className="space-y-8">

          {step === 1 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label htmlFor="date-service" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">วันที่ต้องการรถ (Date of Service)</label>
                  <input
                    id="date-service"
                    required
                    type="date"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                    value={formData.dateOfService}
                    onKeyDown={(e) => e.preventDefault()}
                    onChange={e => setFormData({ ...formData, dateOfService: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="truck-type" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ประเภทรถ (Truck Type)</label>
                  <select
                    id="truck-type"
                    required
                    className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800 appearance-none cursor-pointer"
                    value={formData.truckType}
                    onChange={e => setFormData({ ...formData, truckType: e.target.value })}
                  >
                    <option value="">เลือกประเภทรถ</option>
                    {MASTER_DATA.truckTypes.map((t, idx) => <option key={`${t}-${idx}`} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="product-detail" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">รายละเอียดสินค้า (Product Description - Optional)</label>
                <input
                  id="product-detail"
                  type="text"
                  placeholder="เช่น ข้าวสาร 500 ถุง"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                  value={formData.productDetail}
                  onChange={e => setFormData({ ...formData, productDetail: e.target.value })}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5 relative">
                  <label htmlFor="origin-input" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ต้นทาง (Origin)</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input
                      id="origin-input"
                      type="text"
                      autoComplete="off"
                      placeholder="พิมพ์เพื่อค้นหาจุดรับสินค้า..."
                      className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                      value={originQuery || formData.origin}
                      onFocus={() => setShowOriginList(true)}
                      onChange={e => {
                        setOriginQuery(e.target.value);
                        setFormData({ ...formData, origin: e.target.value });
                        setShowOriginList(true);
                      }}
                      onBlur={() => setTimeout(() => setShowOriginList(false), 200)}
                    />
                  </div>
                  {showOriginList && filteredOrigins.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto animate-in fade-in zoom-in duration-200">
                      {/* Priority Locations */}
                      {filteredOrigins.some(l => masterPricingOrigins.includes(l)) && (
                        <div className="px-5 py-2 bg-blue-50/50 text-[10px] font-black text-blue-500 uppercase tracking-widest border-b border-blue-50">
                          🎯 สถานที่ตามราคากลาง (Contract)
                        </div>
                      )}

                      {filteredOrigins.map((l, i) => {
                        const isMaster = masterPricingOrigins.includes(l);
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`w-full text-left px-5 py-3.5 hover:bg-blue-50 text-sm font-bold transition-all border-b border-slate-50 last:border-0 flex items-center justify-between ${isMaster ? 'bg-blue-50/20 text-blue-900' : 'text-slate-700'
                              }`}
                            onClick={() => {
                              setFormData({ ...formData, origin: l });
                              setOriginQuery(l);
                              setShowOriginList(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {isMaster ? <ShieldCheck size={14} className="text-emerald-500" /> : <MapPin size={14} className="text-slate-300" />}
                              <span>{highlightMatch(l, originQuery)}</span>
                            </div>
                            {isMaster && (
                              <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider">
                                PRICE FOUND
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5 relative">
                  <label htmlFor="destination-input" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">ปลายทาง (Destination)</label>
                  <div className="relative group">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                    <input
                      id="destination-input"
                      type="text"
                      autoComplete="off"
                      placeholder="พิมพ์เพื่อค้นหาจุดส่งสินค้า..."
                      className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                      value={destQuery || formData.destination}
                      onFocus={() => setShowDestList(true)}
                      onChange={e => {
                        setDestQuery(e.target.value);
                        setFormData({ ...formData, destination: e.target.value });
                        setShowDestList(true);
                      }}
                      onBlur={() => setTimeout(() => setShowDestList(false), 200)}
                    />
                  </div>
                  {showDestList && filteredDests.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto animate-in fade-in zoom-in duration-200">
                      {/* Priority Locations */}
                      {filteredDests.some(l => masterPricingDests.includes(l)) && (
                        <div className="px-5 py-2 bg-emerald-50 text-[10px] font-black text-emerald-600 uppercase tracking-widest border-b border-emerald-50">
                          🎯 ปลายทางตามราคากล่าวง (Verified Destinations)
                        </div>
                      )}

                      {filteredDests.map((l, i) => {
                        const isMaster = masterPricingDests.includes(l);
                        return (
                          <button
                            key={i}
                            type="button"
                            className={`w-full text-left px-5 py-3.5 hover:bg-blue-50 text-sm font-bold transition-all border-b border-slate-50 last:border-0 flex items-center justify-between ${isMaster ? 'bg-emerald-50/10 text-slate-900' : 'text-slate-700'
                              }`}
                            onClick={() => {
                              setFormData({ ...formData, destination: l });
                              setDestQuery(l);
                              setShowDestList(false);
                            }}
                          >
                            <div className="flex items-center gap-2">
                              {isMaster ? <ShieldCheck size={14} className="text-emerald-500" /> : <MapPin size={14} className="text-slate-300" />}
                              <span>{highlightMatch(l, destQuery)}</span>
                            </div>
                            {isMaster && (
                              <div className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-wider">
                                PRICE FOUND
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Drops Management UI */}
              <div className="pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">จุดแวะส่งสินค้า (Drop-off Points)</h3>
                    <p className="text-[9px] font-medium text-slate-400 ml-1 mt-0.5">ระบบจะคิดค่าจุดอัตโนมัติตามที่มีข้อมูลในราคากลาง</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, drops: [...formData.drops, { location: '', status: 'PENDING' }] });
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-95"
                  >
                    + เพิ่มจุดเพิ่ม (Add)
                  </button>
                </div>

                <div className="space-y-3">
                  {formData.drops.map((drop, index) => (
                    <div key={index} className="flex items-center gap-3 animate-in slide-in-from-left-4 duration-200">
                      <div className="shrink-0 w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200">
                        {index + 1}
                      </div>
                      <div className="flex-1 relative group">
                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                        <input
                          type="text"
                          placeholder="ระบุสถานที่ส่งสินค้า..."
                          className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-100 bg-slate-50/30 focus:bg-white focus:border-blue-500 outline-none transition-all font-bold text-slate-700 text-sm"
                          value={drop.location}
                          onChange={(e) => {
                            const newDrops = [...formData.drops];
                            newDrops[index] = { ...newDrops[index], location: e.target.value };
                            setFormData({ ...formData, drops: newDrops });
                          }}
                          onFocus={() => {
                            const newShowDrops = [...showDropList];
                            newShowDrops[index] = true;
                            setShowDropList(newShowDrops);
                          }}
                          onBlur={() => {
                            setTimeout(() => {
                              const newShowDrops = [...showDropList];
                              newShowDrops[index] = false;
                              setShowDropList(newShowDrops);
                            }, 200);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const newDrops = formData.drops.filter((_, i) => i !== index);
                            setFormData({ ...formData, drops: newDrops });
                          }}
                          title="Remove drop point"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500 p-1 rounded-full hover:bg-rose-50 transition-all"
                        >
                          <AlertTriangle size={16} />
                        </button>

                        {/* Drop Auto-complete (Simplified) */}
                        {showDropList[index] && filteredLocations(drop.location).length > 0 && (
                          <div className="absolute z-[60] w-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 max-h-40 overflow-y-auto">
                            {filteredLocations(drop.location).slice(0, 10).map((l, i) => (
                              <button
                                key={i}
                                type="button"
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-[11px] font-bold text-slate-600 transition-colors border-b border-slate-50 last:border-0"
                                onClick={() => {
                                  const newDrops = [...formData.drops];
                                  newDrops[index] = { ...newDrops[index], location: l };
                                  setFormData({ ...formData, drops: newDrops });
                                }}
                              >
                                {l}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {formData.drops.length === 0 && (
                    <div className="p-10 border-2 border-dashed border-slate-100 rounded-3xl flex flex-col items-center justify-center opacity-40">
                      <MapPin size={24} className="text-slate-300 mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">ไม่มีจุดแวะส่งสินค้าระหว่างทาง<br />(Only Origin to Destination)</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="weight-vol" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">น้ำหนัก-ปริมาตร (Weight / Volume - Optional)</label>
                <input
                  id="weight-vol"
                  type="text"
                  placeholder="เช่น 15 ตัน / 40 CBM"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                  value={formData.weightVolume}
                  onChange={e => setFormData({ ...formData, weightVolume: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label htmlFor="ref-no" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">เลขอ้างอิง (Ref No. - Optional)</label>
                  <input
                    id="ref-no"
                    type="text"
                    placeholder="PO / Invoice / SO number"
                    className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                    value={formData.referenceNo}
                    onChange={e => setFormData({ ...formData, referenceNo: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="remark-area" className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">หมายเหตุเพิ่มเติม (Special Remarks - Optional)</label>
                  <textarea
                    id="remark-area"
                    rows={1}
                    placeholder="ระบุเพิ่มเติมถ้ามี..."
                    className="w-full px-5 py-4 rounded-2xl border border-slate-100 bg-slate-50/50 focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800 resize-none"
                    value={formData.remark}
                    onChange={e => setFormData({ ...formData, remark: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 3 && (() => {
            const matchedPricing = priceMatrix.filter(p =>
              p.origin === formData.origin &&
              p.destination === formData.destination &&
              p.truckType === formData.truckType
            );
            const hasPricing = matchedPricing.length > 0;

            return (
              <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                {/* Save button moved back to footer as requested */}

                {/* Smart Pricing Insight Tool */}
                <div className={`p-6 rounded-[2rem] border-2 transition-all duration-500 ${hasPricing ? 'bg-emerald-50 border-emerald-100 shadow-lg shadow-emerald-100' : 'bg-rose-50 border-rose-100 shadow-lg shadow-rose-100'}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-xl ${hasPricing ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'}`}>
                        {hasPricing ? <Zap size={20} /> : <AlertTriangle size={20} />}
                      </div>
                      <div>
                        <h3 className={`text-sm font-black uppercase tracking-widest ${hasPricing ? 'text-emerald-700' : 'text-rose-700'}`}>
                          Pricing Intelligence / ระบบตรวจสอบราคาอัจฉริยะ
                        </h3>
                        <p className={`text-[10px] font-bold ${hasPricing ? 'text-emerald-600' : 'text-rose-600'}`}>
                          Auto-checking Subcontractor Master Pricing Table
                        </p>
                      </div>
                    </div>
                    <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${hasPricing ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {hasPricing ? 'Price Found / พบข้อมูล' : 'No Data / ไม่พบข้อมูลราคา'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                    <div className="space-y-2">
                      <p className={`text-xs font-medium leading-relaxed ${hasPricing ? 'text-emerald-800' : 'text-rose-800'}`}>
                        {hasPricing ? (
                          <>
                            <strong className="block text-sm mb-1">✅ พบราคาในระบบมาตรฐาน</strong>
                            เส้นทางนี้ (<strong>{formData.origin}</strong> → <strong>{formData.destination}</strong>)
                            มีราคาที่ตกลงไว้ใน Master Table แล้วสำหรับรถประเภท <strong>{formData.truckType}</strong>
                            จำนวน <strong>{matchedPricing.length}</strong> รายการ.
                          </>
                        ) : (
                          <>
                            <strong className="block text-sm mb-1">⚠️ ไม่พบข้อมูลราคามาตรฐาน</strong>
                            ขออภัย เส้นทางและประเภทรถนี้ ยังไม่ได้ถูกกำหนดราคาไว้ในระบบ Master Table
                            ฝ่ายจัดรถอาจต้องทำการต่อรองราคาเป็นกรณีพิเศษ (Spot Rate).
                          </>
                        )}
                      </p>
                      {!hasPricing && (
                        <div className="mt-3 bg-rose-100 p-3 rounded-xl border border-rose-200">
                          <p className="text-[10px] font-black text-rose-700 uppercase tracking-wide mb-1">Status Impact / ผลกระทบต่อสถานะงาน</p>
                          <p className="text-xs font-bold text-rose-800">
                            งานนี้จะถูกบันทึกในสถานะ <span className="underline decoration-2 text-rose-900">"รอตรวจสอบราคา (Pending Pricing)"</span>
                            และจะไม่สามารถจัดรถได้ จนกว่า Admin หรือฝ่ายบัญชีจะเพิ่มราคากลางเข้าระบบ.
                          </p>
                        </div>
                      )}
                    </div>

                    {hasPricing && (
                      <div className="bg-white/60 backdrop-blur-sm rounded-3xl p-5 border border-emerald-100">
                        <div className="flex items-center justify-between mb-4 px-1">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                            <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Available Options / ตัวเลือกที่ตรวจพบ</div>
                          </div>
                          <div className="text-[9px] font-bold text-slate-400 uppercase">Sorted by Lowest Cost</div>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {matchedPricing
                            .sort((a, b) => {
                              const totalA = a.basePrice + (formData.drops.length * (a.dropOffFee || 0));
                              const totalB = b.basePrice + (formData.drops.length * (b.dropOffFee || 0));
                              return totalA - totalB;
                            })
                            .map((p, idx) => {
                              const isSelected = formData.subcontractor === p.subcontractor;
                              const dropFeeTotal = (formData.drops.length) * (p.dropOffFee || 0);
                              const totalWithDrops = p.basePrice + dropFeeTotal;
                              const isCheapest = idx === 0;

                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setFormData(prev => ({ ...prev, subcontractor: '', cost: 0, sellingPrice: 0, paymentType: '', paymentAccount: '' }));
                                    } else {
                                      setFormData(prev => ({
                                        ...prev,
                                        subcontractor: p.subcontractor,
                                        cost: totalWithDrops,
                                        sellingPrice: p.sellingBasePrice + dropFeeTotal,
                                        paymentType: p.paymentType || 'CREDIT',
                                        paymentAccount: p.paymentAccount || ''
                                      }));
                                    }
                                  }}
                                  className={`group relative w-full text-left p-4 rounded-2xl border-2 transition-all duration-300 ${isSelected
                                    ? 'bg-gradient-to-r from-emerald-500 to-teal-600 border-emerald-600 shadow-xl shadow-emerald-200 -translate-y-1'
                                    : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-md'
                                    }`}
                                >
                                  {isCheapest && !isSelected && (
                                    <div className="absolute -top-2 -right-2 bg-amber-400 text-white text-[8px] font-black px-2 py-1 rounded-lg shadow-lg z-10 animate-bounce">
                                      CHEAPEST
                                    </div>
                                  )}

                                  <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600'
                                        }`}>
                                        <Truck size={24} />
                                      </div>

                                      <div>
                                        <h4 className={`font-black text-sm mb-1 ${isSelected ? 'text-white' : 'text-slate-800'}`}>
                                          {p.subcontractor}
                                        </h4>
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                          <div className={`flex items-center gap-1 text-[10px] font-bold ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                                            <span>Base: ฿{p.basePrice.toLocaleString()}</span>
                                          </div>
                                          {formData.drops.length > 0 && (
                                            <div className={`flex items-center gap-1 text-[10px] font-bold ${isSelected ? 'text-white' : 'text-blue-600'}`}>
                                              <span>Drop(x{formData.drops.length}): ฿{dropFeeTotal.toLocaleString()}</span>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    <div className="text-right">
                                      <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${isSelected ? 'text-emerald-100' : 'text-slate-400'}`}>
                                        Total Cost
                                      </p>
                                      <p className={`text-xl font-black ${isSelected ? 'text-white' : 'text-emerald-600'}`}>
                                        ฿{totalWithDrops.toLocaleString()}
                                      </p>
                                    </div>
                                  </div>
                                </button>
                              );
                            })}
                        </div>

                        {formData.subcontractor && (
                          <div className="mt-4 pt-4 border-t border-emerald-100/50">
                            <div className="flex items-center justify-center gap-2 bg-emerald-500/10 py-2 rounded-xl">
                              <CheckCircle2 size={14} className="text-emerald-600" />
                              <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">
                                Selected: {formData.subcontractor}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-blue-50/50 border border-blue-100 rounded-[2rem] p-8 space-y-8">

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">รายละเอียดงาน (Service Details)</p>
                        <div className="space-y-1">
                          <div className="text-lg font-black text-slate-800">{formatDate(formData.dateOfService)}</div>
                          <div className="text-sm font-bold text-slate-500">{formData.truckType}</div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Product / สินค้า</p>
                        <p className="text-sm font-bold text-slate-700">{formData.productDetail || 'ไม่ระบุรายละเอียด'}</p>
                      </div>

                      {/* Subcontractor Selection in Review Step */}
                      <div className="space-y-2 pt-2">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">Assign Subcontractor / ระบุบริษัทรถร่วม</p>
                        <select
                          className="w-full px-4 py-3 rounded-xl border border-blue-100 bg-white shadow-sm focus:ring-4 focus:ring-blue-50 outline-none transition-all font-bold text-slate-700 text-sm"
                          value={formData.subcontractor}
                          title="Select Subcontractor"
                          onChange={e => {
                            const sub = e.target.value;
                            const match = priceMatrix.find(p =>
                              p.origin === formData.origin &&
                              p.destination === formData.destination &&
                              p.truckType === formData.truckType &&
                              p.subcontractor === sub
                            );
                            const dropFeeTotal = (formData.drops.length) * (match?.dropOffFee || 0);
                            setFormData({
                              ...formData,
                              subcontractor: sub,
                              cost: match ? match.basePrice + dropFeeTotal : 0,
                              sellingPrice: match ? match.sellingBasePrice + dropFeeTotal : 0
                            });
                          }}
                        >
                          <option value="">Waiting Assignment / รอจัดสรร</option>
                          {MASTER_DATA.subcontractors.map((s, idx) => (
                            <option key={`${s}-${idx}`} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>

                      {/* Driver & Truck Info for Booking Officer */}
                      <div className="space-y-4 p-4 bg-white rounded-2xl border border-blue-50 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="p-1 px-2 bg-blue-600 text-white rounded text-[9px] font-black uppercase tracking-widest">Operator Entry</div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รายละเอียดคนขับประจำเที่ยว (Fleet Info)</p>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ชื่อคนขับ (Driver Name)</label>
                            <input
                              type="text"
                              placeholder="ระบุชื่อคนขับ... (Driver Name)"
                              className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-slate-700 text-xs"
                              value={formData.driverName}
                              onChange={e => setFormData({ ...formData, driverName: e.target.value })}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">เบอร์โทรศัพท์ (Phone)</label>
                              <input
                                type="tel"
                                placeholder="0xx-xxx-xxxx"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-slate-700 text-xs"
                                value={formData.driverPhone}
                                onChange={e => setFormData({ ...formData, driverPhone: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">ทะเบียนรถ (License Plate)</label>
                              <input
                                type="text"
                                placeholder="ตัวอย่าง 70-1234"
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all font-bold text-slate-700 text-xs"
                                value={formData.licensePlate}
                                onChange={e => setFormData({ ...formData, licensePlate: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Payment Account - CASH only */}
                      {formData.paymentType === 'CASH' && (
                        <div className="p-4 bg-red-50 rounded-2xl border-2 border-red-200 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="p-1 px-2 bg-red-600 text-white rounded text-[9px] font-black uppercase tracking-widest">💰 เงินสด</div>
                            <p className="text-[10px] font-black text-red-600 uppercase tracking-widest">บัญชีที่ต้องชำระเงิน (Payment Account) *</p>
                          </div>
                          <input
                            type="text"
                            placeholder="เช่น กสิกรไทย 123-4-56789-0 ชื่อ บจก.xxxxx"
                            className="w-full px-4 py-2.5 rounded-xl border border-red-300 bg-white focus:ring-4 focus:ring-red-100 focus:border-red-500 outline-none transition-all font-bold text-slate-700 text-xs"
                            value={formData.paymentAccount}
                            onChange={e => setFormData({ ...formData, paymentAccount: e.target.value })}
                          />
                          {!(formData.paymentAccount || '').trim() && (
                            <p className="text-[10px] font-bold text-red-500 mt-1">⚠️ กรุณาระบุเลขบัญชีก่อนบันทึก</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em]">เส้นทาง (Route)</p>
                        <div className="flex items-center gap-3 py-2">
                          <div className="shrink-0 w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-blue-600">
                            <MapPin size={16} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-black text-slate-800">{formData.origin}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">จุดรับสินค้า (Pick-up)</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 py-2">
                          <div className="shrink-0 w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center text-orange-500">
                            <MapPin size={16} />
                          </div>
                          <div className="flex-1">
                            <div className="text-sm font-black text-slate-800">{formData.destination}</div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">จุดส่งสินค้า (Drop-off)</div>
                          </div>
                        </div>

                        {/* Drops Visualization in Review */}
                        {formData.drops.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-slate-100">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-3">จุดแวะส่งสินค้าระหว่างทาง ({formData.drops.length} จุด)</p>
                            <div className="space-y-3">
                              {formData.drops.map((drop, i) => (
                                <div key={i} className="flex items-center gap-3">
                                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                                  <span className="text-xs font-bold text-slate-600">{typeof drop === 'string' ? drop : drop.location}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pt-6 border-t border-blue-100">
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Weight/Vol</p>
                      <p className="text-sm font-bold text-slate-800">{formData.weightVolume || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Ref No.</p>
                      <p className="text-sm font-bold text-slate-800">{formData.referenceNo || '-'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">Subcontractor</p>
                      <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{formData.subcontractor || 'Waiting'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-1">หมายเหตุ (Remarks)</p>
                      <p className="text-xs font-bold text-slate-500">{formData.remark || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className={`p-6 rounded-2xl flex items-start gap-4 border ${canSaveJob ? 'bg-orange-50/50 border-orange-100' : 'bg-rose-50 border-rose-200 animate-pulse'}`}>
                  <div className={`shrink-0 p-2 bg-white rounded-xl shadow-sm ${canSaveJob ? '' : 'text-rose-500'}`}>
                    {canSaveJob ? <Truck size={20} className="text-orange-500" /> : <AlertTriangle size={20} />}
                  </div>
                  <div className="flex-1">
                    {canSaveJob ? (
                      <p className="text-xs font-bold text-orange-800 leading-relaxed">
                        โปรดตรวจสอบความถูกต้องของข้อมูลก่อนกดยืนยัน ข้อมูลนี้จะถูกส่งไปที่ฝ่าย Operation เพื่อจัดรถและซับคอนแทรคเตอร์ต่อไป
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-sm font-black text-rose-900 uppercase">ไม่สามารถสร้างใบงานได้ (Invalid Request)</p>
                        <p className="text-xs font-bold text-rose-700 leading-relaxed">
                          เส้นทาง ({formData.origin} → {formData.destination}) สำหรับประเภทรถ {formData.truckType} <span className="underline decoration-2">ยังไม่มีราคากลางในระบบ</span>
                          กรุณาแจ้งแอดมินให้เพิ่มราคาก่อนจึงจะสามารถสร้างใบงานได้
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="pt-6 sm:pt-8 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3 border-t border-slate-50">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-black text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
              >
                <ArrowLeft size={18} /> ย้อนกลับ (Back)
              </button>
            ) : (
              <button
                type="button"
                onClick={onShowSummary}
                className="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-2xl font-black text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all uppercase tracking-widest text-[10px]"
              >
                <LayoutPanelTop size={16} /> สรุปกระดานงาน (Summary)
              </button>
            )}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                className="flex items-center justify-center gap-2 bg-slate-900 disabled:bg-slate-100 disabled:text-slate-300 text-white px-6 sm:px-10 py-3 sm:py-4 rounded-2xl font-black shadow-xl shadow-slate-200 transition-all uppercase tracking-widest text-xs"
              >
                ถัดไป (Next) <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting || !canSaveJob}
                className={`flex items-center justify-center gap-2 px-6 sm:px-12 py-3 sm:py-4 rounded-2xl font-black shadow-xl transform transition-all uppercase tracking-widest text-xs sm:text-sm ${isSubmitting || !canSaveJob
                  ? 'bg-slate-300 text-slate-500 shadow-none cursor-not-allowed opacity-60'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 hover:shadow-blue-300 hover:-translate-y-1'
                  }`}
              >
                {isSubmitting ? (
                  <>Processing... / กำลังบันทึก <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div></>
                ) : (
                  <>Confirm & Save / ยืนยันข้อมูล <ClipboardCheck size={20} /></>
                )}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobRequestForm;
