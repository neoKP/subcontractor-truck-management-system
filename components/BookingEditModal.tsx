
import React, { useState, useRef } from 'react';
import { Job, UserRole, AuditLog, PriceMatrix, AccountingStatus } from '../types';
import { MASTER_DATA } from '../constants';
import { X, Edit3, MapPin, Truck, ShieldAlert, BadgeCheck, Zap, ShieldCheck, Camera, Upload, Image as ImageIcon, FileText, Trash2, ChevronDown } from 'lucide-react';

interface BookingEditModalProps {
    job: Job;
    onClose: () => void;
    onSave: (job: Job, logs?: AuditLog[]) => void;
    user: { id: string; name: string; role: UserRole };
    priceMatrix: PriceMatrix[];
}

const BookingEditModal: React.FC<BookingEditModalProps> = ({ job, onClose, onSave, user, priceMatrix }) => {
    // Pricing Intelligence Logic
    const findContractMatch = (origin: string, dest: string, truck: string, sub?: string) => {
        if (!origin || !dest || !truck) return null;

        // Find all matches for this route/truck
        const matches = priceMatrix.filter(p => {
            const originMatch = p.origin === origin;
            const destMatch = p.destination === dest;
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
            driverName: job.driverName || '',
            driverPhone: job.driverPhone || '',
            licensePlate: job.licensePlate || '',
            cost: job.cost || (contract ? contract.basePrice : 0),
            sellingPrice: job.sellingPrice || (contract ? contract.sellingBasePrice : 0)
        };
    });

    const allMatches = (!editData.origin || !editData.destination || !editData.truckType)
        ? []
        : priceMatrix.filter(p => {
            const originMatch = p.origin === editData.origin;
            const destMatch = p.destination === editData.destination;
            const truckMatch = p.truckType === editData.truckType;
            return originMatch && destMatch && truckMatch;
        });

    const activeContract = findContractMatch(editData.origin, editData.destination, editData.truckType, editData.subcontractor)
        || findContractMatch(editData.origin, editData.destination, editData.truckType);

    const hasContractPrice = activeContract !== null && editData.origin && editData.destination && editData.truckType;

    const [reason, setReason] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Searchable Input States
    const [originQuery, setOriginQuery] = useState('');
    const [destQuery, setDestQuery] = useState('');
    const [subQuery, setSubQuery] = useState('');
    const [showOriginList, setShowOriginList] = useState(false);
    const [showDestList, setShowDestList] = useState(false);
    const [showSubList, setShowSubList] = useState(false);

    // POD Image Management States
    const [podImages, setPodImages] = useState<string[]>(job.podImageUrls || []);
    const [newPodFiles, setNewPodFiles] = useState<File[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    // Check if this is a rejected job (show POD section only for rejected jobs)
    const isRejectedJob = job.accountingStatus === AccountingStatus.REJECTED;

    // Handle file selection for POD
    const handlePodFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []) as File[];
        if (files.length > 0) {
            const oversizedFiles = files.filter(f => f.size > 10 * 1024 * 1024);
            if (oversizedFiles.length > 0) {
                if (typeof (window as any).Swal !== 'undefined') {
                    (window as any).Swal.fire({
                        title: 'ไฟล์ใหญ่เกินไป / File Too Large',
                        text: 'ไฟล์ต้องมีขนาดไม่เกิน 10MB',
                        icon: 'warning',
                        confirmButtonColor: '#2563eb'
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
                    setNewPodFiles(prev => [...prev, ...files]);
                    setTimeout(() => setUploadProgress(null), 500);
                } else {
                    setUploadProgress(progress);
                }
            }, 100);
        }
    };

    // Remove existing POD image
    const removeExistingPod = (index: number) => {
        setPodImages(prev => prev.filter((_, i) => i !== index));
    };

    // Remove new POD file
    const removeNewPodFile = (index: number) => {
        setNewPodFiles(prev => prev.filter((_, i) => i !== index));
    };

    // Convert file to base64 with compression
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            if (!file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = error => reject(error);
                return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const MAX_SIZE = 1280;

                    if (width > height && width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    } else if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                        ctx.drawImage(img, 0, 0, width, height);
                        resolve(canvas.toDataURL('image/jpeg', 0.7));
                    } else {
                        resolve(reader.result as string);
                    }
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = error => reject(error);
        });
    };

    const handleSave = async () => {
        if (isSubmitting) return;

        // Check for POD image changes
        const originalPodCount = (job.podImageUrls || []).length;
        const newPodCount = podImages.length + newPodFiles.length;
        const podImagesChanged = originalPodCount !== podImages.length || newPodFiles.length > 0;

        const hasChanged =
            job.origin !== editData.origin ||
            job.destination !== editData.destination ||
            job.truckType !== editData.truckType ||
            job.driverName !== editData.driverName ||
            job.driverPhone !== editData.driverPhone ||
            job.licensePlate !== editData.licensePlate ||
            (job.subcontractor || '') !== editData.subcontractor ||
            podImagesChanged;

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

        // Convert new files to base64
        let newPodBase64: string[] = [];
        if (newPodFiles.length > 0) {
            try {
                newPodBase64 = await Promise.all(newPodFiles.map(f => fileToBase64(f)));
            } catch (err) {
                console.error('Error converting POD files:', err);
            }
        }

        await new Promise(resolve => setTimeout(resolve, 500));

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
        if (job.driverName !== editData.driverName) {
            logs.push(createLog('Driver Name', job.driverName || 'None', editData.driverName || 'None'));
        }
        if (job.driverPhone !== editData.driverPhone) {
            logs.push(createLog('Driver Phone', job.driverPhone || 'None', editData.driverPhone || 'None'));
        }
        if (job.licensePlate !== editData.licensePlate) {
            logs.push(createLog('License Plate', job.licensePlate || 'None', editData.licensePlate || 'None'));
        }
        if ((job.sellingPrice || 0) !== (editData.sellingPrice || 0)) {
            logs.push(createLog('Selling Price', (job.sellingPrice || 0).toString(), (editData.sellingPrice || 0).toString()));
        }
        if (podImagesChanged) {
            logs.push(createLog('POD Images', `${originalPodCount} รูป`, `${newPodCount} รูป (แก้ไขใหม่)`));
        }

        // Merge existing (retained) POD images with new ones
        const finalPodImageUrls = [...podImages, ...newPodBase64];

        const updatedJob: Job = {
            ...job,
            origin: editData.origin,
            destination: editData.destination,
            truckType: editData.truckType,
            subcontractor: editData.subcontractor,
            driverName: editData.driverName,
            driverPhone: editData.driverPhone,
            licensePlate: editData.licensePlate,
            cost: editData.cost || 0,
            sellingPrice: editData.sellingPrice || 0,
            podImageUrls: finalPodImageUrls.length > 0 ? finalPodImageUrls : undefined
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
                        {/* Origin Input (Searchable) */}
                        <div className="space-y-2 relative">
                            <label htmlFor="origin-input" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MapPin size={12} className="text-blue-500" /> Origin / ต้นทาง
                            </label>
                            <div className="relative group">
                                <input
                                    id="origin-input"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Type or select origin..."
                                    className="w-full pl-4 pr-16 py-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:font-normal"
                                    value={originQuery !== '' ? originQuery : (editData.origin || '')}
                                    onFocus={() => {
                                        setOriginQuery('');
                                        setShowOriginList(true);
                                    }}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setOriginQuery(val);
                                        setEditData(prev => ({ ...prev, origin: val }));

                                        // Recalculate price if contract exists
                                        const contract = findContractMatch(val, editData.destination, editData.truckType, editData.subcontractor)
                                            || findContractMatch(val, editData.destination, editData.truckType);
                                        if (contract) setEditData(prev => ({ ...prev, cost: contract.basePrice }));
                                    }}
                                    onBlur={() => setTimeout(() => {
                                        setShowOriginList(false);
                                        setOriginQuery('');
                                    }, 200)}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {editData.origin && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditData({ ...editData, origin: '' });
                                                setOriginQuery('');
                                            }}
                                            title="Clear origin"
                                            className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setShowOriginList(!showOriginList);
                                        }}
                                        title="Toggle Origin List"
                                        className={`p-1 transition-transform duration-300 ${showOriginList ? 'rotate-180 text-blue-500' : 'text-slate-300 hover:text-blue-500'}`}
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                </div>
                            </div>
                            {showOriginList && (
                                <div className="absolute z-[60] w-full mt-1 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 max-h-60 overflow-y-auto py-2 animate-in fade-in zoom-in-95 duration-200">
                                    {MASTER_DATA.locations
                                        .filter(l => l.toLowerCase().includes(originQuery.toLowerCase()))
                                        .map((l, i) => {
                                            const isSelected = editData.origin === l;
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className={`w-full text-left px-6 py-3 text-sm font-bold transition-colors flex items-center justify-between group ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                    onClick={() => {
                                                        setEditData(prev => {
                                                            const newData = { ...prev, origin: l };
                                                            const contract = findContractMatch(l, prev.destination, prev.truckType, prev.subcontractor)
                                                                || findContractMatch(l, prev.destination, prev.truckType);
                                                            if (contract) newData.cost = contract.basePrice;
                                                            return newData;
                                                        });
                                                        setOriginQuery('');
                                                        setShowOriginList(false);
                                                    }}
                                                >
                                                    <span>{l}</span>
                                                    {(isSelected || originQuery === l) && <BadgeCheck size={14} className="text-blue-500" />}
                                                    {!isSelected && <BadgeCheck size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                </button>
                                            );
                                        })}
                                    {MASTER_DATA.locations.filter(l => l.toLowerCase().includes(originQuery.toLowerCase())).length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400 font-bold italic">
                                            No matching locations found...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Destination Input (Searchable) */}
                        <div className="space-y-2 relative">
                            <label htmlFor="destination-input" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <MapPin size={12} className="text-orange-500" /> Destination / ปลายทาง
                            </label>
                            <div className="relative group">
                                <input
                                    id="destination-input"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Type or select destination..."
                                    className="w-full pl-4 pr-16 py-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:font-normal"
                                    value={destQuery !== '' ? destQuery : (editData.destination || '')}
                                    onFocus={() => {
                                        setDestQuery('');
                                        setShowDestList(true);
                                    }}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setDestQuery(val);
                                        setEditData(prev => ({ ...prev, destination: val }));

                                        // Recalculate price if contract exists
                                        const contract = findContractMatch(editData.origin, val, editData.truckType, editData.subcontractor)
                                            || findContractMatch(editData.origin, val, editData.truckType);
                                        if (contract) setEditData(prev => ({ ...prev, cost: contract.basePrice }));
                                    }}
                                    onBlur={() => setTimeout(() => {
                                        setShowDestList(false);
                                        setDestQuery('');
                                    }, 200)}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {editData.destination && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditData({ ...editData, destination: '' });
                                                setDestQuery('');
                                            }}
                                            title="Clear destination"
                                            className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            setShowDestList(!showDestList);
                                        }}
                                        title="Toggle Destination List"
                                        className={`p-1 transition-transform duration-300 ${showDestList ? 'rotate-180 text-blue-500' : 'text-slate-300 hover:text-blue-500'}`}
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                </div>
                            </div>
                            {showDestList && (
                                <div className="absolute z-[60] w-full mt-1 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 max-h-60 overflow-y-auto py-2 animate-in fade-in zoom-in-95 duration-200">
                                    {MASTER_DATA.locations
                                        .filter(l => l.toLowerCase().includes(destQuery.toLowerCase()))
                                        .map((l, i) => {
                                            const isSelected = editData.destination === l;
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className={`w-full text-left px-6 py-3 text-sm font-bold transition-colors flex items-center justify-between group ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                    onClick={() => {
                                                        setEditData(prev => {
                                                            const newData = { ...prev, destination: l };
                                                            const contract = findContractMatch(prev.origin, l, prev.truckType, prev.subcontractor)
                                                                || findContractMatch(prev.origin, l, prev.truckType);
                                                            if (contract) newData.cost = contract.basePrice;
                                                            return newData;
                                                        });
                                                        setDestQuery('');
                                                        setShowDestList(false);
                                                    }}
                                                >
                                                    <span>{l}</span>
                                                    {(isSelected || destQuery === l) && <BadgeCheck size={14} className="text-blue-500" />}
                                                    {!isSelected && <BadgeCheck size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                </button>
                                            );
                                        })}
                                    {MASTER_DATA.locations.filter(l => l.toLowerCase().includes(destQuery.toLowerCase())).length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400 font-bold italic">
                                            No matching locations found...
                                        </div>
                                    )}
                                </div>
                            )}
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

                        <div className="space-y-2 relative">
                            <label htmlFor="subcontractor-input" className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <Truck size={12} className="text-emerald-500" /> Subcontractor / บริษัทรถร่วม
                            </label>
                            <div className="relative group">
                                <input
                                    id="subcontractor-input"
                                    type="text"
                                    autoComplete="off"
                                    placeholder="Type or select subcontractor..."
                                    className="w-full pl-4 pr-16 py-4 rounded-xl border border-slate-200 bg-slate-50 font-bold text-slate-800 outline-none focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all placeholder:font-normal"
                                    value={subQuery !== '' ? subQuery : (editData.subcontractor || '')}
                                    onFocus={() => {
                                        setSubQuery(''); // Clear query to show full list on focus
                                        setShowSubList(true);
                                    }}
                                    onChange={e => {
                                        const val = e.target.value;
                                        setSubQuery(val);
                                        setEditData(prev => ({ ...prev, subcontractor: val }));

                                        // Recalculate price if contract exists
                                        const contract = findContractMatch(editData.origin, editData.destination, editData.truckType, val)
                                            || findContractMatch(editData.origin, editData.destination, editData.truckType);
                                        if (contract) setEditData(prev => ({ ...prev, cost: contract.basePrice }));
                                    }}
                                    onBlur={() => setTimeout(() => {
                                        setShowSubList(false);
                                        setSubQuery(''); // Reset query on blur
                                    }, 200)}
                                />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                                    {editData.subcontractor && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditData({ ...editData, subcontractor: '' });
                                                setSubQuery('');
                                            }}
                                            title="Clear subcontractor"
                                            className="text-slate-300 hover:text-rose-500 p-1 transition-colors"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onMouseDown={(e) => {
                                            e.preventDefault(); // Prevent blur & focus
                                            setShowSubList(!showSubList);
                                        }}
                                        title="Toggle Subcontractor List"
                                        aria-label="Toggle Subcontractor List"
                                        className={`p-1 transition-transform duration-300 ${showSubList ? 'rotate-180 text-blue-500' : 'text-slate-300 hover:text-blue-500'}`}
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                </div>
                            </div>
                            {showSubList && (
                                <div className="absolute z-[60] w-full mt-1 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-100 max-h-64 overflow-y-auto py-2 animate-in fade-in zoom-in-95 duration-200">
                                    <button
                                        type="button"
                                        className="w-full text-left px-4 py-3 hover:bg-emerald-50 text-sm font-bold text-emerald-600 transition-colors border-b border-slate-50 italic flex items-center gap-2"
                                        onClick={() => {
                                            setEditData(prev => ({ ...prev, subcontractor: '' }));
                                            setSubQuery('');
                                            setShowSubList(false);
                                        }}
                                    >
                                        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                        <span>Waiting Assignment / รอจัดสรร</span>
                                    </button>
                                    {MASTER_DATA.subcontractors
                                        .filter(s => s.toLowerCase().includes(subQuery.toLowerCase()))
                                        .map((s, i) => {
                                            const isSelected = editData.subcontractor === s;
                                            return (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    className={`w-full text-left px-6 py-3 text-sm font-bold transition-colors flex items-center justify-between group ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-slate-50 text-slate-700'}`}
                                                    onClick={() => {
                                                        setEditData(prev => {
                                                            const newData = { ...prev, subcontractor: s };
                                                            const contract = findContractMatch(prev.origin, prev.destination, prev.truckType, s)
                                                                || findContractMatch(prev.origin, prev.destination, prev.truckType);
                                                            if (contract) newData.cost = contract.basePrice;
                                                            return newData;
                                                        });
                                                        setSubQuery('');
                                                        setShowSubList(false);
                                                    }}
                                                >
                                                    <span>{s}</span>
                                                    {(isSelected || subQuery === s) && <BadgeCheck size={14} className="text-blue-500" />}
                                                    {!isSelected && <BadgeCheck size={14} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                                </button>
                                            );
                                        })}
                                    {MASTER_DATA.subcontractors.filter(s => s.toLowerCase().includes(subQuery.toLowerCase())).length === 0 && (
                                        <div className="p-4 text-center text-xs text-slate-400 font-bold italic">
                                            No matching companies found...
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Driver & Truck Info Section */}
                        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-4 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="p-1 px-2 bg-slate-900 text-white rounded text-[9px] font-black uppercase tracking-widest">Fleet Details</div>
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ข้อมูลคนขับและทะเบียนรถ</p>
                            </div>

                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between ml-1 leading-none">
                                        <label htmlFor="edit-driver-name" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ชื่อคนขับ (Driver Name)</label>
                                        <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 italic">Required for Dispatch *</span>
                                    </div>
                                    <input
                                        id="edit-driver-name"
                                        type="text"
                                        placeholder="ระบุชื่อพนักงานขับรถ..."
                                        className={`w-full px-4 py-2.5 rounded-xl border font-bold text-slate-800 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm ${!editData.driverName ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}
                                        value={editData.driverName}
                                        onChange={e => setEditData({ ...editData, driverName: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between ml-1 leading-none">
                                            <label htmlFor="edit-driver-phone" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">เบอร์โทร (Phone)</label>
                                            <span className="text-rose-500 font-bold text-[10px]">*</span>
                                        </div>
                                        <input
                                            id="edit-driver-phone"
                                            type="tel"
                                            placeholder="0xx-xxx-xxxx"
                                            className={`w-full px-4 py-2.5 rounded-xl border font-bold text-slate-800 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm ${!editData.driverPhone ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}
                                            value={editData.driverPhone}
                                            onChange={e => setEditData({ ...editData, driverPhone: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between ml-1 leading-none">
                                            <label htmlFor="edit-license-plate" className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ทะเบียนรถ (Plate)</label>
                                            <span className="text-rose-500 font-bold text-[10px]">*</span>
                                        </div>
                                        <input
                                            id="edit-license-plate"
                                            type="text"
                                            placeholder="ตัวอย่าง 70-1234"
                                            className={`w-full px-4 py-2.5 rounded-xl border font-bold text-slate-800 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-sm ${!editData.licensePlate ? 'border-rose-200 bg-rose-50/30' : 'border-slate-200 bg-white'}`}
                                            value={editData.licensePlate}
                                            onChange={e => setEditData({ ...editData, licensePlate: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
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
                                            {allMatches.slice(0, 3).map((p, idx) => {
                                                const isSelected = p.subcontractor === editData.subcontractor;
                                                return (
                                                    <button
                                                        key={idx}
                                                        type="button"
                                                        onClick={() => {
                                                            setEditData(prev => ({
                                                                ...prev,
                                                                subcontractor: p.subcontractor,
                                                                cost: p.basePrice,
                                                                sellingPrice: p.sellingBasePrice || prev.sellingPrice
                                                            }));
                                                        }}
                                                        className={`w-full flex justify-between items-center text-xs p-2 rounded-xl border transition-all ${isSelected ? 'bg-blue-50 border-blue-100 text-blue-700 shadow-sm' : 'bg-white/40 border-slate-100 text-slate-700 hover:bg-white hover:border-emerald-200 hover:shadow-sm'}`}
                                                    >
                                                        <span className="font-bold flex items-center gap-2">
                                                            {p.subcontractor}
                                                            {isSelected && <span className="px-1.5 py-0.5 bg-blue-600 text-white rounded-md text-[8px] uppercase font-black">Selected</span>}
                                                        </span>
                                                        <span className={`font-black flex items-center gap-1 ${isSelected ? 'text-blue-500' : 'text-emerald-600'}`}>
                                                            {isSelected ? <BadgeCheck size={12} /> : <ShieldCheck size={12} />}
                                                            {isSelected ? 'Selected' : 'Click to Apply'}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            {allMatches.length > 3 && <div className="text-[10px] text-center text-emerald-400 font-bold italic pt-1 border-t border-emerald-50">And {allMatches.length - 3} more contract options available...</div>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* POD Image Section - Only show if job is rejected */}
                        {isRejectedJob && (
                            <div className="bg-rose-50 border-2 border-rose-200 rounded-2xl p-5 space-y-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <div className="p-1.5 px-2 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5">
                                        <Camera size={12} />
                                        POD / เอกสาร
                                    </div>
                                    <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">รูปภาพหลักฐาน (แก้ไขได้)</p>
                                </div>

                                {/* Display rejection reason if about images */}
                                {job.accountingRemark && (
                                    <div className="bg-white border border-rose-200 rounded-xl p-3">
                                        <p className="text-[9px] font-black text-rose-600 uppercase tracking-tight mb-0.5">💬 เหตุผลที่ถูกตีกลับ:</p>
                                        <p className="text-xs font-bold text-rose-800">{job.accountingRemark}</p>
                                    </div>
                                )}

                                {/* Current POD Images */}
                                {podImages.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-slate-500 uppercase">รูปเดิมที่แนบมา ({podImages.length} รูป)</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {podImages.map((url, idx) => (
                                                <div key={idx} className="relative group">
                                                    <img
                                                        src={url}
                                                        alt={`POD ${idx + 1}`}
                                                        className="w-full h-24 object-cover rounded-xl border-2 border-slate-200"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeExistingPod(idx)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                        title="ลบรูปนี้"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* New POD Files */}
                                {newPodFiles.length > 0 && (
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-black text-emerald-600 uppercase">รูปใหม่ที่เพิ่ม ({newPodFiles.length} รูป)</p>
                                        <div className="grid grid-cols-3 gap-3">
                                            {newPodFiles.map((file, idx) => (
                                                <div key={idx} className="relative group">
                                                    <img
                                                        src={URL.createObjectURL(file)}
                                                        alt={`New POD ${idx + 1}`}
                                                        className="w-full h-24 object-cover rounded-xl border-2 border-emerald-300"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeNewPodFile(idx)}
                                                        className="absolute -top-2 -right-2 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                                                        title="ลบรูปนี้"
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-emerald-500 text-white text-[8px] font-black rounded uppercase">
                                                        NEW
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Upload Progress */}
                                {uploadProgress !== null && (
                                    <div className="space-y-1">
                                        <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-blue-500 transition-all duration-200 ${uploadProgress >= 100 ? 'w-full' :
                                                    uploadProgress >= 90 ? 'w-[90%]' :
                                                        uploadProgress >= 80 ? 'w-[80%]' :
                                                            uploadProgress >= 70 ? 'w-[70%]' :
                                                                uploadProgress >= 60 ? 'w-[60%]' :
                                                                    uploadProgress >= 50 ? 'w-1/2' :
                                                                        uploadProgress >= 40 ? 'w-[40%]' :
                                                                            uploadProgress >= 30 ? 'w-[30%]' :
                                                                                uploadProgress >= 20 ? 'w-1/5' :
                                                                                    uploadProgress >= 10 ? 'w-[10%]' : 'w-0'
                                                    }`}
                                            ></div>
                                        </div>
                                        <p className="text-[9px] text-blue-600 font-bold text-center">กำลังอัปโหลด...</p>
                                    </div>
                                )}

                                {/* Upload Buttons */}
                                <div className="flex gap-3">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        className="hidden"
                                        title="Select POD files"
                                        aria-label="Select POD image files"
                                        onChange={handlePodFileChange}
                                    />
                                    <input
                                        ref={cameraInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        title="Take photo"
                                        aria-label="Take a photo for POD"
                                        onChange={handlePodFileChange}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-white border-2 border-dashed border-rose-300 rounded-xl text-rose-600 font-bold text-xs hover:bg-rose-50 transition-all"
                                    >
                                        <Upload size={16} />
                                        เลือกไฟล์
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 px-4 bg-rose-600 text-white rounded-xl font-bold text-xs hover:bg-rose-700 transition-all shadow-lg"
                                    >
                                        <Camera size={16} />
                                        ถ่ายรูปใหม่
                                    </button>
                                </div>

                                <p className="text-[9px] text-slate-400 text-center">
                                    รองรับไฟล์รูปภาพ (jpg, png) ขนาดไม่เกิน 10MB ต่อไฟล์
                                </p>
                            </div>
                        )}

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
