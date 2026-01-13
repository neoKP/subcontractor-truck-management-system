
import React, { useState } from 'react';
import { PriceMatrix, UserRole } from '../types';
import { MASTER_DATA } from '../constants';
import { Search, MapPin, Truck, Building2, CircleDollarSign, Plus, Edit, Trash2, X, Save } from 'lucide-react';

interface PricingTableViewProps {
  priceMatrix: PriceMatrix[];
  onUpdate: (newList: PriceMatrix[]) => void;
  userRole: UserRole;
}

const PricingTableView: React.FC<PricingTableViewProps> = ({ priceMatrix, onUpdate, userRole }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<PriceMatrix>({
    origin: '',
    destination: '',
    subcontractor: '',
    truckType: '',
    basePrice: 0,
    sellingBasePrice: 0,
    dropOffFee: 0
  });
  const [filterSubCon, setFilterSubCon] = useState('');
  const [filterTruckType, setFilterTruckType] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const canEdit = userRole === UserRole.ADMIN;

  const filteredPricing = priceMatrix.map((p, originalIndex) => ({ ...p, originalIndex })).filter(p => {
    const matchesSearch = searchTerm === '' ||
      p.origin.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.subcontractor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.truckType.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSubCon = filterSubCon === '' || p.subcontractor === filterSubCon;
    const matchesTruckType = filterTruckType === '' || p.truckType === filterTruckType;

    return matchesSearch && matchesSubCon && matchesTruckType;
  });

  const totalPages = Math.ceil(filteredPricing.length / itemsPerPage);
  const paginatedPricing = filteredPricing.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDelete = (index: number) => {
    if (window.confirm('Are you sure you want to delete this price entry?')) {
      const newList = [...priceMatrix];
      newList.splice(index, 1);
      onUpdate(newList);
    }
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setFormData(priceMatrix[index]);
    setIsAdding(true);
  };

  const handleAddNew = () => {
    setEditingIndex(null);
    setFormData({
      origin: '',
      destination: '',
      subcontractor: '',
      truckType: '',
      basePrice: 0,
      sellingBasePrice: 0,
      dropOffFee: 0
    });
    setIsAdding(true);
  };

  const handleSave = () => {
    const newList = [...priceMatrix];
    if (editingIndex !== null) {
      newList[editingIndex] = formData;
    } else {
      newList.unshift(formData);
    }
    onUpdate(newList);
    setIsAdding(false);
    setEditingIndex(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 flex-1 w-full">
          <div className="flex items-center gap-4 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200 flex-1 min-w-[200px]">
            <Search size={18} className="text-slate-400" />
            <input
              id="price-search-input"
              type="text"
              placeholder="ค้นหาต้นทาง, ปลายทาง, บริษัท..."
              className="bg-transparent border-none outline-none w-full text-slate-700 font-medium placeholder:text-slate-400 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              title="ค้นหาข้อมูลราคากลาง (Search Price Records)"
            />
          </div>

          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 min-w-[160px]"
            value={filterSubCon}
            onChange={(e) => setFilterSubCon(e.target.value)}
            title="Filter by Subcontractor"
          >
            <option value="">ทุกบริษัท (All Sub-Con)</option>
            {MASTER_DATA.subcontractors.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
          </select>

          <select
            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-blue-100 min-w-[140px]"
            value={filterTruckType}
            onChange={(e) => setFilterTruckType(e.target.value)}
            title="Filter by Truck Type"
          >
            <option value="">ทุกประเภทรถ (All Truck Types)</option>
            {MASTER_DATA.truckTypes.map((t, idx) => <option key={`${t}-${idx}`} value={t}>{t}</option>)}
          </select>
        </div>

        {canEdit && (
          <button
            onClick={handleAddNew}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-200 transition-all text-sm whitespace-nowrap w-full md:w-auto justify-center"
          >
            <Plus size={18} /> เพิ่มราคากลางใหม่ (Add New Price)
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
        <div className="overflow-x-auto max-h-[600px] scrollbar-thin">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-100 text-[10px] font-black uppercase text-slate-500 border-b border-slate-200 shadow-sm">
              <tr>
                <th className="px-6 py-5">ต้นทาง (ORIGIN)</th>
                <th className="px-6 py-5">ปลายทาง (DESTINATION)</th>
                <th className="px-6 py-5">บริษัทรถร่วม (SUB-CON)</th>
                <th className="px-6 py-5">ประเภทรถ (TRUCK TYPE)</th>
                <th className="px-6 py-5">ต้นทุนรถ (COST)</th>
                <th className="px-6 py-5">ราคาจ้าง (REVENUE)</th>
                <th className="px-6 py-5 text-center">ค่าจุด (DROP FEE)</th>
                {canEdit && <th className="px-6 py-5 text-right">จัดการ (ACTIONS)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedPricing.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 7 : 6} className="px-6 py-20 text-center text-slate-400 font-medium italic">
                    No pricing data matches your search.
                  </td>
                </tr>
              ) : (
                paginatedPricing.map((p) => (
                  <tr key={p.originalIndex} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-bold text-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        {p.origin}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-blue-400" />
                        {p.destination}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs">
                        <Building2 size={14} className="text-slate-400" />
                        <span className="px-2 py-0.5 bg-slate-100 rounded-md font-bold text-slate-600 uppercase">
                          {p.subcontractor}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs">
                        <Truck size={14} className="text-slate-400" />
                        <span className="font-semibold text-slate-700">{p.truckType}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase">Cost</span>
                        <div className="flex items-center gap-1.5 font-black text-slate-900 text-xs">
                          ฿{(Number(p.basePrice) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-blue-400 uppercase">Revenue</span>
                        <div className="flex items-center gap-1.5 font-black text-blue-600 text-xs">
                          ฿{(Number(p.sellingBasePrice) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.dropOffFee ? (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-xs">
                          ฿{(Number(p.dropOffFee) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(p.originalIndex)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Price"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(p.originalIndex)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Price"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              หน้า {currentPage} จาก {totalPages} (ทั้งหมด {filteredPricing.length} รายการ)
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentPage(i + 1)}
                    className={`w-8 h-8 rounded-lg text-xs font-black transition-all ${currentPage === i + 1 ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <h3 className="text-lg font-bold">{editingIndex !== null ? 'แก้ไขข้อมูลราคากลาง (Edit Price)' : 'เพิ่มข้อมูลราคากลางใหม่ (Add Price)'}</h3>
              <button onClick={() => setIsAdding(false)} className="p-1 hover:bg-slate-800 rounded-lg transition-colors" title="ปิด (Close)"><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label htmlFor="price-origin" className="text-xs font-bold text-slate-500 uppercase">Origin (ต้นทาง)</label>
                  <input
                    list="origin-list"
                    id="price-origin"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.origin}
                    onChange={e => setFormData({ ...formData, origin: e.target.value })}
                    placeholder="เลือกหรือพิมพ์ต้นทาง..."
                    autoComplete="off"
                  />
                  <datalist id="origin-list">
                    {MASTER_DATA.locations.map((l, idx) => <option key={`${l}-${idx}`} value={l} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label htmlFor="price-dest" className="text-xs font-bold text-slate-500 uppercase">Destination (ปลายทาง)</label>
                  <input
                    list="dest-list"
                    id="price-dest"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.destination}
                    onChange={e => setFormData({ ...formData, destination: e.target.value })}
                    placeholder="เลือกหรือพิมพ์ปลายทาง..."
                    autoComplete="off"
                  />
                  <datalist id="dest-list">
                    {MASTER_DATA.locations.map((l, idx) => <option key={`${l}-${idx}`} value={l} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label htmlFor="price-sub" className="text-xs font-bold text-slate-500 uppercase">Subcontractor</label>
                  <input
                    list="sub-list"
                    id="price-sub"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.subcontractor}
                    onChange={e => setFormData({ ...formData, subcontractor: e.target.value })}
                    placeholder="เลือกหรือพิมพ์ชื่อบริษัท..."
                    autoComplete="off"
                  />
                  <datalist id="sub-list">
                    {MASTER_DATA.subcontractors.map((s, idx) => <option key={`${s}-${idx}`} value={s} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label htmlFor="price-truck" className="text-xs font-bold text-slate-500 uppercase">Truck Type</label>
                  <input
                    list="truck-list"
                    id="price-truck"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.truckType}
                    onChange={e => setFormData({ ...formData, truckType: e.target.value })}
                    placeholder="เลือกหรือพิมพ์ประเภทรถ..."
                    autoComplete="off"
                  />
                  <datalist id="truck-list">
                    {MASTER_DATA.truckTypes.map((t, idx) => <option key={`${t}-${idx}`} value={t} />)}
                  </datalist>
                </div>
                <div className="space-y-1">
                  <label htmlFor="price-base" className="text-xs font-bold text-slate-500 uppercase">Cost (ต้นทุนรถร่วม)</label>
                  <input
                    id="price-base"
                    type="number"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.basePrice}
                    onChange={e => setFormData({ ...formData, basePrice: Number(e.target.value) })}
                    title="Cost Paid to Subcontractor"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="price-selling" className="text-xs font-bold text-blue-500 uppercase">Revenue (ราคาจ้าง)</label>
                  <input
                    id="price-selling"
                    type="number"
                    className="w-full px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold text-blue-700"
                    value={formData.sellingBasePrice}
                    onChange={e => setFormData({ ...formData, sellingBasePrice: Number(e.target.value) })}
                    title="Revenue Billed to Customer"
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label htmlFor="price-drop" className="text-xs font-bold text-slate-500 uppercase">Drop Fee (ค่าจุด)</label>
                  <input
                    id="price-drop"
                    type="number"
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    value={formData.dropOffFee || 0}
                    onChange={e => setFormData({ ...formData, dropOffFee: Number(e.target.value) })}
                    title="Drop Fee"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              <button
                onClick={() => setIsAdding(false)}
                className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
              >
                ยกเลิก (Cancel)
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.origin || !formData.destination || !formData.subcontractor || !formData.truckType}
                className="bg-blue-600 disabled:bg-slate-300 hover:bg-blue-700 text-white px-8 py-2 rounded-lg font-bold shadow-lg shadow-blue-200 transition-all text-sm flex items-center gap-2"
              >
                <Save size={16} /> บันทึกข้อมูล (Save Price)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingTableView;
