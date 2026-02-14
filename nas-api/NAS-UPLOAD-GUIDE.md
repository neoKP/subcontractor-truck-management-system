# คู่มือ: Synology NAS File Upload Integration

## สำหรับ AI Agent ใช้เป็นแนวทางเชื่อมต่อโปรเจคอื่นกับ Synology NAS

---

## ข้อมูล NAS Server

| รายการ | ค่า |
|---|---|
| **NAS Model** | Synology DiskStation (DSM 7) |
| **Domain** | `neosiam.dscloud.biz` |
| **Internal IP** | `192.168.1.89` |
| **Web Server** | Nginx + PHP 8.2 (Web Station) |
| **PHP User** | `http` (process) / `ten` (file owner) |
| **Web Root** | `/web/` |
| **API Path** | `/web/api/` → URL: `https://neosiam.dscloud.biz/api/` |
| **Upload Dir** | `/tmp/nas-uploads/` (writable by PHP) |
| **Synology Drive Dir** | `/volume1/Operation/paweewat/subcontractor-truck-management/` |
| **QuickConnect** | `https://neosiam.sg3.quickconnect.to` |

---

## สถาปัตยกรรม (Architecture)

```
Client App (Vercel/Browser)
    ↓ POST + API Key + FormData
NAS: upload.php (/web/api/)
    ↓ บันทึกไฟล์
/tmp/nas-uploads/{project}/{path}/{file}
    ↓ rsync ทุก 5 นาที (Task Scheduler, root)
/volume1/Operation/paweewat/subcontractor-truck-management/{project}/{path}/{file}
    ↓
Synology Drive (เห็นไฟล์ผ่าน QuickConnect)

เมื่อต้องการแสดงไฟล์:
Client App → GET serve.php?file={path} → ค้นหาจาก Synology Drive ก่อน → fallback /tmp/nas-uploads
```

---

## 🌐 Network Prerequisites (ต้องตั้งค่าก่อนใช้งาน)

### DDNS + Port Forwarding + SSL

เพื่อให้ Client App (เช่น Vercel) เรียก `https://neosiam.dscloud.biz/api/upload.php` ได้ ต้องมี:

1. **DDNS (Dynamic DNS)** — ให้ NAS มี domain name ที่เข้าถึงได้จากอินเทอร์เน็ต
   - ตั้งค่าที่: DSM → Control Panel → External Access → DDNS
   - ปัจจุบันใช้: `neosiam.dscloud.biz` (Synology DDNS)

2. **Port Forwarding** บน Router — เปิด port 80 (HTTP) และ 443 (HTTPS) ไปยัง NAS IP `192.168.1.89`
   - ตั้งค่าที่: Router admin page
   - External port 80 → Internal 192.168.1.89:80
   - External port 443 → Internal 192.168.1.89:443

3. **SSL Certificate** — ให้ HTTPS ทำงาน
   - ตั้งค่าที่: DSM → Control Panel → Security → Certificate
   - ใช้ Let's Encrypt (ฟรี) หรือ Synology self-signed

4. **Web Station** — เปิดใช้งาน + ตั้ง Virtual Host (ถ้าจำเป็น)
   - ติดตั้งผ่าน Package Center → Web Station
   - PHP 8.2 + Nginx

### ⚠️ ปัญหาที่อาจเจอ: Port Forwarding ไม่ทำงาน

ถ้าเข้า `https://neosiam.dscloud.biz/api/upload.php` จากภายนอกไม่ได้:

| ตรวจสอบ | วิธีเช็ค |
|---|---|
| DDNS ชี้ไป IP ถูกต้อง | `nslookup neosiam.dscloud.biz` |
| Port เปิดอยู่ | ทดสอบจาก https://www.yougetsignal.com/tools/open-ports/ |
| Router forward ถูก port | เช็คใน Router admin → Port Forwarding |
| Firewall บน NAS ไม่บล็อก | DSM → Control Panel → Security → Firewall |
| ISP ไม่บล็อก port 80/443 | ติดต่อ ISP หรือใช้ port อื่น เช่น 5001 |

