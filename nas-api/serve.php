<?php
/**
 * Serve files from NAS — ทำหน้าที่เป็น static file server
 * URL: /api/serve.php?file=pod-images/JOB-001/123_0.webp
 * ค้นหาจาก Synology Drive ก่อน แล้ว fallback ไป /tmp/nas-uploads (รูปเก่า)
 */

// ⚠️ ต้องตรงกับ UPLOAD_DIRS ใน telegram-notify.php เสมอ
//    ถ้าไม่ตรง: หน้าเว็บยังแสดงรูปได้ แต่รูปจะไม่เข้า Telegram (photo_error: not_found)
$UPLOAD_DIRS = array(
    '/volume1/Operation/paweewat/subcontractor-truck-management',
    '/tmp/nas-uploads'
);

// CORS — ตอบเฉพาะโดเมนที่รู้จัก
// หมายเหตุสำคัญ: CORS กันได้แค่เบราว์เซอร์ ไม่กัน curl หรือสคริปต์
// ตอน deploy ขึ้นโดเมนจริง ต้องเพิ่มโดเมนนั้นในรายการนี้ด้วย
// ต้องตรงกับ $ALLOWED_ORIGINS ใน upload.php เสมอ — รูปที่อัปได้แต่แสดงไม่ได้ก็ไม่มีประโยชน์
// ⚠️ `vercel alias ls` แสดงไม่ครบ (ไม่รวมโดเมนที่ Vercel ตั้งให้อัตโนมัติ)
//    ดูคำอธิบายเต็มใน upload.php ก่อนเพิ่ม/ลบโดเมนที่นี่
$ALLOWED_ORIGINS = array(
    'http://localhost:3000',
    'http://localhost:5173',
    'http://192.168.1.82',
    'https://neosiam.dscloud.biz',
    'https://subcontractor-truck-management-syst.vercel.app',
    'https://subcontractor-truck-management-syst-eight.vercel.app',
    'https://subcontractor-truck-management-system-prats-projects-95416bd3.vercel.app',
);

function normalizeOriginForMatch($url) {
    if (!is_string($url) || $url === '') {
        return '';
    }

    $parts = @parse_url($url);
    if (!is_array($parts) || !isset($parts['scheme'], $parts['host'])) {
        return '';
    }

    $scheme = strtolower($parts['scheme']);
    $host = strtolower($parts['host']);
    $origin = $scheme . '://' . $host;

    if (isset($parts['port'])
        && !(($scheme === 'https' && (int) $parts['port'] === 443)
            || ($scheme === 'http' && (int) $parts['port'] === 80))) {
        $origin .= ':' . (int) $parts['port'];
    }

    return $origin;
}

$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$originForMatch = normalizeOriginForMatch($origin);
// เครื่องนักพัฒนา: ยอมทุกพอร์ตของ localhost/127.0.0.1
// (vite.config ตั้งไว้ 3000 แต่ถ้าพอร์ตชนจะเลื่อนเป็น 3001 เอง และ 127.0.0.1 นับเป็นคนละ origin)
$isLocalDev = (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:[0-9]+)?\z#i', $originForMatch);
// เครื่องในวงแลนเดียวกัน เช่น เปิดเว็บจากมือถือเพื่อถ่ายรูป POD (http://192.168.x.x:3000)
// ยอมเฉพาะช่วง IP ส่วนตัวเท่านั้น เว็บสาธารณะยังเรียกไม่ได้
$isPrivateLan = (bool) preg_match('#^http://(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)(:[0-9]+)?\z#', $originForMatch);
// ไม่ใช้รูปแบบ *.vercel.app หรือ *.netlify.app อีกต่อไป — โดเมนย่อยพวกนั้นใครสมัครก็ได้
// เว็บของคนอื่นบนโฮสต์เดียวกันจึงเรียก endpoint นี้จากเบราว์เซอร์ของผู้ใช้ที่ถือคีย์อยู่ได้
// (คีย์ถูกฝังในบันเดิล JS ตอน build จึงถือว่าผู้ใช้ทุกคนมีคีย์อยู่ในมือ)
// ต้องระบุโดเมนตรงตัวเท่านั้น · preview ของ Vercel ได้โดเมนสุ่มต่อ branch
// ถ้าจำเป็นต้องทดสอบจาก preview ให้เพิ่มโดเมนนั้นชั่วคราวแล้วถอดออกเมื่อเสร็จ
/*
  Vary: Origin ต้องส่ง "ทุกครั้ง" ไม่ใช่เฉพาะตอน origin ผ่าน

  คำตอบของ endpoint นี้ต่างกันตาม Origin/Referer ที่ส่งมา ถ้าไม่บอกไว้
  แคชที่ไหนสักแห่งอาจจำคำตอบของ origin หนึ่งไปตอบให้อีก origin หนึ่ง
  ต้องอยู่นอกบล็อก if เพราะกรณีที่ถูกปฏิเสธก็เป็นคำตอบที่ขึ้นกับ Origin เหมือนกัน

  หมายเหตุ: หลังเปลี่ยนเป็น Cache-Control: private แคชกลางไม่เก็บอยู่แล้ว
  ข้อนี้จึงเหลือเป็นความถูกต้องเชิงรูปแบบ ไม่ใช่ช่องโหว่ — แต่ไม่มีเหตุผล
  ที่จะเขียนให้ผิดต่อไป
*/
header('Vary: Origin');
if (in_array($originForMatch, $ALLOWED_ORIGINS, true) || $isLocalDev || $isPrivateLan) {
    header('Access-Control-Allow-Origin: ' . $origin);
}

