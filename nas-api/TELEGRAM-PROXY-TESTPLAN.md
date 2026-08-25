# แผนทดสอบ telegram-notify.php

เอกสารนี้เก็บเกณฑ์อ่านผลที่ตกลงกันไว้ เพื่อไม่ให้ต้องรื้อจากประวัติแชต
ทุกข้อในนี้มาจากการอ่านโค้ดจริง ไม่ใช่การเดา — มีเลขบรรทัดกำกับ

## ทำไมต้องมีเอกสารนี้

ระหว่างเตรียมงาน เราเกือบสรุปสาเหตุผิดสามครั้ง เพราะ **สัญญาณเดียวมีได้หลายสาเหตุ**
เกณฑ์ด้านล่างจึงเขียนแบบ "เห็นอาการนี้ ให้ไปดูตรงไหน" ไม่ใช่ "อาการนี้แปลว่าอะไร"

## ขนาดไฟล์ที่ถูกต้อง

ใช้ตรวจว่าไฟล์ขึ้นครบโดยไม่ต้องเปิดดู — ขนาดผิดแม้ 1 ไบต์คือไฟล์เสีย

| ไฟล์ | ตำแหน่ง | ขนาด |
|---|---|---|
| `telegram-notify.php` | `/volume1/web/api/` | 11,777 bytes |
| `telegram-token.php` | `/volume1/nas-secrets/` | 62 Bytes |
| `telegram-chat.php` | `/volume1/nas-secrets/` | 27 Bytes |
| `api-key.php` | `/volume1/nas-secrets/` | 80 Bytes (ของเดิม) |

สูตร: `<?php` + ขึ้นบรรทัดใหม่ + `return '…';` = โครง 16 ไบต์ + ความยาวค่า
ห้ามมีบรรทัดว่างท้ายไฟล์ (เกิน 1 ไบต์ = มี output หลุดก่อน `header()`)

**ห้ามอัปด้วยสคริปต์** — `upload-to-nas.mjs` ตัดไบต์สุดท้ายของทุกไฟล์ทิ้ง
ใช้ปุ่มอัปโหลดของ File Station เท่านั้น

## ลำดับด่านในไฟล์ (สำคัญต่อการอ่านผล)

```
71  OPTIONS  -> exit ทันที (ตอบ 200 เสมอ ไม่ว่า origin จะผ่านหรือไม่)
72  method   -> reply(405) ถ้าไม่ใช่ POST
73  origin   -> reply(403) เฉพาะเมื่อ $origin !== '' && !$originOk
78  auth     -> reply(401) ถ้าคีย์ไม่ตรง
84  json     -> reply(400) bad_json
87  text     -> reply(400) empty_text
108 rate     -> reply(429) เกิน 30/นาที
112 secrets  -> อ่าน telegram-token.php / telegram-chat.php ตรงนี้
114          -> reply(500) server_misconfigured ถ้าค่าว่าง
145 telegram -> reply(502) telegram_failed (+ reason ถ้าตรง allowlist)
148 สำเร็จ    -> reply(200) ok:true
```

ข้อสรุปที่ได้จากลำดับนี้:

- **auth (78) อยู่ก่อนการอ่าน secrets ของ telegram (112)** ดังนั้นคนที่คีย์ผิด
  จะไม่มีวันเห็น `server_misconfigured` จากไฟล์ telegram — ถ้าเห็น แปลว่า
  `api-key.php` เองอ่านไม่ได้
- **preflight (71) อยู่ก่อนด่าน origin (73)** ดังนั้น `bad_origin` เป็นสิ่งที่
  **curl เท่านั้นที่เห็นได้** เบราว์เซอร์จะโดนบล็อกที่ preflight เพราะไม่มี
  ACAO กลับมา แล้วได้ `TypeError` แทน
- **origin ว่างปล่อยผ่าน** (`$origin !== '' &&`) ดังนั้น curl ที่ไม่ใส่ Origin
  จะไม่มีวันได้ `bad_origin` — เจตนาถูก เพราะ CORS กันได้แค่เบราว์เซอร์
  ด่านที่กันจริงคือคีย์ที่บรรทัด 78

## กฎเหล็ก: ทุก response ต้องเป็น HTTP 200

`reply()` บังคับ `http_response_code(200)` เสมอ แล้วใส่โค้ดจริงไว้ใน body
เป็นฟิลด์ `status` — เพราะ Nginx ของ Synology จะแทน response ที่ไม่ใช่ 200
ด้วยหน้า error ของตัวเอง แล้ว CORS header หายทั้งหมด

