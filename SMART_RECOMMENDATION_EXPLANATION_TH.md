# 🧠 คู่มือฟังก์ชัน SMART RECOMMENDATION (แนะนำอัจฉริยะ)

## 📍 ตำแหน่งฟังก์ชัน

ฟังก์ชันนี้อยู่ใน: `DispatcherActionModal.tsx` (บรรทัด 273-319)

ใช้งานเมื่อ: **Dispatcher** กำลังมอบหมายงานให้ผู้รับเหมาช่วง (Subcontractor)

---

## 🎯 วัตถุประสงค์

ระบบ **Smart Recommendation** ถูกออกแบบมาเพื่อ:

1. **ช่วยประหยัดเวลา** - ไม่ต้องค้นหาราคาเองทีละราย
2. **แนะนำราคาที่ดีที่สุด** - เรียงลำดับจากถูกที่สุดไปแพงที่สุด
3. **ป้องกันความผิดพลาด** - แสดงเฉพาะบริษัทที่มีราคาตรงกับเส้นทางและประเภทรถ
4. **เพิ่มความโปร่งใส** - แสดงราคาชัดเจนก่อนตัดสินใจ

---

## 🔍 ฟังก์ชันหลัก 3 ส่วน

### 1️⃣ ฟังก์ชันตรวจสอบเส้นทาง (Route Matching)

**โค้ด:**

```typescript
priceMatrix.filter(p =>
  p.origin.includes(job.origin) &&
  p.destination.includes(job.destination) &&
  p.truckType === editData.truckType
)
```

**คำอธิบาย:**

- **ทำอะไร:** กรองข้อมูลจากตาราง Price Matrix เพื่อหาบริษัทที่ตรงกับเงื่อนไข
- **เงื่อนไข 3 ข้อ:**
  1. `p.origin.includes(job.origin)` - **ต้นทาง**ตรงกัน
  2. `p.destination.includes(job.destination)` - **ปลายทาง**ตรงกัน
  3. `p.truckType === editData.truckType` - **ประเภทรถ**ตรงกัน

**ตัวอย่าง:**

```text
งานที่กำลังสร้าง:
- ต้นทาง: "กรุงเทพฯ"
- ปลายทาง: "เชียงใหม่"
- ประเภทรถ: "6 ล้อ"

ระบบจะค้นหาใน Price Matrix:
✅ บริษัท A: กรุงเทพฯ → เชียงใหม่, 6 ล้อ, ราคา 8,500 บาท
✅ บริษัท B: กรุงเทพฯ → เชียงใหม่, 6 ล้อ, ราคา 9,200 บาท
❌ บริษัท C: กรุงเทพฯ → เชียงใหม่, 10 ล้อ, ราคา 12,000 บาท (ประเภทรถไม่ตรง)
❌ บริษัท D: กรุงเทพฯ → ภูเก็ต, 6 ล้อ, ราคา 7,500 บาท (ปลายทางไม่ตรง)
```

---

### 2️⃣ ฟังก์ชันเรียงลำดับราคา (Price Sorting)

**โค้ด:**

```typescript
.sort((a, b) => a.basePrice - b.basePrice)
.slice(0, 3)
```

**คำอธิบาย:**

- **`.sort((a, b) => a.basePrice - b.basePrice)`**
  - เรียงลำดับจาก**ราคาถูกที่สุด → แพงที่สุด**
  - ใช้ `basePrice` (ราคาฐาน) เป็นตัวเปรียบเทียบ

- **`.slice(0, 3)`**
  - แสดงเฉพาะ **3 อันดับแรก** (Top 3)
  - ป้องกันการแสดงข้อมูลมากเกินไป

**ตัวอย่าง:**

```text
ข้อมูลที่กรองได้:
- บริษัท B: 9,200 บาท
- บริษัท A: 8,500 บาท
- บริษัท E: 10,500 บาท
- บริษัท F: 8,800 บาท

หลังเรียงลำดับ:
1. บริษัท A: 8,500 บาท ⭐ (ถูกที่สุด)
2. บริษัท F: 8,800 บาท
3. บริษัท B: 9,200 บาท

แสดงเฉพาะ 3 อันดับแรก (ไม่แสดงบริษัท E)
```

---

### 3️⃣ ฟังก์ชันคำนวณราคาอัตโนมัติ (Auto Price Calculation)

