
import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { PriceMatrix, MasterData, UserRole } from '../types';
import { formatThaiCurrency, roundHalfUp } from '../utils/format';
import { MASTER_DATA } from '../constants';
import { Search, MapPin, Truck, Building2, CircleDollarSign, Plus, Edit, Trash2, X, Save, AlertTriangle, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PricingTableViewProps {
  priceMatrix: PriceMatrix[];
  onUpdate: (newList: PriceMatrix[]) => void;
  userRole: UserRole;
  initialData?: Partial<PriceMatrix>; // New Prop for Auto-fill
}

const PricingTableView: React.FC<PricingTableViewProps> = ({ priceMatrix, onUpdate, userRole, initialData }) => {
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
    dropOffFee: 0,
    paymentType: 'CREDIT',
    creditDays: 30
  });

  const [isReviewing, setIsReviewing] = useState(false);

  // Auto-open modal if initialData is provided
  React.useEffect(() => {
    if (initialData) {
      setFormData({
        origin: initialData.origin || '',
        destination: initialData.destination || '',
        subcontractor: initialData.subcontractor || '',
        truckType: initialData.truckType || '',
        basePrice: initialData.basePrice || 0,
        sellingBasePrice: initialData.sellingBasePrice || 0,
        dropOffFee: initialData.dropOffFee || 0,
        paymentType: initialData.paymentType || 'CREDIT',
        creditDays: initialData.creditDays || 30
      });
      setIsAdding(true);
    }
  }, [initialData]);
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

  const handleDelete = async (index: number) => {
    const item = priceMatrix[index];
    const result = await Swal.fire({
      title: 'ยืนยันการลบข้อมูล?',
      html: `คุณกำลังจะลบราคากลางเส้นทาง<br/><b class="text-rose-600">${item.origin} → ${item.destination}</b><br/>ของ <b>${item.subcontractor}</b>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#e11d48',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ลบเลย!',
      cancelButtonText: 'ยกเลิก',
      customClass: {
        popup: 'rounded-[2rem]',
        confirmButton: 'rounded-xl font-bold px-8 py-3',
        cancelButton: 'rounded-xl font-bold px-8 py-3'
      }
    });

    if (result.isConfirmed) {
      const newList = [...priceMatrix];
      newList.splice(index, 1);
      onUpdate(newList);

      Swal.fire({
        title: 'ลบสำเร็จ!',
        text: 'ข้อมูลราคากลางถูกนำออกจากระบบแล้ว',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false,
        customClass: { popup: 'rounded-[2rem]' }
      });
    }
  };

  const handleSyncSellingPrice = async () => {
    const zeroSellingPriceCount = priceMatrix.filter(p => !p.sellingBasePrice || p.sellingBasePrice === 0).length;
    
    if (zeroSellingPriceCount === 0) {
      Swal.fire({
        title: 'ไม่พบข้อมูลที่ต้องแก้ไข',
        text: 'ราคาจ้าง (sellingBasePrice) ทุกรายการมีค่าแล้ว',
        icon: 'info',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'rounded-[2rem]' }
      });
      return;
    }

    const result = await Swal.fire({
      title: 'ยืนยันการซิงค์ราคาจ้าง?',
      html: `พบ <b class="text-rose-600">${zeroSellingPriceCount} รายการ</b> ที่ราคาจ้างเป็น 0<br/>จะคัดลอกจากราคาต้นทุน (basePrice) ไปยังราคาจ้าง (sellingBasePrice)`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'ใช่, ซิงค์เลย!',
      cancelButtonText: 'ยกเลิก',
      customClass: {
        popup: 'rounded-[2rem]',
        confirmButton: 'rounded-xl font-bold px-8 py-3',
        cancelButton: 'rounded-xl font-bold px-8 py-3'
      }
    });

    if (result.isConfirmed) {
      const newList = priceMatrix.map(p => ({
        ...p,
        sellingBasePrice: p.sellingBasePrice || p.basePrice
      }));
      onUpdate(newList);

      Swal.fire({
        title: 'ซิงค์สำเร็จ!',
        text: `อัปเดตราคาจ้าง ${zeroSellingPriceCount} รายการแล้ว`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        customClass: { popup: 'rounded-[2rem]' }
      });
    }
  };

  const handleEdit = (index: number) => {
    setFormData(priceMatrix[index]);
    setIsAdding(true);
    setIsReviewing(false);
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
      dropOffFee: 0,
      paymentType: 'CREDIT',
      creditDays: 30
    });
    setIsAdding(true);
    setIsReviewing(false);
  };

  const handleSave = () => {
    // Basic validation
    if (!formData.origin || !formData.destination || !formData.subcontractor || !formData.truckType) return;

    // Duplicate check
    const isDuplicate = priceMatrix.some((p, idx) =>
      idx !== editingIndex &&
      p.origin === formData.origin &&
      p.destination === formData.destination &&
      p.subcontractor === formData.subcontractor &&
      p.truckType === formData.truckType
    );

    if (isDuplicate) {
      Swal.fire({
        title: 'พบข้อมูลซ้ำ! (Duplicate)',
        html: `มีการตั้งราคากลางของ <b class="text-blue-600">${formData.subcontractor}</b><br/>เส้นทาง <b>${formData.origin} → ${formData.destination}</b><br/>สำหรับรถ <b>${formData.truckType}</b> ไว้แล้วในระบบ`,
        icon: 'error',
        confirmButtonColor: '#2563eb',
        confirmButtonText: 'ตกลง (OK)',
        customClass: { popup: 'rounded-[2rem]' }
      });
      return;
    }

    setIsReviewing(true);
  };

  const handleFinalConfirm = () => {
    const newList = [...priceMatrix];
    const cleanData = {
      ...formData,
      origin: (formData.origin || '').trim(),
      destination: (formData.destination || '').trim(),
      subcontractor: (formData.subcontractor || '').trim(),
      truckType: (formData.truckType || '').trim(),
      basePrice: Number(formData.basePrice) || 0,
      sellingBasePrice: Number(formData.sellingBasePrice) || 0,
      dropOffFee: Number(formData.dropOffFee) || 0
    };

    if (editingIndex !== null) {
      newList[editingIndex] = cleanData;
    } else {
      newList.unshift(cleanData);
    }
    onUpdate(newList);

    Swal.fire({
      title: 'บันทึกสำเร็จ!',
      text: 'ข้อมูลราคากลางใน Master Data ได้รับการอัปเดตแล้ว',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: 'rounded-[2rem]' }
    });

    setIsAdding(false);
    setIsReviewing(false);
    setEditingIndex(null);
  };

  const handleExportExcel = () => {
    // Prepare data for export - use filteredPricing to export what the user sees
    const dataForExport = filteredPricing.map(p => ({
      'ต้นทาง (Origin)': p.origin,
      'ปลายทาง (Destination)': p.destination,
      'บริษัทรถร่วม (Subcontractor)': p.subcontractor,
      'ประเภทรถ (Truck Type)': p.truckType,
      'ราคาทุนรถ (Base Cost)': p.basePrice,
      'ราคาจ้างงาน (Selling Price)': p.sellingBasePrice,
      'ค่าจุดดรอป (Drop Fee)': p.dropOffFee || 0
    }));

    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(dataForExport);

    // Set column widths
    const wscols = [
      { wch: 30 }, // Origin
      { wch: 30 }, // Destination
      { wch: 25 }, // Subcontractor
      { wch: 15 }, // Truck Type
      { wch: 15 }, // Base Cost
      { wch: 15 }, // Selling Price
      { wch: 15 }  // Drop Fee
    ];
    worksheet['!cols'] = wscols;

    // Create workbook and append worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Pricing');

    // Generate Excel file and trigger download
    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Subcontractor_Price_Matrix_${dateStr}.xlsx`);

    Swal.fire({
      title: 'Export สำเร็จ!',
      text: 'ระบบกำลังดาวน์โหลดไฟล์ Excel...',
      icon: 'success',
      timer: 1500,
      showConfirmButton: false,
      customClass: { popup: 'rounded-[2rem]' }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col xl:flex-row gap-4 justify-between items-stretch xl:items-center bg-white p-4 md:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 flex-1">
          <div className="flex items-center gap-3 bg-slate-100 px-4 py-2.5 rounded-xl border border-slate-200 flex-1">
            <Search size={18} className="text-slate-400" />
            <input
              id="price-search-input"
              type="text"
              placeholder="ค้นหาต้นทาง, ปลายทาง, บริษัท..."
              className="bg-transparent border-none outline-none w-full text-slate-700 font-medium placeholder:text-slate-400 text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 md:flex gap-2">
            <select
              className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:ring-4 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer"
              value={filterSubCon}
              onChange={(e) => setFilterSubCon(e.target.value)}
              title="กรองตามบริษัทรถร่วม (Filter by Subcontractor)"
            >
              <option value="">ทุกบริษัท</option>
              {MASTER_DATA.subcontractors.map((s, idx) => <option key={`${s}-${idx}`} value={s}>{s}</option>)}
            </select>

            <select
              className="pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-700 focus:ring-4 focus:ring-blue-100 outline-none transition-all appearance-none cursor-pointer"
              value={filterTruckType}
              onChange={(e) => setFilterTruckType(e.target.value)}
              title="กรองตามประเภทรถ (Filter by Truck Type)"
            >
              <option value="">ทุกประเภทรถ</option>
              {MASTER_DATA.truckTypes.map((t, idx) => <option key={`${t}-${idx}`} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-2 w-full xl:w-auto mt-2 xl:mt-0">
          <button
            onClick={handleExportExcel}
            className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-4 md:px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 transition-all text-sm whitespace-nowrap"
          >
            <Download size={18} /> <span className="hidden sm:inline">Export</span>
          </button>

          {canEdit && (
            <button
              onClick={handleAddNew}
              className="flex-[2] md:flex-none bg-blue-600 hover:bg-blue-700 text-white px-4 md:px-6 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-100 transition-all text-sm whitespace-nowrap"
            >
              <Plus size={18} /> เพิ่มราคากลาง
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm relative">
        {/* Desktop Table View */}
        <div className="hidden lg:block overflow-x-auto max-h-[600px] scrollbar-thin">
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
                <th className="px-6 py-5 text-center">เงื่อนไขชำระ (TERMS)</th>
                {canEdit && <th className="px-6 py-5 text-right">จัดการ (ACTIONS)</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedPricing.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 8 : 7} className="px-6 py-20 text-center text-slate-400 font-medium italic">
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
                          ฿{formatThaiCurrency(Number(p.basePrice) || 0)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] font-bold text-blue-400 uppercase">Revenue</span>
                        <div className="flex items-center gap-1.5 font-black text-blue-600 text-xs">
                          ฿{formatThaiCurrency(Number(p.sellingBasePrice) || 0)}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {p.dropOffFee ? (
                        <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 text-xs">
                          ฿{formatThaiCurrency(Number(p.dropOffFee) || 0)}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-1 rounded-lg font-bold text-[10px] uppercase ${p.paymentType === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {p.paymentType === 'CASH' ? '💵 เงินสด' : `📅 ${p.creditDays || 30} วัน`}
                      </span>
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

        {/* Mobile Card View */}
        <div className="lg:hidden divide-y divide-slate-100">
          {paginatedPricing.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium italic">
              No pricing data matches your search.
            </div>
          ) : (
            paginatedPricing.map((p) => (
              <div key={p.originalIndex} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-black text-slate-800">
                      <MapPin size={14} className="text-slate-400 shrink-0" />
                      {p.origin}
                    </div>
                    <div className="flex items-center gap-2 text-sm font-black text-blue-600">
                      <MapPin size={14} className="text-blue-500 shrink-0" />
                      {p.destination}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(p.originalIndex)} className="p-2 text-blue-600 bg-blue-50 rounded-lg" title="แก้ไข (Edit)"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(p.originalIndex)} className="p-2 text-rose-600 bg-rose-50 rounded-lg" title="ลบ (Delete)"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-[10px] font-black text-slate-400 uppercase">บริษัทรถร่วม</p>
                    <p className="text-xs font-bold text-slate-700 truncate">{p.subcontractor}</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg">
                    <p className="text-[10px] font-black text-slate-400 uppercase">ประเภทรถ</p>
                    <p className="text-xs font-bold text-slate-700">{p.truckType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-2">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Cost</p>
                    <p className="text-sm font-black text-slate-800">฿{formatThaiCurrency(p.basePrice)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-blue-400 uppercase">Revenue</p>
                    <p className="text-sm font-black text-blue-600">฿{formatThaiCurrency(p.sellingBasePrice)}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-amber-500 uppercase">Drop</p>
                    <p className="text-sm font-black text-amber-600">฿{formatThaiCurrency(p.dropOffFee || 0)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination UI */}
        {totalPages > 1 && (
          <div className="px-4 md:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
              หน้า {currentPage} จาก {totalPages} ({filteredPricing.length} รายการ)
            </p>
            <div className="flex items-center gap-2">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="px-2 md:px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
              >
                Prev
              </button>
              <div className="hidden sm:flex items-center gap-1">
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
                className="px-2 md:px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold hover:bg-slate-50 disabled:opacity-30 transition-all shadow-sm"
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
              <h3 className="text-lg font-bold">
                {isReviewing
                  ? 'ตรวจสอบความถูกต้อง (Review Data)'
                  : (editingIndex !== null ? 'แก้ไขข้อมูลราคากลาง (Edit Price)' : 'เพิ่มข้อมูลราคากลางใหม่ (Add Price)')}
              </h3>
              <button onClick={() => { setIsAdding(false); setIsReviewing(false); }} className="p-1 hover:bg-slate-800 rounded-lg transition-colors" title="ปิด (Close)"><X size={20} /></button>
            </div>

            {isReviewing ? (
              <div className="p-6 space-y-6 animate-in slide-in-from-right-4 duration-300">
                <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-2xl space-y-4">
                  <div className="grid grid-cols-2 gap-y-4">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Origin</p>
                      <p className="font-bold text-slate-800 flex items-center gap-2">
                        <MapPin size={14} className="text-slate-400" />
                        {formData.origin}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Destination</p>
                      <p className="font-bold text-slate-800 flex items-center gap-2">
                        <MapPin size={14} className="text-blue-500" />
                        {formData.destination}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Subcontractor</p>
                      <p className="font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg w-fit">
                        {formData.subcontractor}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Truck Type</p>
                      <p className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Truck size={14} className="text-slate-400" />
                        {formData.truckType}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cost (ต้นทุน)</p>
                    <p className="text-lg font-black text-slate-900">฿{formatThaiCurrency(formData.basePrice)}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Revenue (ราคาจ้าง)</p>
                    <p className="text-lg font-black text-blue-600">฿{formatThaiCurrency(formData.sellingBasePrice)}</p>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100">
                    <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Drop Fee (ค่าจุด)</p>
                    <p className="text-lg font-black text-amber-600">฿{formatThaiCurrency(formData.dropOffFee || 0)}</p>
                  </div>
                </div>

                {/* Payment Terms Review */}
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-2">💳 เงื่อนไขการชำระเงิน</p>
                  <div className="flex items-center gap-4">
                    <span className={`px-3 py-1.5 rounded-lg font-black text-sm ${formData.paymentType === 'CASH' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                      {formData.paymentType === 'CASH' ? '💵 เงินสด' : '📅 เครดิต'}
                    </span>
                    <span className="font-black text-emerald-800">
                      {formData.paymentType === 'CASH' ? 'จ่ายทันทีเมื่องานเสร็จ' : `${formData.creditDays} วัน`}
                    </span>
                  </div>
                  {formData.paymentType === 'CASH' && formData.paymentAccount && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-[10px] font-black text-red-600 uppercase mb-0.5">💰 บัญชีที่ต้องชำระ</p>
                      <p className="text-sm font-bold text-red-800">{formData.paymentAccount}</p>
                    </div>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-xl flex items-center gap-3">
                  <CircleDollarSign className="text-yellow-600 shrink-0" size={20} />
                  <p className="text-xs font-bold text-yellow-700 italic">
                    กรุณาตรวจสอบข้อมูลให้ถูกต้องก่อนยืนยัน บันทึกแล้วจะมีผลกับงานใหม่ทันที
                  </p>
                </div>
              </div>
            ) : (
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
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setFormData({ ...formData, basePrice: isNaN(val) ? 0 : val });
                      }}
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
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setFormData({ ...formData, sellingBasePrice: isNaN(val) ? 0 : val });
                      }}
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
                      onChange={e => {
                        const val = e.target.value === '' ? 0 : Number(e.target.value);
                        setFormData({ ...formData, dropOffFee: isNaN(val) ? 0 : val });
                      }}
                      title="Drop Fee"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* Payment Terms Section */}
                <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-200">
                  <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wider mb-3 flex items-center gap-2">
                    💳 เงื่อนไขการชำระเงิน (Payment Terms)
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">ประเภทการชำระ</label>
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                        value={formData.paymentType || 'CREDIT'}
                        title="เลือกประเภทการชำระเงิน"
                        onChange={e => setFormData({ 
                          ...formData, 
                          paymentType: e.target.value as 'CASH' | 'CREDIT',
                          creditDays: e.target.value === 'CASH' ? 0 : (formData.creditDays || 30),
                          paymentAccount: e.target.value === 'CREDIT' ? '' : formData.paymentAccount
                        })}
                      >
                        <option value="CASH">💵 เงินสด (จ่ายทันที)</option>
                        <option value="CREDIT">📅 เครดิต</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">จำนวนวันเครดิต</label>
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold disabled:bg-slate-100 disabled:text-slate-400"
                        value={formData.creditDays || 0}
                        title="เลือกจำนวนวันเครดิต"
                        onChange={e => setFormData({ ...formData, creditDays: Number(e.target.value) })}
                        disabled={formData.paymentType === 'CASH'}
                      >
                        <option value={0}>0 วัน (ทันที)</option>
                        <option value={7}>7 วัน</option>
                        <option value={15}>15 วัน</option>
                        <option value={30}>30 วัน</option>
                        <option value={45}>45 วัน</option>
                        <option value={60}>60 วัน</option>
                      </select>
                    </div>
                  </div>

                  {/* Payment Account - CASH only */}
                  {formData.paymentType === 'CASH' && (
                    <div className="mt-3 space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">💰 เลขที่บัญชีที่ต้องชำระ (Optional)</label>
                      <input
                        type="text"
                        placeholder="เช่น กสิกรไทย 123-4-56789-0 ชื่อ บจก.xxxxx"
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 outline-none text-sm font-bold"
                        value={formData.paymentAccount || ''}
                        onChange={e => setFormData({ ...formData, paymentAccount: e.target.value })}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-100">
              {isReviewing ? (
                <>
                  <button
                    onClick={() => setIsReviewing(false)}
                    className="px-6 py-2 rounded-lg font-bold text-slate-600 hover:bg-slate-200 transition-colors text-sm"
                  >
                    กลับไปแก้ไข (Back)
                  </button>
                  <button
                    onClick={handleFinalConfirm}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2 rounded-lg font-black shadow-lg shadow-emerald-200 transition-all text-sm flex items-center gap-2 active:scale-95"
                  >
                    <Save size={16} /> ยืนยันข้อมูลถูกต้อง (Confirm & Save)
                  </button>
                </>
              ) : (
                <>
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
                    <Plus size={16} /> ตรวจสอบข้อมูล (Review Price)
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PricingTableView;
