# คู่มือ: Synology NAS File Upload Integration

## สำหรับ AI Agent ใช้เป็นแนวทางเชื่อมต่อโปรเจคอื่นกับ Synology NAS

---

## ข้อมูล NAS Server

| รายการ | ค่า |
| --- | --- |
| **NAS Model** | Synology DiskStation (DSM 7) |
| **Domain** | `neosiam.dscloud.biz` |
| **Internal IP** | `192.168.1.82` |
| **Web Server** | Nginx + PHP 8.2 (Web Station) |
| **PHP User** | `http` (process) / `ten` (file owner) |
| **Web Root** | `/web/` |
| **API Path** | `/web/api/` → URL: `https://neosiam.dscloud.biz/api/` |
| **Upload Dir** | `/tmp/nas-uploads/` (writable by PHP) |
| **Synology Drive Dir** | `/volume1/Operation/paweewat/subcontractor-truck-management/` |
| **QuickConnect** | `https://neosiam.sg3.quickconnect.to` |

---

## สถาปัตยกรรม (Architecture)

```text
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

2. **Port Forwarding** บน Router — เปิด port 80 (HTTP) และ 443 (HTTPS) ไปยัง NAS IP `192.168.1.82`
   - ตั้งค่าที่: Router admin page
   - External port 80 → Internal 192.168.1.82:80
   - External port 443 → Internal 192.168.1.82:443

3. **SSL Certificate** — ให้ HTTPS ทำงาน
   - ตั้งค่าที่: DSM → Control Panel → Security → Certificate
   - ใช้ Let's Encrypt (ฟรี) หรือ Synology self-signed

4. **Web Station** — เปิดใช้งาน + ตั้ง Virtual Host (ถ้าจำเป็น)
   - ติดตั้งผ่าน Package Center → Web Station
   - PHP 8.2 + Nginx

### ⚠️ ปัญหาที่อาจเจอ: Port Forwarding ไม่ทำงาน

ถ้าเข้า `https://neosiam.dscloud.biz/api/upload.php` จากภายนอกไม่ได้:

| ตรวจสอบ | วิธีเช็ค |
| --- | --- |
| DDNS ชี้ไป IP ถูกต้อง | `nslookup neosiam.dscloud.biz` |
| Port เปิดอยู่ | ทดสอบจาก <https://www.yougetsignal.com/tools/open-ports/> |
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

ดูโค้ดเต็มที่ `nas-api/upload.php` — สิ่งที่ต้องแก้สำหรับโปรเจคใหม่ (อัปเดตให้รองรับ Dynamic URL + MIME fallback):