**โค้ด:**

```typescript
const calculatePriceLive = (origin: string, destination: string, truckType: string, sub: string): number => {
  const match = priceMatrix.find(
    p => p.origin.includes(origin) && 
         p.destination.includes(destination) && 
         p.truckType === truckType && 
         p.subcontractor === sub
  );
  if (match) return match.basePrice;
  return 0; // ถ้าไม่เจอ คืนค่า 0
};
```

**คำอธิบาย:**

- **ทำอะไร:** ค้นหาราคาที่ตรงกับเงื่อนไขทั้งหมด
- **เงื่อนไข 4 ข้อ:**
  1. ต้นทางตรงกัน
  2. ปลายทางตรงกัน
  3. ประเภทรถตรงกัน
  4. **บริษัทรับเหมาช่วงตรงกัน** (เพิ่มเติมจาก Route Matching)

- **ผลลัพธ์:**
  - เจอ → คืนค่า `basePrice` (ราคาฐาน)
  - ไม่เจอ → คืนค่า `0`

**ตัวอย่าง:**

```typescript
calculatePriceLive("กรุงเทพฯ", "เชียงใหม่", "6 ล้อ", "โชคะ")
// ผลลัพธ์: 8,500 (ถ้ามีในตาราง)

calculatePriceLive("กรุงเทพฯ", "เชียงใหม่", "6 ล้อ", "บริษัทที่ไม่มี")
// ผลลัพธ์: 0 (ไม่พบข้อมูล)
```

---

## 🔄 การทำงานอัตโนมัติ (Auto-Recalculation)

**โค้ด:**

```typescript
useEffect(() => {
  const hasSubChanged = editData.subcontractor !== sessionPriceKeys.sub;
  const hasTruckChanged = editData.truckType !== sessionPriceKeys.truck;

  if (hasSubChanged || hasTruckChanged) {
    if (editData.subcontractor && editData.truckType) {
      const newPrice = calculatePriceLive(job.origin, job.destination, editData.truckType, editData.subcontractor);
      setEditData(prev => ({ ...prev, cost: newPrice }));
      if (newPrice > 0) {
        setPriceCalculated(true);
        setTimeout(() => setPriceCalculated(false), 2000);
      }
    }
    setSessionPriceKeys({
      sub: editData.subcontractor,
      truck: editData.truckType
    });
  }
}, [editData.subcontractor, editData.truckType, ...]);
```

**คำอธิบาย:**

### เมื่อไหร่ที่ระบบจะคำนวณราคาใหม่อัตโนมัติ?

1. **เมื่อเปลี่ยนบริษัทรับเหมาช่วง** (`subcontractor`)
2. **เมื่อเปลี่ยนประเภทรถ** (`truckType`)

### ทำไมต้องมี `sessionPriceKeys`?

- **ป้องกันการคำนวณซ้ำ** - ไม่ให้คำนวณทุกครั้งที่ component re-render
- **เก็บค่าเดิม** - เปรียบเทียบว่ามีการเปลี่ยนแปลงจริงหรือไม่
- **รักษาราคาที่ต่อรองแล้ว** - ถ้าผู้ใช้แก้ไขราคาเอง จะไม่ถูก override

### Animation Feedback

```typescript
if (newPrice > 0) {
  setPriceCalculated(true);
  setTimeout(() => setPriceCalculated(false), 2000);
}
```

- แสดงข้อความ **"✓ AUTO-CALCULATED"** เป็นเวลา 2 วินาที
- ช่องราคาเปลี่ยนเป็น**สีเขียว** (emerald) ชั่วคราว
- ให้ feedback ว่าระบบคำนวณให้อัตโนมัติแล้ว

---

## 🎨 UI/UX ของ Smart Recommendation

### การแสดงผลแต่ละอันดับ

