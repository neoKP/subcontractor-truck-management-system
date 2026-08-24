import React, { useState, useEffect } from 'react';
import { Job, JobStatus, AccountingStatus, UserRole, AuditLog, PriceMatrix, SubcontractorMaster } from '../types';
import { Search, Download, CheckCircle, Clock, TrendingUp, AlertCircle, User } from 'lucide-react';
import { formatDate, formatThaiCurrency, generateUUID } from '../utils/format';
import { db, ref, get, authReady } from '../firebaseConfig';
import { canConfirmJob, markJobReviewed, describeChanges } from '../utils/confirmJob';
import ReviewConfirmModal from './ReviewConfirmModal';
import { useJobFuelRate } from '../utils/useJobFuelRate';
import { watchActiveFuelRates, type FuelRateVersion } from '../utils/fuelRateStore';
import { findFuelRateOptions } from '../utils/fuelRateLookup';
import { oilPriceAtDate } from '../utils/oilPriceAtDate';
import { useOilPrice } from '../utils/useOilPrice';
import { todayIsoLocal } from '../utils/oilRounds';
import DispatcherActionModal from './DispatcherActionModal';


interface ReviewConfirmDashboardProps {
    jobs: Job[];
    /** บันทึกใบงาน — throw เมื่อเขียนไม่สำเร็จ หน้าจอจะแจ้งผู้ใช้เอง */
    onSave: (job: Job, logs?: AuditLog[]) => void | Promise<void>;
    user: { id: string; name: string; role: UserRole };
    priceMatrix: any[];
    subcontractorMasters?: SubcontractorMaster[];
    logs: any[];
    logsLoaded: boolean;
    hidePrice?: boolean;
}