```php
<?php
// ===== CONFIG (แก้สำหรับโปรเจคใหม่เท่านั้น) =====
$API_KEY = 'YOUR_PROJECT_API_KEY_HERE';               // เปลี่ยน API Key ใหม่
$UPLOAD_DIR = '/tmp/nas-uploads';                      // ใช้ path เดิมได้ (แยกด้วย sub-folder)
$MAX_FILE_SIZE = 10 * 1024 * 1024;                     // 10MB
$ALLOWED_TYPES = array('image/webp','image/jpeg','image/jpg','image/png','image/x-png','image/pjpeg','image/gif','application/pdf','application/octet-stream');

// ===== Build BASE_URL ตาม host/scheme ที่ client ใช้เรียก (สำคัญ) =====
$scheme = 'http';
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && !empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
    $scheme = $_SERVER['HTTP_X_FORWARDED_PROTO'];
} elseif (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    $scheme = 'https';
}
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$BASE_URL = $scheme . '://' . $host . '/api/serve.php?file=';

// ===== CORS =====
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

// ===== AUTH =====
$apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
if ($apiKey !== $API_KEY) { echo json_encode(array('success'=>false,'error'=>'Unauthorized')); exit; }

if ($_SERVER['REQUEST_METHOD'] !== 'POST') { echo json_encode(array('success'=>false,'error'=>'Method not allowed')); exit; }
if (!isset($_FILES['file'])) { echo json_encode(array('success'=>false,'error'=>'No file uploaded')); exit; }

$file = $_FILES['file'];
if ($file['error'] !== UPLOAD_ERR_OK) { echo json_encode(array('success'=>false,'error'=>'Upload error','code'=>$file['error'])); exit; }
if ($file['size'] > $MAX_FILE_SIZE) { echo json_encode(array('success'=>false,'error'=>'File too large','maxSize'=>'10MB')); exit; }

// ===== MIME type detection + fallbacks =====
$mimeType = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
}
$clientType = isset($file['type']) ? $file['type'] : '';
if ((!$mimeType || $mimeType === 'application/octet-stream') && $clientType) { $mimeType = $clientType; }
if (!in_array($mimeType, $ALLOWED_TYPES)) {
    $ext = strtolower(pathinfo($_POST['path'] ?? ($file['name'] ?? ''), PATHINFO_EXTENSION));
    $map = array('webp'=>'image/webp','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png','gif'=>'image/gif','pdf'=>'application/pdf');
    if (isset($map[$ext])) { $mimeType = $map[$ext]; }
}
if (!in_array($mimeType, $ALLOWED_TYPES)) { echo json_encode(array('success'=>false,'error'=>'File type not allowed','type'=>$mimeType,'clientType'=>$clientType)); exit; }

// ===== SAVE FILE =====
$subPath = isset($_POST['path']) ? $_POST['path'] : '';
$subPath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $subPath);
if (empty($subPath)) {
    $extMap = array('image/webp'=>'webp','image/jpeg'=>'jpg','image/png'=>'png','image/gif'=>'gif','application/pdf'=>'pdf');
    $ext = isset($extMap[$mimeType]) ? $extMap[$mimeType] : 'bin';
    $subPath = 'misc/' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
}
$fullPath = $UPLOAD_DIR . '/' . $subPath;
$dir = dirname($fullPath);
if (!is_dir($dir)) { mkdir($dir, 0755, true); }
if (!move_uploaded_file($file['tmp_name'], $fullPath)) { echo json_encode(array('success'=>false,'error'=>'Failed to save file')); exit; }
chmod($fullPath, 0644);

// ===== RESPONSE (Dynamic URL) =====
echo json_encode(array('success'=>true,'url'=>$BASE_URL . '/' . $subPath,'path'=>$subPath,'size'=>$file['size'],'type'=>$mimeType));
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

สร้างไฟล์ `utils/nasUpload.ts` ในโปรเจค (ตัวอย่างพร้อม fallback หลาย endpoint และ cache 10 นาที):

```typescript
const NAS_API_KEY = 'YOUR_PROJECT_API_KEY_HERE';

let cachedBase: string | null = null;
const getCandidates = (): string[] => {
  const overrides: string[] = [];
  if (typeof window !== 'undefined') {
    const o = window.localStorage?.getItem('NAS_API_BASE_OVERRIDE');
    const t = window.localStorage?.getItem('NAS_API_TUNNEL');
    if (o) overrides.push(o);
    if (t) overrides.push(t);
  }
  return [
    ...overrides,
    'https://neosiam.dscloud.biz/api',
    'http://192.168.1.82/api',
  ];
};

const probe = async (base: string): Promise<boolean> => {
  try {
    const c = new AbortController();
    const timer = setTimeout(() => c.abort(), 2500);
    const res = await fetch(`${base}/diag.php`, { method: 'GET', cache: 'no-store', signal: c.signal });
    clearTimeout(timer);
    return res.ok;
  } catch { return false; }
};

