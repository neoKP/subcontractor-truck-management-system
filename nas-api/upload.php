<?php
/**
 * NAS Upload API — รับไฟล์จากแอป React แล้วบันทึกลง Synology NAS
 * วางไฟล์นี้ที่: /web/api/upload.php บน Synology NAS
 */

// ===== CONFIG =====
// คีย์อ่านจากไฟล์ที่วางไว้บน NAS เท่านั้น ไม่ฝังในโค้ดแล้ว (repo นี้เป็น public)
//
// เก็บไว้ "นอก web root" — ถ้าเก็บในโฟลเดอร์เดียวกับไฟล์นี้ จะปลอดภัยแค่ตราบใดที่ PHP
// ยังทำงาน วันไหน PHP handler พังหรือถูกปิด เว็บจะส่งไฟล์นั้นเป็นข้อความธรรมดาทันที
// และคีย์หลุดทั้งใบ · ตัวไฟล์มีบรรทัดเดียว: <?php return 'คีย์';
// ดูวิธีทำที่ api-key.example.php · เปลี่ยนที่เก็บได้ด้วย env NAS_API_KEY_FILE
// สำคัญ: ต้องเช็คว่าเป็น string ก่อน — `include` ของไฟล์ที่ไม่มี `return` จะคืน int 1
// ถ้าแคสต์เป็น string ตรง ๆ คีย์จะกลายเป็น "1" แล้วใครส่ง X-API-Key: 1 ก็ผ่านหมด
$KEY_FILE = getenv('NAS_API_KEY_FILE') ?: '/volume1/nas-secrets/api-key.php';
$rawKey = is_readable($KEY_FILE) ? @include $KEY_FILE : null;
$API_KEY = is_string($rawKey) ? trim($rawKey) : '';
$UPLOAD_DIR = '/tmp/nas-uploads';
$PROJECT_KEY = 'subcontractor-truck-management';
// Build BASE_URL dynamically based on the request scheme and host so that the returned
// public URL matches the access endpoint that actually succeeded (neosiam / tunnel / local)
// URL ที่คืนกลับไปถูกเก็บลงฐานข้อมูลแล้วเอาไป render เป็น <img src> ทีหลัง
// ถ้าปล่อยให้สร้างจาก Host header ตรง ๆ ผู้เรียกปลอม Host เป็นโดเมนตัวเองได้
// แล้วรูปในระบบจะไปโหลดจากเครื่องเขาแทน · จึงรับเฉพาะโฮสต์ที่รู้จัก
$scheme = 'https';
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'http') {
    $scheme = 'http';
} elseif (!isset($_SERVER['HTTP_X_FORWARDED_PROTO'])
    && (!isset($_SERVER['HTTPS']) || $_SERVER['HTTPS'] === 'off')) {
    $scheme = 'http';
}
$rawHost = isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : '';
$hostOnly = preg_replace('/:\d+\z/', '', $rawHost);
$isKnownHost = in_array($hostOnly, array('neosiam.dscloud.biz', 'localhost'), true)
    || (bool) preg_match('#^(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+|127\.0\.0\.1)\z#', $hostOnly);
if (!$isKnownHost) {
    $rawHost = 'neosiam.dscloud.biz';
    $scheme = 'https';
}
$BASE_URL = $scheme . '://' . $rawHost . '/api/serve.php?file=';
$MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
// ถอด application/octet-stream ออกจากรายการ — เดิมมันคือ "ผ่านทุกอย่างที่ระบุชนิดไม่ได้"
// ตอนนี้ถ้า finfo ระบุไม่ได้ ให้ตกไปใช้ตารางนามสกุลไฟล์แทน ไม่ใช่ปล่อยผ่าน
$ALLOWED_TYPES = array('image/webp', 'image/jpeg', 'image/jpg', 'image/png', 'image/x-png', 'image/pjpeg', 'image/gif', 'application/pdf');

