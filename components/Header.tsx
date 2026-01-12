
import React from 'react';
import { UserRole } from '../types';
import { Bell, Search, User, Menu } from 'lucide-react';

interface HeaderProps {
  user: { id: string; name: string; role: UserRole };
  onMenuToggle?: () => void;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({ user, onMenuToggle, className }) => {
  return (
    <header id="header" className={`h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between sticky top-0 z-10 box-border ${className || ''}`}>
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

      <div className="flex items-center gap-3 md:gap-6">
        <button
          className="relative p-2.5 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all"
          title="Notifications"
        >
          <Bell size={22} />
          <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white shadow-sm"></span>
        </button>

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