> **หมายเหตุ:** ในโปรเจคนี้ `neosiam.dscloud.biz` เข้าถึงได้แล้วและใช้งานได้ปกติ
> แต่ถ้าตั้ง NAS ใหม่หรือเปลี่ยน Router อาจต้องตั้งค่า port forwarding ใหม่

---

## ⚠️ ข้อจำกัดสำคัญของ Synology NAS (ต้องรู้ก่อนเริ่ม)

### 1. PHP user (`http`) เขียนไปที่ `/volume1/` ไม่ได้

Synology ใช้ ACL ที่ซับซ้อน — แม้ตั้ง chmod 777 หรือ setfacl ก็ยังเขียนไม่ได้

**วิธีแก้:** อัปโหลดไปที่ `/tmp/nas-uploads/` แล้วใช้ Task Scheduler (root) rsync ไป Synology Drive

### 2. Nginx ดักจับ HTTP status code ที่ไม่ใช่ 200

ถ้า PHP return 401, 500 ฯลฯ → Nginx จะแทนที่ response ด้วย custom error page → **CORS headers หายหมด** → Browser เห็น CORS error

**วิธีแก้:** PHP ต้อง return HTTP 200 เสมอ ใส่ error ใน JSON body แทน:

```php
// ❌ ห้ามทำ — Nginx จะดักจับ
http_response_code(401);
echo json_encode(['error' => 'Unauthorized']);

// ✅ ทำแบบนี้แทน
echo json_encode(['success' => false, 'error' => 'Unauthorized']);
```

### 3. OPTIONS preflight ต้อง return 200 (ไม่ใช่ 204)

```php
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit; // default 200, ไม่ต้องตั้ง status code
}
```

### 4. `/tmp/` บน Synology ยังอยู่หลัง reboot

`/tmp` → symlink ไป `/volume1/@tmp` ซึ่ง persist across reboots (ไม่เหมือน Linux ทั่วไป)

---

## ขั้นตอนการ Setup สำหรับโปรเจคใหม่

### Step 1: สร้าง upload.php

วางที่ `/web/api/upload.php` บน NAS

ดูโค้ดเต็มที่ `nas-api/upload.php` — สิ่งที่ต้องแก้สำหรับโปรเจคใหม่:

```php
<?php
// ===== CONFIG — แก้ตรงนี้สำหรับโปรเจคใหม่ =====
$API_KEY = 'YOUR_PROJECT_API_KEY_HERE';          // เปลี่ยน API Key ใหม่
$UPLOAD_DIR = '/tmp/nas-uploads';                 // ใช้ path เดิมได้ (แยกด้วย sub-folder)
$BASE_URL = 'https://neosiam.dscloud.biz/api/serve.php?file=';
$MAX_FILE_SIZE = 10 * 1024 * 1024;               // 10MB
$ALLOWED_TYPES = array('image/webp', 'image/jpeg', 'image/png', 'image/gif', 'application/pdf');

// ===== CORS — ต้องมีเสมอ =====
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json; charset=utf-8');

// Preflight — ห้ามใส่ http_response_code
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// ===== AUTH =====
$apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
if ($apiKey !== $API_KEY) {
    // ⚠️ ห้ามใช้ http_response_code(401) — Nginx จะดักจับ
    echo json_encode(array('success' => false, 'error' => 'Unauthorized'));
    exit;
}

// ===== VALIDATE =====
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(array('success' => false, 'error' => 'Method not allowed'));
    exit;
}

// ===== RECEIVE FILE =====
if (!isset($_FILES['file'])) {
    echo json_encode(array('success' => false, 'error' => 'No file uploaded'));
    exit;
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(array('success' => false, 'error' => 'Upload error', 'code' => $file['error']));
    exit;
}

if ($file['size'] > $MAX_FILE_SIZE) {
    echo json_encode(array('success' => false, 'error' => 'File too large', 'maxSize' => '10MB'));
    exit;
}

// MIME type check
$mimeType = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
} else {
    $mimeType = $file['type'];
}

if (!in_array($mimeType, $ALLOWED_TYPES)) {
    echo json_encode(array('success' => false, 'error' => 'File type not allowed', 'type' => $mimeType));
    exit;
}

// ===== SAVE FILE =====
$subPath = isset($_POST['path']) ? $_POST['path'] : '';
$subPath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $subPath);

if (empty($subPath)) {
    $extMap = array(
        'image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png',
        'image/gif' => 'gif', 'application/pdf' => 'pdf'
    );
    $ext = isset($extMap[$mimeType]) ? $extMap[$mimeType] : 'bin';
    $subPath = 'misc/' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
}

$fullPath = $UPLOAD_DIR . '/' . $subPath;
$dir = dirname($fullPath);

if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
    echo json_encode(array('success' => false, 'error' => 'Failed to save file'));
    exit;
}

chmod($fullPath, 0644);

// ===== RESPONSE =====
echo json_encode(array(
    'success' => true,
    'url' => $BASE_URL . '/' . $subPath,
    'path' => $subPath,
    'size' => $file['size'],
    'type' => $mimeType
));
```

