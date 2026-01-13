
import React, { useState } from 'react';
import { UserRole, Job, JobStatus, AuditLog, PriceMatrix, AccountingStatus } from './types';
import JobRequestForm from './components/JobRequestForm';
import JobBoard from './components/JobBoard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import BillingView from './components/BillingView';
import PricingTableView from './components/PricingTableView';
import LoginPage from './components/LoginPage';
import { PRICE_MATRIX } from './constants';
import AccountingReportsView from './components/AccountingReportsView';
import AccountingVerificationView from './components/AccountingVerificationView';
import UserManagementView from './components/UserManagementView';
import ProfitAnalysisView from './components/ProfitAnalysisView';
import JobSummaryBoard from './components/JobSummaryBoard';
import { ShieldCheck, Truck, Receipt, Tag, Search, PieChart, ClipboardCheck, Users, TrendingUp, LayoutPanelTop } from 'lucide-react';
import { db, ref, onValue, set, remove } from './firebaseConfig';

// Initial Users Data for Seeding
const INITIAL_USERS = [
  { id: 'ADMIN_001', name: 'System Admin', role: UserRole.ADMIN, username: 'ADMIN001', password: 'a888' },
  { id: 'ACCOUNTANT_001', name: 'ADMIN Accountant', role: UserRole.ACCOUNTANT, username: 'ACCOUNT001', password: 'ac999' },
  { id: 'DISPATCHER_001', name: 'Fleet Dispatcher', role: UserRole.DISPATCHER, username: 'DISPATCH001', password: 't777' },
  { id: 'BOOKING_001', name: 'อภัสนันท์ ภู่จรัสธนพัฒน์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING001', password: 'b001' },
  { id: 'BOOKING_002', name: 'วรารัตน์ แก้วนิ่ม', role: UserRole.BOOKING_OFFICER, username: 'BOOKING002', password: 'b002' },
  { id: 'BOOKING_003', name: 'กุลณัฐ คิดดีจริง', role: UserRole.BOOKING_OFFICER, username: 'BOOKING003', password: 'b003' },
  { id: 'BOOKING_004', name: 'ชนัญชิดา พวงมาลัย', role: UserRole.BOOKING_OFFICER, username: 'BOOKING004', password: 'b004' },
  { id: 'BOOKING_005', name: 'สุภาพร ชูชัยสุวรรณศรี', role: UserRole.BOOKING_OFFICER, username: 'BOOKING005', password: 'b005' },
  { id: 'BOOKING_006', name: 'ชุติมา สีหาบุตร', role: UserRole.BOOKING_OFFICER, username: 'BOOKING006', password: 'b006' },
  { id: 'BOOKING_007', name: 'เยาวนันท์ จันทรพิทักษ์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING007', password: 'b007' },
  { id: 'BOOKING_008', name: 'ขนิษฐา วัฒนวิกย์กรรม์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING008', password: 'b008' },
  { id: 'BOOKING_009', name: 'สุพัชญ์กานต์ ธีระภัณฑ์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING009', password: 'b009' },
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: UserRole } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [priceMatrix, setPriceMatrix] = useState<PriceMatrix[]>(PRICE_MATRIX);
  const [activeTab, setActiveTab] = useState<'board' | 'create' | 'logs' | 'billing' | 'pricing' | 'aggregation' | 'verify' | 'users' | 'profit'>('board');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 15;
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [showSummaryBoard, setShowSummaryBoard] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);

  // Sync with Firebase on mount
  React.useEffect(() => {
    // Listen for Jobs
    const jobsRef = ref(db, 'jobs');
    const unsubscribeJobs = onValue(jobsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setJobs(Object.values(data));
      }
    });

    // Listen for Logs
    const logsRef = ref(db, 'logs');
    const unsubscribeLogs = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setLogs(Object.values(data));
      }
      setLogsLoaded(true);
    });

    // Listen for Pricing
    const pricingRef = ref(db, 'priceMatrix');
    const unsubscribePricing = onValue(pricingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPriceMatrix(Object.values(data));
      } else {
        // Seed if empty
        set(pricingRef, PRICE_MATRIX);
      }
    });

    // Listen for Users
    const usersRef = ref(db, 'users');
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUsers(Object.values(data));
      } else {
        // Seed users if empty
        INITIAL_USERS.forEach(user => {
          set(ref(db, `users/${user.id}`), user);
        });
      }
    });

    return () => {
      unsubscribeJobs();
      unsubscribeLogs();
      unsubscribePricing();
      unsubscribeUsers();
    };
  }, []);

  const handleUserUpdate = (user: any) => {
    set(ref(db, `users/${user.id}`), user);
  };

  const handleUserDelete = (userId: string) => {
    remove(ref(db, `users/${userId}`));
  };
  const cleanJob = (job: Job): Job => {
    const cleaned = { ...job };
    // Numeric defaults
    cleaned.cost = cleaned.cost ?? 0;
    cleaned.sellingPrice = cleaned.sellingPrice ?? 0;
    cleaned.extraCharge = cleaned.extraCharge ?? 0;

    // Explicitly remove any undefined fields that Firebase might complain about
    Object.keys(cleaned).forEach(key => {
      if ((cleaned as any)[key] === undefined) {
        delete (cleaned as any)[key];
      }
    });

    return cleaned;
  };

  const addJob = (job: Job) => {
    // Persist to Firebase
    set(ref(db, `jobs/${job.id}`), cleanJob(job));
    setActiveTab('board');
  };

  const updateJob = (updatedJob: Job, newLogs?: AuditLog[]) => {
    // Persist to Firebase
    set(ref(db, `jobs/${updatedJob.id}`), cleanJob(updatedJob));
    if (newLogs && newLogs.length > 0) {
      newLogs.forEach(log => {
        set(ref(db, `logs/${log.id}`), log);
      });
    }
  };

  const handleVerifyJob = (updatedJob: Job, action: 'approve' | 'reject' | 'update', reason?: string) => {
    let finalJob = { ...updatedJob };
    const log: AuditLog = {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      jobId: updatedJob.id,
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || 'unknown',
      userRole: currentUser?.role || UserRole.ADMIN,
      timestamp: new Date().toISOString(),
      field: 'Accounting Status',
      oldValue: updatedJob.accountingStatus || 'Pending',
      newValue: action === 'approve' ? 'Approved' : 'Rejected',
      reason: reason || (action === 'approve' ? 'Accounting Verification Approved' : 'Accounting Rejected')
    };

    if (action === 'approve') {
      finalJob.accountingStatus = AccountingStatus.APPROVED;
      finalJob.isBaseCostLocked = true;
    } else if (action === 'reject') {
      finalJob.accountingStatus = AccountingStatus.REJECTED;
      finalJob.accountingRemark = reason;
      // Revert status to ASSIGNED so it appears back in the active flow for Dispatcher
      finalJob.status = JobStatus.ASSIGNED;
    }

    updateJob(finalJob, [log]);
  };

  const updatePriceMatrix = (newList: PriceMatrix[]) => {
    setPriceMatrix(newList);
    set(ref(db, 'priceMatrix'), newList);
  };

  const deleteJob = (jobId: string) => {
    // 1. Log the deletion before removing content (for safety trail)
    const log: AuditLog = {
      id: crypto.randomUUID(),
      jobId: jobId,
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || 'unknown',
      userRole: currentUser?.role || UserRole.ADMIN,
      timestamp: new Date().toISOString(),
      field: 'SYSTEM',
      oldValue: 'Active',
      newValue: 'Deleted',
      reason: 'Hard Delete by Admin'
    };
    set(ref(db, `logs/${log.id}`), log);

    // 2. Remove the job from Firebase
    remove(ref(db, `jobs/${jobId}`));
  };

  const handleLogin = (user: { id: string; name: string; role: UserRole }) => {
    setCurrentUser(user);
    setActiveTab('board');
  };

  const handleLogout = () => {
    setCurrentUser(null);
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} users={users} />;
  }

  return (
    <div className="flex min-h-screen bg-slate-50 overflow-x-hidden">
      <Sidebar
        className="no-print"
        currentRole={currentUser.role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
      />

      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
        <Header className="no-print" user={currentUser} onMenuToggle={toggleSidebar} jobs={jobs} />

        <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto w-full box-border">
          {activeTab === 'create' && currentUser.role === UserRole.BOOKING_OFFICER && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4 flex items-center gap-3">
                <Truck className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">สร้างใบงานใหม่ (Create New Job Request)</h2>
              </div>
              <div className="p-6">
                <JobRequestForm
                  onSubmit={addJob}
                  existingJobs={jobs}
                  priceMatrix={priceMatrix}
                  onShowSummary={() => setShowSummaryBoard(true)}
                />
              </div>
            </div>
          )}

          {activeTab === 'board' && (
            <JobBoard
              jobs={jobs}
              user={currentUser}
              onUpdateJob={updateJob}
              onDeleteJob={deleteJob}
              priceMatrix={priceMatrix}
              logs={logs}
              logsLoaded={logsLoaded}
            />
          )}

          {activeTab === 'pricing' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-800 px-6 py-4 flex items-center gap-3">
                <Tag className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">ข้อมูลราคากลาง (Subcontractor Master Pricing)</h2>
              </div>
              <div className="p-6">
                <PricingTableView
                  priceMatrix={priceMatrix}
                  onUpdate={updatePriceMatrix}
                  userRole={currentUser.role}
                />
              </div>
            </div>
          )}

          {activeTab === 'aggregation' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-indigo-600 px-6 py-4 flex items-center gap-3">
                <PieChart className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">การประมวลผลตัวเลข (Data Aggregation)</h2>
              </div>
              <div className="p-6">
                <AccountingReportsView jobs={jobs} logs={logs} userRole={currentUser.role} />
              </div>
            </div>
          )}

          {activeTab === 'profit' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4 flex items-center gap-3">
                <TrendingUp className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">วิเคราะห์ผลกำไรและประสิทธิภาพ (Profit Margin Analysis)</h2>
              </div>
              <div className="p-6">
                <ProfitAnalysisView jobs={jobs} userRole={currentUser.role} />
              </div>
            </div>
          )}

          {activeTab === 'verify' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-blue-600 px-6 py-4 flex items-center gap-3">
                <ClipboardCheck className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">ตรวจสอบและอนุมัติงาน (Verification Center)</h2>
              </div>
              <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 flex items-center gap-2">
                <ShieldCheck size={14} className="text-slate-400" />
                <span>ระบบตรวจสอบพิเศษสำหรับบัญชี: อนุมัติการจ่ายเงินและตรวจสอบหลักฐาน (Accounting Verification Module)</span>
              </div>
              <div className="p-6">
                <AccountingVerificationView jobs={jobs} onUpdateJob={handleVerifyJob} userRole={currentUser.role} />
              </div>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-emerald-600 px-6 py-4 flex items-center gap-3">
                <Receipt className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">การวางบิลและข้อมูลการเงิน (Billing & Financial)</h2>
              </div>
              <div className="p-6">
                <BillingView jobs={jobs} user={currentUser} onUpdateJob={updateJob} />
              </div>
            </div>
          )}

          {activeTab === 'users' && currentUser.role === UserRole.ADMIN && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-900 px-6 py-4 flex items-center gap-3">
                <Users className="text-white" size={24} />
                <h2 className="text-xl font-bold text-white">จัดการผู้ใช้งานระบบ (User Management)</h2>
              </div>
              <div className="p-6">
                <UserManagementView
                  users={users}
                  onAddUser={handleUserUpdate}
                  onUpdateUser={handleUserUpdate}
                  onDeleteUser={handleUserDelete}
                  currentUserRole={currentUser.role}
                />
              </div>
            </div>
          )}

          {activeTab === 'logs' && (() => {
            const filteredLogs = logs.filter(log =>
              !logSearch ||
              log.jobId.toLowerCase().includes(logSearch.toLowerCase()) ||
              log.userName.toLowerCase().includes(logSearch.toLowerCase()) ||
              (log.field || '').toLowerCase().includes(logSearch.toLowerCase())
            );
            const totalLogPages = Math.ceil(filteredLogs.length / logsPerPage);
            const paginatedLogs = filteredLogs.slice().reverse().slice((logPage - 1) * logsPerPage, logPage * logsPerPage);

            return (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="text-slate-600" size={24} />
                    <h2 className="text-xl font-bold text-slate-800">ประวัติการใช้งานระบบ (System Audit Trail)</h2>
                  </div>
                  <div className="relative w-full md:w-64">
                    <input
                      type="text"
                      placeholder="ค้นหา Job ID หรือผู้ใช้งาน..."
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all text-sm font-bold"
                      value={logSearch}
                      onChange={e => { setLogSearch(e.target.value); setLogPage(1); }}
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  </div>
                </div>
                <div className="p-0 overflow-x-auto max-h-[600px] scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500 uppercase text-[10px] font-black tracking-widest shadow-sm border-b border-slate-100">
                      <tr>
                        <th className="px-6 py-4">วัน-เวลา (TIMELINE)</th>
                        <th className="px-6 py-4">รายละเอียดการแก้ไข (ACTION SUMMARY)</th>
                        <th className="px-6 py-4">หมายเหตุ (REASON)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 italic">
                      {paginatedLogs.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-6 py-20 text-center text-slate-300 font-black uppercase tracking-widest italic">ไม่พบประวัติการใช้งานในขณะนี้ (No operational logs)</td>
                        </tr>
                      ) : (
                        paginatedLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors group not-italic">
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="text-xs font-black text-slate-800">
                                {(log.timestamp || '').includes('T') ? new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ((log.timestamp || '').includes(',') ? log.timestamp.split(',')[1] : log.timestamp)}
                              </div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                {(log.timestamp || '').includes('T') ? new Date(log.timestamp).toLocaleDateString('th-TH') : ((log.timestamp || '').includes(',') ? log.timestamp.split(',')[0] : '')}
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-black bg-blue-600 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">Job #{log.jobId}</span>
                                  <span className="text-xs font-black text-slate-400 uppercase">{log.field}</span>
                                </div>
                                <p className="text-sm font-bold text-slate-800 leading-tight">
                                  {log.field === 'Cost (Price)' || log.field === 'Price Override' ? (
                                    <>แก้ไขราคา จาก <span className="text-rose-500 line-through decoration-2">฿{(Number(log.oldValue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> เป็น <span className="text-emerald-600 font-black">฿{(Number(log.newValue) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> โดย <span className="text-blue-600 underline decoration-blue-200 underline-offset-4">{log.userName}</span></>
                                  ) : log.field === 'Truck Type' ? (
                                    <>แก้ไขประเภทรถ จาก <span className="text-slate-400 line-through">{log.oldValue}</span> เป็น <span className="text-blue-600 font-black">{log.newValue}</span> โดย <span className="font-black text-slate-900">{log.userName}</span></>
                                  ) : log.field === 'Status' && log.newValue === 'Cancelled' ? (
                                    <>ยกเลิกใบงาน โดย <span className="text-rose-600 font-black">{log.userName}</span></>
                                  ) : (
                                    <>แก้ไข {log.field} จาก "{log.oldValue}" เป็น "{log.newValue}" โดย {log.userName}</>
                                  )}
                                </p>
                              </div>
                            </td>
                            <td className="px-6 py-5">
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 max-w-xs transition-colors group-hover:bg-white">
                                <p className="text-xs font-bold text-slate-500 italic leading-relaxed">
                                  {log.reason || 'ไม่ได้ระบุเหตุผล (No specific reason provided)'}
                                </p>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination UI */}
                {totalLogPages > 1 && (
                  <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      หน้า {logPage} จาก {totalLogPages} (ทั้งหมด {filteredLogs.length} รายการ)
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={logPage === 1}
                        onClick={() => setLogPage(prev => prev - 1)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 transition-all"
                      >
                        Previous
                      </button>
                      <button
                        disabled={logPage === totalLogPages}
                        onClick={() => setLogPage(prev => prev + 1)}
                        className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 transition-all"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Job Summary Board Modal - Global */}
          {showSummaryBoard && (
            <JobSummaryBoard
              jobs={jobs}
              isOpen={showSummaryBoard}
              onClose={() => setShowSummaryBoard(false)}
              user={currentUser}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