/*
  ===== ด่านตรวจว่าใครเป็นคนขอรูป =====

  ไฟล์ที่เสิร์ฟจากที่นี่คือรูป POD ซึ่งเป็นหลักฐานการส่งของลูกค้า
  มีชื่อผู้รับ ลายเซ็น และบางใบมีที่อยู่กับเบอร์โทร
  เดิมไม่มีการตรวจอะไรเลย ใครมี URL ก็เปิดดูได้ และส่งต่อให้คนอื่นเปิดได้ด้วย

  ทำไมไม่ตรวจด้วย X-API-Key เหมือน upload.php และ telegram-notify.php:
  รูปถูกแสดงด้วยแท็ก <img src="..."> ในหน้าเว็บ ซึ่ง **เบราว์เซอร์ไม่ยอมให้
  แนบ header เองกับแท็ก img** ถ้าบังคับให้ต้องมีคีย์ รูปทุกใบในระบบจะพังทันที
  และ URL ที่เก็บไว้ในใบงานหลายพันใบก็ใช้ไม่ได้อีกเลย

  จึงตรวจจาก Referer แทน — เบราว์เซอร์ส่งค่านี้เองเมื่อโหลดรูปจากหน้าเว็บ
  แต่จะไม่มีค่านี้เมื่อมีคนเอา URL ไปเปิดตรง ๆ ในแท็บใหม่ หรือส่งต่อทางแชต

  ⚠️ ข้อจำกัดที่ต้องรู้: Referer ปลอมได้ด้วย curl บรรทัดเดียว
  ด่านนี้จึงกัน "คนทั่วไปที่ได้ลิงก์ไป" ไม่ได้กัน "ผู้โจมตีที่ตั้งใจ"
  การป้องกันที่แข็งแรงกว่าคือ signed URL ที่หมดอายุได้ แต่ต้องแก้ URL
  ที่เก็บไว้แล้วทั้งหมด จึงแยกเป็นงานต่างหาก

  ที่ด่านนี้กันได้จริง:
    - เปิด URL ตรงจากแท็บใหม่ / วางในแชต / บุ๊กมาร์กแล้วส่งต่อ
    - บอทที่ไล่เดา path
    - เว็บอื่นที่ฝังรูปแบบปกติ (ส่ง Referer ของตัวเองมา จึงตกด่านแรก)

  ที่ด่านนี้ **กันไม่ได้** — เขียนไว้ตรง ๆ อย่าเข้าใจผิดว่าปลอดภัยแล้ว:
    - เว็บอื่นที่ใส่ referrerpolicy="no-referrer" บนแท็ก img
      แอตทริบิวต์เดียวก็ผ่านทางสำรอง Sec-Fetch-Site ได้
    - curl หรือสคริปต์ที่ปลอม Referer เป็นโดเมนของเรา

  เรายอมแลกตรงนี้เพื่อให้ผู้ใช้จริงที่เบราว์เซอร์ตัด Referer (LINE in-app,
  ส่วนขยายกันโฆษณา) ยังเห็นรูปได้ · คนที่จะ hotlink ต้องมี URL อยู่ในมือก่อน
  และคนที่มี URL อยู่แล้วจะส่งต่อยังไงก็ได้อยู่ดี แม้แต่แคปหน้าจอ
*/
$referer = isset($_SERVER['HTTP_REFERER']) ? (string) $_SERVER['HTTP_REFERER'] : '';

// ตัดเอาเฉพาะส่วน scheme://host[:port] ออกมาเทียบ ไม่สนใจ path ที่ตามมา
$refOrigin = normalizeOriginForMatch($referer);