```typescript
.map((rec, index) => (
  <button
    key={index}
    onClick={() => setEditData({ ...editData, subcontractor: rec.subcontractor })}
    className={`... ${editData.subcontractor === rec.subcontractor ? 'border-emerald-500 bg-emerald-50' : 'border-slate-50 bg-slate-50/50 hover:border-blue-200 hover:bg-white'}`}
  >
    {/* อันดับ */}
    <div className={`... ${index === 0 ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-200 text-slate-500'}`}>
      {index + 1}
    </div>
    
    {/* ชื่อบริษัท */}
    <p className="...">{rec.subcontractor}</p>
    <p className="...">ราคาตรงตามเส้นทาง (Perfect Match for Route)</p>
    
    {/* ราคา */}
    <p className="...">฿{formatThaiCurrency(Number(rec.basePrice) || 0)}</p>
    <p className="...">กดเพื่อเลือก (Select This)</p>
  </button>
))
```

### จุดเด่นของ UI

1. **อันดับ 1 สีเขียว** - เน้นให้เห็นว่าเป็นตัวเลือกที่ดีที่สุด
2. **Hover Effect** - เปลี่ยนสีเมื่อเมาส์ชี้
3. **Selected State** - แสดงกรอบสีเขียวเมื่อเลือกแล้ว
4. **One-Click Selection** - คลิกเดียวเลือกบริษัทได้เลย

---

## 📊 ตัวอย่างการทำงานจริง

### สถานการณ์: Dispatcher กำลังมอบหมายงาน

**ข้อมูลงาน:**

```text
Job ID: JOB-2026-001
ต้นทาง: กรุงเทพฯ
ปลายทาง: เชียงใหม่
ประเภทรถ: 6 ล้อ
```

#### ขั้นตอนที่ 1: เปิด Modal

- ระบบโหลด Price Matrix
- ยังไม่แสดง Recommendation (เพราะยังไม่ได้เลือกประเภทรถ)

#### ขั้นตอนที่ 2: เลือกประเภทรถ "6 ล้อ"

```text
ระบบทำงาน:
1. กรองข้อมูลจาก Price Matrix
   - เงื่อนไข: กรุงเทพฯ → เชียงใหม่, 6 ล้อ
   
2. พบข้อมูล 5 บริษัท:
   - โชคะ: 8,500 บาท
   - วัจนโกเซ็น: 8,800 บาท
   - เอกชัยโลจิสติก: 9,200 บาท
   - ทรานสปอร์ต: 9,500 บาท
   - สยามขนส่ง: 10,000 บาท

3. เรียงลำดับและแสดง Top 3:
   ┌─────────────────────────────────────┐
   │ 1  โชคะ                   ฿8,500.00 │ ⭐ ถูกที่สุด
   │    Perfect Match for Route          │
   ├─────────────────────────────────────┤
   │ 2  วัจนโกเซ็น             ฿8,800.00 │
   │    Perfect Match for Route          │
   ├─────────────────────────────────────┤
   │ 3  เอกชัยโลจิสติก         ฿9,200.00 │
   │    Perfect Match for Route          │
   └─────────────────────────────────────┘
```

#### ขั้นตอนที่ 3: คลิกเลือก "โชคะ"

```text
ระบบทำงาน:
1. setEditData({ ...editData, subcontractor: "โชคะ" })
2. useEffect ตรวจจับการเปลี่ยนแปลง
3. คำนวณราคา: calculatePriceLive(...) → 8,500
4. อัพเดทช่องราคา: cost = 8,500
5. แสดง Animation: "✓ AUTO-CALCULATED" (2 วินาที)
6. ช่องราคาเปลี่ยนเป็นสีเขียว
```

#### ขั้นตอนที่ 4: ผู้ใช้ต่อรองราคาได้

```text
Dispatcher สามารถแก้ไขราคาเป็น 8,200 บาท
→ ระบบจะไม่ override ราคานี้
→ เมื่อบันทึก จะถูกถามเหตุผล (Reason for Change)
```

---

## 🚨 กรณีพิเศษ

### กรณีที่ 1: ไม่พบข้อมูลในตาราง

**โค้ด:**

```typescript
{priceMatrix.filter(...).length === 0 && (
  <div className="...">
    ไม่พบข้อมูลราคากลางสำหรับเส้นทางและประเภทรถนี้ (No pricing records found)
  </div>
)}
```

**ผลลัพธ์:**

- แสดงข้อความแจ้งเตือน
- ผู้ใช้ต้องกรอกราคาเองทั้งหมด
- ระบบจะถามเหตุผลเมื่อบันทึก

### กรณีที่ 2: ราคาถูกล็อกโดยฝ่ายบัญชี

**โค้ด:**

```typescript
const isActuallyLocked = job.isBaseCostLocked &&
  user.role !== UserRole.ADMIN &&
  job.accountingStatus !== AccountingStatus.REJECTED &&
  job.accountingStatus !== AccountingStatus.PENDING_REVIEW;