**เจอ `res.status !== 200` เมื่อไหร่ = หยุดทั้งหมด** ไม่ต้องรันชุดถัดไป

## ชุดทดสอบ (เรียงเบาไปหนัก)

ก่อนเริ่ม: ดึงคีย์จาก `index-*.js` เท่านั้น ด้วยแพตเทิร์น `=\s*"([0-9a-f]{64})"`
**ต้องเจอพอดี 1 ค่า ไม่งั้นหยุด** — `exceljs.min` มีสตริง 64-hex อยู่ 358 ตัว
ถ้ากวาดผิดไฟล์จะได้คีย์มั่ว แล้วผลจะออกมาเป็น `unauthorized` ซึ่งหน้าตา
เหมือน "คีย์บน NAS ไม่ตรง" เป๊ะ

| ชุด | ยิงอะไร | คาดว่าได้ |
|---|---|---|
| 0 | อ่าน `location.origin` เทียบ allowlist | ตรงพอดี ไม่งั้นอย่ายิงต่อ |
| 1 | POST `{}` + คีย์ถูก | `empty_text` / 400 |
| 2 | POST + คีย์ปลอม 64 hex | `unauthorized` / 401 |
| 3 | GET + คีย์ถูก | `method_not_allowed` / 405 |
| 4 | POST + text จริง + คีย์ถูก | `ok:true` / 200 + ข้อความเข้ากลุ่ม |

ชุด 2 ใช้ 64 hex ปลอม (เช่น `'0'.repeat(64)`) ไม่ใช่คำว่า `wrong` เพราะ
`hash_equals` คืน false ทันทีถ้าความยาวไม่เท่ากัน — จะไม่ได้ทดสอบการเทียบไบต์จริง

ชุด 3 ส่งคีย์ที่ถูกไปด้วย แม้ด่าน method จะอยู่ก่อน auth อยู่แล้ว
เพื่อให้การทดสอบไม่ผูกกับลำดับภายในที่อาจแก้วันหลัง

ชุด 4 ยิงครั้งเดียวพอ (ข้อความเข้ากลุ่มจริง)

## เกณฑ์อ่านผล

| อาการ | ไปดูตรงไหน |
|---|---|
| `ok:true` + status 200 | ผ่าน — ต้องมีข้อความเข้ากลุ่มจริงด้วย |
| `empty_text` / 400 | ชุด 1 ผ่านตามคาด (JSON ถึงและ parse ได้) |
| `unauthorized` / 401 | คีย์ไม่ตรง — ดู `api-key.php` |
| `method_not_allowed` / 405 | ชุด 3 ผ่านตามคาด |
| `bad_origin` / 403 | **curl เท่านั้นที่เห็น** — allowlist ไม่ครอบคลุม แก้ที่ไฟล์ PHP อย่างเดียว |
| `bad_json` / 400 | body ไม่ใช่ JSON ที่ถูกต้อง |
| `rate_limited` / 429 | ยิงเกิน 30/นาที รอ 1 นาที |
| `server_misconfigured` ที่ชุด 2 | `api-key.php` อ่านไม่ได้ (ไม่ใช่ไฟล์ telegram) |
| `server_misconfigured` ที่ชุด 4 | `telegram-token.php` / `telegram-chat.php` |
| `telegram_failed` + `reason` | ดูตารางถัดไป |
| `telegram_failed` ไม่มี `reason` | รัน `getMe` / `getChat` |
| `res.status !== 200` | Nginx แทรก — หยุดทั้งหมด |
| `TypeError` ที่ชุด 1 | **เฉพาะเมื่อผ่านชุด 0 แล้ว** จึงแปลว่าไฟล์เป็นตัวเก่า (204) |

บรรทัดสุดท้ายสำคัญ: ถ้ายังไม่ได้เทียบ origin `TypeError` มีได้สองสาเหตุ
(ไฟล์เก่า หรือ origin ไม่อยู่ใน allowlist) — อย่าสรุป

## แยกสาเหตุของ telegram_failed

`reason` ส่งกลับเฉพาะค่าที่ตรงกับ allowlist 6 ตัวในโค้ด (บรรทัด 142)
ไม่ใช่ข้อความดิบจาก Telegram เพราะ token อาจปนอยู่ในนั้น

