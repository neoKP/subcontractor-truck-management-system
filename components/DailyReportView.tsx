import React, { useState, useMemo } from 'react';
import { Job, JobStatus, JOB_STATUS_LABELS, UserRole } from '../types';
import { FileSpreadsheet, Search, Calendar, Truck, User, MapPin, CheckCircle2, Clock, AlertCircle, Users, Eye } from 'lucide-react';
import { formatDate } from '../utils/format';
import JobPreviewModal from './JobPreviewModal';

interface DailyReportViewProps {
    jobs: Job[];
    currentUser: { id: string; name: string; role: UserRole };
}

const DailyReportView: React.FC<DailyReportViewProps> = ({ jobs, currentUser }) => {
    // Default to today in YYYY-MM-DD format (Local Time)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [selectedDate, setSelectedDate] = useState<string>(today);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'my' | 'all'>('all');
    const [previewJob, setPreviewJob] = useState<Job | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    // Filter jobs by date, search term, and view mode
    // Filter jobs by date, search term, and view mode
    const filteredJobs = useMemo(() => {
        return jobs.filter(job => {
            // 1. Filter by View Mode (My Jobs vs All Jobs)
            if (viewMode === 'my' && job.requestedBy !== currentUser.id) {
                return false;
            }

            const term = searchTerm.toLowerCase();
            const matchesSearch = (
                (job.id && job.id.toLowerCase().includes(term)) ||
                (job.subcontractor && job.subcontractor.toLowerCase().includes(term)) ||
                (job.origin && job.origin.toLowerCase().includes(term)) ||
                (job.destination && job.destination.toLowerCase().includes(term)) ||
                (job.licensePlate && job.licensePlate.toLowerCase().includes(term))
            );

            // SPECIAL LOGIC: If searching for a specific Job ID (4+ chars), ignore date filter
            const isSpecificJobSearch = term.length >= 4 && (term.startsWith('jrs') || !isNaN(Number(term))) && job.id.toLowerCase().includes(term);

            if (isSpecificJobSearch) return true;

            // 2. Filter by DATE CREATED (วันที่สร้างใบงาน)
            // User requirement: Show all jobs created on the selected date, regardless of service date.

            let jobCreatedDateLocal = '';
            if (job.createdAt) {
                // Convert UTC ISO string to Local Date YYYY-MM-DD
                const d = new Date(job.createdAt);
                jobCreatedDateLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            } else if (job.dateOfService) {
                // Fallback for legacy jobs without createdAt - use dateOfService
                const d = new Date(job.dateOfService);
                jobCreatedDateLocal = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            }

            const isDateMatch = jobCreatedDateLocal === selectedDate;

            if (!isDateMatch) return false;

            // 3. Filter by Search Term
            return matchesSearch;
        }).sort((a, b) => {
            // Sort by Created Time (Newest First)
            if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            // Fallback to ID sorting for legacy jobs
            return a.id.localeCompare(b.id);
        });
    }, [jobs, selectedDate, searchTerm, viewMode, currentUser.id]);

    // Calculate Summary Stats
    const stats = useMemo(() => {
        return {
            total: filteredJobs.length,
            assigned: filteredJobs.filter(j => j.status === JobStatus.ASSIGNED).length,
            completed: filteredJobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED).length,
            pending: filteredJobs.filter(j => j.status === JobStatus.NEW_REQUEST || j.status === JobStatus.PENDING_PRICING).length
        };
    }, [filteredJobs]);

    // Handle Export to CSV
    const handleExport = () => {
        // Define CSV Headers
        const headers = [
            'Job ID / เลขงาน',
            'Requested By / ผู้สร้างงาน',
            'Job Date / วันที่สร้างใบงาน',
            'Date of Service / วันที่ต้องการรถ',
            'Origin / ต้นทาง',
            'Destination / ปลายทาง',
            'Truck Type / ประเภทรถ',
            'License Plate / ทะเบียนรถ',
            'Driver Name / คนขับ',
            'Subcontractor / ผู้รับเหมา',
            'Status / สถานะ'
        ];

        // Map Data to CSV Rows
        const rows = filteredJobs.map(job => [
            job.id,
            `"${job.requestedByName || 'Unknown'}"`,
            job.createdAt
                ? formatDate(job.createdAt)
                : (job.dateOfService ? formatDate(job.dateOfService) + ' (ประมาณ)' : 'N/A'),
            formatDate(job.dateOfService),
            `"${job.origin}"`, // Quote strings to handle commas
            `"${job.destination}"`,
            job.truckType,
            job.licensePlate || '-',
            job.driverName || '-',
            `"${job.subcontractor || '-'}"`,
            JOB_STATUS_LABELS[job.status]
        ]);

        // Combine Headers and Rows
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        // Create Blob and Download Link
        // Add BOM for Excel to read UTF-8 correctly
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `Daily_Report_${selectedDate}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row gap-6 items-start md:items-center w-full xl:w-auto">
                    <div>
                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl text-white">
                                <FileSpreadsheet size={24} />
                            </div>
                            สรุปงานรายวัน (Daily Report)
                        </h2>
                        <p className="text-slate-500 font-medium text-sm mt-1 ml-14">
                            รายงานงานที่สร้างในวันที่เลือก (ไม่สนใจวันที่รถวิ่ง)
                        </p>
                        <div className="ml-14 mt-2 flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 w-fit">
                            <Calendar size={14} className="text-blue-600" />
                            <span className="text-xs font-bold text-blue-700">
                                แสดงงานที่สร้างวันที่: {formatDate(selectedDate)}
                            </span>
                        </div>
                    </div>

                    {/* View Toggle */}
                    {currentUser.role !== UserRole.ACCOUNTANT && currentUser.role !== UserRole.ADMIN && (
                        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner ml-0 md:ml-4">
                            <button
                                onClick={() => setViewMode('my')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'my' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <User size={14} />
                                งานของฉัน
                            </button>
                            <button
                                onClick={() => setViewMode('all')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Users size={14} />
                                งานทั้งหมด
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-3 w-full xl:w-auto justify-end">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Calendar className="text-slate-400" size={16} />
                        </div>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            title="Select Date Created (เลือกวันที่สร้างใบงาน)"
                            aria-label="Select Date Created"
                            className="pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-700 focus:ring-4 focus:ring-blue-100 outline-none transition-all cursor-pointer"
                        />
                    </div>
                    <button
                        onClick={handleExport}
                        disabled={filteredJobs.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                    >
                        <FileSpreadsheet size={18} />
                        Export to Excel
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Truck size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">รถทั้งหมด (Total)</p>
                        <p className="text-2xl font-black text-slate-800">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                        <AlertCircle size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">รอจัดรถ (Pending)</p>
                        <p className="text-2xl font-black text-slate-800">{stats.pending}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">กำลังวิ่ง (In Progress)</p>
                        <p className="text-2xl font-black text-slate-800">{stats.assigned}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle2 size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase">เสร็จสิ้น (Completed)</p>
                        <p className="text-2xl font-black text-slate-800">{stats.completed}</p>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Table Header / Search */}
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">รายการเดินรถประจำวัน</h3>
                        <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{filteredJobs.length} รายการ</span>
                    </div>
                    <div className="relative w-64 md:w-80">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            placeholder="ค้นหา (ทะเบียน, ผู้รับเหมา, เลขงาน)..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-100 outline-none"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <th className="px-6 py-4">Job ID</th>
                                <th className="px-6 py-4">Requested By (ผู้สร้างงาน)</th>
                                <th className="px-6 py-4">Created Date (วันที่สร้างใบงาน)</th>
                                <th className="px-6 py-4">Date of Service (วันที่ต้องการรถ)</th>
                                <th className="px-6 py-4">Route (เส้นทาง)</th>
                                <th className="px-6 py-4">Vehicle Info (ข้อมูลรถ)</th>
                                <th className="px-6 py-4">Subcontractor (ผู้รับเหมา)</th>
                                <th className="px-6 py-4">Status & Driver</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {filteredJobs.length > 0 ? (
                                filteredJobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => {
                                                    setPreviewJob(job);
                                                    setIsPreviewOpen(true);
                                                }}
                                                className="group/btn flex items-center gap-2 font-mono font-bold text-slate-700 hover:text-blue-600 transition-colors"
                                            >
                                                <div className="p-1.5 bg-slate-100 rounded-lg group-hover/btn:bg-blue-50 transition-colors">
                                                    <Eye size={14} className="text-slate-400 group-hover/btn:text-blue-500" />
                                                </div>
                                                <span>#{job.id}</span>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <User size={14} className="text-indigo-500" />
                                                <span className="font-bold text-slate-700 text-xs">
                                                    {job.requestedByName || 'Unknown'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-slate-400" />
                                                <span className="font-bold text-slate-600 text-xs">
                                                    {job.createdAt
                                                        ? formatDate(job.createdAt)
                                                        : job.dateOfService
                                                            ? (
                                                                <>
                                                                    {formatDate(job.dateOfService)}
                                                                    <span className="ml-1 text-[9px] text-amber-600 font-black">(ประมาณ)</span>
                                                                </>
                                                            )
                                                            : 'N/A'
                                                    }
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="text-blue-500" />
                                                <span className="font-bold text-slate-700">{formatDate(job.dateOfService)}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]" title={job.origin}>{job.origin}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                                                    <span className="text-xs font-bold text-slate-700 truncate max-w-[150px]" title={job.destination}>{job.destination}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-slate-100 text-slate-500 rounded-lg">
                                                    <Truck size={14} />
                                                </div>
                                                <div>
                                                    <div className="font-black text-slate-700">{job.licensePlate || <span className="text-slate-300 italic">No Plate</span>}</div>
                                                    <div className="text-[10px] font-bold text-slate-400">{job.truckType}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {job.subcontractor ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-bold">
                                                    <check-circle size={12} className="opacity-50" />
                                                    {job.subcontractor}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-2">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                    job.status === JobStatus.ASSIGNED ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                        job.status === JobStatus.CANCELLED ? 'bg-rose-100 text-rose-700 border-rose-200' :
                                                            'bg-amber-100 text-amber-700 border-amber-200'
                                                    }`}>
                                                    {JOB_STATUS_LABELS[job.status]}
                                                </span>
                                                {(job.driverName || job.driverPhone) && (
                                                    <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                                        <User size={10} />
                                                        <span className="font-medium">{job.driverName}</span>
                                                        {job.driverPhone && <span className="text-slate-400">({job.driverPhone})</span>}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-2">
                                            <div className="p-3 bg-slate-50 rounded-full">
                                                <FileSpreadsheet size={24} className="text-slate-300" />
                                            </div>
                                            <p className="font-bold">ไม่พบข้อมูลงานสำหรับวันที่เลือก</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 italic">
                        * ข้อมูลนี้สำหรับใช้ตรวจสอบการเดินรถภายในเท่านั้น (Internal Use Only)
                    </p>
                </div>
            </div>
            {/* Job Preview Modal */}
            {previewJob && (
                <JobPreviewModal
                    isOpen={isPreviewOpen}
                    onClose={() => {
                        setIsPreviewOpen(false);
                        setPreviewJob(null);
                    }}
                    job={previewJob}
                />
            )}
        </div>
    );
};

export default DailyReportView;
