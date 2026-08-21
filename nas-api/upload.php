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
    // ⚠️ ต้องแทนที่บรรทัดล่างด้วยโดเมน Vercel จริงของโปรเจกต์นี้ก่อน deploy
    //    ดูได้ที่ Vercel > โปรเจกต์ subcontractor-truck-management-system > Domains
    //    สคริปต์ deploy จะไม่ยอมทำงานตราบใดที่ยังเป็นข้อความตัวยึดนี้
    'https://REPLACE-ME.vercel.app',
);
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
// เครื่องนักพัฒนา: ยอมทุกพอร์ตของ localhost/127.0.0.1
// (vite.config ตั้งไว้ 3000 แต่ถ้าพอร์ตชนจะเลื่อนเป็น 3001 เอง และ 127.0.0.1 นับเป็นคนละ origin)
$isLocalDev = (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:[0-9]+)?\z#i', $origin);
// เครื่องในวงแลนเดียวกัน เช่น เปิดเว็บจากมือถือเพื่อถ่ายรูป POD (http://192.168.x.x:3000)
// ยอมเฉพาะช่วง IP ส่วนตัวเท่านั้น เว็บสาธารณะยังเรียกไม่ได้
$isPrivateLan = (bool) preg_match('#^http://(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)(:[0-9]+)?\z#', $origin);
// ไม่ใช้รูปแบบ *.vercel.app หรือ *.netlify.app อีกต่อไป — โดเมนย่อยพวกนั้นใครสมัครก็ได้
// เว็บของคนอื่นบนโฮสต์เดียวกันจึงเรียก endpoint นี้จากเบราว์เซอร์ของผู้ใช้ที่ถือคีย์อยู่ได้
// (คีย์ถูกฝังในบันเดิล JS ตอน build จึงถือว่าผู้ใช้ทุกคนมีคีย์อยู่ในมือ)
// ต้องระบุโดเมนตรงตัวเท่านั้น · preview ของ Vercel ได้โดเมนสุ่มต่อ branch
// ถ้าจำเป็นต้องทดสอบจาก preview ให้เพิ่มโดเมนนั้นชั่วคราวแล้วถอดออกเมื่อเสร็จ
if (in_array($origin, $ALLOWED_ORIGINS, true) || $isLocalDev || $isPrivateLan) {
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
// ซึ่งผิดกฎ "ต้องตอบ 200 เสมอ" ของ NAS ตัวนี้ · ตอบกลับไปเลยว่าผิด อย่ากลืนเงียบ
if (!is_string($rawPath)) {
    echo json_encode(array('success' => false, 'error' => 'Invalid path'));
    exit;
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

// ถ้าโดนตัดอะไรออก แปลว่า path ที่ส่งมาไม่ปกติ — ตอบกลับไปเลย อย่าเขียนเงียบ ๆ
// (เดิมแค่ตัด ".." ทิ้งแล้วเขียนต่อ ทำให้ไม่มีสัญญาณว่ามีคนยิง exploit เข้ามา
//  และยังสร้างโฟลเดอร์ขยะที่ Task Scheduler จะ rsync ตามไป Synology Drive ด้วย)
// ห้ามใช้ trim($cleanPath, '/') ตรงนี้ — มันตัดสแลชนำหน้าทิ้งก่อนเทียบ
// ทำให้ path=/etc/cron.d/evil.jpg ผ่านได้ทั้งที่เป็น absolute path (พิสูจน์ด้วยเทสต์จริงแล้ว)
if ($subPath !== $cleanPath) {
    echo json_encode(array('success' => false, 'error' => 'Invalid path'));
    exit;
}

// นามสกุลของ "ไฟล์ที่จะเขียนลงดิสก์" ต้องอยู่ในรายการนี้เท่านั้น
// ด่านตรวจชนิดไฟล์ด้านล่างดูแค่ "เนื้อไฟล์" ไม่ได้ดูชื่อไฟล์ปลายทาง
// ไฟล์ polyglot (ขึ้นต้นด้วย GIF89a แต่มีโค้ด PHP ต่อท้าย) จึงผ่าน finfo ได้
// แล้วถูกเขียนเป็น x.php · ตอนนี้ /tmp/nas-uploads ไม่ถูกเสิร์ฟก็จริง แต่ไฟล์ถูก rsync
// ไป Synology Drive ต่อ ถ้าวันไหนมี Web Station ชี้เข้าโฟลเดอร์นั้น = รันโค้ดได้ทันที
if ($subPath !== '') {
    $ALLOWED_EXT = array('webp', 'jpg', 'jpeg', 'png', 'gif', 'pdf');
    $outExt = strtolower(pathinfo($subPath, PATHINFO_EXTENSION));
    if (!in_array($outExt, $ALLOWED_EXT, true)) {
        echo json_encode(array('success' => false, 'error' => 'Extension not allowed', 'ext' => $outExt));
        exit;
    }
}

// ชนิดไฟล์: เชื่อผลตรวจจากเนื้อไฟล์เป็นหลัก
// ของเดิมถ้า finfo ตอบไม่ได้จะไปเชื่อ $file['type'] ซึ่งผู้เรียกกำหนดเองได้ = ด่านนี้ถูกข้ามได้
// ตอนนี้ใช้ได้แค่ 2 ทาง: ผลจาก finfo หรือมาจากนามสกุลไฟล์ที่เรากำหนดรายการเอง
$EXT_MIME = array(
    'webp' => 'image/webp',
    'jpg'  => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png'  => 'image/png',
    'gif'  => 'image/gif',
    'pdf'  => 'application/pdf'
);
// finfo ตอบชื่อพ้องได้หลายแบบ ยุบให้เป็นชื่อหลักก่อนเทียบ
$MIME_ALIAS = array(
    'image/x-png' => 'image/png',
    'image/pjpeg' => 'image/jpeg',
    'image/jpg'   => 'image/jpeg'
);

$detected = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $detected = (string) finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
    if (isset($MIME_ALIAS[$detected])) {
        $detected = $MIME_ALIAS[$detected];
    }
}

// เบาะแสนามสกุล: ใช้ path ปลายทางถ้ามี ไม่งั้นใช้ชื่อไฟล์ที่ผู้เรียกส่งมา
// (โหมด "ไม่ส่ง path" ยังต้องอัปได้ ระบบจะตั้งชื่อ misc/... ให้เองทีหลัง)
$hintExt = '';
if ($subPath !== '') {
    $hintExt = $outExt;
} elseif (isset($file['name']) && is_string($file['name'])) {
    $hintExt = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
}
$extMime = isset($EXT_MIME[$hintExt]) ? $EXT_MIME[$hintExt] : '';

// เทียบ "ผลตรวจจากเนื้อไฟล์" กับ "นามสกุลปลายทาง" โดยดูจากค่าที่ finfo ตรวจได้จริง
// ไม่ใช่ค่าหลังเติมจากนามสกุล ไม่งั้นจะกลายเป็นเทียบตัวเองกับตัวเอง
if ($detected !== '' && $detected !== 'application/octet-stream') {
    if (!in_array($detected, $ALLOWED_TYPES, true)) {
        // เนื้อไฟล์เป็นชนิดที่ไม่รับเลย เช่น text/html หรือ text/x-php ที่ตั้งชื่อเป็น .pdf
        echo json_encode(array('success' => false, 'error' => 'File type not allowed', 'type' => $detected));
        exit;
    }
    // เทียบเฉพาะตอนที่ผู้เรียก "ตั้งชื่อไฟล์ปลายทางเอง" — โหมดไม่ส่ง path ระบบตั้งชื่อตามชนิดจริงอยู่แล้ว
    if ($subPath !== '' && $extMime !== '' && $extMime !== $detected) {
        echo json_encode(array(
            'success' => false,
            'error' => 'Extension does not match file content',
            'ext' => $outExt,
            'type' => $detected
        ));
        exit;
    }
}

// สรุปชนิดไฟล์: ใช้ผลจาก finfo ถ้าใช้ได้ ไม่งั้นค่อยใช้ตารางนามสกุล
// (libmagic รุ่นเก่าตอบ webp เป็น octet-stream — กรณีนั้นยังต้องอัปได้)
$mimeType = in_array($detected, $ALLOWED_TYPES, true) ? $detected : $extMime;

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
