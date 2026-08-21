import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Upload, FileSpreadsheet, AlertTriangle, CheckCircle2, X, Loader2,
    History, RotateCcw, Trash2, Info, Download,
} from 'lucide-react';
import Swal from 'sweetalert2';
import { parseFuelRateWorkbook, findRateAt, type ParseResult } from '../utils/fuelRateParser';
import {
    saveFuelRateVersion, listFuelRateVersions, activateFuelRateVersion,
    deleteFuelRateVersion, type FuelRateVersionMeta,
} from '../utils/fuelRateStore';
import { buildFuelRateTemplate, checkAgainstMaster, TEMPLATE_VERSION } from '../utils/fuelRateTemplate';
import { downloadWorkbook } from '../utils/excelReport';
import { MASTER_DATA } from '../constants';
import { useOilPrice } from '../utils/useOilPrice';

interface Props {
    /** ชื่อผู้ใช้ที่ล็อกอินอยู่ — บันทึกไว้ว่าใครอัปโหลด */
    currentUserName: string;
}

const ISSUE_LABEL: Record<string, string> = {
    'zero-price': 'ค่าขนส่งเป็น 0 บาท (ใช้คิดเงินไม่ได้)',
    'price-decreases': 'ค่าขนส่งลดลงทั้งที่ราคาน้ำมันสูงขึ้น',
    'missing-band': 'มีช่วงราคาน้ำมันที่ไม่ได้ระบุค่าขนส่ง',
    'duplicate-route': 'เส้นทางและประเภทรถซ้ำกัน',
    'no-bands': 'แถวที่ไม่มีค่าขนส่งเลย',
    'side-table-unreadable': 'เจอตารางย่อยแต่อ่านไม่ได้ (ยังไม่ได้นำเข้า)',
    'unknown-subcontractor': 'ตรวจชื่อผู้รับจ้าง (คอลัมน์บริษัท)',
    'unknown-truck-type': 'ตรวจชื่อประเภทรถ',
    'unknown-location': 'ตรวจชื่อต้นทาง/ปลายทาง',
};

const formatDateTime = (iso: string): string => {
    if (!iso) return '-';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
};

