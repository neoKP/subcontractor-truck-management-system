import React, { useState } from 'react';
import { Job, JobStatus, UserRole } from '../types';
import { Search, Download, CheckCircle, Clock, TrendingUp, AlertCircle, User } from 'lucide-react';
import { formatDate, formatThaiCurrency } from '../utils/format';
import ReviewConfirmModal from './ReviewConfirmModal';
import DispatcherActionModal from './DispatcherActionModal';


interface ReviewConfirmDashboardProps {
    jobs: Job[];
    onSave: (job: Job) => void;
    user: { id: string; name: string; role: UserRole };
    priceMatrix: any[];
    logs: any[];
    logsLoaded: boolean;
    hidePrice?: boolean;
}

const ReviewConfirmDashboard: React.FC<ReviewConfirmDashboardProps> = ({
    jobs,
    onSave,
    user,
    priceMatrix,
    logs,
    logsLoaded,
    hidePrice = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [filterView, setFilterView] = useState<'all' | 'incomplete' | 'complete'>('all');


    // กรองงานที่ ASSIGNED และยังไม่ล็อกราคา (เฉพาะงานที่รอตรวจทาน)
    const assignedJobs = jobs.filter(job =>
        job.status === JobStatus.ASSIGNED &&
        !job.isBaseCostLocked  // เฉพาะงานที่ยังไม่ล็อก
    );

    // ตรวจสอบว่าข้อมูล Fleet Information ครบหรือไม่
    const isFleetInfoComplete = (job: Job) => {
        return !!(job.driverName && job.driverPhone && job.licensePlate);
    };

    // แยกงานออกเป็น 2 กลุ่ม
    const incompleteJobs = assignedJobs.filter(job => !isFleetInfoComplete(job));
    const completeJobs = assignedJobs.filter(job => isFleetInfoComplete(job));

    // กรองตาม Search
    const filterBySearch = (jobList: Job[]) => {
        return jobList.filter(job => {
            const search = searchTerm.toLowerCase();
            return (
                job.id.toLowerCase().includes(search) ||
                job.origin.toLowerCase().includes(search) ||
                job.destination.toLowerCase().includes(search) ||
                (job.subcontractor || '').toLowerCase().includes(search) ||
                (job.driverName || '').toLowerCase().includes(search)
            );
        });
    };

    // กรองตาม Filter View
    const getFilteredJobs = () => {
        if (filterView === 'incomplete') {
            return filterBySearch(incompleteJobs);
        } else if (filterView === 'complete') {
            return filterBySearch(completeJobs);
        } else {
            return filterBySearch(assignedJobs);
        }
    };

    const filteredJobs = getFilteredJobs();

    // สถิติ
    const stats = {
        total: assignedJobs.length,
        incomplete: incompleteJobs.length,
        complete: completeJobs.length,
        totalValue: assignedJobs.reduce((sum, j) => sum + (j.cost || 0), 0)
    };

    // Export to CSV
    const handleExport = () => {
        const csvData = filteredJobs.map(job => ({
            'Job ID': job.id,
            'Route': `${job.origin} → ${job.destination}`,
            'Subcontractor': job.subcontractor || '-',
            'Truck Type': job.truckType,
            'Driver': job.driverName || '-',
            'Cost': job.cost || 0,
            'Service Date': formatDate(job.dateOfService)
        }));

        const headers = Object.keys(csvData[0] || {});
        const csv = [
            headers.join(','),
            ...csvData.map(row => headers.map(h => row[h as keyof typeof row]).join(','))
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `review-confirm-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-xl shadow-blue-200">
                            <div className="text-3xl">📋</div>
                        </div>
                        <div>
                            <h1 className="text-4xl font-black text-slate-800 tracking-tight">
                                ตรวจทานและคอนเฟิร์ม
                            </h1>
                            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                                Review & Confirm Dashboard
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-emerald-200 transition-all"
                    >
                        <Download size={18} />
                        Export รายงาน
                    </button>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-black text-blue-400 uppercase tracking-widest">Total Jobs</p>
                            <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                                <CheckCircle size={16} />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-blue-600">{stats.total}</p>
                        <p className="text-xs font-bold text-blue-500 mt-1">งานทั้งหมด</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-orange-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-black text-orange-400 uppercase tracking-widest">Incomplete</p>
                            <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                <AlertCircle size={16} />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-orange-600">{stats.incomplete}</p>
                        <p className="text-xs font-bold text-orange-500 mt-1">ข้อมูลไม่ครบ</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-emerald-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">Complete</p>
                            <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                <CheckCircle size={16} />
                            </div>
                        </div>
                        <p className="text-3xl font-black text-emerald-600">{stats.complete}</p>
                        <p className="text-xs font-bold text-emerald-500 mt-1">ข้อมูลครบ</p>
                    </div>

                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-indigo-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">Total Value</p>
                            <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                <TrendingUp size={16} />
                            </div>
                        </div>
                        <p className="text-2xl font-black text-indigo-600">฿{formatThaiCurrency(stats.totalValue)}</p>
                        <p className="text-xs font-bold text-indigo-500 mt-1">มูลค่ารวม</p>
                    </div>
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-100 mb-6">
                <div className="flex flex-col gap-4">
                    {/* Search */}
                    <div className="relative">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <Search size={20} />
                        </div>
                        <input
                            type="text"
                            placeholder="🔍 ค้นหา Job ID, Route, Subcontractor, Driver..."
                            className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all font-bold text-slate-800"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Filter Buttons */}
                    <div className="flex items-center gap-3">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">แสดง:</p>
                        <button
                            onClick={() => setFilterView('all')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'all'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ทั้งหมด ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilterView('incomplete')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'incomplete'
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ⚠️ ข้อมูลไม่ครบ ({stats.incomplete})
                        </button>
                        <button
                            onClick={() => setFilterView('complete')}
                            className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${filterView === 'complete'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ✅ ข้อมูลครบ ({stats.complete})
                        </button>
                    </div>
                </div>
            </div>

            {/* Job List */}
            <div className="space-y-4">
                {filteredJobs.length === 0 ? (
                    <div className="bg-white rounded-2xl p-12 text-center shadow-lg border border-slate-100">
                        <div className="text-6xl mb-4">📋</div>
                        <p className="text-xl font-black text-slate-400 mb-2">ไม่พบงานที่ต้องการ</p>
                        <p className="text-sm font-bold text-slate-400">ลองเปลี่ยน Filter หรือคำค้นหา</p>
                    </div>
                ) : (
                    filteredJobs.map((job, index) => {
                        const isComplete = isFleetInfoComplete(job);
                        const missingFields = [];
                        if (!job.driverName) missingFields.push('ชื่อคนขับ');
                        if (!job.driverPhone) missingFields.push('เบอร์โทร');
                        if (!job.licensePlate) missingFields.push('ทะเบียนรถ');

                        return (
                            <div
                                key={job.id}
                                className={`bg-white rounded-2xl p-6 shadow-lg border-2 hover:shadow-xl transition-all ${isComplete
                                    ? 'border-emerald-200 hover:border-emerald-300'
                                    : 'border-orange-200 hover:border-orange-300'
                                    }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        {/* Header */}
                                        <div className="flex items-center gap-3 mb-3 flex-wrap">
                                            <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${isComplete
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-orange-100 text-orange-700'
                                                }`}>
                                                {isComplete ? '✅ ข้อมูลครบ' : '⚠️ ข้อมูลไม่ครบ'}
                                            </div>
                                            <p className="text-sm font-mono font-black text-slate-400">{job.id}</p>
                                            <p className="text-xs font-bold text-slate-400">{formatDate(job.dateOfService)}</p>
                                        </div>

                                        {/* Missing Fields Warning */}
                                        {!isComplete && (
                                            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 mb-4">
                                                <div className="flex items-start gap-2">
                                                    <AlertCircle size={16} className="text-orange-600 shrink-0 mt-0.5" />
                                                    <div>
                                                        <p className="text-xs font-black text-orange-900 mb-1">ขาดข้อมูล:</p>
                                                        <p className="text-sm font-bold text-orange-700">
                                                            {missingFields.join(', ')}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Requested By */}
                                        {job.requestedByName && (
                                            <div className="mb-4">
                                                <div className="flex items-center gap-2 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2 w-fit">
                                                    <User size={14} className="text-purple-500" />
                                                    <span className="text-xs font-black text-purple-700">ผู้ขอใช้รถ:</span>
                                                    <span className="text-xs font-black text-purple-900">{job.requestedByName}</span>
                                                </div>
                                            </div>
                                        )}

                                        {/* Job Details */}
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <div>
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Route</p>
                                                <p className="text-sm font-black text-slate-800">{job.origin} → {job.destination}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Subcontractor</p>
                                                <p className="text-sm font-black text-slate-800">{job.subcontractor || '-'}</p>
                                                <p className="text-xs font-bold text-slate-500">{job.truckType}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Driver</p>
                                                <p className={`text-sm font-black ${job.driverName ? 'text-slate-800' : 'text-orange-600 italic'}`}>
                                                    {job.driverName || '❌ ยังไม่ระบุ'}
                                                </p>
                                                <p className={`text-xs font-bold ${job.licensePlate ? 'text-slate-500' : 'text-orange-600 italic'}`}>
                                                    {job.licensePlate || '❌ ยังไม่ระบุ'}
                                                </p>
                                            </div>
                                            {!hidePrice && (
                                                <div>
                                                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Cost</p>
                                                    <p className="text-lg font-black text-blue-600">฿{formatThaiCurrency(job.cost || 0)}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex flex-col gap-2 shrink-0">
                                        <button
                                            id={`rc-btn-edit-${job.id}-${filterView}-${index}`}
                                            onClick={() => setEditingJob(job)}
                                            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black shadow-lg shadow-orange-200 transition-all flex items-center gap-2 whitespace-nowrap"
                                        >
                                            🔧 แก้ไขข้อมูล
                                        </button>
                                        <button
                                            id={`rc-btn-review-${job.id}-${filterView}-${index}`}
                                            onClick={() => setSelectedJob(job)}
                                            disabled={!isComplete}

                                            className={`px-6 py-3 rounded-xl font-black shadow-lg transition-all flex items-center gap-2 whitespace-nowrap ${isComplete
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 cursor-pointer'
                                                : 'bg-slate-300 text-slate-500 shadow-slate-200 cursor-not-allowed opacity-60'
                                                }`}
                                        >
                                            <CheckCircle size={18} />
                                            ตรวจทาน
                                        </button>
                                    </div>

                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Review Confirm Modal */}
            {selectedJob && (
                <ReviewConfirmModal
                    job={selectedJob}
                    editData={{
                        subcontractor: selectedJob.subcontractor || '',
                        truckType: selectedJob.truckType,
                        driverName: selectedJob.driverName || '',
                        driverPhone: selectedJob.driverPhone || '',
                        licensePlate: selectedJob.licensePlate || '',
                        cost: selectedJob.cost || 0,
                        sellingPrice: selectedJob.sellingPrice || 0
                    }}
                    user={user}
                    onConfirm={() => {
                        // Lock the price and update job status
                        const updatedJob = {
                            ...selectedJob,
                            isBaseCostLocked: true,
                            status: JobStatus.ASSIGNED,
                            accountingStatus: 'PENDING_REVIEW' as any
                        };

                        onSave(updatedJob);
                        setSelectedJob(null);

                        // Show success message
                        if ((window as any).Swal) {
                            (window as any).Swal.fire({
                                icon: 'success',
                                title: '✅ ยืนยันและล็อกสำเร็จ',
                                text: `งาน ${selectedJob.id} ถูกล็อกราคาและส่งไปยังฝ่ายบัญชีแล้ว`,
                                timer: 2000,
                                showConfirmButton: false,
                                customClass: { popup: 'rounded-[2rem]' }
                            });
                        }
                    }}
                    onEdit={() => {
                        setEditingJob(selectedJob);
                        setSelectedJob(null);
                    }}

                    onClose={() => {
                        setSelectedJob(null);
                    }}
                />
            )}

            {/* Edit Modal */}
            {editingJob && (
                <DispatcherActionModal
                    job={editingJob}
                    user={user}
                    priceMatrix={priceMatrix}
                    logs={logs}
                    logsLoaded={logsLoaded}
                    onClose={() => setEditingJob(null)}
                    onSave={(updatedJob) => {
                        onSave(updatedJob);
                        setEditingJob(null);
                    }}
                />
            )}
        </div>

    );
};

export default ReviewConfirmDashboard;
