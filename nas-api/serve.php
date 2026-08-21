<?php
/**
 * Serve files from NAS — ทำหน้าที่เป็น static file server
 * URL: /api/serve.php?file=pod-images/JOB-001/123_0.webp
 * ค้นหาจาก Synology Drive ก่อน แล้ว fallback ไป /tmp/nas-uploads (รูปเก่า)
 */

$UPLOAD_DIRS = array(
    '/volume1/Operation/paweewat/subcontractor-truck-management',
    '/tmp/nas-uploads'
);

// CORS — ตอบเฉพาะโดเมนที่รู้จัก
// หมายเหตุสำคัญ: CORS กันได้แค่เบราว์เซอร์ ไม่กัน curl หรือสคริปต์
// ตอน deploy ขึ้นโดเมนจริง ต้องเพิ่มโดเมนนั้นในรายการนี้ด้วย
$ALLOWED_ORIGINS = array(
    'http://localhost:3000',
    'http://192.168.1.82',
    'https://neosiam.dscloud.biz',
    // ⚠️ ก่อน deploy ขึ้นใช้งานจริง ต้องเพิ่มโดเมนของหน้าเว็บที่นี่ด้วย ให้ตรงกับ upload.php
);
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
// เว็บจริงโฮสต์บน Netlify (ดู netlify.toml) แต่ยังไม่ได้ระบุชื่อไซต์ไว้ในโปรเจกต์
// จึงยอมรับ *.netlify.app ไว้ก่อน ไม่งั้นการอัปโหลดรูป POD จากเว็บจริงจะพังทันทีที่ deploy
// เมื่อรู้ชื่อโดเมนแน่นอนแล้ว ให้ใส่ในรายการข้างบนแล้วลบเงื่อนไขนี้ทิ้ง
$isNetlify = (bool) preg_match('#^https://[a-z0-9-]+\.netlify\.app$#i', $origin);
// เครื่องนักพัฒนา: ยอมทุกพอร์ตของ localhost/127.0.0.1
// (vite.config ตั้งไว้ 3000 แต่ถ้าพอร์ตชนจะเลื่อนเป็น 3001 เอง และ 127.0.0.1 นับเป็นคนละ origin)
$isLocalDev = (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:[0-9]+)?$#i', $origin);
// เครื่องในวงแลนเดียวกัน เช่น เปิดเว็บจากมือถือเพื่อถ่ายรูป POD (http://192.168.x.x:3000)
// ยอมเฉพาะช่วง IP ส่วนตัวเท่านั้น เว็บสาธารณะยังเรียกไม่ได้
$isPrivateLan = (bool) preg_match('#^http://(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)(:[0-9]+)?$#', $origin);
if (in_array($origin, $ALLOWED_ORIGINS, true) || $isNetlify || $isLocalDev || $isPrivateLan) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

$rawFile = isset($_GET['file']) ? $_GET['file'] : '';
if (!is_string($rawFile)) {
    $rawFile = '';   // file[]=a&file[]=b ทำให้ค่าที่ได้เป็น array แล้วฟังก์ชันข้างล่างจะพัง
}
$filePath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $rawFile);

// ตัด segment ".." และสแลชนำหน้าทิ้งก่อน — ตัวกรองอักขระด้านบนยอมให้ "." กับ "/" ผ่าน
// จึงยังส่ง ../ เข้ามาได้ · ด่าน realpath ด้านล่างยังอยู่ อันนี้เป็นชั้นแรก
$segments = array();
foreach (explode('/', $filePath) as $seg) {
    if ($seg === '' || $seg === '.' || $seg === '..') {
        continue;
    }
    $segments[] = $seg;
}
$filePath = implode('/', $segments);

if ($filePath === '') {
    http_response_code(400);
    echo 'Missing file parameter';
    exit;
}

// ค้นหาไฟล์จากหลาย directory (ใหม่ก่อน → เก่า fallback)
$realFile = false;
foreach ($UPLOAD_DIRS as $dir) {
    $candidate = $dir . '/' . $filePath;
    $realBase = realpath($dir);
    $realCandidate = realpath($candidate);
    // ต้องเทียบแบบมีตัวคั่นท้าย ไม่งั้น /tmp/nas-uploads-evil/x.jpg จะผ่าน
    // เพราะขึ้นต้นด้วยข้อความ /tmp/nas-uploads เหมือนกัน
    if ($realBase !== false && $realCandidate !== false
        && strpos($realCandidate . DIRECTORY_SEPARATOR, $realBase . DIRECTORY_SEPARATOR) === 0
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

// MIME type
// เสิร์ฟเฉพาะนามสกุลที่รู้จักเท่านั้น อะไรที่ไม่อยู่ในรายการนี้ให้ 404 ไปเลย
// ไม่ fallback เป็น octet-stream เพราะเท่ากับยอมส่งไฟล์อะไรก็ได้ที่หลุดเข้ามาในโฟลเดอร์
//
// ถอด json ออกด้วย — upload.php เขียนไฟล์ .json คู่กับรูปทุกครั้ง ในนั้นมี originalName
// (ชื่อไฟล์ต้นฉบับ ซึ่งมักมีชื่อลูกค้า/เลขงาน) และ sha256 · ไฟล์นี้ไม่มีการยืนยันตัวตน
// ใครเดา URL ถูกก็อ่านได้หมด และฝั่งเว็บของโปรเจกต์นี้ไม่ได้เรียกใช้เลย (grep แล้วไม่เจอ)
// ถ้าโปรเจกต์อื่นจำเป็นต้องอ่าน ให้เปิดเฉพาะหลังการยืนยันตัวตน อย่าเปิดทั้งโฟลเดอร์
$mimeMap = array(
    'webp' => 'image/webp',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'pdf' => 'application/pdf'
);

$ext = strtolower(pathinfo($realFile, PATHINFO_EXTENSION));
if (!isset($mimeMap[$ext])) {
    http_response_code(404);
    echo 'File not found';
    exit;
}
$mime = $mimeMap[$ext];

// Cache 30 days
header('Content-Type: ' . $mime);
// endpoint นี้ไม่มีคีย์ เสิร์ฟไบต์ที่ผู้ใช้อัปมา และอยู่โดเมนเดียวกับ DSM ที่แอดมินล็อกอินอยู่
// nosniff กันเบราว์เซอร์เดาชนิดไฟล์เองแล้วรันเป็น HTML
header('X-Content-Type-Options: nosniff');
header('Content-Length: ' . filesize($realFile));
header('Cache-Control: public, max-age=2592000');
// ETag จากเวลาแก้ไข+ขนาด ไม่ใช่ md5 ของทั้งไฟล์ — เดิมต้องอ่านไฟล์ทั้งก้อนซ้ำทุก request
// หน้า POD เปิดทีละหลายสิบรูปพร้อมกัน
header('ETag: "' . filemtime($realFile) . '-' . filesize($realFile) . '"');

readfile($realFile);
