<?php
/**
 * oil-proxy.php — ส่งต่อคำขอราคาน้ำมันจากเว็บไปยัง backend ของระบบ KPI
 *
 * ทำไมต้องมีไฟล์นี้
 * ----------------
 * ราคาดีเซลอยู่ที่ https://neosiam.dscloud.biz:8443/api/oil/* ซึ่งเป็น backend
 * ของ "ระบบ KPI" คนละระบบกัน · backend นั้นมี allowlist ว่าเว็บโดเมนไหนเรียกได้
 * และโดเมนของระบบนี้ไม่อยู่ในรายชื่อ เบราว์เซอร์จึงถูกปฏิเสธ (ตอบ HTTP 500
 * เพราะโค้ดฝั่งนั้นใช้ callback(new Error(...)) ซึ่ง Express แปลงเป็น 500)
 *
 * ทางแก้ที่ตรงที่สุดคือเพิ่มโดเมนเราใน CORS_ORIGIN ของระบบ KPI แต่ต้องแก้ไฟล์
 * .env ที่มีรหัสฐานข้อมูลปนอยู่ และต้อง recreate container (restart เฉย ๆ ไม่พอ
 * เพราะ env_file ถูกอ่านตอนสร้าง container ไม่ใช่ตอนสตาร์ต) ซึ่งทำให้ระบบ KPI
 * ดับชั่วคราว · เจ้าของเลือกไม่แตะระบบนั้น จึงใช้วิธีนี้แทน
 *
 * ทำไมวิธีนี้ได้ผล
 * ---------------
 * allowlist ฝั่ง KPI ตรวจจาก header Origin ซึ่ง "เบราว์เซอร์" เป็นคนใส่มาเอง
 * การเรียกจากเซิร์ฟเวอร์ด้วย curl ไม่มี Origin จึงผ่านด่านนั้นตามปกติ
 * (ยืนยันแล้ว: ยิงไม่ใส่ Origin ได้ 200 · ใส่ Origin ของเราได้ 500)
 *
 * ไม่ได้เป็นการเจาะระบบ — เจ้าของระบบทั้งสองฝั่งเป็นคนเดียวกันและอนุญาตแล้ว
 * ข้อมูลราคาน้ำมันเป็นข้อมูลสาธารณะจาก ปตท. ไม่ใช่ความลับ
 *
 * ถ้าวันหนึ่งเพิ่มโดเมนใน CORS_ORIGIN ของระบบ KPI ได้แล้ว ให้ลบไฟล์นี้ทิ้ง
 * แล้วเปลี่ยน NAS_BASE ใน utils/nasOilApi.ts กลับไปเป็นพอร์ต 8443 ตามเดิม
 */

declare(strict_types=1);

/** backend ของระบบ KPI — ปลายทางเดียวที่ไฟล์นี้ยิงไปได้ */
const UPSTREAM = 'https://neosiam.dscloud.biz:8443';

/**
 * เส้นทางที่อนุญาต — allowlist ไม่ใช่การต่อสตริงจากที่ client ส่งมา
 *
 * ถ้ารับ path อิสระแล้วต่อเข้ากับ UPSTREAM จะกลายเป็นช่อง SSRF ทันที
 * (สั่งให้ NAS ยิงไปที่ไหนก็ได้แทนตัวเอง) — เป็นช่องเดียวกับที่ upload.php
 * เคยมีแล้วถอดออกไปแล้ว · ที่นี่จึงรับได้แค่ค่าที่กำหนดไว้ล่วงหน้าเท่านั้น
 */
const ALLOWED_PATHS = [
    'ptt'     => '/api/oil/ptt',
    'history' => '/api/oil/history',
];

/** แคชสั้น ๆ กันยิงถี่ — ราคาน้ำมันเปลี่ยนวันละครั้ง ไม่ต้องถามทุกครั้งที่เปิดหน้า */
const CACHE_DIR      = '/tmp/oil-proxy-cache';
const CACHE_TTL_SEC  = 900;   // 15 นาที
const UPSTREAM_TIMEOUT = 10;

// ---------------------------------------------------------------- CORS
/*
  ยกรายการมาจาก serve.php / upload.php ทั้งก้อน — ห้ามมีสองมาตรฐาน
  เพิ่มโดเมนที่นี่แล้วต้องเพิ่มในสองไฟล์นั้นด้วยเสมอ
*/
$ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://192.168.1.82',
    'https://neosiam.dscloud.biz',
    // โดเมนจริงที่ผู้ใช้งานเปิด — ตัวหลักตั้งแต่ 22 ก.ย. 2569
    'https://subcontractor.neosiamcrm.com',
    'https://subcontractor-truck-management-syst.vercel.app',
    'https://subcontractor-truck-management-syst-eight.vercel.app',
    'https://subcontractor-truck-management-system-prats-projects-95416bd3.vercel.app',
];

/**
 * ตัดพอร์ตมาตรฐานออกก่อนเทียบ
 *
 * origin ที่มี :443 หรือ :80 ติดมาจะไม่ตรงกับรายการข้างบนทั้งที่เป็นโดเมนเดียวกัน
 * (บทเรียนจาก serve.php — Codex จับได้ว่าเป็น P2)
 */