### Step 2: สร้าง serve.php

วางที่ `/web/api/serve.php` บน NAS

ดูโค้ดเต็มที่ `nas-api/serve.php`:

```php
<?php
// ค้นหาไฟล์จากหลาย directory — Synology Drive ก่อน, fallback /tmp
$UPLOAD_DIRS = array(
    '/volume1/Operation/paweewat/subcontractor-truck-management',
    '/tmp/nas-uploads'
);

header('Access-Control-Allow-Origin: *');

$filePath = isset($_GET['file']) ? $_GET['file'] : '';
$filePath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $filePath);

if (empty($filePath)) {
    http_response_code(400);
    echo 'Missing file parameter';
    exit;
}

// ค้นหาไฟล์ + security check (ป้องกัน path traversal)
$realFile = false;
foreach ($UPLOAD_DIRS as $dir) {
    $candidate = $dir . '/' . $filePath;
    $realBase = realpath($dir);
    $realCandidate = realpath($candidate);
    if ($realBase !== false && $realCandidate !== false
        && strpos($realCandidate, $realBase) === 0
        && is_file($realCandidate)) {
        $realFile = $realCandidate;
        break;
    }
}

if ($realFile === false) {
    http_response_code(404);
    echo 'File not found';
    exit;
}

// MIME type mapping
$ext = strtolower(pathinfo($realFile, PATHINFO_EXTENSION));
$mimeMap = array(
    'webp' => 'image/webp', 'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg',
    'png' => 'image/png', 'gif' => 'image/gif', 'pdf' => 'application/pdf'
);
$mime = isset($mimeMap[$ext]) ? $mimeMap[$ext] : 'application/octet-stream';

// ส่งไฟล์พร้อม cache 30 วัน
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($realFile));
header('Cache-Control: public, max-age=2592000');
header('ETag: "' . md5_file($realFile) . '"');

readfile($realFile);
```

### Step 3: สร้าง Client Upload Utility (TypeScript/JavaScript)

สร้างไฟล์ `utils/nasUpload.ts` ในโปรเจค:

```typescript
const NAS_API_URL = 'https://neosiam.dscloud.biz/api/upload.php';
const NAS_API_KEY = 'YOUR_PROJECT_API_KEY_HERE';

/**
 * Upload a File/Blob to NAS and return the public download URL.
 */
export const uploadToNAS = async (
    fileOrBlob: File | Blob,
    path: string
): Promise<string> => {
    const formData = new FormData();
    formData.append('file', fileOrBlob, path.split('/').pop() || 'file');
    formData.append('path', path);

    const response = await fetch(NAS_API_URL, {
        method: 'POST',
        headers: { 'X-API-Key': NAS_API_KEY },
        body: formData,
    });

    // ⚠️ ห้ามเช็ค response.ok — เพราะ server return 200 เสมอ
    const text = await response.text();

    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error(`NAS upload: invalid JSON response: ${text.substring(0, 200)}`);
    }

    if (!result.success || !result.url) {
        throw new Error(`NAS upload failed: ${result.error || JSON.stringify(result)}`);
    }

    return result.url; // URL สำหรับแสดงรูป เช่น https://neosiam.dscloud.biz/api/serve.php?file=...
};
```