$refLocalDev   = (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:[0-9]+)?\z#i', $refOrigin);
$refPrivateLan = (bool) preg_match('#^http://(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)(:[0-9]+)?\z#', $refOrigin);
$refererOk = in_array($refOrigin, $ALLOWED_ORIGINS, true) || $refLocalDev || $refPrivateLan;

// Origin ถูกส่งมาด้วยในบางกรณี (เช่น fetch/XHR) — ยอมรับได้เหมือนกัน
$originOk = in_array($originForMatch, $ALLOWED_ORIGINS, true) || $isLocalDev || $isPrivateLan;

/*
  ด่านสำรอง: กันไม่ให้ "ผู้ใช้จริง" โดนปฏิเสธเพราะ Referer ถูกตัดทิ้ง

  ปัญหาของการดูแค่ Referer/Origin คือมีผู้ใช้จริงที่ไม่ส่งทั้งสองอย่าง:
  เบราว์เซอร์ในแอป LINE/Facebook, ส่วนขยายกันโฆษณาที่ตัด Referer,
  policy ขององค์กรบางแห่ง · คนไทยเปิดลิงก์ใน LINE เป็นปกติ ถ้าไม่กันเคสนี้
  คนขับหรือฝ่ายบัญชีอาจเห็นรูปหายทั้งหน้าโดยไม่รู้สาเหตุ

  Sec-Fetch-Site เป็น header ที่เบราว์เซอร์ใส่มาเอง หน้าเว็บสั่งให้ตัดทิ้งไม่ได้
  (ต่างจาก Referer ที่ Referrer-Policy สั่งได้) ค่าที่สนใจ:
    none        = ผู้ใช้พิมพ์ URL เอง / เปิดจากบุ๊กมาร์ก / วางลิงก์ในแท็บใหม่
    cross-site  = มีหน้าเว็บสั่งโหลด (ทั้งหน้าเราและหน้าคนอื่น)

  หน้าเว็บเราอยู่ vercel.app ส่วนรูปอยู่ dscloud.biz จึงเป็น cross-site
  แต่หน้าเว็บของคนอื่นที่เอารูปไป hotlink ก็ได้ cross-site เหมือนกัน
  **การยอมรับ cross-site เฉย ๆ จึงเท่ากับเปิดให้ hotlink ได้**

  ทางออก: ยอมรับ cross-site เฉพาะตอนที่ "ไม่มี Referer มาเลย" เท่านั้น
  เพราะหน้าเว็บที่ hotlink ตามปกติจะส่ง Referer ของตัวเองมาด้วย (แล้วตกด่านแรก)
  ส่วนเบราว์เซอร์ที่ตัด Referer ทิ้งจะไม่มีค่านี้ — ซึ่งคือเคสที่เราต้องการช่วย

  ยังไม่สมบูรณ์: เว็บที่ตั้ง Referrer-Policy: no-referrer เองก็เข้าข่ายนี้
  แต่แลกกับการที่ผู้ใช้จริงเปิดรูปไม่ได้แล้ว ผมเลือกให้ผู้ใช้ใช้งานได้ก่อน
*/
$secFetchSite = isset($_SERVER['HTTP_SEC_FETCH_SITE'])
    ? strtolower(trim((string) $_SERVER['HTTP_SEC_FETCH_SITE']))
    : '';