const ReviewConfirmDashboard: React.FC<ReviewConfirmDashboardProps> = ({
    jobs,
    onSave,
    user,
    priceMatrix,
    subcontractorMasters = [],
    logs,
    logsLoaded,
    hidePrice = false
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    // กันกดยืนยันซ้ำระหว่างที่ยังบันทึกไม่เสร็จ
    const [confirming, setConfirming] = useState(false);
    const [selectedJob, setSelectedJob] = useState<Job | null>(null);

    /**
     * เรทตามน้ำมันของงานที่กำลังตรวจ ณ วันที่ต้องการรถ
     *
     * ต้องตรวจซ้ำที่นี่ ไม่ใช่เชื่อราคาที่บันทึกไว้ตอนสร้างใบงาน เพราะนี่คือจุด
     * สุดท้ายก่อนราคาถูกล็อกเข้าบัญชี งานที่จองล่วงหน้าอาจถูกสร้างตอนน้ำมัน
     * ราคาหนึ่ง แล้วน้ำมันปรับก่อนถึงวันงาน
     */
    const jobFuel = useJobFuelRate(
        {
            origin: selectedJob?.origin,
            destination: selectedJob?.destination,
            truckType: selectedJob?.truckType,
        },
        selectedJob?.dateOfService
    );
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [filterView, setFilterView] = useState<'all' | 'incomplete' | 'complete'>('all');


    // งานที่ต้องตรวจทาน: ASSIGNED และยังไม่ล็อกราคา หรือถูกบัญชีตีกลับมาแก้
    //
    // รวมงานที่ "ล็อกแล้วแต่ไม่มีสถานะบัญชี" ด้วย — สถานะนั้นหลุดจากทั้งหน้านี้และหน้าบัญชี
    // ทำให้งานหายจากสายตาทุกคน เกิดได้เมื่อเขียนข้อมูลไม่ครบ เช่น เน็ตหลุดกลางคัน
    const assignedJobs = jobs.filter(job =>
        job.status === JobStatus.ASSIGNED && (
            !job.isBaseCostLocked ||
            job.accountingStatus === AccountingStatus.REJECTED ||
            !job.accountingStatus
        )
    );

    // Check if price matches Master Pricing
    /**
     * เรทตามน้ำมันของ "ทุกงาน" ในหน้านี้
     *
     * โหลดรุ่นเรทครั้งเดียวแล้วเช็คทีละใบ — ถ้าใช้ hook ต่อใบจะยิงโหลดซ้ำหลายสิบรอบ
     * ราคาน้ำมันยึดวันที่ต้องการรถของแต่ละใบ ไม่ใช่วันนี้
     */
    const [fuelVersion, setFuelVersion] = useState<FuelRateVersion | null>(null);
    useEffect(() => watchActiveFuelRates(v => setFuelVersion(v), () => setFuelVersion(null)), []);
    const liveOil = useOilPrice();


    /** ราคาในใบงานตรงกับเรทตามน้ำมันของวันที่ต้องการรถไหม */
    const hasFuelRateMatch = (job: Job) => {
        // ใช้เรทรุ่นล่าสุดเสมอ — หน่วยงานแก้เรทแล้วเราต้องตาม (ข้อตกลงกับหน่วยงาน)
        //
        // งานที่ราคายังไม่ถูกล็อกจึงถูกวัดด้วยเรทปัจจุบัน ถ้าหน่วยงานส่งเรทใหม่ที่
        // ราคาต่างไป งานนั้นจะขึ้นเตือนให้แก้ราคาก่อนยืนยัน ไม่ใช่ผ่านไปด้วยราคาเก่า
        // (ใบงานยังเก็บ fuelRateVersionId ไว้เพื่อตรวจย้อนว่าตอนตกลงใช้เรทรุ่นไหน)
        const rows = fuelVersion?.rows ?? [];
        if (!rows.length) return false;
        const oilAt = oilPriceAtDate(liveOil.byDate, job.dateOfService, todayIsoLocal());
        if (!oilAt.usable) return false;
        return findFuelRateOptions(
            rows,
            { origin: job.origin || '', destination: job.destination || '', truckType: job.truckType || '' },
            oilAt.diesel
        ).some(o =>
            o.subcontractor === (job.subcontractor || '').trim()
            && Math.abs(o.price - (job.cost || 0)) < 0.01
        );
    };

    const hasPriceMatch = (job: Job) => {
        return priceMatrix.some(p =>
            (p.origin || '').trim() === (job.origin || '').trim() &&
            (p.destination || '').trim() === (job.destination || '').trim() &&
            (p.truckType || '').trim() === (job.truckType || '').trim() &&
            (p.subcontractor || '').trim() === (job.subcontractor || '').trim()
        );
    };

    // Check if all drops have POD (Completed)
    const hasAllPODs = (job: Job) => {
        if (!job.drops || job.drops.length === 0) return true;
        return job.drops.every(drop => drop.status === 'COMPLETED');
    };

    // ตรวจสอบว่าข้อมูลครบถ้วนตามกฏ (Strict Rules)
    // POD moved to Job Confirmation step - not required here
    const isFleetInfoComplete = (job: Job) => {
        const infoDone = !!(job.driverName && job.driverPhone && job.licensePlate);
        // ราคาถูกต้องเมื่อตรงกับแหล่งใดแหล่งหนึ่ง — ราคากลาง หรือเรทตามน้ำมัน
        // เดิมตรวจแต่ราคากลาง งานที่ใช้เรทของหน่วยงานจึงค้างอยู่กลุ่ม "ข้อมูลไม่ครบ" ตลอดไป
        const priceValid = hasPriceMatch(job) || hasFuelRateMatch(job);
        return infoDone && priceValid;
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
            'Origin': job.origin,
            'Drop-off Points': job.drops && job.drops.length > 0 ? job.drops.map(d => d.location).join('; ') : '-',
            'Destination': job.destination,
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
            {/* Header */}
            <div className="mb-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 md:p-4 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl text-white shadow-xl shadow-blue-200">
                            <div className="text-2xl md:text-3xl">📋</div>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tight">
                                ตรวจทานและคอนเฟิร์ม
                            </h1>
                            <p className="text-[10px] md:text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">
                                Review & Confirm Dashboard
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleExport}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black shadow-lg shadow-emerald-200 transition-all text-sm"
                    >
                        <Download size={18} />
                        Export รายงาน
                    </button>
                </div>

                {/* Statistics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-blue-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] md:text-xs font-black text-blue-400 uppercase tracking-widest">Total Jobs</p>
                            <div className="p-1.5 md:p-2 bg-blue-100 rounded-lg text-blue-600">
                                <CheckCircle size={14} />
                            </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-blue-600">{stats.total}</p>
                        <p className="text-[10px] md:text-xs font-bold text-blue-500 mt-1">งานทั้งหมด</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-orange-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] md:text-xs font-black text-orange-400 uppercase tracking-widest">Incomplete</p>
                            <div className="p-1.5 md:p-2 bg-orange-100 rounded-lg text-orange-600">
                                <AlertCircle size={14} />
                            </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-orange-600">{stats.incomplete}</p>
                        <p className="text-[10px] md:text-xs font-bold text-orange-500 mt-1">ข้อมูลไม่ครบ</p>
                    </div>

                    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-emerald-100">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[10px] md:text-xs font-black text-emerald-400 uppercase tracking-widest">Complete</p>
                            <div className="p-1.5 md:p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                <CheckCircle size={14} />
                            </div>
                        </div>
                        <p className="text-2xl md:text-3xl font-black text-emerald-600">{stats.complete}</p>
                        <p className="text-[10px] md:text-xs font-bold text-emerald-500 mt-1">ข้อมูลครบ</p>
                    </div>

                    {!hidePrice && (
                        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-indigo-100 col-span-2 lg:col-span-1">
                            <div className="flex items-center justify-between mb-2">
                                <p className="text-[10px] md:text-xs font-black text-indigo-400 uppercase tracking-widest">Total Value</p>
                                <div className="p-1.5 md:p-2 bg-indigo-100 rounded-lg text-indigo-600">
                                    <TrendingUp size={14} />
                                </div>
                            </div>
                            <p className="text-xl md:text-2xl font-black text-indigo-600">฿{formatThaiCurrency(stats.totalValue)}</p>
                            <p className="text-[10px] md:text-xs font-bold text-indigo-500 mt-1">มูลค่ารวม</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Search & Filter Bar */}
            <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-lg border border-slate-100 mb-4 sm:mb-6">
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
                    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest shrink-0">แสดง:</p>
                        <button
                            onClick={() => setFilterView('all')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${filterView === 'all'
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ทั้งหมด ({stats.total})
                        </button>
                        <button
                            onClick={() => setFilterView('incomplete')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${filterView === 'incomplete'
                                ? 'bg-orange-600 text-white shadow-lg shadow-orange-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ⚠️ ไม่ครบ ({stats.incomplete})
                        </button>
                        <button
                            onClick={() => setFilterView('complete')}
                            className={`px-3 py-1.5 rounded-lg font-bold text-[10px] md:text-sm transition-all whitespace-nowrap ${filterView === 'complete'
                                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            ✅ ครบ ({stats.complete})
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
                        // POD moved to Job Confirmation step - not required here
                        if (!hasPriceMatch(job)) missingFields.push('ข้อมูลราคากลาง (Master Pricing)');

                        return (
                            <div
                                key={job.id}
                                className={`bg-white rounded-[2rem] p-5 md:p-6 shadow-lg border-2 hover:shadow-xl transition-all ${isComplete
                                    ? 'border-emerald-200 hover:border-emerald-300'
                                    : 'border-orange-200 hover:border-orange-300'
                                    }`}
                            >
                                <div className="flex flex-col lg:flex-row items-stretch lg:items-start justify-between gap-4">
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
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                                            <div>
                                                <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Route</p>
                                                <p className="text-sm font-black text-slate-800">{job.origin} → {job.destination}</p>
                                                {/* Drop-off Points */}
                                                {job.drops && job.drops.length > 0 && (
                                                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                                                        <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold">
                                                            📍 {job.drops.length} จุดส่ง
                                                        </span>
                                                        <span className="text-[9px] text-slate-400">
                                                            {job.drops.slice(0, 2).map(d => d.location).join(', ')}
                                                            {job.drops.length > 2 && ` +${job.drops.length - 2}`}
                                                        </span>
                                                    </div>
                                                )}
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
                                    <div className="flex flex-row lg:flex-col gap-2 shrink-0">
                                        <button
                                            onClick={() => setEditingJob(job)}
                                            className="flex-1 lg:flex-none px-4 md:px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-black shadow-lg shadow-orange-200 transition-all flex items-center justify-center gap-2 whitespace-nowrap text-xs md:text-sm"
                                        >
                                            🔧 แก้ไข
                                        </button>
                                        <button
                                            onClick={() => setSelectedJob(job)}
                                            disabled={!isComplete}
                                            className={`flex-1 lg:flex-none px-4 md:px-6 py-3 rounded-xl font-black shadow-lg transition-all flex items-center justify-center gap-2 whitespace-nowrap text-xs md:text-sm ${isComplete
                                                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 cursor-pointer'
                                                : 'bg-slate-300 text-slate-500 shadow-slate-200 cursor-not-allowed opacity-60'
                                                }`}
                                        >
                                            <CheckCircle size={16} />
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
                        sellingPrice: selectedJob.sellingPrice || 0,
                        drops: selectedJob.drops || []
                    }}
                    user={user}
                    priceMatrix={priceMatrix}
                    fuelRateOptions={jobFuel.options}
                    fuelDiesel={jobFuel.diesel}
                    isConfirming={confirming}
                    onConfirm={async () => {
                        if (confirming) return;
                        setConfirming(true);
                        const jobId = selectedJob.id;
                        try {
                            // อ่านฉบับล่าสุดก่อนเสมอ — หน้านี้ถูกเปิดค้างได้นาน
                            // ถ้าเขียนทับด้วย snapshot ตอนเปิด สิ่งที่คนอื่นแก้ระหว่างนั้นจะหาย
                            await authReady;
                            const snap = await get(ref(db, `jobs/${jobId}`));
                            const latest = snap.val() as Job | null;

                            // ตรวจเรทจาก "ฉบับล่าสุด" ไม่ใช่ค่าที่ค้างในจอ — เส้นทางหรือวันที่
                            // อาจถูกแก้ระหว่างที่หน้านี้เปิดค้าง
                            const check = canConfirmJob(latest, priceMatrix, hasFuelRateMatch(latest));
                            if (!check.ok || !latest) {
                                setConfirming(false);
                                if ((window as any).Swal) {
                                    await (window as any).Swal.fire({
                                        icon: 'warning',
                                        title: 'ยืนยันไม่ได้',
                                        text: check.message || 'ใบงานเปลี่ยนสถานะไปแล้ว',
                                        confirmButtonText: 'ตกลง',
                                    });
                                }
                                setSelectedJob(null);
                                return;
                            }

                            const now = new Date().toISOString();
                            const merged = markJobReviewed(latest, { name: user.name, at: now });

                            // บันทึกว่าใครยืนยัน — เดิมล็อกราคาส่งบัญชีโดยไม่มีร่องรอยเลย
                            // และบันทึกด้วยว่ามีใครแก้ข้อมูลระหว่างที่หน้าเปิดค้างไหม
                            const changes = describeChanges(selectedJob, latest);
                            const mkLog = (field: string, oldValue: string, newValue: string, reason = 'ตรวจทานและยืนยันใบงาน'): AuditLog => ({
                                reason,
                                // ใช้ Date.now() ไม่ใช่ ISO — คีย์ของ Firebase ห้ามมีจุด
                                // และ ISO มีจุดในหลักมิลลิวินาที ทำให้เขียน log ไม่เข้าเงียบ ๆ
                                id: `LOG-${Date.now()}-${generateUUID().slice(0, 8)}`,
                                jobId,
                                userId: user.id,
                                userName: user.name,
                                userRole: user.role,
                                timestamp: now,
                                field,
                                oldValue,
                                newValue,
                            });
                            const auditLogs: AuditLog[] = [
                                mkLog('ยืนยันและล็อกราคา', latest.accountingStatus || '-', AccountingStatus.PENDING_REVIEW),
                                ...changes.map(c => mkLog(c.field, c.from, c.to, 'ข้อมูลถูกแก้โดยผู้อื่นระหว่างตรวจทาน')),
                            ];

                            await onSave(merged, auditLogs);

                            setSelectedJob(null);
                            if ((window as any).Swal) {
                                (window as any).Swal.fire({
                                    icon: 'success',
                                    title: '✅ ยืนยันและล็อกสำเร็จ',
                                    text: `งาน ${jobId} ถูกล็อกราคาและส่งไปยังฝ่ายบัญชีแล้ว`,
                                    timer: 2000,
                                    showConfirmButton: false,
                                    customClass: { popup: 'rounded-[2rem]' }
                                });
                            }
                        } catch (e) {
                            if ((window as any).Swal) {
                                await (window as any).Swal.fire({
                                    icon: 'error',
                                    title: 'บันทึกไม่สำเร็จ',
                                    html: `ใบงานยังไม่ถูกยืนยัน กรุณาลองใหม่<br/><small>${(e as Error).message || ''}</small>`,
                                    confirmButtonText: 'ตกลง',
                                });
                            }
                        } finally {
                            setConfirming(false);
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
                    subcontractorMasters={subcontractorMasters}
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
