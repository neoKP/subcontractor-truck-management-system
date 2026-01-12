
import React, { useState } from 'react';
import { UserRole, USER_ROLE_LABELS } from '../types';
import { Truck, Lock, User, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';


interface LoginPageProps {
    onLogin: (user: { id: string; name: string; role: UserRole }) => void;
    users: any[];
}

declare const Swal: any;

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, users }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');

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
                                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors z-10" size={20} />
                                    <select
                                        id="username-select"
                                        required
                                        className="w-full pl-12 pr-10 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:bg-white focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold text-slate-800 appearance-none cursor-pointer"
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                    >
                                        <option value="">-- SELECT DEMO USER --</option>
                                        {users.map((user: any) => (
                                            <option key={user.id} value={user.username}>
                                                {user.name}
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
                                        <ArrowRight size={16} className="rotate-90" />
                                    </div>
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
                    Secure Multi-Tenant Logistics System &copy; 2026
                </p>
            </div>
        </div>
    );
};

export default LoginPage;