```

**ผลลัพธ์:**

- Smart Recommendation ยังแสดงได้
- แต่**ไม่สามารถเปลี่ยนบริษัทหรือราคาได้**
- แสดงไอคอน 🔒 และข้อความ "ล็อกโดยฝ่ายบัญชี (LOCKED)"

### กรณีที่ 3: Admin Override

**โค้ด:**

```typescript
const isAdminOverride = job.isBaseCostLocked && user.role === UserRole.ADMIN;
```

**ผลลัพธ์:**

- Admin สามารถแก้ไขได้แม้ราคาถูกล็อก
- แสดงข้อความ "แอดมินกำลังแก้ไข (ADMIN OVERRIDE)"

---

## 💡 ข้อดีของระบบ

### 1. ประหยัดเวลา

- **ก่อนมีระบบ:** ต้องเปิดตารางราคา → ค้นหาเส้นทาง → เปรียบเทียบราคา → กรอกเอง
- **หลังมีระบบ:** คลิกเลือก 1 ครั้ง → ราคาถูกกรอกอัตโนมัติ

### 2. ลดข้อผิดพลาด

- ป้องกันการกรอกราคาผิด
- ป้องกันการเลือกบริษัทที่ไม่มีราคาในเส้นทางนั้น
- แสดงเฉพาะตัวเลือกที่ถูกต้อง

### 3. เพิ่มความโปร่งใส

- เห็นราคาเปรียบเทียบชัดเจน
- รู้ว่าบริษัทไหนถูกที่สุด
- สามารถตัดสินใจได้อย่างมีข้อมูล

### 4. ยืดหยุ่น

- สามารถเลือกบริษัทอื่นได้ (ไม่จำเป็นต้องเลือกอันดับ 1)
- สามารถแก้ไขราคาได้ (กรณีต่อรอง)
- มี Audit Trail บันทึกการเปลี่ยนแปลง

---

## 🔐 ความปลอดภัยและการตรวจสอบ

### Audit Log System

เมื่อเลือกบริษัทและบันทึก ระบบจะบันทึก:

```typescript
logs.push(createLog(
  'Assignment',
  'Unassigned',
  `${editData.subcontractor} (${editData.truckType})`,
  'New Job Assignment'
));

logs.push(createLog(
  'Cost (Price)',
  '0',
  editData.cost.toString(),
  finalReason || 'Initial Pricing'
));

// ถ้าราคาไม่ตรงกับตาราง
if (editData.cost !== matrixPrice) {
  logs.push(createLog(
    'Price Override',
    matrixPrice.toString(),
    editData.cost.toString(),
    finalReason || 'Price Negotiation'
  ));
}
```

**ข้อมูลที่บันทึก:**

- ใครเป็นคนมอบหมาย (User ID, Name, Role)
- เมื่อไหร่ (Timestamp)
- เปลี่ยนอะไร (Field, Old Value, New Value)
- ทำไม (Reason)

---

## 📝 สรุป

### Smart Recommendation ทำงาน 3 ขั้นตอนหลัก

```text
1. FILTER (กรอง)
   ↓
   ค้นหาบริษัทที่ตรงกับ: ต้นทาง + ปลายทาง + ประเภทรถ

2. SORT (เรียง)
   ↓
   เรียงลำดับจากราคาถูกที่สุด → แพงที่สุด
   แสดงเฉพาะ Top 3

3. AUTO-CALCULATE (คำนวณอัตโนมัติ)
   ↓
   เมื่อเลือกบริษัท → ราคาถูกกรอกอัตโนมัติ
   แสดง Animation Feedback
```

### ประโยชน์หลัก

✅ **ประหยัดเวลา** - เลือกได้ใน 1 คลิก  
✅ **ลดข้อผิดพลาด** - แสดงเฉพาะตัวเลือกที่ถูกต้อง  
✅ **โปร่งใส** - เห็นราคาเปรียบเทียบชัดเจน  
✅ **ยืดหยุ่น** - สามารถแก้ไขและต่อรองได้  
✅ **ปลอดภัย** - มี Audit Trail ครบถ้วน

---

เอกสารนี้สร้างขึ้นเพื่ออธิบายการทำงานของ Smart Recommendation System

อัพเดทล่าสุด: 16 มกราคม 2026
