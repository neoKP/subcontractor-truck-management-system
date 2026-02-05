
import React, { useState, useMemo } from 'react';
import {
  DollarSign, FileText, Calendar, Building2, Search, Filter,
  Plus, Eye, CheckCircle, AlertTriangle, Clock, X, Save,
  Receipt, TrendingUp, Banknote, Upload, Trash2, ArrowRight
} from 'lucide-react';
import { Job, SubcontractorInvoice, InvoiceDeduction, InvoiceStatus, PriceMatrix, UserRole } from '../types';
import { formatDate, formatThaiCurrency } from '../utils/format';

interface PaymentDashboardProps {
  jobs: Job[];
  invoices: SubcontractorInvoice[];
  priceMatrix: PriceMatrix[];
  onCreateInvoice: (invoice: SubcontractorInvoice) => void;
  onUpdateInvoice: (invoice: SubcontractorInvoice) => void;
  user: { id: string; name: string; role: UserRole };
}

const PaymentDashboard: React.FC<PaymentDashboardProps> = ({
  jobs,
  invoices,
  priceMatrix,
  onCreateInvoice,
  onUpdateInvoice,
  user
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'pending' | 'invoices' | 'create'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSubCon, setFilterSubCon] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<SubcontractorInvoice | null>(null);

  // Get completed jobs that haven't been invoiced yet
  const completedJobs = useMemo(() => {
    const invoicedJobIds = invoices.flatMap(inv => inv.jobIds);
    return jobs.filter(job => 
      job.status === 'Completed' && 
      job.subcontractor &&
      !invoicedJobIds.includes(job.id)
    );
  }, [jobs, invoices]);

  // Get unique subcontractors from completed jobs
  const subcontractors = useMemo(() => {
    const subs = [...new Set(completedJobs.map(j => j.subcontractor).filter(Boolean))];
    return subs as string[];
  }, [completedJobs]);

  // Calculate totals
  const totals = useMemo(() => {
    const pending = invoices.filter(inv => inv.status === InvoiceStatus.PENDING);
    const overdue = invoices.filter(inv => inv.status === InvoiceStatus.OVERDUE);
    const paid = invoices.filter(inv => inv.status === InvoiceStatus.PAID);
    
    return {
      pendingCount: pending.length,
      pendingAmount: pending.reduce((sum, inv) => sum + inv.netAmount, 0),
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, inv) => sum + inv.netAmount, 0),
      paidCount: paid.length,
      paidAmount: paid.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0),
      uninvoicedJobs: completedJobs.length,
      uninvoicedAmount: completedJobs.reduce((sum, job) => sum + (job.cost || 0), 0)
    };
  }, [invoices, completedJobs]);

  // Create Invoice Modal State
  const [createForm, setCreateForm] = useState({
    subcontractor: '',
    periodStart: '',
    periodEnd: '',
    selectedJobs: [] as string[],
    deductions: [] as InvoiceDeduction[]
  });

  // Payment Modal State
  const [paymentForm, setPaymentForm] = useState({
    paidAmount: 0,
    paymentRef: '',
    paymentSlipUrl: ''
  });

  // Get jobs for selected subcontractor in create modal
  const jobsForSubcontractor = useMemo(() => {
    if (!createForm.subcontractor) return [];
    return completedJobs.filter(job => 
      job.subcontractor === createForm.subcontractor &&
      (!createForm.periodStart || job.dateOfService >= createForm.periodStart) &&
      (!createForm.periodEnd || job.dateOfService <= createForm.periodEnd)
    );
  }, [completedJobs, createForm.subcontractor, createForm.periodStart, createForm.periodEnd]);

  // Calculate invoice totals
  const invoiceTotals = useMemo(() => {
    const selectedJobsData = jobsForSubcontractor.filter(j => createForm.selectedJobs.includes(j.id));
    const totalAmount = selectedJobsData.reduce((sum, j) => sum + (j.cost || 0), 0);
    const totalDeductions = createForm.deductions.reduce((sum, d) => sum + d.amount, 0);
    return {
      totalAmount,
      totalDeductions,
      netAmount: totalAmount - totalDeductions
    };
  }, [jobsForSubcontractor, createForm.selectedJobs, createForm.deductions]);

  // Get payment terms for subcontractor
  const getPaymentTerms = (subcontractor: string) => {
    const match = priceMatrix.find(p => p.subcontractor === subcontractor);
    return {
      paymentType: match?.paymentType || 'CREDIT',
      creditDays: match?.creditDays || 30
    };
  };

  // Generate invoice number
  const generateInvoiceNo = () => {
    const year = new Date().getFullYear();
    const count = invoices.filter(inv => inv.invoiceNo.includes(`INV-${year}`)).length + 1;
    return `INV-${year}-${String(count).padStart(4, '0')}`;
  };

  // Handle create invoice
  const handleCreateInvoice = () => {
    if (!createForm.subcontractor || createForm.selectedJobs.length === 0) return;

    const terms = getPaymentTerms(createForm.subcontractor);
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (terms.creditDays || 0));

    const newInvoice: SubcontractorInvoice = {
      id: `inv-${Date.now()}`,
      invoiceNo: generateInvoiceNo(),
      subcontractor: createForm.subcontractor,
      periodStart: createForm.periodStart || jobsForSubcontractor[0]?.dateOfService || new Date().toISOString().split('T')[0],
      periodEnd: createForm.periodEnd || jobsForSubcontractor[jobsForSubcontractor.length - 1]?.dateOfService || new Date().toISOString().split('T')[0],
      jobIds: createForm.selectedJobs,
      totalAmount: invoiceTotals.totalAmount,
      deductions: createForm.deductions,
      netAmount: invoiceTotals.netAmount,
      dueDate: dueDate.toISOString().split('T')[0],
      status: InvoiceStatus.PENDING,
      createdAt: new Date().toISOString(),
      createdBy: user.name
    };

    onCreateInvoice(newInvoice);
    setShowCreateModal(false);
    setCreateForm({
      subcontractor: '',
      periodStart: '',
      periodEnd: '',
      selectedJobs: [],
      deductions: []
    });
  };

  // Handle payment
  const handlePayment = () => {
    if (!selectedInvoice) return;

    const updatedInvoice: SubcontractorInvoice = {
      ...selectedInvoice,
      status: InvoiceStatus.PAID,
      paidDate: new Date().toISOString().split('T')[0],
      paidAmount: paymentForm.paidAmount,
      paymentRef: paymentForm.paymentRef,
      paymentSlipUrl: paymentForm.paymentSlipUrl
    };

    onUpdateInvoice(updatedInvoice);
    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setPaymentForm({ paidAmount: 0, paymentRef: '', paymentSlipUrl: '' });
  };

  // Add deduction
  const addDeduction = (type: 'DAMAGE' | 'WITHHOLDING_TAX' | 'OTHER') => {
    setCreateForm(prev => ({
      ...prev,
      deductions: [
        ...prev.deductions,
        {
          id: `ded-${Date.now()}`,
          type,
          description: type === 'DAMAGE' ? 'ค่าเสียหาย' : type === 'WITHHOLDING_TAX' ? 'ภาษี ณ ที่จ่าย 1%' : '',
          amount: type === 'WITHHOLDING_TAX' ? Math.round(invoiceTotals.totalAmount * 0.01) : 0
        }
      ]
    }));
  };

  // Filter invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchSearch = searchTerm === '' ||
        inv.invoiceNo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        inv.subcontractor.toLowerCase().includes(searchTerm.toLowerCase());
      const matchSub = filterSubCon === '' || inv.subcontractor === filterSubCon;
      return matchSearch && matchSub;
    });
  }, [invoices, searchTerm, filterSubCon]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 rounded-[2rem] p-8 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
            <Banknote size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">ระบบวางบิลและจ่ายเงินรถร่วม</h1>
            <p className="text-emerald-100 text-sm font-bold">Subcontractor Payment Management</p>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-emerald-100 text-[10px] font-black uppercase tracking-widest">รอวางบิล</p>
            <p className="text-2xl font-black">{totals.uninvoicedJobs} งาน</p>
            <p className="text-emerald-200 text-sm font-bold">฿{formatThaiCurrency(totals.uninvoicedAmount)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-yellow-200 text-[10px] font-black uppercase tracking-widest">รอจ่าย</p>
            <p className="text-2xl font-black">{totals.pendingCount} ใบ</p>
            <p className="text-yellow-200 text-sm font-bold">฿{formatThaiCurrency(totals.pendingAmount)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-red-200 text-[10px] font-black uppercase tracking-widest">เกินกำหนด</p>
            <p className="text-2xl font-black">{totals.overdueCount} ใบ</p>
            <p className="text-red-200 text-sm font-bold">฿{formatThaiCurrency(totals.overdueAmount)}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4">
            <p className="text-emerald-200 text-[10px] font-black uppercase tracking-widest">จ่ายแล้ว</p>
            <p className="text-2xl font-black">{totals.paidCount} ใบ</p>
            <p className="text-emerald-200 text-sm font-bold">฿{formatThaiCurrency(totals.paidAmount)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'overview', label: '📊 ภาพรวม', icon: TrendingUp },
          { id: 'pending', label: '⏳ รอวางบิล', icon: Clock },
          { id: 'invoices', label: '📄 ใบวางบิล', icon: FileText },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'
                : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
        <button
          onClick={() => setShowCreateModal(true)}
          className="ml-auto px-5 py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center gap-2"
        >
          <Plus size={16} /> สร้างใบวางบิล
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-[2rem] shadow-lg border border-slate-100 overflow-hidden">
        {activeTab === 'overview' && (
          <div className="p-6 space-y-6">
            <h2 className="text-lg font-black text-slate-800">📊 สรุปยอดค้างจ่ายแยกตามบริษัทรถร่วม</h2>
            <div className="grid gap-4">
              {subcontractors.map(sub => {
                const subJobs = completedJobs.filter(j => j.subcontractor === sub);
                const subTotal = subJobs.reduce((sum, j) => sum + (j.cost || 0), 0);
                const terms = getPaymentTerms(sub);
                return (
                  <div key={sub} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-slate-200 rounded-xl">
                        <Building2 size={20} className="text-slate-600" />
                      </div>
                      <div>
                        <p className="font-black text-slate-800">{sub}</p>
                        <p className="text-sm text-slate-500">{subJobs.length} งานรอวางบิล</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-800">฿{formatThaiCurrency(subTotal)}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        terms.paymentType === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {terms.paymentType === 'CASH' ? '💵 เงินสด' : `📅 ${terms.creditDays} วัน`}
                      </span>
                    </div>
                  </div>
                );
              })}
              {subcontractors.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <Receipt size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-bold">ไม่มีงานที่รอวางบิล</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'pending' && (
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-black text-slate-800">⏳ งานที่รอวางบิล</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Job ID</th>
                    <th className="px-4 py-3">วันที่</th>
                    <th className="px-4 py-3">เส้นทาง</th>
                    <th className="px-4 py-3">บริษัทรถร่วม</th>
                    <th className="px-4 py-3 text-right">ยอดเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedJobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">{job.id}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(job.dateOfService)}</td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-800">{job.origin}</span>
                        <ArrowRight size={12} className="inline mx-1 text-slate-400" />
                        <span className="text-slate-600">{job.destination}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 bg-slate-100 rounded font-bold text-slate-600">{job.subcontractor}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-black text-slate-800">฿{formatThaiCurrency(job.cost || 0)}</td>
                    </tr>
                  ))}
                  {completedJobs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                        ไม่มีงานที่รอวางบิล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ค้นหาใบวางบิล..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 text-sm"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-bold"
                value={filterSubCon}
                onChange={e => setFilterSubCon(e.target.value)}
              >
                <option value="">ทุกบริษัท</option>
                {[...new Set(invoices.map(inv => inv.subcontractor))].map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {filteredInvoices.map(inv => (
                <div key={inv.id} className={`rounded-2xl p-4 border-2 ${
                  inv.status === InvoiceStatus.PAID ? 'bg-emerald-50 border-emerald-200' :
                  inv.status === InvoiceStatus.OVERDUE ? 'bg-red-50 border-red-200' :
                  'bg-white border-slate-200'
                }`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-black text-slate-800">{inv.invoiceNo}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          inv.status === InvoiceStatus.PAID ? 'bg-emerald-100 text-emerald-700' :
                          inv.status === InvoiceStatus.OVERDUE ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {inv.status === InvoiceStatus.PAID ? '✅ จ่ายแล้ว' :
                           inv.status === InvoiceStatus.OVERDUE ? '⚠️ เกินกำหนด' :
                           '⏳ รอจ่าย'}
                        </span>
                      </div>
                      <p className="font-bold text-slate-600">{inv.subcontractor}</p>
                      <p className="text-xs text-slate-400">
                        {formatDate(inv.periodStart)} - {formatDate(inv.periodEnd)} • {inv.jobIds.length} งาน
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-slate-800">฿{formatThaiCurrency(inv.netAmount)}</p>
                      <p className="text-xs text-slate-400">ครบกำหนด: {formatDate(inv.dueDate)}</p>
                      {inv.status === InvoiceStatus.PENDING && (
                        <button
                          onClick={() => {
                            setSelectedInvoice(inv);
                            setPaymentForm({ paidAmount: inv.netAmount, paymentRef: '', paymentSlipUrl: '' });
                            setShowPaymentModal(true);
                          }}
                          className="mt-2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700"
                        >
                          💰 บันทึกจ่าย
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filteredInvoices.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <FileText size={48} className="mx-auto mb-4 opacity-50" />
                  <p className="font-bold">ไม่พบใบวางบิล</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">สร้างใบวางบิล</h2>
                  <p className="text-blue-100 text-sm">Create Batch Invoice</p>
                </div>
                <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/20 rounded-xl">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Subcontractor Selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase">เลือกบริษัทรถร่วม</label>
                <select
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 font-bold text-lg focus:border-blue-500 outline-none"
                  value={createForm.subcontractor}
                  onChange={e => setCreateForm({ ...createForm, subcontractor: e.target.value, selectedJobs: [] })}
                >
                  <option value="">-- เลือกบริษัท --</option>
                  {subcontractors.map(sub => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              {/* Period Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">วันที่เริ่มต้น</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                    value={createForm.periodStart}
                    onChange={e => setCreateForm({ ...createForm, periodStart: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-500 uppercase">วันที่สิ้นสุด</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2 rounded-xl border border-slate-200"
                    value={createForm.periodEnd}
                    onChange={e => setCreateForm({ ...createForm, periodEnd: e.target.value })}
                  />
                </div>
              </div>

              {/* Jobs Selection */}
              {createForm.subcontractor && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-500 uppercase">เลือกงาน ({jobsForSubcontractor.length} งาน)</label>
                    <button
                      onClick={() => setCreateForm({ ...createForm, selectedJobs: jobsForSubcontractor.map(j => j.id) })}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      เลือกทั้งหมด
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                    {jobsForSubcontractor.map(job => (
                      <label key={job.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={createForm.selectedJobs.includes(job.id)}
                          onChange={e => {
                            if (e.target.checked) {
                              setCreateForm({ ...createForm, selectedJobs: [...createForm.selectedJobs, job.id] });
                            } else {
                              setCreateForm({ ...createForm, selectedJobs: createForm.selectedJobs.filter(id => id !== job.id) });
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-600"
                        />
                        <div className="flex-1">
                          <span className="font-mono text-xs text-slate-400">{job.id}</span>
                          <span className="mx-2 text-slate-400">|</span>
                          <span className="text-sm font-bold text-slate-700">{job.origin} → {job.destination}</span>
                        </div>
                        <span className="font-black text-slate-800">฿{formatThaiCurrency(job.cost || 0)}</span>
                      </label>
                    ))}
                    {jobsForSubcontractor.length === 0 && (
                      <div className="p-6 text-center text-slate-400">ไม่พบงานในช่วงเวลาที่เลือก</div>
                    )}
                  </div>
                </div>
              )}

              {/* Deductions */}
              {createForm.selectedJobs.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-500 uppercase">รายการหัก</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => addDeduction('DAMAGE')}
                        className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold hover:bg-rose-100"
                      >
                        + ค่าเสียหาย
                      </button>
                      <button
                        onClick={() => addDeduction('WITHHOLDING_TAX')}
                        className="px-3 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-bold hover:bg-amber-100"
                      >
                        + ภาษี ณ ที่จ่าย
                      </button>
                      <button
                        onClick={() => addDeduction('OTHER')}
                        className="px-3 py-1 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100"
                      >
                        + อื่นๆ
                      </button>
                    </div>
                  </div>
                  {createForm.deductions.map((ded, idx) => (
                    <div key={ded.id} className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        ded.type === 'DAMAGE' ? 'bg-rose-100 text-rose-700' :
                        ded.type === 'WITHHOLDING_TAX' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-200 text-slate-600'
                      }`}>
                        {ded.type === 'DAMAGE' ? 'ค่าเสียหาย' : ded.type === 'WITHHOLDING_TAX' ? 'ภาษีหัก ณ ที่จ่าย' : 'อื่นๆ'}
                      </span>
                      <input
                        type="text"
                        placeholder="รายละเอียด"
                        className="flex-1 px-3 py-1 rounded-lg border border-slate-200 text-sm"
                        value={ded.description}
                        onChange={e => {
                          const newDeds = [...createForm.deductions];
                          newDeds[idx].description = e.target.value;
                          setCreateForm({ ...createForm, deductions: newDeds });
                        }}
                      />
                      <input
                        type="number"
                        placeholder="จำนวนเงิน"
                        className="w-32 px-3 py-1 rounded-lg border border-slate-200 text-sm text-right font-bold"
                        value={ded.amount}
                        onChange={e => {
                          const newDeds = [...createForm.deductions];
                          newDeds[idx].amount = Number(e.target.value) || 0;
                          setCreateForm({ ...createForm, deductions: newDeds });
                        }}
                      />
                      <button
                        onClick={() => {
                          setCreateForm({ ...createForm, deductions: createForm.deductions.filter((_, i) => i !== idx) });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Summary */}
              {createForm.selectedJobs.length > 0 && (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-200">
                  <h4 className="text-xs font-black text-emerald-700 uppercase mb-3">สรุปยอด</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-600">ยอดรวม ({createForm.selectedJobs.length} งาน)</span>
                      <span className="font-black text-slate-800">฿{formatThaiCurrency(invoiceTotals.totalAmount)}</span>
                    </div>
                    {createForm.deductions.length > 0 && (
                      <div className="flex justify-between text-rose-600">
                        <span>หัก</span>
                        <span className="font-black">-฿{formatThaiCurrency(invoiceTotals.totalDeductions)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-emerald-200">
                      <span className="font-black text-emerald-700">ยอดสุทธิ</span>
                      <span className="text-lg font-black text-emerald-700">฿{formatThaiCurrency(invoiceTotals.netAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-6 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleCreateInvoice}
                disabled={!createForm.subcontractor || createForm.selectedJobs.length === 0}
                className="px-6 py-2 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 flex items-center gap-2"
              >
                <Save size={16} /> สร้างใบวางบิล
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black">บันทึกการจ่ายเงิน</h2>
                  <p className="text-emerald-100 text-sm">{selectedInvoice.invoiceNo}</p>
                </div>
                <button onClick={() => setShowPaymentModal(false)} className="p-2 hover:bg-white/20 rounded-xl">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-sm text-slate-500">บริษัท: <span className="font-bold text-slate-800">{selectedInvoice.subcontractor}</span></p>
                <p className="text-2xl font-black text-slate-800 mt-1">฿{formatThaiCurrency(selectedInvoice.netAmount)}</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase">จำนวนเงินที่จ่าย</label>
                <input
                  type="number"
                  className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 font-bold text-lg focus:border-emerald-500 outline-none"
                  value={paymentForm.paidAmount}
                  onChange={e => setPaymentForm({ ...paymentForm, paidAmount: Number(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase">เลขอ้างอิง / เลขที่โอน</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200"
                  value={paymentForm.paymentRef}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentRef: e.target.value })}
                  placeholder="เช่น 20260205123456"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase">สลิปการโอน (URL)</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 rounded-xl border border-slate-200"
                  value={paymentForm.paymentSlipUrl}
                  onChange={e => setPaymentForm({ ...paymentForm, paymentSlipUrl: e.target.value })}
                  placeholder="แนบ URL รูปสลิป"
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="px-6 py-2 rounded-xl font-bold text-slate-600 hover:bg-slate-200"
              >
                ยกเลิก
              </button>
              <button
                onClick={handlePayment}
                className="px-6 py-2 rounded-xl font-bold bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-2"
              >
                <CheckCircle size={16} /> ยืนยันการจ่าย
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentDashboard;
