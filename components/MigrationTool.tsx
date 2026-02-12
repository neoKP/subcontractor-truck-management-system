import React, { useState } from 'react';
import { migrateBase64ToStorage, MigrationProgress } from '../utils/migrateBase64ToStorage';
import { Database, Upload, CheckCircle2, AlertTriangle, Loader2, HardDrive, Image as ImageIcon, FileText } from 'lucide-react';

const MigrationTool: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const [progress, setProgress] = useState<MigrationProgress>({
        totalJobs: 0,
        processedJobs: 0,
        totalImages: 0,
        migratedImages: 0,
        totalSlips: 0,
        migratedSlips: 0,
        errors: [],
        status: 'idle'
    });

    const handleMigrate = async () => {
        if (progress.status === 'running') return;

        const Swal = (window as any).Swal;
        if (Swal) {
            const result = await Swal.fire({
                icon: 'warning',
                title: '<span style="font-size:18px;font-weight:900">⚠️ ยืนยันการย้ายข้อมูล</span>',
                html: `
                    <div style="text-align:left;font-size:13px;color:#475569;line-height:1.8">
                        <p style="font-weight:700;color:#1e293b;margin-bottom:8px">การดำเนินการนี้จะ:</p>
                        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:12px 16px;margin-bottom:12px">
                            <p>1. อ่าน jobs และ invoices ทั้งหมด</p>
                            <p>2. Upload รูป Base64 ไป NAS Storage</p>
                            <p>3. เปลี่ยน Base64 ใน DB เป็น URL</p>
                        </div>
                        <p style="font-weight:800;color:#059669">✅ DB size จะลดจาก ~57MB เหลือ ~5MB</p>
                    </div>
                `,
                showCancelButton: true,
                confirmButtonText: '🚀 เริ่มย้ายข้อมูล',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#7c3aed',
                cancelButtonColor: '#94a3b8',
                customClass: { popup: 'rounded-[1.5rem]' },
                reverseButtons: true
            });
            if (!result.isConfirmed) return;
        } else {
            if (!window.confirm('ยืนยันการย้ายรูป Base64 ไป Firebase Storage?')) return;
        }

        setProgress(prev => ({ ...prev, status: 'running' }));
        await migrateBase64ToStorage((p) => setProgress(p));
    };

    const pct = progress.totalJobs > 0
        ? Math.round((progress.processedJobs / progress.totalJobs) * 100)
        : 0;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-600 px-8 py-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center text-white">
                            <Database size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-white">Migration Tool</h3>
                            <p className="text-violet-200 text-xs font-bold">ย้ายรูป Base64 → NAS Storage</p>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    {progress.status === 'idle' && (
                        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 space-y-3">
                            <div className="flex items-start gap-3">
                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                                <div className="space-y-2">
                                    <p className="font-bold text-amber-800 text-sm">สิ่งที่จะเกิดขึ้น:</p>
                                    <ul className="text-xs text-amber-700 space-y-1.5 font-medium">
                                        <li className="flex items-center gap-2"><ImageIcon size={12} /> รูป POD (podImageUrls) ที่เป็น Base64 → Upload ไป NAS</li>
                                        <li className="flex items-center gap-2"><FileText size={12} /> สลิปการจ่ายเงิน (paymentSlipUrl) ที่เป็น Base64 → Upload ไป NAS</li>
                                        <li className="flex items-center gap-2"><HardDrive size={12} /> DB size จะลดจาก ~57MB เหลือ ~5MB</li>
                                    </ul>
                                    <p className="text-[10px] text-amber-600 font-bold mt-2">* รูปที่เป็น URL อยู่แล้วจะไม่ถูกแตะต้อง</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {progress.status === 'running' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Loader2 className="animate-spin text-violet-500" size={24} />
                                <p className="font-bold text-violet-700">กำลังย้ายข้อมูล... อย่าปิดหน้านี้</p>
                            </div>

                            {/* Progress bar */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs font-bold text-slate-500">
                                    <span>Jobs: {progress.processedJobs}/{progress.totalJobs}</span>
                                    <span>{pct}%</span>
                                </div>
                                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-300"
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-blue-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-blue-600">{progress.migratedImages}</p>
                                    <p className="text-[10px] font-bold text-blue-400 uppercase">รูป POD ย้ายแล้ว</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-black text-emerald-600">{progress.migratedSlips}</p>
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase">สลิปย้ายแล้ว</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {progress.status === 'done' && (
                        <div className="space-y-4">
                            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-5 text-center space-y-3">
                                <CheckCircle2 className="text-emerald-500 mx-auto" size={48} />
                                <h4 className="text-lg font-black text-emerald-700">Migration สำเร็จ!</h4>
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="bg-white rounded-xl p-3">
                                        <p className="text-2xl font-black text-blue-600">{progress.migratedImages}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">รูป POD ย้ายแล้ว</p>
                                    </div>
                                    <div className="bg-white rounded-xl p-3">
                                        <p className="text-2xl font-black text-emerald-600">{progress.migratedSlips}</p>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase">สลิปย้ายแล้ว</p>
                                    </div>
                                </div>
                                {progress.totalImages === 0 && progress.totalSlips === 0 && (
                                    <p className="text-xs text-slate-500 font-medium">ไม่พบรูป Base64 ใน DB — อาจถูกย้ายไปแล้ว หรือยังไม่มีรูปในระบบ</p>
                                )}
                            </div>

                            {progress.errors.length > 0 && (
                                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-2">
                                    <p className="text-xs font-bold text-rose-600">⚠️ Errors ({progress.errors.length}):</p>
                                    <div className="max-h-32 overflow-y-auto space-y-1">
                                        {progress.errors.map((err, i) => (
                                            <p key={i} className="text-[10px] text-rose-500 font-mono">{err}</p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {progress.status === 'error' && (
                        <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 text-center space-y-2">
                            <AlertTriangle className="text-rose-500 mx-auto" size={48} />
                            <h4 className="text-lg font-black text-rose-700">เกิดข้อผิดพลาด</h4>
                            <div className="max-h-32 overflow-y-auto">
                                {progress.errors.map((err, i) => (
                                    <p key={i} className="text-xs text-rose-500 font-mono">{err}</p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-8 py-5 flex justify-end gap-3 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        disabled={progress.status === 'running'}
                        className="px-6 py-3 rounded-xl font-black text-slate-400 uppercase tracking-widest text-[10px] hover:bg-white hover:text-slate-600 transition-all disabled:opacity-30"
                    >
                        {progress.status === 'done' || progress.status === 'error' ? 'ปิด' : 'ยกเลิก'}
                    </button>
                    {(progress.status === 'idle' || progress.status === 'error') && (
                        <button
                            onClick={handleMigrate}
                            className="bg-gradient-to-r from-violet-600 to-purple-600 px-8 py-3 rounded-xl font-black text-white uppercase tracking-widest text-[10px] shadow-lg shadow-violet-200 hover:shadow-xl hover:shadow-violet-300 transition-all flex items-center gap-2"
                        >
                            <Upload size={14} />
                            เริ่มย้ายข้อมูล
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MigrationTool;
