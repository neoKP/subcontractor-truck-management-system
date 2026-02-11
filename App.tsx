import React, { useState } from 'react';
import { UserRole, Job, JobStatus, AuditLog, PriceMatrix, AccountingStatus, SubcontractorInvoice, InvoiceStatus } from './types';
import JobRequestForm from './components/JobRequestForm';
import JobBoard from './components/JobBoard';
import Sidebar from './components/Sidebar';
import { formatThaiCurrency, roundHalfUp, formatDate, generateUUID } from './utils/format';
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
import JobTrackingModal from './components/JobTrackingModal';
import BookingOfficerDashboard from './components/BookingOfficerDashboard';
import PremiumExecutiveDashboard from './components/PremiumExecutiveDashboard';
import DailyReportView from './components/DailyReportView'; // Added DailyReportView import
import JobCompletionView from './components/JobCompletionView'; // Added DailyReportView import
import ReviewConfirmDashboard from './components/ReviewConfirmDashboard'; // Added ReviewConfirmDashboard import
import DispatcherDashboard from './components/DispatcherDashboard'; // Added DispatcherDashboard import
import PendingPricingModal from './components/PendingPricingModal'; // Added PendingPricingModal import
import HomeView from './components/HomeView'; // Added HomeView import
import PaymentDashboard from './components/PaymentDashboard'; // Added PaymentDashboard import
import { ShieldCheck, Truck, Receipt, Tag, Search, PieChart, ClipboardCheck, Users, TrendingUp, LayoutPanelTop, BarChart3, ShieldAlert } from 'lucide-react';
import { db, ref, onValue, set, remove, get, query, limitToLast } from './firebaseConfig';