const resolveBaseUrl = async (): Promise<string> => {
  if (cachedBase) return cachedBase;
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage?.getItem('NAS_API_BASE_CACHE');
      if (raw) {
        const { base, ts } = JSON.parse(raw);
        if (base && ts && Date.now() - Number(ts) < 10 * 60 * 1000) {
          cachedBase = base; return cachedBase;
        }
      }
    } catch {}
  }
  for (const base of getCandidates()) {
    if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')) continue;
    if (await probe(base)) {
      cachedBase = base;
      if (typeof window !== 'undefined') {
        try { window.localStorage?.setItem('NAS_API_BASE_CACHE', JSON.stringify({ base, ts: Date.now() })); } catch {}
      }
      return cachedBase;
    }
  }
  throw new Error('No NAS endpoint reachable');
};

export const uploadToNAS = async (fileOrBlob: File | Blob, path: string): Promise<string> => {
  const formData = new FormData();
  formData.append('file', fileOrBlob, path.split('/').pop() || 'file');
  formData.append('path', path);
  const base = await resolveBaseUrl();
  const response = await fetch(`${base}/upload.php`, { method: 'POST', headers: { 'X-API-Key': NAS_API_KEY }, body: formData });
  const text = await response.text();
  let result: any; try { result = JSON.parse(text); } catch { throw new Error(`NAS upload: invalid JSON response: ${text.substring(0,200)}`); }
  if (!result?.success || !result?.url) { throw new Error(`NAS upload failed: ${result?.error || response.status}`); }
  return result.url as string;
};

// เคลียร์ cache (เวลาต้องสลับ endpoint เอง):
export const clearNASBaseCache = () => { if (typeof window !== 'undefined') window.localStorage?.removeItem('NAS_API_BASE_CACHE'); };
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

```text
DSM → Control Panel → Task Scheduler
→ Create → Scheduled Task → User-defined script
```

| ตั้งค่า | ค่า |
| --- | --- |
| **Task** | `sync-to-drive` |
| **User** | `root` |
| **Schedule** | Daily, Repeat every **5 minutes** |
| **Script** | `sh /volume1/scripts/sync-to-drive.sh` |

> ⚠️ ต้องเลือก **Scheduled Task** ไม่ใช่ **Triggered Task**
> Triggered Task (Boot-up) จะรันแค่ตอนเปิดเครื่องเท่านั้น
> ⚠️ **ห้ามใช้** `rsync -av /tmp/nas-uploads/ /volume1/.../subcontractor-truck-management/` โดยตรง
> เพราะจะลาก folder จากระบบอื่น (migrated-ncr, migrated-returns) มาปนด้วย
> ให้ใช้ `sync-to-drive.sh` ที่ sync เฉพาะ folder ของโปรเจคนี้ (pod-images, payment-slips)

หมายเหตุ: ย้ายไฟล์สคริปต์ไปไว้ที่ Shared Folder `scripts` (ตำแหน่งจริง `/volume1/scripts/`) เพื่อความปลอดภัย ไม่วางไว้ใต้ `/web/api`.

### Step 7: Health Check + Auto‑restart (แนะนำ)

สร้างสคริปต์บน NAS: `/volume1/scripts/healthcheck-nas.sh` (ในโปรเจคนี้มีตัวอย่างแล้ว) แล้วตั้ง Task ตามนี้:

1. Scheduled Task: ตรวจทุก 5 นาที

| ตั้งค่า | ค่า |
| --- | --- |
| Task | `NAS API Health Check` |
| User | `root` |
| Schedule | Every 5 minutes |
| Script | `ENDPOINT="https://neosiam.dscloud.biz/api/diag.php" sh /volume1/scripts/healthcheck-nas.sh` |

สคริปต์จะ curl ไปยัง `diag.php` ถ้าไม่ผ่าน จะพยายาม restart Web Station/Nginx อัตโนมัติ และถ้ากำหนด `CLOUDFLARED_CMD` จะสั่งรัน cloudflared ให้ด้วย

1. Triggered Task (Boot‑up): สตาร์ท Cloudflared อัตโนมัติเมื่อบูต

