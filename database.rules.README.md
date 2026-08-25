# กฎฐานข้อมูล (database.rules.json)

Firebase ไม่รองรับคอมเมนต์ในไฟล์กฎ — แม้แต่คีย์ `"//"` ที่อยู่ข้างใน `rules`
ก็ทำให้ deploy ไม่ผ่าน (`Expected '{'` เพราะมันตีความว่าเป็นชื่อ path)
บันทึกทั้งหมดจึงอยู่ที่ไฟล์นี้แทน

## กฎนี้ทำอะไร

บังคับให้ต้องล็อกอิน Firebase Auth ก่อนอ่านหรือเขียนทุก path
เว็บล็อกอินแบบ anonymous ให้อัตโนมัติ (`firebaseConfig.ts`) และ `App.tsx`
รอให้ล็อกอินเสร็จก่อนต่อ listener แล้ว

ก่อนหน้านี้ `.read` และ `.write` ที่ root เป็น `true` — ใครก็ตามที่รู้ URL
(ซึ่งอยู่ใน bundle สาธารณะ) อ่าน แก้ หรือลบข้อมูลทั้งบริษัทได้ด้วย HTTP
ครั้งเดียว ยืนยันด้วยการยิงทดสอบจริงแล้วว่าทำได้

## ที่ยังเหลือ — อ่านก่อนคิดว่าปลอดภัยแล้ว

**กฎนี้กันคนที่ไม่ได้ล็อกอินเท่านั้น ไม่ได้กันคนที่ล็อกอินแล้ว**

เว็บล็อกอินแบบ anonymous ให้ใครก็ได้ที่เปิดหน้าเว็บ แปลว่าคนนอกยังขอ token
เองได้ (`accounts:signUp` ด้วย API key ที่อยู่ใน bundle) แล้วอ่านหรือเขียน
ทุก path ที่กฎเขียนว่า `auth != null` ได้อยู่ดี

ที่กระทบหนักที่สุดคือ `/users` เพราะเก็บรหัสผ่านแบบอ่านได้ — การล็อกอินของ
ระบบอ่านตารางนี้ฝั่ง client โดยตรง

แก้ได้ทางเดียวคือย้าย login ไปฝั่งเซิร์ฟเวอร์ (Cloud Function หรือ NAS),
hash รหัสผ่าน, แล้วเปลี่ยนกฎของ `/users` ให้เข้มกว่า `auth != null`
เช่นให้อ่านได้เฉพาะ record ของตัวเอง (`auth.uid === $uid`)

## บันทึกของแต่ละ path

- **jobCounters** — ตัวนับเลขใบงานรายปี เขียนผ่าน transaction เท่านั้น กันเลขซ้ำเมื่อสร้างงานพร้อมกัน
- **invoiceCounters** — ตัวนับเลขใบแจ้งหนี้รถร่วมรายปี เขียนผ่าน transaction เท่านั้น กันเลขซ้ำเมื่อออกใบพร้อมกัน
- **fuelRates** — ตารางเรทค่าขนส่งตามราคาน้ำมันที่หน่วยงานส่งมา เก็บเป็นรุ่น ไม่ทับของเดิม
- **oilPrice** — ราคาน้ำมันที่ Cloud Function เขียน (ยังไม่ได้ deploy ฟังก์ชันนั้น) เว็บอ่านอย่างเดียว

## วิธี deploy

`firebase.json` ไม่ได้ประกาศ `database` ไว้ถาวรโดยตั้งใจ — ถ้าประกาศไว้
วันหลังใครรัน `firebase deploy` เฉย ๆ จะ deploy กฎซ้ำโดยไม่ตั้งใจ
จึงเพิ่มตอนจะ deploy แล้วเอาออกทันที

รันใน PowerShell ทีละบรรทัด:

```powershell
cd D:\subcontractor-truck-management-system
```

ขั้นที่ 1 — เพิ่ม `database` เข้า `firebase.json` ชั่วคราว:

```powershell
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('firebase.json','utf8'));j.database={rules:'database.rules.json'};fs.writeFileSync('firebase.json',JSON.stringify(j,null,2))"
```

ขั้นที่ 2 — deploy:

```powershell
npx firebase --project subtruckmanagementsystem deploy --only database
```

ขั้นที่ 3 — เอาออก (ห้ามข้าม):

```powershell
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('firebase.json','utf8'));delete j.database;fs.writeFileSync('firebase.json',JSON.stringify(j,null,2))"
```

## ตรวจหลัง deploy

คนนอกต้องเข้าไม่ได้ (ต้องได้ 401):

```powershell
curl.exe -s -o NUL -w "%{http_code}`n" "https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app/jobs.json?shallow=true"
```

แล้วเปิดเว็บดูว่ายังใช้งานได้ — ต้องเห็นข้อมูลครบตามปกติ

## ถ้าต้องย้อนกลับ

สร้างไฟล์กฎเปิดแล้ว deploy แทน (ใช้เมื่อเว็บใช้งานไม่ได้เท่านั้น
เพราะจะเปิดฐานข้อมูลให้คนทั้งอินเทอร์เน็ตอีกครั้ง):

```powershell
node -e "require('fs').writeFileSync('rules-open.json',JSON.stringify({rules:{'.read':true,'.write':true}},null,2))"
node -e "const fs=require('fs');const j=JSON.parse(fs.readFileSync('firebase.json','utf8'));j.database={rules:'rules-open.json'};fs.writeFileSync('firebase.json',JSON.stringify(j,null,2))"
npx firebase --project subtruckmanagementsystem deploy --only database
```

ข้อมูลสำรองล่าสุด: `C:\Users\User\Downloads\rtdb-backup-20260825-104920.json`
(ใบงาน 2,497 · ประวัติ 6,202 · ราคากลาง 514 · ผู้ใช้ 29 · ใบแจ้งหนี้ 4)
