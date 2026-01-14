
import React, { useState } from 'react';
import { UserRole, Job, JobStatus, AuditLog } from '../types';
import { Bell, Search, User, Menu, ShieldAlert, FileText, Clock, ChevronRight } from 'lucide-react';

interface HeaderProps {
  user: { id: string; name: string; role: UserRole };
  onMenuToggle?: () => void;
  className?: string;
  jobs?: Job[];
  logs?: AuditLog[];
  onShowPendingPricing?: () => void;
  onNavigateToLogs?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  user, onMenuToggle, className, jobs = [], logs = [],
  onShowPendingPricing, onNavigateToLogs
}) => {
  const [showNotifications, setShowNotifications] = useState(false);
  const pendingPricingCount = jobs.filter(j => j.status === JobStatus.PENDING_PRICING).length;
  const canSeeAlert = [UserRole.ADMIN, UserRole.ACCOUNTANT].includes(user.role);

  // Get recent logs (Last 5)
  const recentLogs = [...logs]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const hasRecentActivity = recentLogs.length > 0;

  return (
    <header id="header" className={`h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 box-border ${className || ''}`}>
      {/* Backdrop for closing dropdown */}
      {showNotifications && (
        <div
          className="fixed inset-0 z-30 cursor-default"
          onClick={() => setShowNotifications(false)}
        ></div>
      )}

      <div className="flex items-center gap-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors"
          aria-label="Open Menu"
        >
          <Menu size={24} />
        </button>

        <div className="hidden md:flex items-center gap-4 bg-slate-50 border border-slate-100 px-4 py-2.5 rounded-2xl w-96 transition-all focus-within:ring-4 focus-within:ring-blue-100 focus-within:border-blue-500">
          <Search size={18} className="text-slate-400" />
          <input
            type="text"
            placeholder="Search / ค้นหา..."
            className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-400 font-medium"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 md:gap-6 relative">
        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative p-2.5 rounded-xl transition-all z-40 ${showNotifications ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
            title="Recent Activity"
          >
            <Bell size={22} />
            {hasRecentActivity && (
              <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-white shadow-sm animate-pulse"></span>
            )}
          </button>

          {/* Notification Dropdown */}
          {showNotifications && (
            <div className="absolute right-0 top-full mt-4 w-80 md:w-96 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-40 animation-slide-up-sm">
              <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                <h3 className="font-black text-slate-800 text-sm uppercase tracking-wider">Recent Activity</h3>
                <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-1 rounded-full border border-slate-100">Latest 5</span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
                {recentLogs.length > 0 ? (
                  <div className="divide-y divide-slate-50">
                    {recentLogs.map((log) => (
                      <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-3 group">
                        <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${log.field === 'Status' ? 'bg-blue-100 text-blue-600' :
                            log.field === 'SYSTEM' ? 'bg-rose-100 text-rose-600' :
                              'bg-slate-100 text-slate-500'
                          }`}>
                          <FileText size={14} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-800 mb-0.5 truncate">
                            <span className="text-slate-500 font-normal">{log.userName}</span> {log.field === 'Status' ? 'updated job' : 'modified'} <span className="text-blue-600 font-black">#{log.jobId}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">
                            {log.oldValue} <span className="text-slate-300">→</span> <span className="font-bold text-slate-700">{log.newValue}</span>
                          </p>
                          <div className="flex items-center gap-1 mt-2 text-[9px] font-bold text-slate-400">
                            <Clock size={10} />
                            {new Date(log.timestamp).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} • {new Date(log.timestamp).toLocaleDateString('th-TH')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400">
                    <Bell size={32} className="mx-auto mb-3 opacity-20" />
                    <p className="text-xs font-bold">No recent activity</p>
                  </div>
                )}
              </div>
              {onNavigateToLogs && (
                <button
                  onClick={() => {
                    onNavigateToLogs();
                    setShowNotifications(false);
                  }}
                  className="w-full p-3 bg-slate-50 text-blue-600 text-xs font-black uppercase tracking-widest hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 border-t border-slate-100"
                >
                  View All Logs <ChevronRight size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {canSeeAlert && pendingPricingCount > 0 && (
          <button
            onClick={onShowPendingPricing}
            className="relative p-2.5 text-yellow-500 hover:bg-yellow-50 rounded-xl transition-all flex items-center gap-2 group border border-transparent hover:border-yellow-200"
            title={`${pendingPricingCount} Jobs Pending Pricing`}
          >
            <ShieldAlert size={22} className="animate-pulse" />
            <span className="absolute -top-1 -right-1 bg-yellow-500 text-slate-900 text-[9px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-sm">
              {pendingPricingCount}
            </span>
          </button>
        )}

        <div className="h-8 w-px bg-slate-200 hidden xs:block"></div>

        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-black text-slate-800 leading-tight uppercase tracking-tight">{user.name}</p>
            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">{user.role.replace('_', ' ')}</p>
          </div>
          <div className="w-10 h-10 bg-gradient-to-tr from-slate-50 to-white rounded-2xl flex items-center justify-center text-slate-500 border border-slate-200 shadow-sm transition-transform hover:scale-105">
            <User size={20} />
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