### Step 4: (Optional) Image Compression Utility

สร้างไฟล์ `utils/imageCompression.ts` — บีบอัดรูปฝั่ง client ก่อนส่งขึ้น NAS:

```typescript
export const compressImageFile = async (
    file: File,
    maxWidth = 800,
    quality = 0.6
): Promise<File> => {
    if (!file.type.startsWith('image/')) return file; // non-image: skip

    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
    const w = Math.round(bitmap.width * ratio);
    const h = Math.round(bitmap.height * ratio);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);

    const blob: Blob | null = await new Promise(resolve =>
        canvas.toBlob(resolve, 'image/webp', quality)
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return new File([blob], name, { type: 'image/webp' });
};
```

### Step 5: (Optional) Upload Helper with Compression

สร้างไฟล์ `utils/fileUpload.ts` — รวม compress + upload:

```typescript
import { compressImageFile } from './imageCompression';
import { uploadToNAS } from './nasUpload';

/**
 * Upload single file: compress (if image) → upload → return URL
 */
export const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    const compressed = await compressImageFile(file);
    return uploadToNAS(compressed, path);
};

/**
 * Upload multiple files: compress → upload all → return URL array
 */
export const uploadFilesToStorage = async (files: File[], basePath: string): Promise<string[]> => {
    const promises = files.map((file, index) => {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${basePath}/${timestamp}_${index}_${safeName.replace(/\.[^.]+$/, '')}.webp`;
        return uploadFileToStorage(file, path);
    });
    return Promise.all(promises);
};
```

### Step 6: ตั้ง Synology Task Scheduler (ทำครั้งเดียว — ใช้ได้ทุกโปรเจค)

```
DSM → Control Panel → Task Scheduler
→ Create → Scheduled Task → User-defined script
```

| ตั้งค่า | ค่า |
|---|---|
| **Task** | `sync-to-drive` |
| **User** | `root` |
| **Schedule** | Daily, Repeat every **5 minutes** |
| **Script** | `bash /web/api/sync-to-drive.sh` |

> ⚠️ ต้องเลือก **Scheduled Task** ไม่ใช่ **Triggered Task**
> Triggered Task (Boot-up) จะรันแค่ตอนเปิดเครื่องเท่านั้น

> ⚠️ **ห้ามใช้** `rsync -av /tmp/nas-uploads/ /volume1/.../subcontractor-truck-management/` โดยตรง
> เพราะจะลาก folder จากระบบอื่น (migrated-ncr, migrated-returns) มาปนด้วย
> ให้ใช้ `sync-to-drive.sh` ที่ sync เฉพาะ folder ของโปรเจคนี้ (pod-images, payment-slips)

---

## วิธีใช้ในโปรเจค

### แยก path ตามโปรเจค

```typescript
// โปรเจค A — รูป POD
const url = await uploadToNAS(file, 'project-a/pod-images/JOB-001/photo.webp');

// โปรเจค B — เอกสาร
const url = await uploadToNAS(file, 'project-b/documents/invoice.pdf');

// โปรเจค C — รูป profile
const url = await uploadToNAS(file, 'project-c/avatars/user123.webp');
```

### แสดงรูปใน HTML/React

```html
<!-- HTML -->
<img src="https://neosiam.dscloud.biz/api/serve.php?file=project-a/pod-images/JOB-001/photo.webp" />
```

```tsx
// React
<img src={imageUrl} alt="POD" />
// imageUrl มาจาก uploadToNAS() → "https://neosiam.dscloud.biz/api/serve.php?file=..."
```

---

## Proxy Download Mode (เสริม)

ถ้าต้องการให้ NAS ดาวน์โหลดไฟล์จาก URL ภายนอก (เช่น migrate จาก Firebase):

```typescript
const formData = new FormData();
formData.append('action', 'proxy_download');
formData.append('sourceUrl', 'https://firebasestorage.googleapis.com/...');
formData.append('path', 'project-a/images/old-photo.webp');