// Initial Users Data for Seeding
const INITIAL_USERS = [
  { id: 'FIELD_001', name: 'Field Operator (หน้างาน)', role: UserRole.FIELD_OFFICER, username: 'FIELD001', password: 'f111' },
  { id: 'ADMIN_001', name: 'System Admin', role: UserRole.ADMIN, username: 'ADMIN001', password: 'a888' },
  { id: 'ACCOUNTANT_001', name: 'ADMIN Accountant', role: UserRole.ACCOUNTANT, username: 'ACCOUNT001', password: 'ac999' },
  { id: 'DISPATCHER_001', name: 'Fleet Dispatcher', role: UserRole.DISPATCHER, username: 'DISPATCH001', password: 't777' },
  { id: 'BOOKING_001', name: 'อภัสนันท์ ภู่จรัสธนพัฒน์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING001', password: 'b001' },
  { id: 'BOOKING_002', name: 'วรารัตน์ แก้วนิ่ม', role: UserRole.BOOKING_OFFICER, username: 'BOOKING002', password: 'b002' },
  { id: 'BOOKING_003', name: 'กุลณัฐ คิดดีจริง', role: UserRole.BOOKING_OFFICER, username: 'BOOKING003', password: 'b003' },
  { id: 'BOOKING_004', name: 'ชนัญชิดา พวงมาลัย', role: UserRole.BOOKING_OFFICER, username: 'BOOKING004', password: 'b004' },
  { id: 'BOOKING_005', name: 'สุภาพร ชูชัยสุวรรณศรี', role: UserRole.BOOKING_OFFICER, username: 'BOOKING005', password: 'b005' },
  { id: 'BOOKING_006', name: 'ชุติมา สีหาบุตร', role: UserRole.DISPATCHER, username: 'BOOKING006', password: 'b006' },
  { id: 'BOOKING_007', name: 'เยาวนันท์ จันทรพิทักษ์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING007', password: 'b007' },
  { id: 'BOOKING_008', name: 'ขนิษฐา วัฒนวิกย์กรรม์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING008', password: 'b008' },
  { id: 'BOOKING_009', name: 'สุพัชญ์กานต์ ธีระภัณฑ์', role: UserRole.BOOKING_OFFICER, username: 'BOOKING009', password: 'b009' }
];

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; role: UserRole } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [priceMatrix, setPriceMatrix] = useState<PriceMatrix[]>([]); // Firebase only - no initial data from constants
  const [invoices, setInvoices] = useState<SubcontractorInvoice[]>([]); // Subcontractor invoices
  const [activeTab, setActiveTab] = useState<'home' | 'analytics' | 'board' | 'create' | 'review-confirm' | 'logs' | 'billing' | 'pricing' | 'aggregation' | 'verify' | 'users' | 'profit' | 'daily-report' | 'completion' | 'payment'>('home');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logSearch, setLogSearch] = useState('');
  const [logPage, setLogPage] = useState(1);
  const logsPerPage = 15;
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [showSummaryBoard, setShowSummaryBoard] = useState(false);

  // State for Pending Pricing Modal (Lifted from JobBoard) - Refreshed Logic
  const [showPendingPricingModal, setShowPendingPricingModal] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Scanned Job for Tracking Modal
  const [scannedJob, setScannedJob] = useState<Job | null>(null);

  // State for passing data to Pricing Table Modal
  const [pricingModalData, setPricingModalData] = useState<Partial<PriceMatrix> | undefined>(undefined);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  const closeSidebar = () => setSidebarOpen(false);
  const toggleSidebarCollapse = () => setIsSidebarCollapsed(!isSidebarCollapsed);

  // New handler to navigate from JobBoard -> Pricing Tab
  const handleNavigateToPricing = (job: Job) => {
    setPricingModalData({
      origin: job.origin,
      destination: job.destination,
      truckType: job.truckType,
      subcontractor: job.subcontractor // Optional: if we want to pre-fill sub
    });
    setActiveTab('pricing');
    // Clear data after a delay to allow modal to open? 
    // Actually PricingTableView will react to the prop change. 
    // We might need to clear it when modal closes, handled in PricingTableView? 
    // For now this is fine, the useEffect in PricingTableView handles the trigger.
  };

  const handleSearchJob = (query: string) => {
    if (!query) return;
    const targetJob = jobs.find(j => j.id.toLowerCase() === query.toLowerCase() || j.billingDocNo?.toLowerCase() === query.toLowerCase());
    if (targetJob) {
      setScannedJob(targetJob);
    } else {
      if ((window as any).Swal) {
        (window as any).Swal.fire({
          icon: 'error',
          title: 'Job Not Found',
          text: `No job found with ID or Billing Ref: ${query}`,
          timer: 2000,
          showConfirmButton: false
        });
      }
    }
  };

  // ============================================================
  // 🔥 Firebase Sync — Optimized to reduce bandwidth usage
  // Previously: 5 onValue listeners loading entire paths = ~50MB per page load
  // Now: Jobs uses limitToLast, Logs uses get() one-time, Users seed separated
  // ============================================================
  React.useEffect(() => {
    // --- 1. JOBS: Realtime listener with limitToLast ---
    // Previously loaded ALL jobs (including Base64 images) = ~50MB
    // Now limited to last 200 jobs, images stored in Firebase Storage as URLs
    const jobsQuery = query(ref(db, 'jobs'), limitToLast(200));
    const unsubscribeJobs = onValue(jobsQuery, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setJobs(Object.values(data) as Job[]);
      }
    });

    // --- 2. LOGS: One-time fetch (no realtime needed) ---
    // Logs don't need to be realtime — fetch once on mount
    const fetchLogs = async () => {
      try {
        const logsQuery = query(ref(db, 'logs'), limitToLast(500));
        const snapshot = await get(logsQuery);
        const data = snapshot.val();
        if (data) {
          setLogs(Object.values(data));
        }
      } catch (err) {
        console.error('Error fetching logs:', err);
      }
      setLogsLoaded(true);
    };
    fetchLogs();

    // --- 3. PRICING: Realtime (small data, OK to keep) ---
    const pricingRef = ref(db, 'priceMatrix');
    const unsubscribePricing = onValue(pricingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setPriceMatrix(Object.values(data) as PriceMatrix[]);
      } else {
        set(pricingRef, PRICE_MATRIX);
      }
    });

    // --- 4. INVOICES: Realtime (relatively small data) ---
    const invoicesRef = ref(db, 'invoices');
    const unsubscribeInvoices = onValue(invoicesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setInvoices(Object.values(data) as SubcontractorInvoice[]);
      }
    });

    // --- 5. USERS: Seed ONCE with get(), then listen read-only ---
    // ⚠️ Previously had set() INSIDE onValue → caused write loops!
    // Now: seed logic runs once via get(), listener is read-only
    const usersRef = ref(db, 'users');
    const seedAndListenUsers = async () => {
      try {
        const snapshot = await get(usersRef);
        const data = snapshot.val();
        if (!data) {
          // Seed users if DB is empty (one-time)
          for (const user of INITIAL_USERS) {
            await set(ref(db, `users/${user.id}`), user);
          }
        } else {
          // One-time fixes (run once, not inside listener)
          const user006 = Object.values(data).find((u: any) => u.id === 'BOOKING_006');
          if (user006 && (user006 as any).role !== UserRole.DISPATCHER) {
            await set(ref(db, `users/BOOKING_006`), { ...(user006 as object), role: UserRole.DISPATCHER });
          }

          const userThanakorn = Object.values(data).find((u: any) => u.name && u.name.includes('ธนากร'));
          if (userThanakorn) {
            let needsUpdate = false;
            let updatedUser = { ...(userThanakorn as object) };
            if ((userThanakorn as any).name !== 'ธนากร อินอ้น') {
              updatedUser = { ...updatedUser, name: 'ธนากร อินอ้น' };
              needsUpdate = true;
            }
            if ((userThanakorn as any).role !== UserRole.DISPATCHER) {
              updatedUser = { ...updatedUser, role: UserRole.DISPATCHER };
              needsUpdate = true;
            }
            if (needsUpdate) {
              await set(ref(db, `users/${(userThanakorn as any).id}`), updatedUser);
            }
          }

          const fieldUser = Object.values(data).find((u: any) => u.id === 'FIELD_001');
          if (!fieldUser) {
            const newUser = INITIAL_USERS.find(u => u.id === 'FIELD_001');
            if (newUser) {
              await set(ref(db, `users/FIELD_001`), newUser);
            }
          }
        }
      } catch (err) {
        console.error('Error seeding users:', err);
      }
    };
    seedAndListenUsers();

    // Read-only listener for users (NO set() inside!)
    const unsubscribeUsers = onValue(usersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        let allUsers = Object.values(data);
        const field001Exists = allUsers.some((u: any) => u.username === 'FIELD001');
        if (!field001Exists) {
          allUsers.unshift(INITIAL_USERS[0]);
        }
        setUsers(allUsers);
      }
    });

    return () => {
      unsubscribeJobs();
      unsubscribePricing();
      unsubscribeInvoices();
      unsubscribeUsers();
    };
  }, []);

  // AUTOMATIC ACTION: Move jobs out of Pending Pricing Queue if a price is now available
  React.useEffect(() => {
    const pendingJobs = jobs.filter(j => j.status === JobStatus.PENDING_PRICING);
    if (pendingJobs.length === 0) return;

    pendingJobs.forEach(job => {
      const match = priceMatrix.find(p =>
        p.origin === job.origin &&
        p.destination === job.destination &&
        p.truckType === job.truckType
      );

      if (match) {
        console.log(`Auto-Updating Job ${job.id}: Price found in Master Matrix.`);

        const updatedJob: Job = {
          ...job,
          status: JobStatus.NEW_REQUEST,
          cost: match.basePrice,
          sellingPrice: match.sellingBasePrice
        };

        const auditLog: AuditLog = {
          id: generateUUID(),
          jobId: job.id,
          userId: 'SYSTEM_BOT',
          userName: 'System Auto-Price',
          userRole: UserRole.ADMIN,
          timestamp: new Date().toISOString(),
          field: 'Status & Pricing',
          oldValue: JobStatus.PENDING_PRICING,
          newValue: JobStatus.NEW_REQUEST,
          reason: 'Auto-transition: Matching price found in Master Matrix.'
        };

        // Update Firebase
        set(ref(db, `jobs/${job.id}`), cleanJob(updatedJob));
        set(ref(db, `logs/${auditLog.id}`), auditLog);
      }
    });
  }, [priceMatrix, jobs]); // Runs whenever price matrix or jobs list changes

  const handleUserUpdate = (user: any) => {
    set(ref(db, `users/${user.id}`), user);
  };

  const handleUserDelete = (userId: string) => {
    remove(ref(db, `users/${userId}`));
  };

  // Invoice handlers
  const handleCreateInvoice = (invoice: SubcontractorInvoice) => {
    set(ref(db, `invoices/${invoice.id}`), invoice);
  };

  const handleUpdateInvoice = (invoice: SubcontractorInvoice) => {
    set(ref(db, `invoices/${invoice.id}`), invoice);
  };
  const cleanJob = (job: Job): Job => {
    const cleaned = { ...job };
    // Numeric defaults & NaN protection
    cleaned.cost = (!cleaned.cost || isNaN(Number(cleaned.cost))) ? 0 : Number(cleaned.cost);
    cleaned.sellingPrice = (!cleaned.sellingPrice || isNaN(Number(cleaned.sellingPrice))) ? 0 : Number(cleaned.sellingPrice);
    cleaned.extraCharge = (!cleaned.extraCharge || isNaN(Number(cleaned.extraCharge))) ? 0 : Number(cleaned.extraCharge);

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
    // Sanitize data to prevent NaN from breaking Firebase
    const sanitizedList = newList.map(p => ({
      ...p,
      basePrice: Number(p.basePrice) || 0,
      sellingBasePrice: Number(p.sellingBasePrice) || 0,
      dropOffFee: Number(p.dropOffFee) || 0
    }));
    setPriceMatrix(sanitizedList);
    set(ref(db, 'priceMatrix'), sanitizedList);
  };

  const deleteJob = (jobId: string) => {
    // 1. Log the deletion before removing content (for safety trail)
    const log: AuditLog = {
      id: generateUUID(),
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

  // Attempt to restore session
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('currentUser');
      if (stored) {
        setCurrentUser(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('LocalStorage access denied. Session will not persist.', e);
    }

    // Always start at home on fresh entry
    setActiveTab('home');
  }, []);

  const handleLogin = (user: { id: string; name: string; role: UserRole }) => {
    setCurrentUser(user);
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (e) {
      console.warn('Failed to save user to localStorage:', e);
    }

    // Force all users to land on the Home page for a premium experience
    setActiveTab('home');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('currentUser');
    } catch (e) {
      console.warn('Failed to remove user from localStorage:', e);
    }
  };

  // MAIN RENDERING LOGIC (RE-PRIORITIZED)
  // ---------------------------------------------------------

  // 1. ABSOLUTE PRIORITY: IF 'home' is current tab, show HomeView immediately.
  // This ensures Home is ALWAYS the first thing anyone sees.
  if (activeTab === 'home') {
    return (
      <div className="flex h-screen bg-slate-900 overflow-hidden font-sans antialiased text-white">
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          <div className="flex-1 overflow-y-auto p-0 scrollbar-none">
            <HomeView
              jobs={currentUser ? jobs : []}
              user={currentUser}
              onTabChange={setActiveTab}
              onLoginClick={() => setShowLogin(true)}
              onLogout={handleLogout}
            />
          </div>
        </main>

        {/* Login Modal Overlay */}
        {showLogin && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="max-w-md w-full relative animate-in zoom-in-95 duration-300">
              <button
                onClick={() => setShowLogin(false)}
                className="absolute -top-4 -right-4 w-10 h-10 bg-rose-600 text-white rounded-full flex items-center justify-center font-black shadow-xl z-10 hover:scale-110 transition-all border-2 border-white"
              >
                ✕
              </button>
              <div className="rounded-[3rem] overflow-hidden shadow-2xl border-2 border-white/20">
                <LoginPage onLogin={(user) => { handleLogin(user); setShowLogin(false); }} users={users} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. If NOT on home Tab and NOT logged in, show Full Screen Login
  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} users={users} />;
  }

  // 3. Main Dashboard Layout (For logged in users, not on home tab)
  const isHome = activeTab === 'home';

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden font-sans antialiased text-slate-900">
      <Sidebar
        currentRole={currentUser.role}
        activeTab={activeTab as any}
        setActiveTab={setActiveTab as any}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <Header
          user={currentUser}
          onMenuToggle={toggleSidebar}
          jobs={jobs}
          logs={logs}
          onShowPendingPricing={() => setShowPendingPricingModal(true)}
          onNavigateToLogs={() => setActiveTab('logs')}
          onSearchJob={handleSearchJob}
        />


        {/* Content Area */}
        <div className={`flex-1 overflow-y-auto ${isHome ? 'p-0' : 'p-4 md:p-6'} scrollbar-thin`}>
          {/* The max-w-7xl mx-auto w-full box-border was previously on the div below,
              but for 'home' tab, we want full width, so it's moved inside the conditional content */}
          <div className={`${isHome ? '' : 'max-w-7xl mx-auto w-full box-border'}`}>
            {activeTab === 'analytics' && currentUser.role !== UserRole.BOOKING_OFFICER && (
              <PremiumExecutiveDashboard
                jobs={jobs}
                activeTab="analytics" // Pass analytics context
              />
            )}

            {activeTab === 'daily-report' && [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.DISPATCHER, UserRole.BOOKING_OFFICER].includes(currentUser.role) && (
              <DailyReportView jobs={jobs} currentUser={currentUser} />
            )}

            {activeTab === 'completion' && [UserRole.ADMIN, UserRole.DISPATCHER, UserRole.BOOKING_OFFICER, UserRole.FIELD_OFFICER].includes(currentUser.role) && (
              <JobCompletionView
                jobs={currentUser.role === UserRole.BOOKING_OFFICER ? jobs.filter(j => j.requestedBy === currentUser.id) : jobs}
                user={currentUser}
                onUpdateJob={updateJob}
                hidePrice={[UserRole.BOOKING_OFFICER, UserRole.FIELD_OFFICER].includes(currentUser.role)}
              />
            )}

            {activeTab === 'review-confirm' && [UserRole.ADMIN, UserRole.DISPATCHER, UserRole.BOOKING_OFFICER].includes(currentUser.role) && (
              <ReviewConfirmDashboard
                jobs={currentUser.role === UserRole.BOOKING_OFFICER ? jobs.filter(j => j.requestedBy === currentUser.id) : jobs}
                user={currentUser}
                onSave={updateJob}
                priceMatrix={priceMatrix}
                logs={logs}
                logsLoaded={logsLoaded}
                hidePrice={[UserRole.BOOKING_OFFICER, UserRole.FIELD_OFFICER].includes(currentUser.role)}
              />
            )}

            {/* Board View */}
            {activeTab === 'create' && (currentUser.role === UserRole.BOOKING_OFFICER || currentUser.role === UserRole.DISPATCHER) && (
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
                    user={currentUser}
                  />
                </div>
              </div>
            )}

            {activeTab === 'board' && (
              currentUser.role === UserRole.BOOKING_OFFICER ? (
                <BookingOfficerDashboard
                  jobs={jobs}
                  user={currentUser}
                  onUpdateJob={updateJob}
                  onShowCreateForm={() => setActiveTab('create')}
                  onDeleteJob={deleteJob}
                  priceMatrix={priceMatrix}
                />
              ) : (
                <DispatcherDashboard
                  jobs={jobs}
                  user={currentUser}
                  onUpdateJob={updateJob}
                  onDeleteJob={deleteJob}
                  priceMatrix={priceMatrix}
                  logs={logs}
                  logsLoaded={logsLoaded}
                />
              )
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
                    initialData={pricingModalData}
                  />
                </div>
              </div>
            )}

            {activeTab === 'home' && (
              <HomeView jobs={jobs} user={currentUser} onTabChange={setActiveTab} onLoginClick={() => setShowLogin(true)} />
            )}


            {activeTab === 'aggregation' && (
              <AccountingReportsView jobs={jobs} logs={logs} userRole={currentUser.role} />
            )}

            {activeTab === 'profit' && (
              <ProfitAnalysisView jobs={jobs} userRole={currentUser.role} />
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
                  <AccountingVerificationView jobs={jobs} onUpdateJob={handleVerifyJob} userRole={currentUser.role} priceMatrix={priceMatrix} />
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
                  <BillingView jobs={jobs} user={currentUser} onUpdateJob={updateJob} priceMatrix={priceMatrix} />
                </div>
              </div>
            )}

            {activeTab === 'payment' && (
              <PaymentDashboard
                jobs={jobs}
                invoices={invoices}
                priceMatrix={priceMatrix}
                onCreateInvoice={handleCreateInvoice}
                onUpdateInvoice={handleUpdateInvoice}
                user={currentUser}
              />
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
                                  {(log.timestamp || '').includes('T') ? formatDate(log.timestamp) : ((log.timestamp || '').includes(',') ? log.timestamp.split(',')[0] : '')}
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
                                      <>แก้ไขราคา จาก <span className="text-rose-500 line-through decoration-2">฿{formatThaiCurrency(Number(log.oldValue) || 0)}</span> เป็น <span className="text-emerald-600 font-black">฿{formatThaiCurrency(Number(log.newValue) || 0)}</span> โดย <span className="text-blue-600 underline decoration-blue-200 underline-offset-4">{log.userName}</span></>
                                    ) : log.field === 'Truck Type' ? (
                                      <>แก้ไขประเภทรถ จาก <span className="text-slate-400 line-through">{log.oldValue}</span> เป็น <span className="text-blue-600 font-black">{log.newValue}</span> โดย <span className="font-black text-slate-900">{log.userName}</span></>
                                    ) : log.field === 'Status' && log.newValue === 'Cancelled' ? (
                                      <>ยกเลิกใบงาน โดย <span className="text-rose-600 font-black">{log.userName}</span></>
                                    ) : log.field === 'Accounting Status' ? (
                                      log.newValue === 'Rejected' ? (
                                        <>บัญชี <span className="text-rose-600 font-black">ตีกลับ/ไม่อนุมัติ (Rejected)</span> โดย <span className="font-bold text-slate-900">{log.userName}</span></>
                                      ) : (
                                        <>บัญชี <span className="text-emerald-600 font-black">อนุมัติ (Approved)</span> โดย <span className="font-bold text-slate-900">{log.userName}</span></>
                                      )
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

            {/* Global Tracking Modal */}
            {scannedJob && (
              <JobTrackingModal
                job={scannedJob}
                onClose={() => setScannedJob(null)}
                currentUser={currentUser || undefined}
              />
            )}

            {/* Pending Pricing Modal - Global */}
            {showPendingPricingModal && (
              <PendingPricingModal
                jobs={jobs}
                priceMatrix={priceMatrix}
                isOpen={showPendingPricingModal}
                onClose={() => setShowPendingPricingModal(false)}
                onAction={(job) => {
                  handleNavigateToPricing(job);
                  setShowPendingPricingModal(false);
                }}
                userRole={currentUser.role}
              />
            )}

            {/* Fallback for unauthorized or missing tabs */}
            {activeTab === 'analytics' && currentUser.role === UserRole.BOOKING_OFFICER && (
              <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                <ShieldAlert size={64} className="text-slate-300 mb-4" />
                <h3 className="text-xl font-black text-slate-800 mb-2">เข้าถึงข้อมูลจำกัด (Access Restricted)</h3>
                <p className="text-slate-500 font-medium">คุณไม่มีสิทธิ์เข้าถึงหน้านี้ ระบบกำลังนำคุณไปยังหน้ากระดานงาน...</p>
                <button
                  onClick={() => setActiveTab('board')}
                  className="mt-6 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl hover:scale-105 transition-all"
                >
                  กลับหน้ากระดานงาน (Go to Job Board)
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
