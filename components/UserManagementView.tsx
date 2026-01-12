import React, { useState } from 'react';
import { UserRole, USER_ROLE_LABELS } from '../types';
import { Users, UserPlus, Edit2, Trash2, Key, Shield } from 'lucide-react';

interface UserData {
    id: string;
    username: string;
    password: string;
    name: string;
    role: UserRole;
}

interface UserManagementViewProps {
    users: UserData[];
    onAddUser: (user: UserData) => void;
    onUpdateUser: (user: UserData) => void;
    onDeleteUser: (userId: string) => void;
    currentUserRole: UserRole;
}

declare const Swal: any;

const UserManagementView: React.FC<UserManagementViewProps> = ({
    users,
    onAddUser,
    onUpdateUser,
    onDeleteUser,
    currentUserRole
}) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleAddUser = () => {
        Swal.fire({
            title: 'เพิ่มผู้ใช้งานใหม่ (Add New User)',
            html: `
        <div class="flex flex-col gap-3 text-left">
          <div>
            <label class="text-xs font-bold text-slate-500">Username (สำหรับเข้าสู่ระบบ)</label>
            <input id="swal-username" class="swal2-input w-full m-0 mt-1" placeholder="e.g. BOOKING010">
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500">Password (รหัสผ่าน)</label>
            <input id="swal-password" type="text" class="swal2-input w-full m-0 mt-1" placeholder="e.g. b010">
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500">Full Name (ชื่อ-นามสกุล)</label>
            <input id="swal-name" class="swal2-input w-full m-0 mt-1" placeholder="ระบุชื่อจริง...">
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500">Role (ตำแหน่ง)</label>
            <select id="swal-role" class="swal2-input w-full m-0 mt-1">
              <option value="${UserRole.BOOKING_OFFICER}">Booking Officer (ฝ่ายรับจองงาน)</option>
              <option value="${UserRole.DISPATCHER}">Dispatcher (ฝ่ายจัดรถ)</option>
              <option value="${UserRole.ACCOUNTANT}">Accountant (ฝ่ายบัญชี)</option>
              <option value="${UserRole.ADMIN}">Admin (ผู้ดูแลระบบ)</option>
            </select>
          </div>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'บันทึกข้อมูล',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#3b82f6',
            customClass: { popup: 'rounded-[2rem]' },
            preConfirm: () => {
                const username = (document.getElementById('swal-username') as HTMLInputElement).value;
                const password = (document.getElementById('swal-password') as HTMLInputElement).value;
                const name = (document.getElementById('swal-name') as HTMLInputElement).value;
                const role = (document.getElementById('swal-role') as HTMLSelectElement).value as UserRole;

                if (!username || !password || !name) {
                    Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                    return false;
                }

                // Check duplicate username
                if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                    Swal.showValidationMessage('Username นี้มีอยู่ในระบบแล้ว');
                    return false;
                }

                return {
                    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
                    username,
                    password,
                    name,
                    role
                };
            }
        }).then((result: any) => {
            if (result.isConfirmed) {
                onAddUser(result.value);
                Swal.fire('สำเร็จ', 'เพิ่มผู้ใช้งานเรียบร้อยแล้ว', 'success');
            }
        });
    };

    const handleEditUser = (user: UserData) => {
        Swal.fire({
            title: 'แก้ไขข้อมูลผู้ใช้ (Edit User)',
            html: `
        <div class="flex flex-col gap-3 text-left">
          <div class="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-2">
            <span class="text-xs font-bold text-blue-600 uppercase">Username:</span>
            <span class="font-mono font-bold text-slate-700 ml-2">${user.username}</span>
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500">Password (ตั้งรหัสผ่านใหม่)</label>
            <input id="swal-password" type="text" class="swal2-input w-full m-0 mt-1" value="${user.password}">
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500">Full Name (ชื่อ-นามสกุล)</label>
            <input id="swal-name" class="swal2-input w-full m-0 mt-1" value="${user.name}">
          </div>
          <div>
            <label class="text-xs font-bold text-slate-500">Role (ตำแหน่ง)</label>
            <select id="swal-role" class="swal2-input w-full m-0 mt-1">
              <option value="${UserRole.BOOKING_OFFICER}" ${user.role === UserRole.BOOKING_OFFICER ? 'selected' : ''}>Booking Officer</option>
              <option value="${UserRole.DISPATCHER}" ${user.role === UserRole.DISPATCHER ? 'selected' : ''}>Dispatcher</option>
              <option value="${UserRole.ACCOUNTANT}" ${user.role === UserRole.ACCOUNTANT ? 'selected' : ''}>Accountant</option>
              <option value="${UserRole.ADMIN}" ${user.role === UserRole.ADMIN ? 'selected' : ''}>Admin</option>
            </select>
          </div>
        </div>
      `,
            showCancelButton: true,
            confirmButtonText: 'บันทึกการแก้ไข',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#3b82f6',
            customClass: { popup: 'rounded-[2rem]' },
            preConfirm: () => {
                const password = (document.getElementById('swal-password') as HTMLInputElement).value;
                const name = (document.getElementById('swal-name') as HTMLInputElement).value;
                const role = (document.getElementById('swal-role') as HTMLSelectElement).value as UserRole;

                if (!password || !name) {
                    Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
                    return false;
                }

                return { ...user, password, name, role };
            }
        }).then((result: any) => {
            if (result.isConfirmed) {
                onUpdateUser(result.value);
                Swal.fire('สำเร็จ', 'แก้ไขข้อมูลเรียบร้อยแล้ว', 'success');
            }
        });
    };

    const handleDeleteUser = (user: UserData) => {
        Swal.fire({
            title: 'ยืนยันลบผู้ใช้งาน?',
            html: `คุณต้องการลบผู้ใช้ <b>${user.name}</b> (${user.username}) ใช่หรือไม่?<br/><span class="text-rose-500 text-sm">การกระทำนี้ไม่สามารถกู้คืนได้</span>`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'ใช่, ลบเลย',
            cancelButtonText: 'ยกเลิก',
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#1e293b',
            customClass: { popup: 'rounded-[2rem]' }
        }).then((result: any) => {
            if (result.isConfirmed) {
                onDeleteUser(user.id);
                Swal.fire('ลบสำเร็จ', 'ผู้ใช้งานถูกลบออกจากระบบแล้ว', 'success');
            }
        });
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        USER_ROLE_LABELS[u.role].toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="relative w-full md:w-96">
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                </div>
                <button
                    onClick={handleAddUser}
                    className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                >
                    <UserPlus size={20} />
                    เพิ่มผู้ใช้งาน (Add User)
                </button>
            </div>

            {/* Users Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map(user => (
                    <div key={user.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">

                        {/* Role Badge */}
                        <div className="absolute top-4 right-4">
                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider
                 ${user.role === UserRole.ADMIN ? 'bg-slate-900 text-white' :
                                    user.role === UserRole.ACCOUNTANT ? 'bg-indigo-100 text-indigo-700' :
                                        user.role === UserRole.DISPATCHER ? 'bg-orange-100 text-orange-700' :
                                            'bg-blue-100 text-blue-700'
                                }
               `}>
                                {USER_ROLE_LABELS[user.role]}
                            </span>
                        </div>

                        <div className="flex items-start gap-4 mb-4">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black
                 ${user.role === UserRole.ADMIN ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-600'}
               `}>
                                {user.name.charAt(0)}
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-lg leading-tight">{user.name}</h3>
                                <p className="text-xs font-mono text-slate-400 mt-1">@{user.username}</p>
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-3 mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                                <Key size={14} />
                                <span>Password:</span>
                            </div>
                            <span className="font-mono font-bold text-slate-800">{user.password}</span>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-slate-100">
                            <button
                                onClick={() => handleEditUser(user)}
                                className="flex-1 py-2 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                            >
                                <Edit2 size={14} /> Edit
                            </button>
                            {user.username !== 'ADMIN001' && (
                                <button
                                    onClick={() => handleDeleteUser(user)}
                                    className="flex-1 py-2 rounded-lg bg-white border border-rose-100 text-rose-500 text-xs font-bold hover:bg-rose-50 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} /> Delete
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {filteredUsers.length === 0 && (
                <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <Shield size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-400 font-bold">ไม่พบผู้ใช้งาน</p>
                </div>
            )}
        </div>
    );
};

export default UserManagementView;