// ===== CORS =====
// ตอบเฉพาะโดเมนที่รู้จัก · CORS กันได้แค่เบราว์เซอร์ ไม่กัน curl หรือสคริปต์
// ด่านที่กันได้จริงคือ API key ด้านล่าง — ตอน deploy ขึ้นโดเมนจริงต้องเพิ่มโดเมนนั้นที่นี่
$ALLOWED_ORIGINS = array(
    'http://localhost:3000',
    'http://192.168.1.82',
    'https://neosiam.dscloud.biz',
    // ⚠️ ก่อน deploy ขึ้นใช้งานจริง ต้องเพิ่มโดเมนของหน้าเว็บที่นี่ด้วย
    // (เช่น 'https://ชื่อไซต์.netlify.app') ไม่งั้นการอัปโหลดรูป POD จากเครื่องผู้ใช้จะถูกบล็อก
    // ต้องเพิ่มให้ครบทั้ง upload.php · serve.php · diag.php
);
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
// เว็บจริงโฮสต์บน Netlify (ดู netlify.toml) แต่ยังไม่ได้ระบุชื่อไซต์ไว้ในโปรเจกต์
// จึงยอมรับ *.netlify.app ไว้ก่อน ไม่งั้นการอัปโหลดรูป POD จากเว็บจริงจะพังทันทีที่ deploy
// เมื่อรู้ชื่อโดเมนแน่นอนแล้ว ให้ใส่ในรายการข้างบนแล้วลบเงื่อนไขนี้ทิ้ง
$isNetlify = (bool) preg_match('#^https://[a-z0-9-]+\.netlify\.app\z#i', $origin);
// เครื่องนักพัฒนา: ยอมทุกพอร์ตของ localhost/127.0.0.1
// (vite.config ตั้งไว้ 3000 แต่ถ้าพอร์ตชนจะเลื่อนเป็น 3001 เอง และ 127.0.0.1 นับเป็นคนละ origin)
$isLocalDev = (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:[0-9]+)?\z#i', $origin);
// เครื่องในวงแลนเดียวกัน เช่น เปิดเว็บจากมือถือเพื่อถ่ายรูป POD (http://192.168.x.x:3000)
// ยอมเฉพาะช่วง IP ส่วนตัวเท่านั้น เว็บสาธารณะยังเรียกไม่ได้
$isPrivateLan = (bool) preg_match('#^http://(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)(:[0-9]+)?\z#', $origin);
if (in_array($origin, $ALLOWED_ORIGINS, true) || $isNetlify || $isLocalDev || $isPrivateLan) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
// ต้องส่ง Vary ทุกครั้ง ไม่ใช่เฉพาะตอนอนุญาต ไม่งั้น cache กลางทางอาจจำคำตอบของ origin หนึ่ง
// ไปตอบให้อีก origin หนึ่ง
header('Vary: Origin');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// ===== AUTH =====
if ($API_KEY === '') {
    // ห้ามตั้ง http_response_code ที่ไม่ใช่ 200 — Nginx ของ Synology จะแทน response
    // ด้วยหน้า error ของตัวเอง ทำให้ CORS header หายและเบราว์เซอร์เห็นเป็น CORS error
    // แทนข้อความจริง (ดู nas-api/NAS-UPLOAD-GUIDE.md ข้อ 2)
    echo json_encode(array('success' => false, 'error' => 'Server key not configured (api-key.php)'));
    exit;
}
$apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
if (!hash_equals($API_KEY, $apiKey)) {
    echo json_encode(array('success' => false, 'error' => 'Unauthorized'));
    exit;
}

// ===== VALIDATE =====
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(array('success' => false, 'error' => 'Method not allowed'));
    exit;
}

// ===== โหมด proxy_download ถูกถอดออกแล้ว (2026-08-21) =====
// เดิมโหมดนี้รับ URL อะไรก็ได้จากผู้เรียก แล้วให้ NAS ไปดึงไฟล์จาก URL นั้นมาเก็บ
// โดยปิดการตรวจใบรับรอง SSL ด้วย (verify_peer = false)
// ผลคือใครมีคีย์ก็สั่งให้ NAS ยิงไปที่เครื่องใดก็ได้ในวงแลนแทนตัวเอง (SSRF)
// ตรวจแล้วว่าไม่มีโค้ดฝั่งเว็บเรียกโหมดนี้เลย จึงถอดออกทั้งก้อน ไม่ใช่แค่ปิดไว้
// ถ้าวันหนึ่งต้องใช้จริง ให้ทำเป็น allowlist ของโดเมนต้นทาง และเปิด verify_peer เสมอ

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

// ===== ทำความสะอาด path ก่อน แล้วค่อยใช้ต่อทั้งเรื่องชนิดไฟล์และตอนบันทึก =====
// path มาจากผู้เรียก ถือเป็นข้อมูลที่เชื่อไม่ได้ทั้งหมด
//
// ของเดิมกรองด้วย preg_replace ชุดเดียว ซึ่งอนุญาต "." และ "/" ผ่าน แปลว่า "../" รอดทั้งดุ้น
// ส่งมาเป็น ../../volume1/nas-secrets/api-key.php ก็เขียนทับไฟล์คีย์ของเซิร์ฟเวอร์ได้เลย
// (อัปรูป JPEG จริงทับไป → include คืน 1 → คีย์กลายเป็น "1" → ใครส่ง X-API-Key: 1 ก็ผ่าน)
// จึงต้องตัด segment ".." ทิ้ง แล้วยืนยันด้วย realpath อีกชั้นก่อนเขียนจริง
$rawPath = isset($_POST['path']) ? $_POST['path'] : '';
// path[]=a&path[]=b ทำให้ค่าที่ได้เป็น array แล้วฟังก์ชันข้างล่างจะโยน TypeError → HTTP 500
// ซึ่งผิดกฎ "ต้องตอบ 200 เสมอ" ของ NAS ตัวนี้ จึงตัดทิ้งตั้งแต่ต้น
if (!is_string($rawPath)) {
    $rawPath = '';
}