```sh
nohup /usr/local/bin/cloudflared tunnel run <ชื่อหรือUUIDของtunnel> >/volume1/scripts/cloudflared.log 2>&1 &
```

เพื่อป้องกันรันซ้ำ ให้ Disable งาน “Start Cloudflare Tunnel” ที่เป็นแบบตามเวลา เหลือเฉพาะงาน Boot‑up

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

## AI Agent Contract (Upload / Serve / Metadata)

### Endpoints และ Auth

- Upload: `POST {BASE}/upload.php`
- Headers: `X-API-Key: &lt;คีย์จากไฟล์ api-key.php บน NAS&gt;`
- Body (FormData): `file`, `path`
- Response ตัวอย่างจริง:

```json
{
  "success": true,
  "url": "https://<host>/api/serve.php?file=/pod-images/JOB-TEST/20260225/00.jpg",
  "path": "pod-images/JOB-TEST/20260225/00.jpg",
  "size": 162725,
  "type": "image/jpeg",
  "sha256": "<sha256>"
}
```

### Sidecar Metadata (.json)

- ไฟล์ `.json` ถูกสร้างคู่กับไฟล์หลักในโฟลเดอร์เดียวกัน
- วิธีอ้างอิง: เปลี่ยนส่วนท้ายของ `file=` เป็น `.json`
  - เช่น `...?file=pod-images/JOB-TEST/20260225/00.jpg` → `...?file=pod-images/JOB-TEST/20260225/00.json`
- MIME: `application/json` (serve.php รองรับแล้ว)
- Schema ที่บันทึก (ตัวอย่าง):

```json
{
  "project": "subcontractor-truck-management",
  "kind": "pod-images",
  "jobId": "JOB-TEST",
  "originalName": "151123.jpg",
  "mime": "image/jpeg",
  "size": 162725,
  "sha256": "<sha256>",
  "createdAt": "2026-02-25T06:03:53Z",
  "serveUrl": "https://<host>/api/serve.php?file=pod-images/JOB-TEST/20260225/00.jpg",
  "source": "upload"
}
```

### แนวทางตั้งชื่อไฟล์/โฟลเดอร์ (Naming)

- ใช้อักขระปลอดภัย [A-Za-z0-9._-]
- แยกโปรเจกต์ด้วย project-key (เช่น `subcontractor-truck-management`)
- ตัวอย่างที่แนะนำ:
  - POD: `pod-images/<JOB_ID>/<YYYYMMDD>/<SEQ>.<ext>`
  - Slip: `payment-slips/<YYYYMMDD>/<TIMESTAMP>_<SAFE_NAME>.<ext>`

### สิ่งที่ควรเก็บในฐานข้อมูล

- ควรเก็บ: `url`, `path`, `sha256`, `mime`, `size`, `createdAt`, และถ้ามี `project`, `kind`, `jobId`, `source`
- ตัวอย่าง TypeScript:

```ts
type NasFileRecord = {
  url: string;
  path: string;
  sha256: string;
  mime: string;
  size: number;
  createdAt: string;
  project?: string;
  kind?: string;
  jobId?: string;
  source?: 'upload' | 'proxy_download';
};
```

- วิธี derive metadata URL จาก `url`:

```ts
const metaUrl = url.replace(/\.[^.]+$/, '.json');
// หรือแบบปลอดภัยกับ query
const u = new URL(url);
u.searchParams.set('file', u.searchParams.get('file')!.replace(/\.[^.]+$/, '.json'));
const metaUrlSafe = u.toString();
```

### Fallback / Health

- Client: `utils/nasUpload.ts` probe หลาย endpoint + cache 10 นาที
- Server: `healthcheck-nas.sh` (ทุก 5 นาที) + Boot‑up Cloudflared

### ตัวอย่างการใช้งาน Metadata (.json)

#### TypeScript/React