function normalize_origin(string $url): string {
    if ($url === '') { return ''; }
    $p = @parse_url($url);
    if (!is_array($p) || !isset($p['scheme'], $p['host'])) { return ''; }
    $scheme = strtolower($p['scheme']);
    $host   = strtolower($p['host']);
    $out    = $scheme . '://' . $host;
    if (isset($p['port'])
        && !(($scheme === 'https' && (int) $p['port'] === 443)
          || ($scheme === 'http'  && (int) $p['port'] === 80))) {
        $out .= ':' . (int) $p['port'];
    }
    return $out;
}

$origin    = $_SERVER['HTTP_ORIGIN'] ?? '';
$originKey = normalize_origin($origin);
$isLocal   = (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:[0-9]+)?\z#i', $originKey);
$isLan     = (bool) preg_match('#^http://(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)(:[0-9]+)?\z#', $originKey);
$originOk  = in_array($originKey, $ALLOWED_ORIGINS, true) || $isLocal || $isLan;

// Vary ต้องส่งทุกครั้ง ไม่ใช่เฉพาะตอนผ่าน — คำตอบที่ถูกปฏิเสธก็ขึ้นกับ Origin เหมือนกัน
header('Vary: Origin');
if ($originOk) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Max-Age: 600');

/*
  ทุก response ต้องเป็น HTTP 200 — Nginx ของ Synology จะแทน response ที่ไม่ใช่ 200
  ด้วยหน้า error ของตัวเอง แล้ว CORS header หายหมด เบราว์เซอร์จะเห็นเป็น CORS error
  แทนข้อความจริง (กฎเดียวกับ upload.php / serve.php / telegram-notify.php)
*/
function reply(int $status, array $body): void {
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body + ['status' => $status], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    reply(405, ['ok' => false, 'error' => 'method_not_allowed']);
}
if ($origin !== '' && !$originOk) {
    reply(403, ['ok' => false, 'error' => 'bad_origin']);
}

// ---------------------------------------------------------------- เลือกปลายทาง
$want = isset($_GET['p']) && is_string($_GET['p']) ? $_GET['p'] : '';
if (!isset(ALLOWED_PATHS[$want])) {
    reply(400, ['ok' => false, 'error' => 'unknown_path']);
}
$path = ALLOWED_PATHS[$want];

// ---------------------------------------------------------------- แคช
$cacheFile = CACHE_DIR . '/' . $want . '.json';
if (is_readable($cacheFile) && (time() - (int) filemtime($cacheFile)) < CACHE_TTL_SEC) {
    $cached = file_get_contents($cacheFile);
    if (is_string($cached) && $cached !== '') {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: private, max-age=300');
        echo $cached;
        exit;
    }
}

// ---------------------------------------------------------------- ยิงไป upstream
/*
  ไม่ส่ง header Origin ไปด้วยโดยตั้งใจ — นั่นคือเหตุผลทั้งหมดที่ไฟล์นี้มีอยู่
  ถ้าส่งไป backend ของ KPI จะปฏิเสธเหมือนที่ปฏิเสธเบราว์เซอร์
*/
$ch = curl_init(UPSTREAM . $path);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => UPSTREAM_TIMEOUT,
    CURLOPT_FOLLOWLOCATION => false,   // กันถูกพาไปโดเมนอื่น
]);
$res  = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

if ($res === false || $code >= 400 || $res === '') {
    error_log('oil-proxy: upstream ตอบ ' . $code . ' ' . $err . ' ' . substr((string) $res, 0, 200));

    /*
      ถ้ายิงไม่ได้ ลองใช้แคชเก่าที่หมดอายุแล้วก่อนยอมแพ้

      ราคาน้ำมันงวดเดิมยังใช้ได้จนกว่า ปตท. จะประกาศงวดใหม่ ข้อมูลเก่าไม่กี่ชั่วโมง
      จึงดีกว่าไม่มีข้อมูลเลย — ฝั่งเว็บจะได้ไม่ต้องตกไปใช้ไฟล์ที่ bundle มากับเว็บ
      ซึ่งเก่ากว่ามาก
    */
    if (is_readable($cacheFile)) {
        $stale = file_get_contents($cacheFile);
        if (is_string($stale) && $stale !== '') {
            header('Content-Type: application/json; charset=utf-8');
            header('X-Oil-Proxy-Stale: 1');
            echo $stale;
            exit;
        }
    }
    reply(502, ['ok' => false, 'error' => 'upstream_failed']);
}

// ตรวจว่าเป็น JSON จริงก่อนแคช — กันหน้า error ของ Nginx ถูกเก็บเป็นข้อมูลราคา
$parsed = json_decode($res, true);
if (!is_array($parsed)) {
    error_log('oil-proxy: upstream ตอบไม่ใช่ JSON');
    reply(502, ['ok' => false, 'error' => 'bad_upstream_json']);
}

if (!is_dir(CACHE_DIR)) { @mkdir(CACHE_DIR, 0755, true); }
@file_put_contents($cacheFile, $res, LOCK_EX);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, max-age=300');
echo $res;
