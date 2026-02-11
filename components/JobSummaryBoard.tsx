
import React, { useState } from 'react';
import { Job, JobStatus, UserRole, JOB_STATUS_LABELS } from '../types';
import { X, Search, Truck, Package, Printer, FileText, CheckCircle, ExternalLink, MapPin } from 'lucide-react';
import JobPreviewModal from './JobPreviewModal';

interface JobSummaryBoardProps {
    jobs: Job[];
    isOpen: boolean;
    onClose: () => void;
    user: { id: string; name: string; role: UserRole };
}

const JobSummaryBoard: React.FC<JobSummaryBoardProps> = ({ jobs, isOpen, onClose, user }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);

    if (!isOpen) return null;

    const filteredJobs = jobs.filter(j =>
        !searchTerm ||
        j.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
        j.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (j.subcontractor || '').toLowerCase().includes(searchTerm.toLowerCase())
    ).slice().reverse(); // Show newest first

    const handlePreview = (job: Job) => {
        setSelectedJob(job);
        setShowPreviewModal(true);
    };

    const getStatusStyle = (status: JobStatus) => {
        switch (status) {
            case JobStatus.NEW_REQUEST: return 'bg-orange-100 text-orange-700 border-orange-200';
            case JobStatus.PENDING_PRICING: return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case JobStatus.ASSIGNED: return 'bg-blue-100 text-blue-700 border-blue-200';
            case JobStatus.COMPLETED: return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case JobStatus.BILLED: return 'bg-slate-100 text-slate-600 border-slate-200';
            case JobStatus.CANCELLED: return 'bg-rose-100 text-rose-700 border-rose-200';
            default: return 'bg-slate-50 text-slate-500 border-slate-100';
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-0 md:p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-slate-50 w-full max-w-[95%] h-full md:h-[90vh] md:rounded-[3rem] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">

                {/* Header Section */}
                <div className="px-8 py-6 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">สรุปกระดานงาน (Job Summary Board)</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mt-1">
                                Real-time Operation Dashboard • {jobs.length} Active Records
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="ค้นหางาน (Search jobs...)"
                                className="pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-xl text-sm font-bold w-full md:w-64 outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        </div>
                        <button
                            onClick={onClose}
                            className="p-3 hover:bg-slate-100 text-slate-400 hover:text-slate-900 rounded-2xl transition-all"
                            title="Close Summary Board"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Table Content */}
                <div className="flex-1 overflow-x-auto overflow-y-auto p-4 md:p-8 scrollbar-thin">
                    <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
                        <table className="w-full text-left border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-900 text-white">
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest w-48">รหัสงาน / สถานะ</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest min-w-[280px]">เส้นทาง (Route)</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-center w-40">ความคืบหน้า</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest min-w-[200px]">ผู้รับงาน</th>
                                    <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-center w-32">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredJobs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-8 py-32 text-center text-slate-300 font-black uppercase tracking-widest italic">
                                            No Records Found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredJobs.map(job => (
                                        <tr key={job.id} className="group hover:bg-slate-50 transition-all duration-300">
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col gap-2">
                                                    <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-black border border-blue-100 shadow-sm w-fit">
                                                        #{job.id}
                                                    </span>
                                                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase border w-fit ${getStatusStyle(job.status)}`}>
                                                        {JOB_STATUS_LABELS[job.status]}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                        <div className="w-px h-4 bg-slate-100"></div>
                                                        <div className="w-2 h-2 rounded-full bg-orange-500"></div>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[13px] font-black text-slate-800 leading-tight">{job.origin}</span>
                                                        <span className="block text-[13px] font-black text-slate-800 leading-tight mt-0.5">{job.destination}</span>
                                                        <div className="flex items-center gap-3 mt-1.5 opacity-40">
                                                            <span className="text-[9px] font-black uppercase">{job.truckType}</span>
                                                            <span className="text-[9px] font-black uppercase truncate max-w-[150px]">{job.productDetail || '-'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <div className="flex flex-col items-center gap-2">
                                                    <div className="w-full max-w-[80px] h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full transition-all duration-1000 ${job.status === JobStatus.NEW_REQUEST ? 'bg-orange-500 w-[20%]' :
                                                                job.status === JobStatus.PENDING_PRICING ? 'bg-yellow-400 w-[30%]' :
                                                                    job.status === JobStatus.ASSIGNED ? 'bg-blue-500 w-[60%] animate-pulse' :
                                                                        job.status === JobStatus.COMPLETED ? 'bg-emerald-500 w-[100%]' : 'bg-slate-200 w-0'
                                                                }`}
                                                        ></div>
                                                    </div>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                        {job.status === JobStatus.NEW_REQUEST ? 'Waiting' :
                                                            job.status === JobStatus.PENDING_PRICING ? 'Review' :
                                                                job.status === JobStatus.ASSIGNED ? 'Transit' :
                                                                    job.status === JobStatus.COMPLETED ? 'Success' : 'Done'}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                {job.subcontractor ? (
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-xl bg-slate-900 flex items-center justify-center text-white text-[9px] font-black">
                                                            {job.subcontractor.slice(0, 2)}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-black text-slate-800 leading-tight">{job.subcontractor}</span>
                                                            <span className="text-[10px] font-mono font-bold text-blue-500">{job.licensePlate}</span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-[9px] font-black text-slate-300 uppercase italic animate-pulse">Assigning...</div>
                                                )}
                                            </td>
                                            <td className="px-8 py-6 text-center">
                                                <button
                                                    onClick={() => handlePreview(job)}
                                                    className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all active:scale-95"
                                                    title="Print / View Detail"
                                                >
                                                    <Printer size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer with Controls */}
                <div className="px-8 py-6 bg-white border-t border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-400">
                        <CheckCircle size={16} className="text-emerald-500" />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">
                            * ข้อมูลอัปเดตอัตโนมัติแบบเรียลไทม์ (Live Sync Enabled)
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 bg-slate-900 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 active:scale-95"
                    >
                        กลับสู่หน้าสร้างใบงาน (Back to Form)
                    </button>
                </div>
            </div>

            {showPreviewModal && selectedJob && (
                <JobPreviewModal
                    job={selectedJob}
                    isOpen={showPreviewModal}
                    onClose={() => setShowPreviewModal(false)}
                />
            )}
        </div>
    );
};

export default JobSummaryBoard;