$hasReferer = ($referer !== '');
/*
  ทางสำรองนี้ต้องรัดสองอย่างเพิ่ม ไม่งั้นมันกว้างเกินไป:

  (1) $origin ต้องว่าง — ถ้าเบราว์เซอร์บอกมาแล้วว่าผู้ขอคือใคร และไม่ใช่เรา
      (เช่น evil.com เรียก fetch แบบ no-cors + referrerPolicy:'no-referrer'
       ซึ่งได้ Referer ว่างแต่ Origin เป็น evil.com) ก็ไม่มีเหตุผลต้องใจดี
      Origin ที่ถูกต้องยังผ่านทาง $originOk ข้างบนตามเดิม
      และเคส LINE ที่เราต้องการช่วยเป็นแท็ก <img> ซึ่งไม่ส่ง Origin มาอยู่แล้ว
      การรัดตรงนี้จึงไม่กระทบสิ่งที่กำลังแก้

  (2) ถอด same-site ออก — หมายถึงโฮสต์อื่นใต้โดเมนจดทะเบียนเดียวกัน ซึ่งเราไม่มี
      และ dscloud.biz เป็นโดเมน DDNS ที่ Synology แจกลูกค้าทุกคน
      (<ชื่อคนอื่น>.dscloud.biz ก็มี) จะนับเป็น same-site หรือไม่ขึ้นกับ
      Public Suffix List ซึ่งเราไม่ควรต้องไปพึ่ง · ถอดออกแล้วคำถามหายทั้งข้อ
      โดยไม่มีผู้ใช้จริงคนไหนเสียประโยชน์

  ขอบเขตที่ต้องรู้ — Sec-Fetch-* ไม่ได้มีทุกที่:
    - ส่งเฉพาะใน secure context: บน http://192.168.1.82 (มือถือวงแลนถ่าย POD)
      Chrome ไม่ส่ง header นี้เลย เคสแลนจึงพึ่ง Referer ล้วน ๆ ไม่มีตาข่ายสำรอง
      (วันนี้ไม่พังเพราะ origin แลนอยู่ใน allowlist และส่ง Referer มาปกติ)
    - Safari รองรับตั้งแต่ 16.4 (2023) และ LINE บน iOS ใช้ WKWebView
      iPhone ที่เก่ากว่านั้นถ้า Referer หายก็ยัง 403
      ถ้ามีรายงานว่ารูปไม่ขึ้น ให้ถามรุ่น iOS ก่อนเป็นอย่างแรก
      อย่าเพิ่งสรุปว่าแพตช์ไม่ทำงาน
*/
$secFetchOk = !$hasReferer
    && $origin === ''
    && in_array($secFetchSite, array('same-origin', 'cross-site'), true);

if (!$refererOk && !$originOk && !$secFetchOk) {
    // ตอบ 403 พร้อมข้อความสั้น ๆ ไม่บอกว่าไฟล์มีอยู่จริงหรือไม่
    // (ไฟล์นี้ไม่ได้อยู่หลังกฎ "ต้องตอบ 200 เสมอ" เพราะไม่ได้ถูกเรียกด้วย fetch
    //  ที่ต้องอ่าน JSON — เป็นแท็ก img ซึ่งแค่ต้องการให้โหลดไม่สำเร็จ)
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    // ห้ามเก็บคำตอบ "ปฏิเสธ" ไว้ใช้ซ้ำ — คำขอถัดไปอาจมาพร้อม Referer ที่ถูกต้อง
    // แล้วควรได้รูปจริง ไม่ใช่ได้ 403 ที่ค้างอยู่ในแคช
    // (403 ไม่ใช่ status ที่เบราว์เซอร์แคชเองโดยไม่มี header สั่ง ต่างจาก 404/410
    //  ใส่ไว้เพื่อความชัดเจน ไม่ใช่เพราะจำเป็น)
    header('Cache-Control: no-store');
    echo 'Forbidden';
    exit;
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
// endpoint นี้เสิร์ฟไบต์ที่ผู้ใช้อัปมา และอยู่โดเมนเดียวกับ DSM ที่แอดมินล็อกอินอยู่
// nosniff กันเบราว์เซอร์เดาชนิดไฟล์เองแล้วรันเป็น HTML
header('X-Content-Type-Options: nosniff');
header('Content-Length: ' . filesize($realFile));
/*
  private ไม่ใช่ public — ไฟล์พวกนี้เป็นรูป POD ของลูกค้า

  "public" อนุญาตให้แคชที่ใช้ร่วมกัน (proxy ขององค์กร, CDN, แคชของ ISP)
  เก็บสำเนาไว้ได้ ซึ่งขัดกับด่าน Referer/Origin ที่เพิ่งใส่ไป — เราเพิ่งกัน
  ไม่ให้คนนอกขอไฟล์จากเซิร์ฟเวอร์ แล้วปล่อยให้ตัวกลางแจกสำเนาแทนก็ไม่มีประโยชน์

  "private" = เก็บได้เฉพาะในเบราว์เซอร์ของคนที่ขอเท่านั้น
  max-age เท่าเดิม 30 วัน ประสิทธิภาพฝั่งผู้ใช้จึงไม่เปลี่ยน
  (หน้า POD เปิดทีละหลายสิบรูป การแคชในเครื่องยังจำเป็น)
*/
header('Cache-Control: private, max-age=2592000');
// ETag จากเวลาแก้ไข+ขนาด ไม่ใช่ md5 ของทั้งไฟล์ — เดิมต้องอ่านไฟล์ทั้งก้อนซ้ำทุก request
// หน้า POD เปิดทีละหลายสิบรูปพร้อมกัน
header('ETag: "' . filemtime($realFile) . '-' . filesize($realFile) . '"');

readfile($realFile);
