import React, { useState } from 'react';
import { UserRole, USER_ROLE_LABELS } from '../types';
import { Users, UserPlus, Edit2, Trash2, Key, Search } from 'lucide-react';

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
              <option value="${UserRole.FIELD_OFFICER}">Field Officer (เจ้าหน้าที่หน้างาน)</option>
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
              <option value="${UserRole.FIELD_OFFICER}" ${user.role === UserRole.FIELD_OFFICER ? 'selected' : ''}>Field Officer</option>
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
                <div className="relative w-full md:w-96 group">
                    <input
                        type="text"
                        placeholder="Search users..."
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-50 focus:border-blue-300 outline-none transition-all font-medium text-slate-600"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
                </div>
                <button
                    onClick={handleAddUser}
                    className="w-full md:w-auto px-6 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                    <UserPlus size={20} />
                    เพิ่มผู้ใช้งาน (Add User)
                </button>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="overflow-x-auto max-h-[70vh] overflow-y-auto relative">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-20 shadow-sm">
                            <tr className="bg-slate-100 border-b border-slate-200 text-xs font-black text-slate-500 uppercase tracking-wider">
                                <th className="px-6 py-4">User Info</th>
                                <th className="px-6 py-4">Role & Permissions</th>
                                <th className="px-6 py-4">Security</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={4}>
                                        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                                            <div className="bg-slate-50 p-4 rounded-full mb-3">
                                                <Users size={32} className="text-slate-300" />
                                            </div>
                                            <p className="font-bold">ไม่พบข้อมูลผู้ใช้งาน</p>
                                            <p className="text-sm">ลองค้นหาด้วยคำค้นอื่น หรือเพิ่มผู้ใช้งานใหม่</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr key={user.id} className="hover:bg-blue-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shadow-sm ring-2 ring-white
                                                    ${user.role === UserRole.ADMIN ? 'bg-slate-800 text-white' :
                                                        user.role === UserRole.ACCOUNTANT ? 'bg-indigo-100 text-indigo-600' :
                                                            user.role === UserRole.DISPATCHER ? 'bg-orange-100 text-orange-600' :
                                                                'bg-blue-100 text-blue-600'
                                                    }`}>
                                                    {user.name.charAt(0)}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-slate-800 text-sm">{user.name}</div>
                                                    <div className="text-xs font-medium text-slate-400">@{user.username}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wide border
                                                ${user.role === UserRole.ADMIN
                                                    ? 'bg-slate-900 border-slate-800 text-white'
                                                    : user.role === UserRole.ACCOUNTANT
                                                        ? 'bg-indigo-50 border-indigo-100 text-indigo-700'
                                                        : user.role === UserRole.DISPATCHER
                                                            ? 'bg-orange-50 border-orange-100 text-orange-700'
                                                            : 'bg-blue-50 border-blue-100 text-blue-700'
                                                }`}>
                                                {USER_ROLE_LABELS[user.role]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 group/pass">
                                                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                                                    <Key size={14} />
                                                </div>
                                                <code className="px-2 py-1 rounded bg-slate-50 border border-slate-100 text-xs font-mono font-bold text-slate-600 group-hover/pass:bg-white group-hover/pass:border-blue-200 transition-colors">
                                                    {user.password}
                                                </code>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEditUser(user)}
                                                    className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                                                    title="แก้ไขข้อมูล"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {user.username !== 'ADMIN001' && (
                                                    <button
                                                        onClick={() => handleDeleteUser(user)}
                                                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                                                        title="ลบผู้ใช้งาน"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="text-center text-xs text-slate-400 font-medium">
                Showing {filteredUsers.length} users
            </div>
        </div>
    );
};

export default UserManagementView;
