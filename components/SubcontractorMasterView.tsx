import React, { useState } from 'react';
import { SubcontractorMaster, UserRole } from '../types';
import { MASTER_DATA } from '../constants';
import { Search, Plus, Edit3, Trash2, Save, X, Building2, CreditCard, Phone, User, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

interface SubcontractorMasterViewProps {
  subcontractorMasters: SubcontractorMaster[];
  onUpdate: (master: SubcontractorMaster) => void;
  onDelete: (id: string) => void;
  userRole: UserRole;
}

const BANK_LIST = ['กสิกรไทย', 'ไทยพาณิชย์', 'กรุงเทพ', 'กรุงไทย', 'กรุงศรีอยุธยา', 'ทหารไทยธนชาต', 'ออมสิน', 'ธนาคารเพื่อการเกษตรฯ (ธกส.)'];

const slugify = (name: string) => name.trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9ก-๙_\-]/g, '');

const emptyForm = (): Omit<SubcontractorMaster, 'id'> => ({
  name: '',
  paymentType: 'CREDIT',
  taxId: '',
  bankName: '',
  bankAccountName: '',
  bankAccountNo: '',
  contactName: '',
  contactPhone: '',
  note: '',
});

const SubcontractorMasterView: React.FC<SubcontractorMasterViewProps> = ({
  subcontractorMasters, onUpdate, onDelete, userRole,
}) => {
  const canEdit = [UserRole.ADMIN, UserRole.ACCOUNTANT].includes(userRole);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'CREDIT' | 'CASH' | 'ALL'>('CREDIT');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Omit<SubcontractorMaster, 'id'>>(emptyForm());

  const filtered = subcontractorMasters.filter(s => {
    const matchSearch = !searchTerm ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.bankName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.taxId || '').includes(searchTerm);
    const matchType = filterType === 'ALL' || (s.paymentType || 'CREDIT') === filterType;
    return matchSearch && matchType;
  });

  // All sub names from MASTER_DATA not yet in master list
  const unregistered = MASTER_DATA.subcontractors.filter(
    name => !subcontractorMasters.some(s => s.name === name)
  );

  const handleEdit = (master: SubcontractorMaster) => {
    setEditingId(master.id);
    setFormData({
      name: master.name,
      paymentType: master.paymentType || 'CREDIT',
      taxId: master.taxId || '',
      bankName: master.bankName || '',
      bankAccountName: master.bankAccountName || '',
      bankAccountNo: master.bankAccountNo || '',
      contactName: master.contactName || '',
      contactPhone: master.contactPhone || '',
      note: master.note || '',
    });
    setIsAdding(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormData(emptyForm());
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      Swal.fire('กรุณาเลือกชื่อบริษัท', '', 'warning');
      return;
    }
    const id = editingId || slugify(formData.name) || Date.now().toString();
    onUpdate({ id, ...formData, name: formData.name.trim() });
    setIsAdding(false);
    setEditingId(null);
    Swal.fire({ title: 'บันทึกสำเร็จ!', icon: 'success', timer: 1400, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
  };

  const handleDelete = async (master: SubcontractorMaster) => {
    const result = await Swal.fire({
      title: `ลบข้อมูล "${master.name}"?`,
      text: 'ข้อมูลบัญชีธนาคารและ Tax ID จะถูกลบออกจากระบบ',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ลบเลย',
      cancelButtonText: 'ยกเลิก',
      customClass: { popup: 'rounded-[2rem]' },
    });
    if (result.isConfirmed) {
      onDelete(master.id);
      Swal.fire({ title: 'ลบสำเร็จ!', icon: 'success', timer: 1200, showConfirmButton: false, customClass: { popup: 'rounded-[2rem]' } });
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3 bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 flex-1">
          <Search size={16} className="text-slate-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อบริษัท, ธนาคาร, Tax ID..."
            className="bg-transparent border-none outline-none w-full text-slate-700 font-medium placeholder:text-slate-400 text-sm"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-1">
          {(['CREDIT', 'CASH', 'ALL'] as const).map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                filterType === t ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }`}>
              {t === 'CREDIT' ? '📅 เครดิต' : t === 'CASH' ? '💵 เงินสด' : 'ทั้งหมด'}
            </button>
          ))}
        </div>
        {canEdit && (
          <button
            onClick={handleAddNew}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow transition-all whitespace-nowrap"
          >
            <Plus size={16} /> เพิ่มบริษัทรถร่วม
          </button>
        )}
      </div>

      {/* Unregistered Warning */}
      {unregistered.length > 0 && canEdit && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-black text-amber-700 mb-2">⚠️ Subcontractor ต่อไปนี้ยังไม่มีข้อมูลบัญชี ({unregistered.length} รายการ):</p>
          <div className="flex flex-wrap gap-2">
            {unregistered.map(name => (
              <button
                key={name}
                onClick={() => { setEditingId(null); setFormData({ ...emptyForm(), name }); setIsAdding(true); }}
                className="px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-xs font-bold transition-all border border-amber-200"
              >
                + {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Building2 size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-bold">ยังไม่มีข้อมูล Subcontractor</p>
            <p className="text-xs mt-1">กดปุ่ม "เพิ่มบริษัทรถร่วม" เพื่อเริ่มต้น</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3">บริษัทรถร่วม</th>
                  <th className="px-5 py-3">ประเภท</th>
                  <th className="px-5 py-3">Tax ID</th>
                  <th className="px-5 py-3">ธนาคาร / บัญชี</th>
                  <th className="px-5 py-3">ชื่อบัญชี</th>
                  <th className="px-5 py-3">ผู้ติดต่อ</th>
                  {canEdit && <th className="px-5 py-3 text-right">จัดการ</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(master => (
                  <tr key={master.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-black text-slate-800 text-sm">{master.name}</p>
                      {master.note && <p className="text-[10px] text-slate-400 mt-0.5 italic">{master.note}</p>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${
                        (master.paymentType || 'CREDIT') === 'CREDIT'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {(master.paymentType || 'CREDIT') === 'CREDIT' ? '📅 เครดิต' : '💵 เงินสด'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="font-mono text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {master.taxId || <span className="text-slate-300 italic">-</span>}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {(master.paymentType || 'CREDIT') === 'CASH'
                        ? <span className="text-[10px] text-slate-400 italic">ใช้จาก Master Pricing</span>
                        : master.bankName ? (
                          <div>
                            <p className="text-xs font-black text-indigo-700">{master.bankName}</p>
                            <p className="font-mono text-xs text-slate-600">{master.bankAccountNo || '-'}</p>
                          </div>
                        ) : <span className="text-slate-300 text-xs italic">ยังไม่ระบุ</span>}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-700 font-medium">
                      {(master.paymentType || 'CREDIT') === 'CASH'
                        ? <span className="text-slate-300 italic text-xs">-</span>
                        : (master.bankAccountName || <span className="text-slate-300 italic text-xs">-</span>)}
                    </td>
                    <td className="px-5 py-4">
                      {master.contactName ? (
                        <div>
                          <p className="text-xs font-bold text-slate-700">{master.contactName}</p>
                          <p className="text-xs text-slate-400">{master.contactPhone}</p>
                        </div>
                      ) : <span className="text-slate-300 text-xs italic">-</span>}
                    </td>
                    {canEdit && (
                      <td className="px-5 py-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => handleEdit(master)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข"><Edit3 size={15} /></button>
                          <button onClick={() => handleDelete(master)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors" title="ลบ"><Trash2 size={15} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
            <div className="bg-indigo-700 px-6 py-4 flex items-center justify-between text-white rounded-t-2xl">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Building2 size={20} />
                {editingId ? 'แก้ไขข้อมูล Subcontractor' : 'เพิ่มข้อมูล Subcontractor'}
              </h3>
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} title="ปิด" className="p-1 hover:bg-indigo-600 rounded-lg transition-colors"><X size={20} /></button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Company Name */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Building2 size={12} /> ชื่อบริษัทรถร่วม *</label>
                {editingId ? (
                  <p className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-bold text-slate-700">{formData.name}</p>
                ) : (
                  <div>
                    <input
                      list="sub-name-list"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                      placeholder="เลือกหรือพิมพ์ชื่อบริษัท..."
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                    <datalist id="sub-name-list">
                      {MASTER_DATA.subcontractors.map(s => <option key={s} value={s} />)}
                    </datalist>
                  </div>
                )}
              </div>

              {/* Payment Type */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">ประเภทการชำระเงิน</label>
                <div className="flex gap-2">
                  {(['CREDIT', 'CASH'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFormData({ ...formData, paymentType: t })}
                      className={`flex-1 py-2 rounded-xl text-sm font-black transition-all border-2 ${
                        formData.paymentType === t
                          ? t === 'CREDIT' ? 'bg-blue-600 border-blue-600 text-white' : 'bg-green-600 border-green-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                      }`}
                    >
                      {t === 'CREDIT' ? '📅 เครดิต' : '💵 เงินสด'}
                    </button>
                  ))}
                </div>
                {formData.paymentType === 'CASH' && (
                  <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1">
                    ⚠️ เงินสด: เลขบัญชีกรอกใน Master Pricing (paymentAccount) ระหว่างสร้างใบงาน
                  </p>
                )}
              </div>

              {/* Tax ID */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><CreditCard size={12} /> เลขบัตรประชาชน / Tax ID (13 หลัก)</label>
                <input
                  type="text"
                  maxLength={13}
                  placeholder="x-xxxx-xxxxx-xx-x"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-mono"
                  value={formData.taxId || ''}
                  onChange={e => setFormData({ ...formData, taxId: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                />
              </div>

              {/* Bank Section — CREDIT only */}
              <div className={`p-4 rounded-2xl border space-y-3 ${
                formData.paymentType === 'CREDIT'
                  ? 'bg-blue-50 border-blue-100'
                  : 'bg-slate-50 border-slate-100 opacity-50 pointer-events-none'
              }`}>
                <p className="text-xs font-black text-blue-700 uppercase tracking-wider">🏦 ข้อมูลธนาคาร</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">ธนาคาร</label>
                    <input
                      list="bank-name-list"
                      type="text"
                      placeholder="เช่น กสิกรไทย"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      value={formData.bankName || ''}
                      onChange={e => setFormData({ ...formData, bankName: e.target.value })}
                    />
                    <datalist id="bank-name-list">
                      {BANK_LIST.map(b => <option key={b} value={b} />)}
                    </datalist>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">เลขที่บัญชี</label>
                    <input
                      type="text"
                      placeholder="xxx-x-xxxxx-x"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                      value={formData.bankAccountNo || ''}
                      onChange={e => setFormData({ ...formData, bankAccountNo: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase">ชื่อบัญชี</label>
                  <input
                    type="text"
                    placeholder="ชื่อเจ้าของบัญชีธนาคาร"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.bankAccountName || ''}
                    onChange={e => setFormData({ ...formData, bankAccountName: e.target.value })}
                  />
                </div>
              </div>

              {/* Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><User size={12} /> ชื่อผู้ติดต่อ</label>
                  <input
                    type="text"
                    placeholder="ชื่อผู้ประสานงาน"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={formData.contactName || ''}
                    onChange={e => setFormData({ ...formData, contactName: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Phone size={12} /> เบอร์โทร</label>
                  <input
                    type="text"
                    placeholder="0xx-xxx-xxxx"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                    value={formData.contactPhone || ''}
                    onChange={e => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><FileText size={12} /> หมายเหตุ</label>
                <input
                  type="text"
                  placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  value={formData.note || ''}
                  onChange={e => setFormData({ ...formData, note: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100 rounded-b-2xl">
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm">ยกเลิก</button>
              <button
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="bg-indigo-600 disabled:bg-slate-300 hover:bg-indigo-700 text-white px-8 py-2 rounded-lg font-bold shadow transition-all text-sm flex items-center gap-2"
              >
                <Save size={16} /> บันทึก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubcontractorMasterView;
