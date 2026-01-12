
import React from 'react';
import { UserRole, USER_ROLE_LABELS } from '../types';
import { LayoutDashboard, PlusCircle, Receipt, ShieldCheck, Tag, Truck, User, X, PieChart, ClipboardCheck } from 'lucide-react';

interface SidebarProps {
  currentRole: UserRole;
  activeTab: 'board' | 'create' | 'logs' | 'billing' | 'pricing' | 'reports' | 'verify';
  setActiveTab: (tab: 'board' | 'create' | 'logs' | 'billing' | 'pricing' | 'reports' | 'verify') => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ currentRole, activeTab, setActiveTab, onLogout, isOpen, onClose, className }) => {
  const tabs = [
    { id: 'board', label: 'Dashboard / กระดานงาน', icon: LayoutDashboard, roles: [UserRole.BOOKING_OFFICER, UserRole.DISPATCHER, UserRole.ACCOUNTANT, UserRole.ADMIN] },
    { id: 'create', label: 'New Request / สร้างงานใหม่', icon: PlusCircle, roles: [UserRole.BOOKING_OFFICER] },
    { id: 'pricing', label: 'Price Master / มาตรฐานราคา', icon: Tag, roles: [UserRole.DISPATCHER, UserRole.ACCOUNTANT, UserRole.ADMIN] },
    { id: 'verify', label: 'Verify / ตรวจสอบงาน', icon: ClipboardCheck, roles: [UserRole.ACCOUNTANT, UserRole.ADMIN] },
    { id: 'billing', label: 'Billing / วางบิล', icon: Receipt, roles: [UserRole.ACCOUNTANT, UserRole.ADMIN] },
    { id: 'reports', label: 'Reports / รายงาน', icon: PieChart, roles: [UserRole.DISPATCHER, UserRole.ACCOUNTANT, UserRole.ADMIN] },
    { id: 'logs', label: 'Audit Logs / ประวัติแก้ไข', icon: ShieldCheck, roles: [UserRole.DISPATCHER, UserRole.ACCOUNTANT, UserRole.ADMIN] },
  ];

  const filteredTabs = tabs.filter(tab => tab.roles.includes(currentRole));

  const handleLogout = () => {
    if (typeof (window as any).Swal !== 'undefined') {
      (window as any).Swal.fire({
        title: 'Sign Out? / ออกจากระบบ?',
        text: 'Are you sure you want to log out of the system? / คุณต้องการออกจากระบบใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#1e293b',
        confirmButtonText: 'Yes, Log Out / ใช่, ออกจากระบบ',
        cancelButtonText: 'Cancel / ยกเลิก',
        customClass: {
          popup: 'rounded-[2rem]',
          confirmButton: 'rounded-xl px-6 py-3 font-bold uppercase tracking-widest text-xs',
          cancelButton: 'rounded-xl px-6 py-3 font-bold uppercase tracking-widest text-xs'
        }
      }).then((result: any) => {
        if (result.isConfirmed) {
          onLogout();
        }
      });
    } else {
      onLogout();
    }
  };

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      <aside id="sidebar" className={`fixed lg:sticky top-0 left-0 w-72 glass-dark text-white flex flex-col h-screen border-r border-white/5 shadow-2xl z-50 shrink-0 transition-transform duration-500 ease-out transform ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} ${className || ''}`}>
        <div className="p-8 h-full flex flex-col overflow-y-auto scrollbar-none relative">
          {/* Decorative glow */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-blue-600/10 blur-[80px] -z-10 rounded-full"></div>

          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-4 transition-transform hover:scale-105 duration-300">
              <div className="bg-white p-1 rounded-2xl shadow-lg shadow-blue-500/10 transition-transform overflow-hidden w-12 h-12 flex items-center justify-center">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tighter leading-tight">Subcontractor</h1>
                <p className="text-[9px] text-blue-400 font-bold uppercase tracking-[0.15em]">Truck Management System</p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              title="Close Menu"
            >
              <X size={24} />
            </button>
          </div>

          <nav className="space-y-1.5 flex-1">
            {filteredTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    if (onClose) onClose();
                  }}
                  title={tab.label}
                  className={`w-full flex items-center gap-3.5 px-5 py-4 rounded-2xl transition-all duration-300 font-bold group relative overflow-hidden ${isActive
                    ? 'bg-blue-600 text-white shadow-xl shadow-blue-900/40'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                >
                  {isActive && (
                    <div className="absolute left-0 top-0 w-1 h-full bg-blue-300/40"></div>
                  )}
                  <Icon size={20} className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="text-xs uppercase tracking-widest">{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="mt-8 space-y-4">
            <div className="bg-slate-800/40 border border-slate-700/50 rounded-3xl p-5 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center border border-slate-500/30">
                  <User size={18} className="text-slate-300" />
                </div>
                <div className="overflow-hidden">
                  <p className="text-[10px] font-black truncate leading-tight uppercase tracking-tight text-white/90">{USER_ROLE_LABELS[currentRole] || currentRole.replace('_', ' ')}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Connected</span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white transition-all duration-300 font-black text-[10px] uppercase tracking-widest border border-red-500/20"
              >
                <X size={14} /> Log Out / ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