const FuelRateUploadView: React.FC<Props> = ({ currentUserName }) => {
    const live = useOilPrice();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [dragging, setDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [preview, setPreview] = useState<ParseResult | null>(null);
    const [fileName, setFileName] = useState('');
    const [note, setNote] = useState('');
    const [error, setError] = useState('');

    const [versions, setVersions] = useState<FuelRateVersionMeta[]>([]);
    const [activeId, setActiveId] = useState<string | null>(null);
    const [loadingVersions, setLoadingVersions] = useState(true);

    const refreshVersions = useCallback(async () => {
        setLoadingVersions(true);
        try {
            const { versions: v, activeId: a } = await listFuelRateVersions();
            setVersions(v);
            setActiveId(a);
        } catch (e) {
            console.error('[FuelRateUpload] โหลดประวัติไม่สำเร็จ:', e);
        } finally {
            setLoadingVersions(false);
        }
    }, []);

    useEffect(() => { void refreshVersions(); }, [refreshVersions]);

    const handleFile = useCallback(async (file: File) => {
        if (!/\.xlsx?$/i.test(file.name)) {
            setError('รองรับเฉพาะไฟล์ Excel (.xlsx หรือ .xls) เท่านั้น');
            setPreview(null);
            return;
        }
        setParsing(true);
        setError('');
        setPreview(null);
        try {
            const buf = await file.arrayBuffer();
            const result = parseFuelRateWorkbook(buf);
            if (!result.rows.length) {
                setError('อ่านไฟล์ได้ แต่ไม่พบเส้นทางเลยสักรายการ — ตรวจสอบว่าเลือกไฟล์ถูกหรือไม่');
                return;
            }
            // ไฟล์ที่กรอกจากแบบฟอร์มของเราควรใช้ชื่อชุดเดียวกับระบบ จึงตรวจให้ตั้งแต่ตอนพรีวิว
            // ไฟล์ต้นฉบับของหน่วยงานไม่ตรวจ เพราะเขาใช้ชื่อคนละชุด จะเตือนทุกแถวจนอ่านไม่รู้เรื่อง
            const nameIssues = result.isTemplate ? checkAgainstMaster(result.rows, MASTER_DATA) : [];
            setPreview({ ...result, issues: [...result.issues, ...nameIssues] });
            setFileName(file.name);
        } catch (e) {
            setError((e as Error).message || 'อ่านไฟล์ไม่สำเร็จ');
        } finally {
            setParsing(false);
        }
    }, []);

    const handleDownloadTemplate = async () => {
        const buf = await buildFuelRateTemplate(MASTER_DATA);
        downloadWorkbook(buf, `แบบฟอร์มตารางเรทค่าขนส่ง_${TEMPLATE_VERSION}`);
    };

    const onDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void handleFile(file);
    };

    const handleSave = async () => {
        if (!preview) return;

        // มีปัญหาในไฟล์ → ต้องยืนยันก่อน ไม่ให้กดผ่านโดยไม่ได้อ่าน
        if (preview.issues.length) {
            // สร้างเป็น DOM node ไม่ใช่สตริง HTML — ข้อความ issue มีชื่อบริษัท/เส้นทาง
            // ที่มาจากไฟล์ Excel ถ้าต่อเป็น HTML ไฟล์ที่ถูกดัดแปลงจะรันสคริปต์ในเบราว์เซอร์ได้
            const container = document.createElement('div');
            container.style.cssText = 'text-align:left;font-size:13px;line-height:1.7';
            for (const iss of preview.issues) {
                const line = document.createElement('div');
                const label = document.createElement('b');
                label.textContent = `• ${ISSUE_LABEL[iss.kind] || iss.kind}: `;
                line.appendChild(label);
                line.appendChild(document.createTextNode(iss.message));
                container.appendChild(line);
            }
            const footer = document.createElement('div');
            footer.style.marginTop = '12px';
            const strong = document.createElement('b');
            strong.textContent = 'ระบบจะบันทึกตัวเลขตามไฟล์ทุกช่อง ไม่แก้ให้';
            footer.appendChild(strong);
            footer.appendChild(document.createElement('br'));
            footer.appendChild(document.createTextNode(
                'แนะนำให้สอบถามหน่วยงานก่อน หากยืนยันว่าถูกต้องแล้วจึงบันทึก'
            ));
            container.appendChild(footer);

            const confirmed = await Swal.fire({
                icon: 'warning',
                title: 'ไฟล์นี้มีจุดที่ควรตรวจสอบ',
                html: container,
                showCancelButton: true,
                confirmButtonText: 'ยืนยัน บันทึกเลย',
                cancelButtonText: 'ยกเลิก',
                confirmButtonColor: '#d97706',
                cancelButtonColor: '#64748b',
                width: 640,
            });
            if (!confirmed.isConfirmed) return;
        }

        setSaving(true);
        try {
            await saveFuelRateVersion({
                fileName,
                uploadedBy: currentUserName,
                layout: preview.layout,
                issues: preview.issues,
                note: note.trim(),
                rows: preview.rows,
            });
            await Swal.fire({
                icon: 'success',
                title: 'บันทึกเรียบร้อย',
                text: `บันทึก ${preview.rows.length} เส้นทาง และตั้งเป็นรุ่นที่ใช้งานแล้ว`,
                timer: 2200,
                showConfirmButton: false,
            });
            setPreview(null);
            setFileName('');
            setNote('');
            if (fileInputRef.current) fileInputRef.current.value = '';
            await refreshVersions();
        } catch (e) {
            await Swal.fire({
                icon: 'error',
                title: 'บันทึกไม่สำเร็จ',
                text: (e as Error).message,
            });
        } finally {
            setSaving(false);
        }
    };

    const handleActivate = async (v: FuelRateVersionMeta) => {
        const confirmed = await Swal.fire({
            icon: 'question',
            title: 'เปลี่ยนไปใช้รุ่นนี้?',
            text: `${v.fileName} · อัปโหลดเมื่อ ${formatDateTime(v.uploadedAt)} · ${v.rowCount} เส้นทาง`,
            showCancelButton: true,
            confirmButtonText: 'เปลี่ยน',
            cancelButtonText: 'ยกเลิก',
        });
        if (!confirmed.isConfirmed) return;
        try {
            await activateFuelRateVersion(v.id);
            await refreshVersions();
        } catch (e) {
            await Swal.fire({ icon: 'error', title: 'เปลี่ยนไม่สำเร็จ', text: (e as Error).message });
        }
    };

    const handleDelete = async (v: FuelRateVersionMeta) => {
        const confirmed = await Swal.fire({
            icon: 'warning',
            title: 'ลบรุ่นนี้?',
            text: `${v.fileName} — ลบแล้วกู้คืนไม่ได้`,
            showCancelButton: true,
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#dc2626',
        });
        if (!confirmed.isConfirmed) return;
        try {
            await deleteFuelRateVersion(v.id);
            await refreshVersions();
        } catch (e) {
            await Swal.fire({ icon: 'error', title: 'ลบไม่สำเร็จ', text: (e as Error).message });
        }
    };

    // ตัวอย่างที่แสดง — จำกัดจำนวนแถวเพื่อไม่ให้หน้าหนัก
    const previewRows = preview?.rows.slice(0, 12) ?? [];
    const pricedAtToday = preview
        ? preview.rows.filter(r => findRateAt(r, live.diesel) !== null).length
        : 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 sm:gap-6 bg-slate-900 p-4 sm:p-8 rounded-2xl sm:rounded-[3rem] shadow-2xl text-white">
                <div className="flex items-center gap-4 sm:gap-5">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-500/10 backdrop-blur-xl rounded-xl sm:rounded-[2rem] flex items-center justify-center text-blue-400 border border-blue-500/20 shadow-inner shrink-0">
                        <Upload size={28} />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-3xl font-black tracking-tight">อัปโหลดเรทค่าขนส่ง</h2>
                        <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] mt-1">
                            Fuel-Indexed Rate Upload
                        </p>
                        <p className="text-slate-400 text-[11px] sm:text-xs mt-1.5">
                            อัปโหลดไฟล์ Excel ที่หน่วยงานอัตราจ้างส่งมา · เก็บทุกรุ่น ย้อนกลับได้
                        </p>
                    </div>
                </div>
            </div>

            {/* คำอธิบายหลักการ */}
            <div className="flex items-start gap-2 px-5 py-4 rounded-[1.5rem] bg-blue-50 border border-blue-100">
                <Info size={15} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    ระบบจะ<b>บันทึกตัวเลขตามไฟล์ทุกช่อง ไม่คำนวณและไม่เติมเอง</b> เพราะเรทนี้หน่วยงานเป็นผู้กำหนด ·
                    หากพบจุดที่ดูผิดปกติ ระบบจะแจ้งเตือนให้ตรวจสอบ แต่จะไม่แก้ไขค่าให้
                </p>
            </div>

            {/* แบบฟอร์มสำหรับให้หน่วยงานกรอก */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <Download size={18} className="text-blue-600" /> แบบฟอร์มสำหรับหน่วยงาน
                    </h3>
                    <p className="text-[11px] text-slate-500 font-medium mt-1.5 leading-relaxed max-w-2xl">
                        ส่งไฟล์นี้ให้หน่วยงานอัตราจ้างกรอกแทนรูปแบบเดิม · ในไฟล์มี<b>ทะเบียนชื่อผู้รับจ้าง สถานที่ และประเภทรถ</b>ของระบบแนบไว้ให้คัดลอก
                        พร้อมตัวอย่างการกรอกและวิธีใช้ · เมื่ออัปโหลดกลับ ระบบจะตรวจให้ทันทีว่าชื่อตรงทะเบียนหรือไม่
                    </p>
                </div>
                <button
                    onClick={handleDownloadTemplate}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                    <Download size={15} /> ดาวน์โหลดแบบฟอร์ม
                </button>
            </div>

            {/* Dropzone */}
            <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`rounded-[2.5rem] border-2 border-dashed transition-all p-10 text-center ${dragging
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
            >
                {parsing ? (
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 size={32} className="animate-spin text-blue-600" />
                        <p className="text-xs font-black uppercase tracking-widest">กำลังอ่านไฟล์...</p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 mx-auto rounded-[2rem] bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
                            <FileSpreadsheet size={30} />
                        </div>
                        <p className="text-sm font-black text-slate-900">ลากไฟล์ Excel มาวางที่นี่</p>
                        <p className="text-[11px] text-slate-400 font-medium mt-1 mb-5">รองรับ .xlsx และ .xls</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-slate-900 hover:bg-slate-800 text-white px-6 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:scale-105 active:scale-95"
                        >
                            เลือกไฟล์
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={e => {
                                const f = e.target.files?.[0];
                                if (f) void handleFile(f);
                            }}
                        />
                    </>
                )}
            </div>

            {error && (
                <div className="flex items-start gap-2 px-5 py-4 rounded-[1.5rem] bg-red-50 border border-red-100">
                    <X size={15} className="text-red-600 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-red-700 font-bold">{error}</p>
                </div>
            )}

            {/* ตัวอย่างก่อนบันทึก */}
            {preview && (
                <div className="space-y-4">
                    <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                                <CheckCircle2 size={18} className="text-emerald-600" />
                                ตรวจสอบก่อนบันทึก
                            </h3>
                            <span className="text-[10px] text-slate-400 font-bold truncate">{fileName}</span>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                            {[
                                { label: 'เส้นทางทั้งหมด', value: String(preview.rows.length) },
                                { label: 'บริษัท', value: String(new Set(preview.rows.map(r => r.company).filter(Boolean)).size) },
                                { label: 'ช่วงราคาน้ำมัน', value: String(preview.rows[0]?.bands.length ?? 0) },
                                { label: `มีเรทที่ ${live.diesel.toFixed(2)} บาท`, value: `${pricedAtToday}/${preview.rows.length}` },
                            ].map((s, i) => (
                                <div key={i} className="bg-slate-50 rounded-2xl p-4">
                                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{s.label}</p>
                                    <p className="text-xl font-black text-slate-900 tabular-nums">{s.value}</p>
                                </div>
                            ))}
                        </div>

                        {preview.issues.length > 0 && (
                            <div className="rounded-[1.5rem] bg-amber-50 border border-amber-100 p-5 mb-6">
                                <div className="flex items-center gap-2 mb-3">
                                    <AlertTriangle size={15} className="text-amber-600" />
                                    <span className="text-[11px] font-black uppercase tracking-widest text-amber-700">
                                        พบ {preview.issues.length} จุดที่ควรสอบถามหน่วยงาน
                                    </span>
                                </div>
                                <ul className="space-y-2">
                                    {preview.issues.map((iss, i) => (
                                        <li key={i} className="text-[11px] text-slate-700 leading-relaxed">
                                            <b>{ISSUE_LABEL[iss.kind] || iss.kind}</b> — {iss.message}
                                        </li>
                                    ))}
                                </ul>
                                <p className="text-[10px] text-amber-700 font-bold mt-3">
                                    ระบบจะบันทึกตามไฟล์ ไม่แก้ให้ · คัดลอกข้อความนี้ส่งถามหน่วยงานได้
                                </p>
                            </div>
                        )}

                        <div className="overflow-x-auto mb-5">
                            <table className="w-full text-sm min-w-[720px]">
                                <thead>
                                    <tr className="bg-slate-900 text-white">
                                        <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest rounded-l-2xl">บริษัท</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">ต้นทาง</th>
                                        <th className="px-3 py-2.5 text-left text-[10px] font-black uppercase tracking-widest">ปลายทาง</th>
                                        <th className="px-3 py-2.5 text-center text-[10px] font-black uppercase tracking-widest">รถ</th>
                                        <th className="px-3 py-2.5 text-right text-[10px] font-black uppercase tracking-widest rounded-r-2xl">
                                            เรทที่ {live.diesel.toFixed(2)} บาท
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewRows.map((r, i) => {
                                        const hit = findRateAt(r, live.diesel);
                                        return (
                                            <tr key={i} className={`border-b border-slate-100 ${i % 2 ? 'bg-slate-50/60' : ''}`}>
                                                <td className="px-3 py-2 text-slate-700 font-bold">{r.company || '-'}</td>
                                                <td className="px-3 py-2 text-slate-600">{r.origin || '-'}</td>
                                                <td className="px-3 py-2 text-slate-600">
                                                    {r.destination || '-'}
                                                    {r.section && (
                                                        <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-black whitespace-nowrap">{r.section}</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center text-slate-500 font-bold">{r.truckType || '-'}</td>
                                                <td className={`px-3 py-2 text-right tabular-nums font-black ${hit ? 'text-slate-900' : 'text-amber-600'}`}>
                                                    {hit ? hit.price!.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'ไม่มีเรท'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {preview.rows.length > previewRows.length && (
                                <p className="text-[10px] text-slate-400 font-bold mt-2 text-center">
                                    แสดง {previewRows.length} จาก {preview.rows.length} เส้นทาง
                                </p>
                            )}
                        </div>

                        <input
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            placeholder="หมายเหตุ เช่น รอบปรับเดือนสิงหาคม (ไม่บังคับ)"
                            maxLength={200}
                            className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-medium outline-none focus:border-slate-400 mb-4"
                        />

                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-6 py-3 rounded-[1.5rem] flex items-center gap-2 text-xs font-black uppercase tracking-widest transition-all shadow-lg hover:scale-105 active:scale-95"
                            >
                                {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                บันทึกและใช้งานรุ่นนี้
                            </button>
                            <button
                                onClick={() => { setPreview(null); setError(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                                disabled={saving}
                                className="bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 px-6 py-3 rounded-[1.5rem] text-xs font-black uppercase tracking-widest transition-all"
                            >
                                ยกเลิก
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ประวัติการอัปโหลด */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-5">
                    <History size={18} className="text-blue-600" />
                    ประวัติการอัปโหลด ({versions.length})
                </h3>

                {loadingVersions ? (
                    <div className="py-8 text-center text-slate-400">
                        <Loader2 size={22} className="animate-spin mx-auto" />
                    </div>
                ) : versions.length === 0 ? (
                    <p className="py-8 text-center text-slate-400 text-xs font-bold">
                        ยังไม่เคยอัปโหลดไฟล์เรท
                    </p>
                ) : (
                    <div className="space-y-2">
                        {versions.map(v => (
                            <div
                                key={v.id}
                                className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 rounded-[1.5rem] border ${v.id === activeId ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-100'
                                    }`}
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-xs font-black text-slate-900 truncate">{v.fileName}</span>
                                        {v.id === activeId && (
                                            <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[9px] font-black uppercase">
                                                ใช้งานอยู่
                                            </span>
                                        )}
                                        {v.issues.length > 0 && (
                                            <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-700 text-[9px] font-black uppercase">
                                                {v.issues.length} คำเตือน
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-medium mt-1">
                                        {formatDateTime(v.uploadedAt)} · {v.uploadedBy || 'ไม่ระบุ'} · {v.rowCount} เส้นทาง
                                        {v.note && ` · ${v.note}`}
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    {v.id !== activeId && (
                                        <>
                                            <button
                                                onClick={() => handleActivate(v)}
                                                title="เปลี่ยนมาใช้รุ่นนี้"
                                                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                            >
                                                <RotateCcw size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(v)}
                                                title="ลบรุ่นนี้"
                                                className="p-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-red-600 hover:border-red-200 transition-colors"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default FuelRateUploadView;