const response = await fetch(NAS_API_URL, {
    method: 'POST',
    headers: { 'X-API-Key': NAS_API_KEY },
    body: formData,
});
```

NAS จะดาวน์โหลดจาก sourceUrl แล้วบันทึกลง path ที่กำหนด

---

## Checklist สำหรับโปรเจคใหม่

- [ ] ตรวจสอบ Network: DDNS ทำงาน + Port 80/443 forward ไป NAS
- [ ] ตรวจสอบ Web Station: PHP 8.2 + Nginx ทำงานปกติ
- [ ] ตัดสินใจ sub-folder path เช่น `project-name/images/`
- [ ] สร้าง API Key ใหม่ (หรือใช้ตัวเดิมถ้าเป็นโปรเจคภายใน)
- [ ] Copy `upload.php` + `serve.php` ไปวาง NAS ที่ `/web/api/` (ถ้ายังไม่มี — ปัจจุบันมีอยู่แล้ว)
- [ ] สร้าง client utility (`nasUpload.ts`) ในโปรเจค
- [ ] สร้าง image compression utility (ถ้าต้องการบีบอัดรูป)
- [ ] ทดสอบอัปโหลด — ดู Console ว่า `[NAS Upload] Response status: 200` + `success: true`
- [ ] ทดสอบแสดงรูป — เปิด URL ที่ได้จาก upload ในบราวเซอร์
- [ ] ตรวจว่า rsync task ทำงาน (ไฟล์ปรากฏใน Synology Drive ภายใน 5 นาที)

---

## Troubleshooting

| อาการ | สาเหตุ | วิธีแก้ |
|---|---|---|
| **CORS error** ใน browser | PHP return non-200 status → Nginx ดักจับ | เปลี่ยนทุก `http_response_code()` เป็น `echo json_encode(['success'=>false])` |
| **401 custom error page** จาก Synology | Nginx แทนที่ PHP response | เหมือนข้อบน — ห้ามใช้ `http_response_code()` |
| **Permission denied** เขียนไฟล์ | PHP user `http` ไม่มีสิทธิ์เขียน `/volume1/` | ใช้ `/tmp/nas-uploads/` + rsync task (root) |
| **รูปไม่ขึ้นใน Synology Drive** | rsync ยังไม่รัน | กด Run task มือ หรือรอ 5 นาที |
| **Upload สำเร็จแต่รูปไม่แสดง** | serve.php หา path ไม่เจอ | ตรวจว่า `$UPLOAD_DIRS` ใน serve.php ครอบคลุมทุก directory |
| **response.ok เป็น true แต่ JSON parse error** | Server ส่ง HTML แทน JSON | ตรวจว่า upload.php มี `header('Content-Type: application/json')` |
| **ไฟล์หายหลัง NAS reboot** | ไม่หาย — `/tmp` บน Synology → `/volume1/@tmp` (persist) | ไม่ต้องกังวล |

---

## ไฟล์อ้างอิงในโปรเจคนี้

| ไฟล์ | ตำแหน่ง | หน้าที่ |
|---|---|---|
| `nas-api/upload.php` | NAS `/web/api/upload.php` | รับไฟล์จาก client แล้วบันทึก |
| `nas-api/serve.php` | NAS `/web/api/serve.php` | เสิร์ฟไฟล์ให้ browser แสดง |
| `utils/nasUpload.ts` | Client (Vercel) | ส่งไฟล์ไป NAS API |
| `utils/imageCompression.ts` | Client (Vercel) | บีบอัดรูปเป็น WebP ก่อนส่ง |
| `utils/firebaseStorage.ts` | Client (Vercel) | รวม compress + upload (helper) |
