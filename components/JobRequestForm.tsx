
import React, { useState } from 'react';
import { Job, JobStatus } from '../types';
import { MASTER_DATA } from '../constants';
import { Truck, MapPin, ClipboardCheck, ArrowRight, ArrowLeft, CheckCircle2, Zap, Search, Info, AlertTriangle, ShieldCheck } from 'lucide-react';
import { PriceMatrix } from '../types';

interface JobRequestFormProps {
  onSubmit: (job: Job) => void;
  existingJobs: Job[];
  priceMatrix: PriceMatrix[];
}

declare const Swal: any;

const JobRequestForm: React.FC<JobRequestFormProps> = ({ onSubmit, existingJobs, priceMatrix }) => {
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
    cost: 0
  });

  const [showOriginList, setShowOriginList] = useState(false);
  const [showDestList, setShowDestList] = useState(false);
  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');

  const filteredOrigins = MASTER_DATA.locations.filter(l =>
    l.toLowerCase().includes(originQuery.toLowerCase())
  );

  const filteredDests = MASTER_DATA.locations.filter(l =>
    l.toLowerCase().includes(destQuery.toLowerCase())
  );

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
      p.origin === formData.origin &&
      p.destination === formData.destination &&
      p.truckType === formData.truckType
    );
    const hasPricing = !!matchedPricing;
    const initialStatus = hasPricing ? JobStatus.NEW_REQUEST : JobStatus.PENDING_PRICING;

    const newJob: Job = {
      ...formData,
      id: `${yearPrefix}${formattedSeq}`,
      status: initialStatus,
      cost: hasPricing ? matchedPricing?.basePrice : 0,
      sellingPrice: hasPricing ? matchedPricing?.sellingBasePrice : 0,
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
  };

  const nextStep = () => setStep(s => s + 1);
  const prevStep = () => setStep(s => s - 1);

  const isStep1Valid = formData.dateOfService && formData.truckType;
  const isStep2Valid = formData.origin && formData.destination;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Wizard Progress Header */}
      <div className="flex items-center justify-between mb-12 relative px-4">
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
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-blue-600 text-white shadow-xl shadow-blue-200 scale-110' : isDone ? 'bg-emerald-500 text-white' : 'bg-white border-2 border-slate-100 text-slate-300'}`}>
                {isDone ? <CheckCircle2 size={24} /> : <Icon size={24} />}
              </div>
              <span className={`absolute -bottom-8 whitespace-nowrap text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-600' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-3xl p-8 md:p-12 shadow-2xl shadow-slate-200/50 border border-slate-100">
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
                      {filteredOrigins.map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left px-5 py-3.5 hover:bg-blue-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                          onClick={() => {
                            setFormData({ ...formData, origin: l });
                            setOriginQuery(l);
                            setShowOriginList(false);
                          }}
                        >
                          {l}
                        </button>
                      ))}
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
                      {filteredDests.map((l, i) => (
                        <button
                          key={i}
                          type="button"
                          className="w-full text-left px-5 py-3.5 hover:bg-blue-50 text-sm font-bold text-slate-700 transition-colors border-b border-slate-50 last:border-0"
                          onClick={() => {
                            setFormData({ ...formData, destination: l });
                            setDestQuery(l);
                            setShowDestList(false);
                          }}
                        >
                          {l}
                        </button>
                      ))}
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
                      <div className="bg-white/60 backdrop-blur-sm rounded-2xl p-4 border border-emerald-100">
                        <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Available Subcontractors</div>
                        <div className="space-y-2">
                          {matchedPricing.slice(0, 3).map((p, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700">{p.subcontractor}</span>
                              <span className="font-black text-emerald-600 flex items-center gap-1">
                                <ShieldCheck size={12} /> Master Price Applied
                              </span>
                            </div>
                          ))}
                          {matchedPricing.length > 3 && <div className="text-[10px] text-center text-emerald-400 font-bold">and {matchedPricing.length - 3} more...</div>}
                        </div>
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
                          <div className="text-lg font-black text-slate-800">{new Date(formData.dateOfService).toLocaleDateString('th-TH', { dateStyle: 'full' })}</div>
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
                            setFormData({
                              ...formData,
                              subcontractor: sub,
                              cost: match ? match.basePrice : 0
                            });
                          }}
                        >
                          <option value="">Waiting Assignment / รอจัดสรร</option>
                          {MASTER_DATA.subcontractors.map((s, idx) => (
                            <option key={`${s}-${idx}`} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
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

                <div className="bg-orange-50/50 border border-orange-100 p-6 rounded-2xl flex items-start gap-4">
                  <div className="shrink-0 p-2 bg-white rounded-xl shadow-sm">
                    <Truck size={20} className="text-orange-500" />
                  </div>
                  <p className="text-xs font-bold text-orange-800 leading-relaxed">
                    โปรดตรวจสอบความถูกต้องของข้อมูลก่อนกดยืนยัน ข้อมูลนี้จะถูกส่งไปที่ฝ่าย Operation เพื่อจัดรถและซับคอนแทรคเตอร์ต่อไป
                  </p>
                </div>
              </div>
            );
          })()}

          <div className="pt-8 flex justify-between items-center border-t border-slate-50">
            {step > 1 ? (
              <button
                type="button"
                onClick={prevStep}
                className="flex items-center gap-2 px-6 py-4 rounded-2xl font-black text-slate-400 hover:text-slate-800 hover:bg-slate-50 transition-all uppercase tracking-widest text-xs"
              >
                <ArrowLeft size={18} /> Back / ย้อนกลับ
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={step === 1 ? !isStep1Valid : !isStep2Valid}
                className="flex items-center gap-2 bg-slate-900 disabled:bg-slate-100 disabled:text-slate-300 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-slate-200 transition-all uppercase tracking-widest text-xs"
              >
                Next / ถัดไป <ArrowRight size={18} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSave}
                disabled={isSubmitting}
                className={`flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-12 py-4 rounded-2xl font-black shadow-xl shadow-blue-200 hover:shadow-blue-300 transform hover:-translate-y-1 transition-all uppercase tracking-widest text-sm ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
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
