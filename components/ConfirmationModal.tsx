
import React, { useState, useEffect, useRef } from 'react';
import { Job, JobStatus, AccountingStatus } from '../types';
import { Camera, CheckCircle2, DollarSign, Image as ImageIcon, X, FileText, Upload, MapPin, Calendar, User, Phone } from 'lucide-react';

interface ConfirmationModalProps {
  job: Job;
  onClose: () => void;
  onConfirm: (job: Job) => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ job, onClose, onConfirm }) => {
  const [actualArrival, setActualArrival] = useState('');
  const [mileage, setMileage] = useState('');
  const [extraCharge, setExtraCharge] = useState(0);
  const [extraChargeComment, setExtraChargeComment] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isVerified, setIsVerified] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (progressRef.current && uploadProgress !== null) {
      progressRef.current.style.setProperty('--progress-width', `${uploadProgress}%`);
    }
  }, [uploadProgress]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length > 0) {
      const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024); // 10MB Limit
      if (oversizedFiles.length > 0) {
        if (typeof (window as any).Swal !== 'undefined') {
          (window as any).Swal.fire({
            title: 'File Too Large / ไฟล์ใหญ่เกินไป',
            text: 'One or more files exceed 10MB. / บางไฟล์มีขนาดเกิน 10MB กรุณาเลือกไฟล์ที่เล็กลง',
            icon: 'warning',
            confirmButtonColor: '#2563eb',
            customClass: { popup: 'rounded-[1.5rem]' }
          });
        }
        e.target.value = '';
        return;
      }

      setUploadProgress(0);
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 40;
        if (progress >= 100) {
          setUploadProgress(100);
          clearInterval(interval);
          setSelectedFiles(prev => [...prev, ...files]);
          setTimeout(() => setUploadProgress(null), 500);
        } else {
          setUploadProgress(progress);
        }
      }, 100);
    }
  };

  const removeFileAt = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    if (selectedFiles.length === 1) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const triggerUpload = () => fileInputRef.current?.click();
  const triggerCamera = () => cameraInputRef.current?.click();

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleConfirm = async () => {
    if (isSubmitting) return;

    // MANDATORY DOCUMENT RULE
    if (selectedFiles.length === 0) {
      if (typeof (window as any).Swal !== 'undefined') {
        (window as any).Swal.fire({
          title: 'Missing Document / ไม่พบเอกสารประกอบ',
          text: 'คุณต้องแนบรูปภาพหรือไฟล์ PDF หลักฐานการส่งสินค้า (POD) ก่อนจึงจะสามารถแจ้งจบงานได้',
          icon: 'error',
          confirmButtonColor: '#e11d48',
          customClass: { popup: 'rounded-[1.5rem]' }
        });
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // Convert images to Base64 for persistence
      let base64Images: string[] = [];
      if (selectedFiles.length > 0) {
        base64Images = await Promise.all(selectedFiles.map(file => fileToBase64(file)));
      }

      // Simulate API Delay
      await new Promise(resolve => setTimeout(resolve, 1200));

      const updatedJob: Job = {
        ...job,
        actualArrivalTime: actualArrival,
        mileage,
        extraCharge,
        accountingStatus: AccountingStatus.PENDING_REVIEW, // Trigger Accounting Workflow
        podImageUrls: base64Images,
        status: JobStatus.COMPLETED
      };
      onConfirm(updatedJob);

      // Show Success Alert
      if (typeof (window as any).Swal !== 'undefined') {
        (window as any).Swal.fire({
          title: 'Job Completed! / จบงานสำเร็จ',
          text: 'The job has been closed and locked. / บันทึกข้อมูลการจบงานเรียบร้อยแล้ว',
          icon: 'success',
          confirmButtonColor: '#059669',
          customClass: {
            popup: 'rounded-[2rem]'
          }
        });
      }

      setIsSubmitting(false);
      onClose();
    } catch (error) {
      console.error("Failed to process POD image:", error);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="glass rounded-[2rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-xl flex flex-col max-h-[95vh] md:max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-300 relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 shrink-0"></div>
        <div className="bg-emerald-50/50 px-6 py-5 md:px-8 md:py-6 flex items-center justify-between border-b border-emerald-100/50 shrink-0">
          <div>
            <h3 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <div className="w-8 h-8 md:w-10 md:h-10 bg-emerald-100 rounded-lg md:rounded-xl flex items-center justify-center text-emerald-600">
                <CheckCircle2 size={20} />
              </div>
              ยืนยันการจบงาน (Job Confirmation)
            </h3>
            <p className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 ml-11 md:ml-13">ยืนยันการปฏิบัติงานจริง</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center bg-white border border-slate-100 rounded-lg md:rounded-xl hover:bg-red-50 hover:text-red-500 transition-all text-slate-400" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto scrollbar-thin">
          <div className="bg-white border border-slate-100 rounded-[2rem] p-6 flex items-start gap-4 hover-lift shadow-sm">
            <div className="shrink-0 px-3 py-2 bg-white rounded-xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-w-[100px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">รหัสใบงาน (Service ID)</span>
              <span className="text-sm font-black text-emerald-600 font-mono">{job.id}</span>
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <div className="text-sm font-black text-slate-800 mb-0.5">{job.subcontractor}</div>
                <div className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-2">
                  <span>{job.truckType}</span>
                  <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                  <span className="font-mono text-emerald-600">{job.licensePlate}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1.5 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <Calendar size={12} className="text-blue-400" />
                  วันที่ปฏิบัติงาน (Service Date): {new Date(job.dateOfService).toLocaleDateString('th-TH')}
                </div>
                {job.driverName && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-100">
                      <User size={12} className="text-slate-400" />
                      <span className="text-[10px] font-black text-slate-700 uppercase">{job.driverName}</span>
                    </div>
                    {job.driverPhone && (
                      <a
                        href={`tel:${job.driverPhone}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 hover:bg-blue-600 hover:text-white transition-all group"
                      >
                        <Phone size={11} className="group-hover:animate-bounce" />
                        <span className="text-[10px] font-black uppercase">{job.driverPhone}</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-50 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                  <MapPin size={12} className="text-blue-500" />
                  <span className="text-slate-400 uppercase mr-1">ต้นทาง (Origin):</span>
                  {job.origin}
                </div>
                <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                  <MapPin size={12} className="text-orange-500" />
                  <span className="text-slate-400 uppercase mr-1">ปลายทาง (Dest):</span>
                  {job.destination}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="arrival-date" className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex justify-between">
                วันที่เข้าหน้างานจริง (Actual Arrival Date)
                <span className="text-red-500">* จำเป็นต้องระบุ (REQUIRED)</span>
              </label>
              <input
                id="arrival-date"
                type="date"
                required
                disabled={isSubmitting}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 disabled:opacity-50"
                value={actualArrival}
                onChange={e => setActualArrival(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label htmlFor="mileage-input" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">เลขไมล์รถ (Actual Mileage - Optional)</label>
                  <input
                    id="mileage-input"
                    type="text"
                    disabled={isSubmitting}
                    placeholder="e.g. 15,240"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 disabled:opacity-50"
                    value={mileage}
                    onChange={e => setMileage(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="extra-charge" className="text-[11px] font-black text-slate-400 uppercase tracking-wider">ค่าใช้จ่ายเพิ่มเติม (Extra Charges - ฿)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">฿</span>
                    <input
                      id="extra-charge"
                      type="number"
                      disabled={isSubmitting}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-bold text-slate-800 disabled:opacity-50"
                      value={extraCharge}
                      onChange={e => setExtraCharge(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              {extraCharge > 0 && (
                <div className="space-y-2 animate-in slide-in-from-top-2">
                  <label htmlFor="extra-charge-comment" className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex justify-between">
                    คำอธิบายค่าใช้จ่าย (Charge Explanation)
                    <span className="text-emerald-600">กรุณาระบุ (REQUIRED)</span>
                  </label>

                  <div className="flex flex-wrap gap-2 mb-2">
                    {['ค่าจุดจอดเพิ่ม', 'ค่ารอสินค้า', 'จุดดรอปเพิ่ม', 'ค่าค้างคืน'].map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setExtraChargeComment(tag)}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${extraChargeComment === tag ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-500 hover:text-emerald-600'}`}
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>

                  <textarea
                    id="extra-charge-comment"
                    disabled={isSubmitting}
                    placeholder="ระบุรายละเอียด เช่น ค่าจุดจอด 2 จุด, รอสินค้าเกิน 3 ชม. ..."
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium text-slate-800 text-sm disabled:opacity-50"
                    rows={2}
                    value={extraChargeComment}
                    onChange={e => setExtraChargeComment(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label htmlFor="pod-upload-trigger" className="text-[11px] font-black text-slate-400 uppercase tracking-wider flex justify-between">
                หลักฐานการส่งสินค้า (Proof of Delivery - POD)
                <span className="text-red-500">* รูปถ่าย หรือ PDF (REQUIRED)</span>
              </label>

              <input
                type="file"
                multiple
                className="hidden"
                ref={fileInputRef}
                accept="image/*,application/pdf"
                onChange={handleFileChange}
                title="Upload POD Files"
              />
              <input
                type="file"
                className="hidden"
                ref={cameraInputRef}
                accept="image/*"
                onChange={handleFileChange}
                title="Take POD Photo"
              />

              <div className="grid grid-cols-2 gap-3 mb-3">
                <button
                  type="button"
                  onClick={triggerCamera}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-50 text-emerald-700 rounded-xl font-bold border border-emerald-100 hover:bg-emerald-100 transition-all text-xs"
                >
                  <Camera size={16} /> ถ่ายรูปด้วยกล้อง (Camera)
                </button>
                <button
                  type="button"
                  onClick={triggerUpload}
                  className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-50 text-blue-700 rounded-xl font-bold border border-blue-100 hover:bg-blue-100 transition-all text-xs"
                >
                  <Upload size={16} /> เลือกไฟล์ PDF/รูปภาพ (Upload File)
                </button>
              </div>

              <div
                id="pod-upload-trigger"
                onClick={uploadProgress === null ? triggerUpload : undefined}
                className={`group relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center gap-3 transition-all ${selectedFiles.length > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : uploadProgress !== null ? 'bg-blue-50 border-blue-300' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-emerald-300 hover:bg-emerald-50/30 cursor-pointer'}`}
              >
                {uploadProgress !== null ? (
                  <div className="w-full space-y-3 px-4">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-blue-600">
                      <span>Uploading / กำลังอัปโหลด...</span>
                      <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                      <div
                        ref={progressRef}
                        className="h-full bg-blue-500 transition-all duration-300 dynamic-width"
                      ></div>
                    </div>
                  </div>
                ) : selectedFiles.length > 0 ? (
                  <div className="w-full space-y-3">
                    {selectedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-emerald-100 relative group/item">
                        <div className="shrink-0 w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                          {file.type.includes('pdf') ? <FileText size={20} /> : <ImageIcon size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-black text-slate-700 truncate">{file.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          onClick={(e) => removeFileAt(idx, e)}
                          className="shrink-0 w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                          title="Remove file"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="pt-2 text-center">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-wider flex items-center justify-center gap-1">
                        <CheckCircle2 size={10} /> {selectedFiles.length} ไฟล์พร้อมบันทึก (Files Ready)
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); triggerUpload(); }}
                        className="mt-2 text-[10px] font-black text-blue-600 underline uppercase tracking-tighter"
                      >
                        + Add More / เพิ่มไฟล์เพิ่ม
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-white rounded-xl shadow-sm group-hover:scale-110 transition-transform">
                      <ImageIcon size={24} className="text-slate-300" />
                    </div>
                    <div className="text-center">
                      <span className="font-black text-xs uppercase text-slate-400 tracking-widest">No file selected / ยังไม่ได้เลือกไฟล์</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 transition-all cursor-pointer"
                  checked={isVerified}
                  onChange={e => setIsVerified(e.target.checked)}
                />
                <span className="text-xs font-bold text-slate-600 group-hover:text-slate-900 transition-colors uppercase tracking-tight">ข้าพเจ้ายืนยันว่าข้อมูลการส่งสินค้าและค่าใช้จ่ายทั้งหมดถูกต้อง (I certify that all data is accurate)</span>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-slate-50 px-6 py-4 md:px-8 md:py-6 flex flex-col md:flex-row justify-end gap-3 md:gap-4 border-t border-slate-100 shrink-0">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-3 rounded-xl font-black text-slate-500 hover:bg-white hover:text-slate-800 transition-all text-xs uppercase tracking-widest disabled:opacity-50"
          >
            ยกเลิก (Cancel)
          </button>
          <button
            onClick={handleConfirm}
            disabled={!actualArrival || selectedFiles.length === 0 || !isVerified || isSubmitting}
            className="bg-emerald-600 disabled:bg-slate-300 hover:bg-emerald-700 text-white px-12 py-3.5 rounded-xl font-black shadow-xl shadow-emerald-200 disabled:shadow-none transform hover:-translate-y-0.5 transition-all text-sm uppercase tracking-widest flex items-center gap-2"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                กำลังบันทึก (Saving...)
              </div>
            ) : (
              <><CheckCircle2 size={18} /> ยืนยันและจบงาน (Confirm & Complete)</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