$cleanPath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $rawPath);
$segments = array();
foreach (explode('/', $cleanPath) as $seg) {
    if ($seg === '' || $seg === '.' || $seg === '..') {
        continue;   // ตัดสแลชนำหน้า จุดเดี่ยว และการถอยขึ้นไดเรกทอรีแม่
    }
    $segments[] = $seg;
}
$subPath = implode('/', $segments);

// ชนิดไฟล์: เชื่อผลตรวจจากเนื้อไฟล์เป็นหลัก
// ของเดิมถ้า finfo ตอบไม่ได้จะไปเชื่อ $file['type'] ซึ่งผู้เรียกกำหนดเองได้ = ด่านนี้ถูกข้ามได้
// ตอนนี้ใช้ได้แค่ 2 ทาง: ผลจาก finfo หรือมาจากนามสกุลไฟล์ที่เรากำหนดรายการเอง
$mimeType = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = (string) finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
}

$EXT_MIME = array(
    'webp' => 'image/webp',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
    'pdf'  => 'application/pdf'
);

if (!in_array($mimeType, $ALLOWED_TYPES, true)) {
    // ใช้นามสกุลจาก path ที่สะอาดแล้ว (หรือชื่อไฟล์) เป็นทางสำรองทางเดียว
    $extSource = $subPath;
    if ($extSource === '') {
        $extSource = isset($file['name']) && is_string($file['name']) ? $file['name'] : '';
    }
    $ext = strtolower(pathinfo($extSource, PATHINFO_EXTENSION));
    if (isset($EXT_MIME[$ext])) {
        $mimeType = $EXT_MIME[$ext];
    }
}

if (!in_array($mimeType, $ALLOWED_TYPES, true)) {
    echo json_encode(array('success' => false, 'error' => 'File type not allowed', 'type' => $mimeType));
    exit;
}

// ===== SAVE FILE =====
if ($subPath === '') {
    $extMap = array(
        'image/webp' => 'webp',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf'
    );
    $ext = isset($extMap[$mimeType]) ? $extMap[$mimeType] : 'bin';
    try {
        $rand = bin2hex(random_bytes(4));
    } catch (Exception $e) {
        // random_bytes โยน exception ได้ถ้าระบบหาแหล่งสุ่มไม่ได้ — ห้ามปล่อยให้กลายเป็น HTTP 500
        echo json_encode(array('success' => false, 'error' => 'Cannot generate file name'));
        exit;
    }
    $subPath = 'misc/' . time() . '_' . $rand . '.' . $ext;
}

$fullPath = $UPLOAD_DIR . '/' . $subPath;
$dir = dirname($fullPath);

if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

// ด่านสุดท้ายก่อนเขียนจริง — ยืนยันว่าโฟลเดอร์ปลายทางอยู่ใต้ $UPLOAD_DIR จริง
// ตัดกรองด้วยข้อความอย่างเดียวไม่พอ เพราะ symlink พาออกนอกได้โดยที่ path ดูปกติ
// (บน Synology /tmp เองก็เป็น symlink ไป /volume1/@tmp — realpath จึงคลี่ให้ตรงกันทั้งสองฝั่ง)
$realBase = realpath($UPLOAD_DIR);
$realDir = realpath($dir);
if ($realBase === false || $realDir === false
    || strpos($realDir . DIRECTORY_SEPARATOR, $realBase . DIRECTORY_SEPARATOR) !== 0) {
    echo json_encode(array('success' => false, 'error' => 'Invalid path'));
    exit;
}

if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
    echo json_encode(array('success' => false, 'error' => 'Failed to save file'));
    exit;
}

chmod($fullPath, 0644);

// ===== RESPONSE =====
$publicUrl = $BASE_URL . '/' . $subPath;
$sha256 = @hash_file('sha256', $fullPath);
$parts = explode('/', $subPath);
$kind = isset($parts[0]) ? $parts[0] : '';
$jobId = ($kind === 'pod-images' && isset($parts[1])) ? $parts[1] : null;
$meta = array(
    'project' => $PROJECT_KEY,
    'kind' => $kind,
    'jobId' => $jobId,
    'originalName' => isset($file['name']) ? $file['name'] : basename($subPath),
    'mime' => $mimeType,
    'size' => filesize($fullPath),
    'sha256' => $sha256 ? $sha256 : '',
    'createdAt' => gmdate('c'),
    'serveUrl' => $publicUrl,
    'source' => 'upload'
);
$metaPath = preg_replace('/\.[^.]+$/', '', $fullPath) . '.json';
@file_put_contents($metaPath, json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

echo json_encode(array(
    'success' => true,
    'url' => $publicUrl,
    'path' => $subPath,
    'size' => $file['size'],
    'type' => $mimeType,
    'sha256' => $sha256 ? $sha256 : ''
));
