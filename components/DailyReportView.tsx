import React, { useState, useMemo } from 'react';
import { Job, JobStatus, JOB_STATUS_LABELS, UserRole } from '../types';
import { FileSpreadsheet, Search, Calendar, Truck, User, MapPin, CheckCircle2, Clock, AlertCircle, Users, Eye, Phone, Package } from 'lucide-react';
import { formatDate } from '../utils/format';
import * as XLSX from 'xlsx';
import JobPreviewModal from './JobPreviewModal';

interface DailyReportViewProps {
    jobs: Job[];
    currentUser: { id: string; name: string; role: UserRole };
}

const DailyReportView: React.FC<DailyReportViewProps> = ({ jobs, currentUser }) => {
    // Default to today in YYYY-MM-DD format (Local Time)
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [dateFrom, setDateFrom] = useState<string>(today);
    const [dateTo, setDateTo] = useState<string>(today);
    const [filterMode, setFilterMode] = useState<'today' | 'month' | 'custom'>('custom');
    const [filterMonth, setFilterMonth] = useState<string>(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSub, setSelectedSub] = useState<string>('');
    const [viewMode, setViewMode] = useState<'my' | 'all'>('all');
    const [previewJob, setPreviewJob] = useState<Job | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const effectiveDateFrom = filterMode === 'today' ? today
        : filterMode === 'month' ? `${filterMonth}-01`
        : dateFrom;
    const effectiveDateTo = filterMode === 'today' ? today
        : filterMode === 'month' ? (() => { const [y, m] = filterMonth.split('-'); return `${y}-${m}-${String(new Date(+y, +m, 0).getDate()).padStart(2, '0')}`; })()
        : dateTo;

    // Subcontractor list derived from all jobs in effective date range (before sub filter)
    const subList = useMemo(() => {
        const names = new Set<string>();
        jobs.forEach(job => {
            if (!job.dateOfService) return;
            const jobDateStr = (job.dateOfService).split('T')[0];
            if (jobDateStr >= effectiveDateFrom && jobDateStr <= effectiveDateTo && job.subcontractor) {
                names.add(job.subcontractor.trim());
            }
        });
        return Array.from(names).sort();
    }, [jobs, effectiveDateFrom, effectiveDateTo]);

    // Filter jobs by date, search term, view mode, and subcontractor
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

            // 2. Filter by DATE OF SERVICE (วันที่ให้บริการ) — ตรงกับ Business Intelligence
            if (!job.dateOfService) return false;
            const jobDateStr = (job.dateOfService).split('T')[0];
            const isDateMatch = jobDateStr >= effectiveDateFrom && jobDateStr <= effectiveDateTo;

            if (!isDateMatch) return false;

            // 3. Filter by Subcontractor
            if (selectedSub && (job.subcontractor || '').trim() !== selectedSub) return false;

            // 4. Filter by Search Term
            return matchesSearch;
        }).sort((a, b) => {
            // Sort by Created Time (Newest First)
            if (a.createdAt && b.createdAt) {
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
            }
            // Fallback to ID sorting for legacy jobs
            return a.id.localeCompare(b.id);
        });
    }, [jobs, effectiveDateFrom, effectiveDateTo, selectedSub, searchTerm, viewMode, currentUser.id]);

    // Calculate Summary Stats
    const stats = useMemo(() => {
        return {
            total: filteredJobs.length,
            assigned: filteredJobs.filter(j => j.status === JobStatus.ASSIGNED).length,
            completed: filteredJobs.filter(j => j.status === JobStatus.COMPLETED || j.status === JobStatus.BILLED).length,
            pending: filteredJobs.filter(j => j.status === JobStatus.NEW_REQUEST || j.status === JobStatus.PENDING_PRICING).length
        };
    }, [filteredJobs]);

    const isFinanceRole = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.ACCOUNTANT;

    // Cost summary (matching BI formula: sum of job.cost)
    const costStats = useMemo(() => {
        const totalBaseCost = filteredJobs.reduce((s, j) => s + (j.cost || 0), 0);
        const totalExtraCost = filteredJobs.reduce((s, j) =>
            s + (j.extraCharges || []).filter(e => e.status === 'APPROVED').reduce((es, e) => es + (e.amount || 0), 0), 0);
        return { totalBaseCost, totalExtraCost, totalCombined: totalBaseCost + totalExtraCost };
    }, [filteredJobs]);

    // Handle Export to XLSX
    const handleExport = () => {
        const rows = filteredJobs.map(job => {
            const extraTotal = (job.extraCharges || [])
                .filter(e => e.status === 'APPROVED')
                .reduce((s, e) => s + (e.amount || 0), 0);
            const totalCost = (job.cost || 0) + extraTotal;

            const base: Record<string, any> = {
                'Job ID': job.id,
                'วันที่ให้บริการ': formatDate(job.dateOfService),
                'สถานะงาน': JOB_STATUS_LABELS[job.status],
                'ต้นทาง': job.origin,
                'ปลายทาง': job.destination,
                'บริษัทรถร่วม': job.subcontractor || '-',
                'คนขับ': job.driverName || '-',
                'เบอร์โทรคนขับ': job.driverPhone || '-',
                'ทะเบียนรถ': job.licensePlate || '-',
                'ประเภทรถ': job.truckType || '-',
                'รายละเอียดสินค้า': job.productDetail || '-',
                'น้ำหนัก/ปริมาณ': job.weightVolume || '-',
                'วันที่เสร็จงาน': job.actualArrivalTime ? formatDate(job.actualArrivalTime) : '-',
                'ระยะทาง (km)': job.mileage || '-',
                'หมายเหตุ': job.remark || '-',
            };

            if (isFinanceRole) {
                base['ต้นทุนพื้นฐาน (Base Cost)'] = job.cost || 0;
                base['ค่าใช้จ่ายพิเศษ (Extra)'] = extraTotal;
                base['ต้นทุนรวม (Total Cost)'] = totalCost;
                base['ธนาคาร'] = job.bankName || '-';
                base['ชื่อบัญชี'] = job.bankAccountName || '-';
                base['เลขที่บัญชี'] = job.bankAccountNo || '-';
                base['เลขผู้เสียภาษี (Tax ID)'] = job.taxId || '-';
                base['หมายเหตุบัญชี'] = job.accountingRemark || '-';
            }

            return base;
        });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Daily Report');
        XLSX.writeFile(workbook, `Daily_Report_${dateFrom}_to_${dateTo}.xlsx`);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header Section */}
            <div className="flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4 bg-white p-4 md:p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center w-full xl:w-auto">
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-xl text-white">
                                <FileSpreadsheet size={20} md:size={24} />
                            </div>
                            สรุปงานรายวัน (Daily Report)
                        </h2>
                        <p className="text-slate-500 font-medium text-[10px] md:text-sm mt-1 ml-11 md:ml-14">
                            {filterMode === 'today' ? `รายงานงานที่ให้บริการวันที่ ${formatDate(today)}`
                                : filterMode === 'month' ? `รายงานงานประจำเดือน ${new Date(filterMonth + '-01').toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })}`
                                : effectiveDateFrom === effectiveDateTo ? `รายงานงานที่ให้บริการวันที่ ${formatDate(effectiveDateFrom)}` : `รายงานงานที่ให้บริการ ${formatDate(effectiveDateFrom)} ถึง ${formatDate(effectiveDateTo)}`}
                        </p>
                    </div>

                    {/* View Toggle */}
                    {currentUser.role !== UserRole.ACCOUNTANT && currentUser.role !== UserRole.ADMIN && (
                        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner w-full md:w-auto">
                            <button
                                onClick={() => setViewMode('my')}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'my' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <User size={14} />
                                งานของฉัน
                            </button>
                            <button
                                onClick={() => setViewMode('all')}
                                className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'all' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                <Users size={14} />
                                งานทั้งหมด
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
                    {/* Subcontractor Filter */}
                    <select
                        value={selectedSub}
                        onChange={(e) => setSelectedSub(e.target.value)}
                        title="กรองตามบริษัทรถร่วม"
                        className="px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-blue-100 outline-none cursor-pointer"
                    >
                        <option value="">บริษัทรถร่วมทั้งหมด</option>
                        {subList.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {/* Filter Mode Buttons */}
                    <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                        <button onClick={() => setFilterMode('today')} className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${filterMode === 'today' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>วันนี้</button>
                        <button onClick={() => setFilterMode('month')} className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${filterMode === 'month' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>เดือน</button>
                        <button onClick={() => setFilterMode('custom')} className={`px-3 py-2 rounded-lg text-xs font-black transition-all ${filterMode === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>กำหนดเอง</button>
                    </div>

                    {/* Month Picker */}
                    {filterMode === 'month' && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                            <Calendar className="text-blue-500 shrink-0" size={15} />
                            <input
                                type="month"
                                value={filterMonth}
                                onChange={e => setFilterMonth(e.target.value)}
                                title="เลือกเดือน"
                                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none cursor-pointer"
                            />
                        </div>
                    )}

                    {/* Custom Date Range Picker */}
                    {filterMode === 'custom' && (
                        <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                            <Calendar className="text-slate-400 shrink-0" size={15} />
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => {
                                    setDateFrom(e.target.value);
                                    if (e.target.value > dateTo) setDateTo(e.target.value);
                                }}
                                title="วันที่เริ่มต้น"
                                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none cursor-pointer w-32"
                            />
                            <span className="text-slate-400 font-bold text-xs shrink-0">ถึง</span>
                            <input
                                type="date"
                                value={dateTo}
                                min={dateFrom}
                                onChange={(e) => setDateTo(e.target.value)}
                                title="วันที่สิ้นสุด"
                                className="bg-transparent text-sm font-black text-slate-700 focus:outline-none cursor-pointer w-32"
                            />
                        </div>
                    )}
                    <button
                        onClick={handleExport}
                        disabled={filteredJobs.length === 0}
                        className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 whitespace-nowrap"
                    >
                        <FileSpreadsheet size={18} />
                        Export
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className={`grid gap-4 ${isFinanceRole ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Truck size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">รวม</p>
                        <p className="text-xl md:text-2xl font-black text-slate-800">{stats.total}</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-amber-50 text-amber-600 rounded-lg">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">รอจัด</p>
                        <p className="text-xl md:text-2xl font-black text-slate-800">{stats.pending}</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-indigo-50 text-indigo-600 rounded-lg">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">วิ่งงาน</p>
                        <p className="text-xl md:text-2xl font-black text-slate-800">{stats.assigned}</p>
                    </div>
                </div>
                <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3 md:gap-4">
                    <div className="p-2 md:p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <CheckCircle2 size={20} />
                    </div>
                    <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">เสร็จ</p>
                        <p className="text-xl md:text-2xl font-black text-slate-800">{stats.completed}</p>
                    </div>
                </div>
                {isFinanceRole && (
                    <div className="bg-amber-50 p-3 md:p-4 rounded-xl border border-amber-200 shadow-sm flex items-center gap-3 md:gap-4 col-span-2 lg:col-span-1">
                        <div className="p-2 md:p-3 bg-amber-100 text-amber-700 rounded-lg shrink-0">
                            <FileSpreadsheet size={20} />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] font-bold text-amber-600 uppercase">ต้นทุนรวม (BI)</p>
                            <p className="text-lg md:text-xl font-black text-amber-800 truncate">฿{costStats.totalBaseCost.toLocaleString()}</p>
                            {costStats.totalExtraCost > 0 && (
                                <p className="text-[10px] font-bold text-orange-500">+Extra ฿{costStats.totalExtraCost.toLocaleString()}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Table/List Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-slate-700 text-sm uppercase tracking-wide">รายการเดินรถประจำวัน</h3>
                            <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{filteredJobs.length} รายการ</span>
                        </div>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input
                                type="text"
                                placeholder="ค้นหา (ทะเบียน, ผู้รับเหมา, เลขงาน)..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 md:py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                            />
                        </div>
                    </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-max">
                        <thead>
                            <tr className="bg-slate-50 text-xs font-black text-slate-500 uppercase tracking-wider border-b border-slate-200">
                                <th className="px-4 py-4 whitespace-nowrap">Job ID</th>
                                <th className="px-4 py-4 whitespace-nowrap">วันที่ให้บริการ</th>
                                <th className="px-4 py-4 whitespace-nowrap">สถานะ</th>
                                <th className="px-4 py-4 whitespace-nowrap">Route</th>
                                <th className="px-4 py-4 whitespace-nowrap">บริษัทรถร่วม / คนขับ</th>
                                <th className="px-4 py-4 whitespace-nowrap">ทะเบียน / ประเภท</th>
                                <th className="px-4 py-4 whitespace-nowrap">สินค้า / น้ำหนัก</th>
                                <th className="px-4 py-4 whitespace-nowrap">เสร็จงาน / ระยะทาง</th>
                                <th className="px-4 py-4 whitespace-nowrap">หมายเหตุ</th>
                                {isFinanceRole && <th className="px-4 py-4 whitespace-nowrap bg-amber-50 text-amber-700">ต้นทุน (฿)</th>}
                                {isFinanceRole && <th className="px-4 py-4 whitespace-nowrap bg-amber-50 text-amber-700">ข้อมูลการชำระ</th>}
                                {isFinanceRole && <th className="px-4 py-4 whitespace-nowrap bg-amber-50 text-amber-700">หมายเหตุบัญชี</th>}
                            </tr>
                        </thead>
                        <tbody className="text-sm divide-y divide-slate-100">
                            {filteredJobs.length > 0 ? (
                                filteredJobs.map((job) => {
                                    const extraTotal = (job.extraCharges || [])
                                        .filter(e => e.status === 'APPROVED')
                                        .reduce((s, e) => s + (e.amount || 0), 0);
                                    const totalCost = (job.cost || 0) + extraTotal;
                                    return (
                                        <tr key={job.id} className="hover:bg-blue-50/30 transition-colors group">
                                            {/* Job ID */}
                                            <td className="px-4 py-3 font-mono font-bold text-blue-600 whitespace-nowrap">
                                                <button onClick={() => { setPreviewJob(job); setIsPreviewOpen(true); }} className="flex items-center gap-1.5 hover:text-blue-800 transition-colors">
                                                    <Eye size={13} className="text-slate-400" />#{job.id}
                                                </button>
                                            </td>
                                            {/* วันที่ให้บริการ */}
                                            <td className="px-4 py-3 text-xs font-bold text-slate-700 whitespace-nowrap">{formatDate(job.dateOfService)}</td>
                                            {/* สถานะ */}
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : job.status === JobStatus.ASSIGNED ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                                                    {JOB_STATUS_LABELS[job.status]}
                                                </span>
                                            </td>
                                            {/* Route */}
                                            <td className="px-4 py-3">
                                                <div className="flex flex-col gap-0.5 text-[11px] font-bold text-slate-600 min-w-[140px]">
                                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>{job.origin}</div>
                                                    {job.drops && job.drops.length > 0 && job.drops.map((d, i) => (
                                                        <div key={i} className="flex items-center gap-1.5 ml-2 text-purple-600"><div className="w-1 h-1 rounded-full bg-purple-400 shrink-0"></div>{d.location}</div>
                                                    ))}
                                                    <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></div>{job.destination}</div>
                                                </div>
                                            </td>
                                            {/* บริษัทรถร่วม / คนขับ */}
                                            <td className="px-4 py-3">
                                                <div className="text-xs min-w-[120px]">
                                                    <div className="font-black text-slate-700">{job.subcontractor || '-'}</div>
                                                    {job.driverName && <div className="flex items-center gap-1 font-bold text-slate-500 mt-0.5"><User size={10} />{job.driverName}</div>}
                                                    {job.driverPhone && <div className="flex items-center gap-1 font-bold text-slate-400 mt-0.5"><Phone size={10} />{job.driverPhone}</div>}
                                                </div>
                                            </td>
                                            {/* ทะเบียน / ประเภท */}
                                            <td className="px-4 py-3">
                                                <div className="text-xs whitespace-nowrap">
                                                    <div className="font-black text-slate-700">{job.licensePlate || '-'}</div>
                                                    <div className="font-bold text-slate-400">{job.truckType}</div>
                                                </div>
                                            </td>
                                            {/* สินค้า / น้ำหนัก */}
                                            <td className="px-4 py-3">
                                                <div className="text-xs min-w-[110px]">
                                                    <div className="flex items-center gap-1 font-bold text-slate-700"><Package size={10} className="shrink-0 text-slate-400" />{job.productDetail || '-'}</div>
                                                    <div className="font-bold text-slate-400 mt-0.5">{job.weightVolume || '-'}</div>
                                                </div>
                                            </td>
                                            {/* เสร็จงาน / ระยะทาง */}
                                            <td className="px-4 py-3">
                                                <div className="text-xs whitespace-nowrap">
                                                    <div className="font-bold text-slate-700">{job.actualArrivalTime ? formatDate(job.actualArrivalTime) : '-'}</div>
                                                    <div className="font-bold text-slate-400">{job.mileage ? `${job.mileage} km` : '-'}</div>
                                                </div>
                                            </td>
                                            {/* หมายเหตุ */}
                                            <td className="px-4 py-3 max-w-[140px]">
                                                <div className="text-[11px] text-slate-500 font-medium truncate" title={job.remark || '-'}>{job.remark || '-'}</div>
                                            </td>
                                            {/* ต้นทุน — ADMIN/ACCOUNTANT only */}
                                            {isFinanceRole && (
                                                <td className="px-4 py-3 bg-amber-50/40 whitespace-nowrap">
                                                    <div className="text-xs">
                                                        <div className="font-bold text-slate-500">Base: ฿{(job.cost || 0).toLocaleString()}</div>
                                                        {extraTotal > 0 && <div className="font-bold text-orange-600">Extra: ฿{extraTotal.toLocaleString()}</div>}
                                                        <div className="font-black text-slate-800 border-t border-slate-200 mt-0.5 pt-0.5">฿{totalCost.toLocaleString()}</div>
                                                    </div>
                                                </td>
                                            )}
                                            {/* ข้อมูลการชำระ — ADMIN/ACCOUNTANT only */}
                                            {isFinanceRole && (
                                                <td className="px-4 py-3 bg-amber-50/40">
                                                    <div className="text-[11px] min-w-[130px]">
                                                        <div className="font-bold text-slate-600">{job.bankName || '-'}</div>
                                                        <div className="font-bold text-slate-500">{job.bankAccountName || '-'}</div>
                                                        <div className="font-bold text-slate-400">{job.bankAccountNo || '-'}</div>
                                                        {job.taxId && <div className="font-bold text-slate-400 mt-0.5">Tax: {job.taxId}</div>}
                                                    </div>
                                                </td>
                                            )}
                                            {/* หมายเหตุบัญชี — ADMIN/ACCOUNTANT only */}
                                            {isFinanceRole && (
                                                <td className="px-4 py-3 bg-amber-50/40 max-w-[130px]">
                                                    <div className="text-[11px] text-slate-500 font-medium truncate" title={job.accountingRemark || '-'}>{job.accountingRemark || '-'}</div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={isFinanceRole ? 12 : 9} className="px-6 py-12 text-center text-slate-400 font-bold">ไม่พบข้อมูลงาน</td>
                                </tr>
                            )}
                        </tbody>
                        {isFinanceRole && filteredJobs.length > 0 && (
                            <tfoot>
                                <tr className="bg-amber-50 border-t-2 border-amber-200">
                                    <td colSpan={9} className="px-4 py-3 text-right text-[11px] font-black text-amber-700 uppercase tracking-wider">
                                        ยอดรวม {filteredJobs.length} งาน
                                    </td>
                                    <td className="px-4 py-3 bg-amber-100 whitespace-nowrap">
                                        <div className="text-xs">
                                            <div className="font-bold text-slate-600">Base: ฿{costStats.totalBaseCost.toLocaleString()}</div>
                                            {costStats.totalExtraCost > 0 && <div className="font-bold text-orange-600">Extra: ฿{costStats.totalExtraCost.toLocaleString()}</div>}
                                            <div className="font-black text-amber-800 border-t border-amber-300 mt-0.5 pt-0.5">รวม ฿{costStats.totalCombined.toLocaleString()}</div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 bg-amber-100"></td>
                                    <td className="px-4 py-3 bg-amber-100"></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="lg:hidden divide-y divide-slate-100">
                    {filteredJobs.length > 0 ? (
                        filteredJobs.map((job) => (
                            <div
                                key={job.id}
                                className="p-4 hover:bg-slate-50 transition-colors"
                                onClick={() => {
                                    setPreviewJob(job);
                                    setIsPreviewOpen(true);
                                }}
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-blue-600 font-mono">#{job.id}</span>
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide border ${job.status === JobStatus.COMPLETED || job.status === JobStatus.BILLED ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                                                job.status === JobStatus.ASSIGNED ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                    'bg-amber-100 text-amber-700 border-amber-200'
                                                }`}>
                                                {JOB_STATUS_LABELS[job.status]}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-slate-400 font-bold">
                                            {job.requestedByName || 'Unknown'} • {formatDate(job.createdAt || job.dateOfService)}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-black text-slate-700">{job.licensePlate || '-'}</div>
                                        <div className="text-[10px] font-bold text-slate-400 uppercase">{job.truckType}</div>
                                    </div>
                                </div>

                                <div className="space-y-2 mb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"></div>
                                        <span className="text-xs font-bold text-slate-600 truncate">{job.origin}</span>
                                    </div>
                                    {/* Drop-off Points for Mobile */}
                                    {job.drops && job.drops.length > 0 && (
                                        <div className="flex items-center gap-1 ml-3 flex-wrap">
                                            <MapPin size={10} className="text-purple-500" />
                                            {job.drops.map((drop, idx) => (
                                                <span key={idx} className="text-[9px] text-purple-600 font-bold">
                                                    {drop.location}{idx < job.drops!.length - 1 ? ',' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0"></div>
                                        <span className="text-xs font-bold text-slate-600 truncate">{job.destination}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between text-[10px] font-black">
                                    <div className="text-slate-500">{job.driverName || 'No Driver'}</div>
                                    <div className="text-blue-600 bg-blue-50 px-2 py-1 rounded">{job.subcontractor || 'No Sub'}</div>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="p-12 text-center text-slate-400 font-bold">ไม่พบข้อมูลงาน</div>
                    )}
                </div>

                <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
                    <p className="text-[10px] text-slate-400 italic">
                        * ข้อมูลเดินรถภายใน (Internal Use Only)
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