```ts
// สร้าง metadata URL อย่างปลอดภัยจาก URL หลักที่ได้จาก upload
export const toMetaUrl = (url: string): string => {
  const u = new URL(url);
  const f = u.searchParams.get('file');
  if (f) u.searchParams.set('file', f.replace(/\.[^.]+$/, '.json'));
  return u.toString();
};
```

```tsx
import { useEffect, useState } from 'react';

type NasMeta = {
  project: string; kind: string; jobId?: string;
  originalName?: string; mime: string; size: number;
  sha256: string; createdAt: string; serveUrl: string; source: string;
};

export function PodImage({ url }: { url: string }) {
  const [meta, setMeta] = useState<NasMeta | null>(null);
  useEffect(() => {
    const metaUrl = toMetaUrl(url);
    fetch(metaUrl).then(r => r.json()).then(setMeta).catch(() => setMeta(null));
  }, [url]);
  return (
    <figure>
      <img src={url} alt={meta?.originalName || 'POD'} />
      <figcaption>{meta?.jobId} · {meta?.mime} · {meta?.size} bytes</figcaption>
    </figure>
  );
}
```

#### Node.js (>=18)

```js
import crypto from 'node:crypto';

// สร้าง URL ของ metadata จาก URL หลัก
const toMetaUrl = (url) => {
  const u = new URL(url);
  const f = u.searchParams.get('file');
  if (f) u.searchParams.set('file', f.replace(/\.[^.]+$/, '.json'));
  return u.toString();
};

const metaUrl = toMetaUrl(url);
const meta = await fetch(metaUrl).then(r => r.json());

// ตรวจสอบ SHA256 ของไฟล์จริง
const buf = Buffer.from(await fetch(url).then(r => r.arrayBuffer()));
const hex = crypto.createHash('sha256').update(buf).digest('hex');
if (hex !== meta.sha256) throw new Error('SHA256 mismatch');
```

#### cURL

```sh
curl -s "https://<host>/api/serve.php?file=pod-images/JOB-TEST/20260225/00.json"
```

### แนวทางโครงสร้างฐานข้อมูลและ Indexing

- ควรเก็บฟิลด์: `url`, `path`, `sha256`, `mime`, `size`, `createdAt`, `project`, `kind`, `jobId`, `source`
- แนะนำ Index สำหรับการค้นหาบ่อย:
  - `(project, kind, jobId, createdAt)` สำหรับเรียงลำดับงานต่อ Job
  - `(sha256)` สำหรับค้นหา/ป้องกันไฟล์ซ้ำ
  - `UNIQUE(path)` เพื่อกันบันทึกซ้ำด้วย path เดิม

```sql
-- ตัวอย่างเชิงแนวคิด (ถ้าใช้ SQL)
CREATE TABLE nas_files (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  project TEXT,
  kind TEXT,
  job_id TEXT,
  source TEXT
);
CREATE INDEX idx_nas_files_lookup ON nas_files(project, kind, job_id, created_at);
CREATE INDEX idx_nas_files_sha ON nas_files(sha256);
```

> หมายเหตุ: ใน Firebase Realtime Database สามารถจัดเก็บเป็น object เดียวกันนี้ และทำ key mapping ตาม use-case (เช่น `/byJob/{jobId}/{pushId}`) เพื่อเร่งการดึงข้อมูลตาม job ได้

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
| --- | --- | --- |
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
| --- | --- | --- |
| `nas-api/upload.php` | NAS `/web/api/upload.php` | รับไฟล์จาก client แล้วบันทึก |
| `nas-api/serve.php` | NAS `/web/api/serve.php` | เสิร์ฟไฟล์ให้ browser แสดง |
| `utils/nasUpload.ts` | Client (Vercel) | ส่งไฟล์ไป NAS API |
| `utils/imageCompression.ts` | Client (Vercel) | บีบอัดรูปเป็น WebP ก่อนส่ง |
| `utils/firebaseStorage.ts` | Client (Vercel) | รวม compress + upload (helper) |