| `reason` | สาเหตุ | แก้ที่ไหน |
|---|---|---|
| `not enough rights` / `have no rights` | บอทอยู่ในกลุ่มแต่ส่งไม่ได้ | สิทธิ์ใน Telegram — **ห้ามแตะ NAS** |
| `chat not found` / `bot is not a member` / `bot was kicked` | chat id ผิด หรือบอทไม่อยู่ในกลุ่ม | `telegram-chat.php` + เชิญบอทเข้ากลุ่ม |
| ไม่มี `reason` | token ผิด หรือเน็ตขาด | รัน `getMe` |

คำสั่งวินิจฉัย (รันบนเครื่องผู้ใช้ ต้องมี token ในมือ):

```
curl -s "https://api.telegram.org/bot<token>/getMe"
curl -s "https://api.telegram.org/bot<token>/getChat?chat_id=<chat_id>"
```

- `getMe` ได้ 401 → token ผิด
- `getChat` ได้ `chat not found` → chat id ผิด หรือบอทถูกเตะออก
- ทั้งคู่ `ok:true` → ค่าถูกทั้งคู่ ปัญหาอยู่ที่ไฟล์บน NAS

**ข้อควรระวัง:** `getChat` ได้ `ok:true` พิสูจน์แค่ว่าบอท *เห็น* กลุ่ม
ไม่ได้พิสูจน์ว่า *ส่งข้อความได้* — บอทที่ถูกลดสิทธิ์จะได้ `ok:true`
แต่ `sendMessage` ตอบ 403 ให้ดู `reason` ก่อนเสมอ

ไม่ต้องไปไล่หา `error_log` — บน Synology ตำแหน่ง log ขึ้นกับ PHP profile
หาไม่เจอง่าย นี่คือเหตุผลที่เพิ่มฟิลด์ `reason` เข้ามา

## allowlist ของ origin (บรรทัด 46-54)

```
http://localhost:3000
http://localhost:5173
http://192.168.1.82
https://neosiam.dscloud.biz
https://subcontractor-truck-management-syst.vercel.app
https://subcontractor-truck-management-syst-eight.vercel.app
https://subcontractor-truck-management-system-prats-projects-95416bd3.vercel.app
```

บวก localhost/127.0.0.1 ทุกพอร์ต และวง IP ส่วนตัวทุกพอร์ต

**ไม่มีรูปแบบ `*.vercel.app` โดยเจตนา** — โดเมนย่อยพวกนั้นใครสมัครก็ได้
ดังนั้น **preview deployment ของ Vercel จะโดนปฏิเสธเสมอ** ถ้าเจอกรณีนี้
ให้เปลี่ยนไปเปิดโดเมน production **อย่าเพิ่มโดเมน preview ลง allowlist**

เพิ่มโดเมนที่นี่แล้วต้องเพิ่มใน `upload.php` และ `serve.php` ให้ตรงกันเสมอ

## แยกว่าเป็นเรื่อง CORS หรือเรื่อง proxy

curl ไม่บังคับใช้ CORS ส่วนเบราว์เซอร์บังคับ — เทียบสองฝั่งแล้วแยกได้:

| curl ไม่ใส่ Origin | curl ใส่ Origin | fetch จากเบราว์เซอร์ | แปลว่า |
|---|---|---|---|
| ผ่าน | ผ่าน | ผ่าน | ทุกอย่างปกติ |
| ผ่าน | ผ่าน | พัง | ACAO ไม่ถูกส่งกลับ (Nginx กรอง header?) |
| ผ่าน | `bad_origin` | พัง | allowlist ไม่ครอบคลุม origin นั้น |
| พัง | พัง | พัง | เรื่อง proxy/คีย์/secret ไม่เกี่ยว CORS |
| พัง | ผ่าน | — | แทบเป็นไปไม่ได้ — สงสัยว่าพิมพ์คำสั่ง curl ผิด |

## สิ่งที่แผนนี้ยังไม่ครอบคลุม

`fetch()` จาก Console **ไม่ได้ทดสอบ `resolveBaseUrl()`** เพราะเรียก URL ตรง
ไม่เดินผ่านโค้ดของแอป — ทางเดียวที่ทดสอบได้คือให้คนที่ล็อกอินกดปุ่มในระบบ
จนเกิดการแจ้งเตือนจริง (รวมกับ POD upload end-to-end ที่ยังค้าง)

อย่านับว่าครอบคลุมแล้วจนกว่าจะทำข้อนั้น
