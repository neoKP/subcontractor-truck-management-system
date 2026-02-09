
import React, { useState } from 'react';
import { UserRole, USER_ROLE_LABELS } from '../types';
import { Truck, Lock, User, KeyRound, AlertCircle, ArrowRight, ChevronDown, Check, Search } from 'lucide-react';


interface LoginPageProps {
    onLogin: (user: { id: string; name: string; role: UserRole }) => void;
    users: any[];
}

declare const Swal: any;

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, users }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const selectedUser = users.find(u => u.username === username);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());

        if (user) {
            if (password === user.password) {
                // Password Match
                onLogin({ id: user.id, name: user.name, role: user.role });
            } else {
                // Wrong Password
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        title: 'Wrong Password!',
                        text: 'รหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบรหัสผ่านส่วนตัวของท่าน',
                        icon: 'warning',
                        confirmButtonColor: '#f59e0b',
                        customClass: { popup: 'rounded-[2rem]' }
                    });
                } else {
                    alert('Wrong password');
                }
            }
        } else {
            // User Not Found (Should not happen with select)
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Access Denied!',
                    text: 'Invalid username.',
                    icon: 'error',
                    confirmButtonColor: '#ef4444',
                    customClass: { popup: 'rounded-[2rem]' }
                });
            }
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>
            </div>

            <div className="w-full max-w-md z-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-24 h-24 bg-white rounded-3xl shadow-2xl shadow-blue-500/10 mb-6 overflow-hidden p-2">
                        <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-black text-white tracking-tighter mb-2">Subcontractor</h1>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Truck Management System</p>
                </div>

                <div className="bg-white rounded-[2.5rem] shadow-2xl overflow-hidden border border-slate-200">
                    <div className="p-10">
                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="space-y-2">
                                <label htmlFor="username-select" className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Account Username</label>
                                <div className="relative group">
                                    <div
                                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                        className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl cursor-pointer hover:bg-slate-100 transition-all flex items-center min-h-[60px]"
                                    >
                                        <User className="absolute left-4 text-slate-300" size={20} />
                                        <span className={`font-bold ${selectedUser ? 'text-slate-800' : 'text-slate-400'}`}>
                                            {selectedUser ? selectedUser.name : '-- SEARCH / SELECT USER --'}
                                        </span>
                                        <ChevronDown className="absolute right-4 text-slate-300" size={20} />
                                    </div>

                                    {/* Dropdown Menu */}
                                    {isDropdownOpen && (
                                        <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                                            {/* Search Input */}
                                            <div className="p-3 border-b border-slate-100 bg-slate-50">
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <input
                                                        type="text"
                                                        placeholder="พิมพ์ขื่อเพื่อค้นหา..."
                                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                        value={searchTerm}
                                                        onChange={(e) => setSearchTerm(e.target.value)}
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </div>
                                            </div>

                                            {/* User List */}
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar">
                                                {filteredUsers.length > 0 ? (
                                                    filteredUsers.map(user => (
                                                        <div
                                                            key={user.id}
                                                            onClick={() => {
                                                                setUsername(user.username);
                                                                setIsDropdownOpen(false);
                                                                setSearchTerm('');
                                                            }}
                                                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between group/item transition-colors border-b border-slate-50 last:border-0"
                                                        >
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-bold text-slate-700 group-hover/item:text-blue-700">{user.name}</span>
                                                                <span className="text-[10px] text-slate-400 uppercase tracking-wider">{user.role.replace('_', ' ')}</span>
                                                            </div>
                                                            {username === user.username && <Check size={16} className="text-blue-600" />}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="p-4 text-center text-xs text-slate-400 font-bold">
                                                        ไม่พบรายชื่อที่ค้นหา
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Backdrop to close dropdown */}
                                    {isDropdownOpen && (
                                        <div
                                            className="fixed inset-0 z-40"
                                            onClick={() => setIsDropdownOpen(false)}
                                        />
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="password-field" className="text-[11px] font-black text-slate-400 uppercase tracking-widest ml-1">Security Password</label>
                                <div className="relative group">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20} />
                                    <input
                                        id="password-field"
                                        required
                                        type="password"
                                        placeholder="••••"
                                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800"
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-5 rounded-2xl font-black shadow-xl shadow-slate-200 transform hover:-translate-y-1 transition-all uppercase tracking-widest text-sm flex items-center justify-center gap-3 group"
                            >
                                Sign In To Dashboard
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={18} />
                            </button>
                        </form>
                    </div>

                    <div className="bg-slate-50 p-6 border-t border-slate-100 text-center">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            กรุณาใช้รหัสผ่านส่วนตัวในการเข้าสู่ระบบ (Personal Password Required)
                        </p>
                    </div>
                </div>

                <p className="text-center mt-8 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                    dev by Paweewat Phosanga &copy; 2026
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
