<?php
/**
 * nas-api/telegram-notify.php  →  วางบน NAS (โฟลเดอร์เดียวกับ endpoint อัปโหลดเดิม)
 *
 * ทำหน้าที่: รับคำขอแจ้งเตือนจากเว็บ แล้วยิงไป Telegram แทน
 * ผลลัพธ์: bot token ไม่ต้องอยู่ในเว็บอีกต่อไป -> ไม่ถูกฝังลง bundle
 *
 * ความลับทั้งหมดอ่านจาก /volume1/nas-secrets/ ซึ่งอยู่นอก webroot
 */

declare(strict_types=1);

const SECRETS_DIR   = '/volume1/nas-secrets';
// โฟลเดอร์ที่เก็บรูป POD — ⚠️ ต้องตรงกับ $UPLOAD_DIRS (บรรทัด 8) ใน serve.php เสมอ
// ถ้าไม่ตรง: serve.php ยังแสดงรูปได้ปกติ แต่ Telegram จะได้ photo_error: not_found
// NAS อ่านไฟล์จากดิสก์ตัวเองแล้วอัปขึ้น Telegram โดยตรง ไม่ผ่าน serve.php
// เพราะ serve.php บังคับ Referer ซึ่งเซิร์ฟเวอร์ของ Telegram ไม่ส่งมา
const UPLOAD_DIRS   = ['/volume1/Operation/paweewat/subcontractor-truck-management', '/tmp/nas-uploads'];
/*
  สองค่านี้บังเอิญเท่ากันวันนี้ แต่คนละเรื่องกัน — อย่ารวมเป็นค่าเดียว

  TG_MEDIA_GROUP_MAX คือกฎของ Telegram (sendMediaGroup รับ 2-10 รายการ)
  เราเลือกไม่ได้ ถ้าแก้เป็นค่าอื่นอัลบั้มจะถูกปฏิเสธทั้งก้อน

  MAX_PHOTOS คือเพดานที่ "เรา" ตั้งว่าจะส่งกี่รูปต่อหนึ่งใบงาน ปรับได้ตามต้องการ

  ถ้าใช้ค่าเดียวกันแล้ววันหนึ่งมีคนอยากได้ 15 รูปต่อใบงาน เขาจะแก้ตัวเลขนี้
  เป็น 15 แล้วขนาดก้อนกลายเป็น 15 ด้วย → Telegram ปฏิเสธทุกอัลบั้ม
  โดยที่คนแก้ไม่มีทางเดาสาเหตุได้ เพราะเขาแค่ปรับ "จำนวนรูปสูงสุด"
*/
const TG_MEDIA_GROUP_MAX = 10;            // ลิมิตของ Telegram — ห้ามแก้
// ⚠️ ต้องเท่ากับ TG_ALBUM_LIMIT ใน utils/telegramNotify.ts เสมอ — ดูคำอธิบายที่นั่น
//    ถ้าสองค่านี้ไม่ตรงกัน ข้อความในกลุ่มจะบอกจำนวนรูปไม่ตรงกับที่มีจริง
const MAX_PHOTOS    = 10;                 // เพดานต่อใบงาน — ปรับได้ (ต้องแก้ทั้งสองไฟล์)
const MAX_PHOTO_MB  = 10;
const MAX_TEXT_LEN  = 3500;
const RATE_PER_MIN  = 30;                 // กันสแปม: กี่ข้อความต่อนาที (รวมทุกคน)
const RATE_FILE     = '/tmp/tg-notify-rate.json';
const REQUIRE_FIREBASE_AUTH = false;      // เปิดเป็น true หลังฝั่งเว็บส่ง ID token แล้ว (ดู PHASE 2)

// ---------------------------------------------------------------- helpers
function reply(int $code, array $body) {   // ไม่ return (exit ในตัว) — ไม่ใช้ : never เพื่อให้รองรับ PHP 7.4 บน DSM
    // ห้ามตั้ง status ที่ไม่ใช่ 200 — Nginx ของ Synology จะแทน response ทั้งก้อนด้วย
    // หน้า error ของตัวเอง แล้ว CORS header หายหมด เบราว์เซอร์จะเห็นเป็น CORS error
    // แทนข้อความจริง และ res.json() ฝั่งเว็บจะได้ HTML มาแทน JSON
    // (กฎเดียวกับ upload.php บรรทัด 98-100 · ดู NAS-UPLOAD-GUIDE.md ข้อ 2)
    // ผลลัพธ์จริงอยู่ใน body: ok = สำเร็จไหม, status = โค้ดที่ตั้งใจจะตอบ
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body + ['status' => $code], JSON_UNESCAPED_UNICODE);
    exit;
}

function secret(string $file): string {
    $path = SECRETS_DIR . '/' . $file;
    if (!is_readable($path)) { error_log("telegram-notify: อ่าน $path ไม่ได้"); reply(500, ['ok' => false, 'error' => 'server_misconfigured']); }
    // สำคัญ: ต้องเช็คว่าเป็น string ก่อน — include ของไฟล์ที่ไม่มี return จะคืน int 1
    // ถ้าแคสต์เป็น string ตรง ๆ คีย์จะกลายเป็น "1" แล้วใครส่ง X-API-Key: 1 ก็ผ่านหมด
    // (กฎเดียวกับ upload.php บรรทัด 14-18)
    /** @var mixed $v */ $v = @require $path;
    return is_string($v) ? trim($v) : '';
}

/*
  ดึง "path ในคลังรูป" ออกจากค่าที่ client ส่งมา

  รับได้สองแบบ:
    pod-images/JRS-2026-2533/x.webp                        (path ตรง ๆ)
    https://host/api/serve.php?file=pod-images/…/x.webp     (URL ที่เก็บใน DB)

  แบบที่สองเอาเฉพาะค่า file= ส่วนโฮสต์ทิ้งทั้งหมด — ไม่ว่า URL จะชี้ไปที่ไหน
  เราก็อ่านไฟล์จากดิสก์ของเราเองเสมอ จึงไม่มีทางถูกหลอกให้ไปดึงจากเครื่องอื่น
*/
function extract_media_path(string $raw): string {
    $raw = trim($raw);
    if ($raw === '') { return ''; }

    // เป็น URL ไหม — ถ้าใช่ ดึง query string ออกมาหา file=
    if (stripos($raw, 'http://') === 0 || stripos($raw, 'https://') === 0) {
        $q = @parse_url($raw, PHP_URL_QUERY);
        if (!is_string($q) || $q === '') { return ''; }
        parse_str($q, $params);
        $raw = isset($params['file']) && is_string($params['file']) ? $params['file'] : '';
        if ($raw === '') { return ''; }
    }

    /*
      ทำความสะอาดแบบเดียวกับ serve.php — ตัวกรองอักขระยอมให้ "." กับ "/" ผ่าน
      จึงยังส่ง ../ เข้ามาได้ ต้องตัด segment ".." ทิ้งอีกชั้น

      สแลชนำหน้าต้องตัดทิ้งก่อนเทียบ ไม่ใช่ถือว่าผิดปกติ
      เพราะ URL ที่ระบบสร้างเองมีรูปแบบ ?file=/pod-images/... (มี / นำหน้า)
      มาจาก upload.php บรรทัด 302: $publicUrl = $BASE_URL . '/' . $subPath;
      เดิมโค้ดนี้ปฏิเสธทุก URL ที่ระบบส่งมาเอง ทำให้ไม่มีรูปไหนถูกส่งเข้า Telegram เลย
      ขณะที่ serve.php ตัดสแลชแล้วไปต่อ รูปในหน้าเว็บจึงแสดงได้ปกติ — ต่างกันตรงนี้

      หลังตัดสแลชแล้วยังเทียบ $rel === $clean เหมือนเดิม ".." หรือ "//" ที่ซ่อนอยู่
      จึงยังถูกปฏิเสธ ด่าน realpath ด้านล่างก็ยังอยู่ครบ
    */
    $clean = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $raw);
    $clean = ltrim($clean, '/');
    $segments = [];
    foreach (explode('/', $clean) as $seg) {
        if ($seg === '' || $seg === '.' || $seg === '..') { continue; }
        $segments[] = $seg;
    }
    $rel = implode('/', $segments);
    return ($rel === $clean) ? $rel : '';
}

/*
  หาไฟล์จริงบนดิสก์จาก path — คืนค่าว่างถ้าหาไม่เจอหรืออยู่นอกคลังรูป

  ยืนยันด้วย realpath อีกชั้นก่อนคืนค่า เพราะการกรองด้วยข้อความอย่างเดียวไม่พอ
  symlink พาออกนอกโฟลเดอร์ได้โดยที่ path ดูปกติ (กฎเดียวกับ upload.php)
*/
function resolve_media_file(string $rel): array {
    if ($rel === '') { return ['', 'bad_path']; }

    $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
    /*
      ส่งได้เฉพาะรูป — sendPhoto ส่ง PDF ไม่ได้ และไม่ควรเดาชนิดให้ Telegram
      ระบบนี้มี POD ที่เป็น PDF อยู่จริง (serve.php บรรทัด 258 รองรับ application/pdf)
      จึงต้องแยกเหตุผลนี้ออกมา ไม่ใช่ปล่อยให้หายเงียบเหมือนไฟล์ที่หาไม่เจอ
    */
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp', 'gif'], true)) {
        return ['', 'unsupported_type'];
    }

    /*
      เก็บเหตุผลของ "ไฟล์ที่เจอแต่ใช้ไม่ได้" ไว้รายงาน

      เดิม continue เฉย ๆ ทุกจุด ทำให้สี่สาเหตุออกมาเป็นความเงียบแบบเดียวกัน
      (ไม่มีทั้ง photos_sent และ photo_error) แล้วคนไล่ปัญหาจะไปนั่งเทียบ
      UPLOAD_DIRS ทั้งที่สาเหตุจริงอาจเป็นไฟล์ใหญ่เกินหรืออ่านไม่ได้
    */
    $reason = 'not_found';
    foreach (UPLOAD_DIRS as $dir) {
        $candidate = $dir . '/' . $rel;
        $real = realpath($candidate);
        $base = realpath($dir);
        if ($real === false || $base === false) { continue; }
        if (strpos($real . DIRECTORY_SEPARATOR, $base . DIRECTORY_SEPARATOR) !== 0) { continue; }
        if (!is_file($real)) { continue; }
        if (!is_readable($real)) { $reason = 'unreadable'; continue; }
        if (filesize($real) > MAX_PHOTO_MB * 1024 * 1024) { $reason = 'too_large'; continue; }
        return [$real, ''];
    }
    return ['', $reason];
}

// ---------------------------------------------------------------- CORS
// ยกรายการมาจาก upload.php ทั้งก้อน — ห้ามมีสองมาตรฐาน
// โดเมนเดียวไม่พอ: ระบบจริงเสิร์ฟจากสามโดเมน บวก localhost ตอนพัฒนา
// และวงแลนสำหรับมือถือที่ถ่ายรูป POD · เพิ่มที่นี่แล้วต้องเพิ่มใน upload.php/serve.php ด้วย
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
header('Vary: Origin');
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
// เครื่องนักพัฒนา: ยอมทุกพอร์ตของ localhost/127.0.0.1 (vite เลื่อนพอร์ตเองได้)
$isLocalDev   = (bool) preg_match('#^http://(localhost|127\.0\.0\.1)(:[0-9]+)?\z#i', $origin);
// เครื่องในวงแลนเดียวกัน เช่น มือถือที่เปิด http://192.168.x.x:3000 เพื่อถ่ายรูป POD
$isPrivateLan = (bool) preg_match('#^http://(10\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+|192\.168\.[0-9.]+)(:[0-9]+)?\z#', $origin);
$originOk     = in_array($origin, $ALLOWED_ORIGINS, true) || $isLocalDev || $isPrivateLan;

if ($originOk) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Headers: Content-Type, X-API-Key, X-Firebase-Token');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Max-Age: 600');

// preflight: ต้องตอบ 200 เหมือนกัน — 204 ทำให้ Nginx แทน response แล้ว endpoint เรียกไม่ได้เลย
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { reply(405, ['ok' => false, 'error' => 'method_not_allowed']); }
if ($origin !== '' && !$originOk)                  { reply(403, ['ok' => false, 'error' => 'bad_origin']); }

// ---------------------------------------------------------------- auth ชั้นที่ 1: API key
$sent   = (string) ($_SERVER['HTTP_X_API_KEY'] ?? '');
$expect = secret('api-key.php');
if ($expect === '' || !hash_equals($expect, $sent)) { reply(401, ['ok' => false, 'error' => 'unauthorized']); }

// ---------------------------------------------------------------- input
$raw = file_get_contents('php://input') ?: '';
if (strlen($raw) > 16384) { reply(413, ['ok' => false, 'error' => 'payload_too_large']); }
$in = json_decode($raw, true);
if (!is_array($in)) { reply(400, ['ok' => false, 'error' => 'bad_json']); }

$text = trim((string) ($in['text'] ?? ''));
if ($text === '')                     { reply(400, ['ok' => false, 'error' => 'empty_text']); }
if (mb_strlen($text) > MAX_TEXT_LEN)  { $text = mb_substr($text, 0, MAX_TEXT_LEN) . '…'; }

// client เลือกปลายทางเองไม่ได้ — chat_id ถูกกำหนดตายตัวฝั่งเซิร์ฟเวอร์
$parseMode = ($in['parse_mode'] ?? '') === 'HTML' ? 'HTML' : null;
$silent    = !empty($in['silent']);

/*
  รูปแนบ — client ส่งมาเป็น "path ในคลังรูป" เท่านั้น ไม่ใช่ URL

  เหตุผลที่ไม่รับ URL: ถ้ารับ URL แล้วให้ NAS ไปดึงเอง จะกลายเป็นช่อง SSRF
  (สั่งให้ NAS ยิงไปที่เครื่องใดก็ได้ในวงแลนแทนตัวเอง) ซึ่งเป็นช่องเดียวกับที่
  upload.php เคยมีแล้วถอดออกไปแล้ว · รับเฉพาะ path แล้วประกอบเองฝั่งเซิร์ฟเวอร์
  จึงไม่มีทางให้ชี้ออกนอกคลังรูปได้

  เว็บเก็บ URL เต็ม (…/serve.php?file=pod-images/…) จึงยอมให้ส่ง URL มาได้
  แต่เราดึงเอาเฉพาะค่า file= ออกมาใช้ ส่วนที่เหลือทิ้งทั้งหมด
*/
$photos = [];
$skipReason = '';
$rawPhotos = $in['photos'] ?? [];
if (is_array($rawPhotos)) {
    foreach ($rawPhotos as $rawPhoto) {
        if (!is_string($rawPhoto) || $rawPhoto === '') { continue; }
        $rel = extract_media_path($rawPhoto);
        if ($rel === '') { $skipReason = $skipReason ?: 'bad_path'; continue; }
        [$abs, $why] = resolve_media_file($rel);
        if ($abs !== '') {
            $photos[] = $abs;
        } else {
            // เก็บเหตุผลแรกที่เจอไว้รายงาน — ดีกว่าเงียบแล้วให้คนไปเดาเอง
            $skipReason = $skipReason ?: $why;
            error_log('telegram-notify: ข้ามรูป (' . $why . ') ' . $rel);
        }
        if (count($photos) >= MAX_PHOTOS) { break; }
    }
}

// ---------------------------------------------------------------- auth ชั้นที่ 2 (ทางเลือก): Firebase ID token
if (REQUIRE_FIREBASE_AUTH) {
    $jwt = (string) ($_SERVER['HTTP_X_FIREBASE_TOKEN'] ?? '');
    if (!verify_firebase_id_token($jwt, secret('firebase-project.php'))) {
        reply(401, ['ok' => false, 'error' => 'bad_id_token']);
    }
}

// ---------------------------------------------------------------- rate limit
$now = time();
$win = @json_decode((string) @file_get_contents(RATE_FILE), true);
if (!is_array($win) || ($win['minute'] ?? -1) !== intdiv($now, 60)) {
    $win = ['minute' => intdiv($now, 60), 'count' => 0];
}
if (++$win['count'] > RATE_PER_MIN) { reply(429, ['ok' => false, 'error' => 'rate_limited']); }
@file_put_contents(RATE_FILE, json_encode($win), LOCK_EX);

// ---------------------------------------------------------------- ส่งเข้า Telegram
$token  = secret('telegram-token.php');   // <?php return 'ตัวเลข:ตัวอักษร';
$chatId = secret('telegram-chat.php');    // <?php return '-1001234567890';
if ($token === '' || $chatId === '') { reply(500, ['ok' => false, 'error' => 'server_misconfigured']); }

/**
 * ยิงไป Telegram หนึ่งครั้ง
 *
 * $fields เป็น array ธรรมดา = ส่งเป็น JSON (sendMessage)
 * ถ้ามี CURLFile ปนอยู่ = ส่งเป็น multipart (sendMediaGroup พร้อมไฟล์)
 * คืน [$res, $code, $err] ให้ผู้เรียกตัดสินใจเอง
 */
function tg_call(string $token, string $method, array $fields, bool $multipart, int $timeout = 10): array {
    $ch = curl_init("https://api.telegram.org/bot{$token}/{$method}");
    $opts = [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
    ];
    if ($multipart) {
        // ห้าม json_encode ตรงนี้ — CURLFile ต้องไปกับ multipart เท่านั้น
        $opts[CURLOPT_POSTFIELDS] = $fields;
    } else {
        $opts[CURLOPT_POSTFIELDS] = json_encode($fields, JSON_UNESCAPED_UNICODE);
        $opts[CURLOPT_HTTPHEADER] = ['Content-Type: application/json'];
    }
    curl_setopt_array($ch, $opts);
    $res  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return [$res, $code, $err];
}

$payload = ['chat_id' => $chatId, 'text' => $text, 'disable_notification' => $silent];
if ($parseMode !== null) { $payload['parse_mode'] = $parseMode; }

[$res, $code, $err] = tg_call($token, 'sendMessage', $payload, false);

if ($res === false || $code >= 400) {
    // log ฝั่งเซิร์ฟเวอร์เท่านั้น — ห้ามส่ง $res ดิบ กลับไปให้ client (มี token ปนได้)
    error_log('telegram-notify: telegram ตอบ ' . $code . ' ' . $err . ' ' . substr((string) $res, 0, 200));

    // ส่งเฉพาะ description ที่อยู่ใน allowlist กลับไป — ค่าเหล่านี้เป็นข้อความคงที่ของ Telegram
    // ไม่มีทางมี token ปน แต่แยกสาเหตุได้ว่าเป็น "สิทธิ์ในกลุ่ม" หรือ "ค่าบน NAS ผิด"
    // ถ้าไม่มีบรรทัดนี้ ต้องไปอ่าน error_log ซึ่งบน Synology หาไม่เจอได้ง่าย
    $hint = '';
    $body = json_decode((string) $res, true);
    $desc = is_array($body) ? (string) ($body['description'] ?? '') : '';
    foreach (['not enough rights', 'have no rights', 'chat not found', 'bot was kicked', 'bot is not a member', 'chat_id is empty'] as $known) {
        if ($desc !== '' && stripos($desc, $known) !== false) { $hint = $known; break; }
    }
    reply(502, ['ok' => false, 'error' => 'telegram_failed'] + ($hint !== '' ? ['reason' => $hint] : []));
}

/*
  ส่งรูปเป็นอัลบั้มตามหลังข้อความ

  ทำไมส่งแยกจากข้อความ ไม่ใช่ใส่เป็น caption ของรูปแรก:
    - ข้อความรายละเอียดงานยาวกว่าที่ caption รองรับได้ดี (caption จำกัด 1024 ตัว
      ส่วนข้อความธรรมดารับได้ 4096) และจะถูกย่อจนอ่านไม่ครบ
    - ถ้าส่งรูปพลาด ข้อความแจ้งเตือนยังไปถึงอยู่ดี — สำคัญกว่ารูป

  ความล้มเหลวตรงนี้ไม่ทำให้ทั้งคำขอล้มเหลว เพราะข้อความส่งไปแล้ว
  แค่รายงานกลับไปว่ารูปไม่ครบ ให้คนเปิดดูในระบบแทน
*/
$photoSent = 0;
$photoError = $skipReason;   // ถ้าไม่มีรูปผ่านด่านเลย อย่างน้อยบอกได้ว่าทำไม

/*
  sendMediaGroup รับ 2-10 ใบเท่านั้น — ไม่ใช่ "ไม่เกิน 10"

  เอกสาร Bot API เขียนว่า media "must include 2-10 items" ดังนั้นการยัด
  รูปใบเดียวลง sendMediaGroup จะถูกปฏิเสธทั้งก้อน · ใบงานที่แนบรูปใบเดียว
  น่าจะเป็นเคสที่พบบ่อยที่สุดในระบบ ถ้าปล่อยไว้ผู้ใช้จะเจอ "ส่งรูปไม่ได้"
  ตั้งแต่งานแรก แล้วสรุปว่าฟีเจอร์ทั้งอันพัง ทั้งที่งานที่มี 3 ใบทำงานได้ปกติ

  จึงแยกเป็น sendPhoto เมื่อมีใบเดียว และแบ่งเป็นก้อนละ 10 เมื่อมีมากกว่านั้น
  (ตอนนี้ฝั่งเว็บตัดมาที่ 10 อยู่แล้ว แต่ array_chunk กันไว้เผื่อวันหนึ่ง
   มีคนเรียก endpoint นี้ตรง ๆ หรือเปลี่ยนลิมิตฝั่งเว็บ)
*/
if (count($photos) > 0) {
    $ok = true;
    foreach (array_chunk($photos, TG_MEDIA_GROUP_MAX) as $chunk) {
        $t0 = microtime(true);

        if (count($chunk) === 1) {
            $fields = [
                'chat_id' => $chatId,
                'photo'   => new CURLFile($chunk[0]),
                'disable_notification' => $silent ? 'true' : 'false',
            ];
            $method = 'sendPhoto';
        } else {
            $media = [];
            $files = [];
            foreach ($chunk as $i => $abs) {
                $key = 'photo' . $i;
                $media[] = ['type' => 'photo', 'media' => 'attach://' . $key];
                $files[$key] = new CURLFile($abs);
            }
            $fields = [
                'chat_id' => $chatId,
                'media'   => json_encode($media, JSON_UNESCAPED_UNICODE),
                'disable_notification' => $silent ? 'true' : 'false',
            ] + $files;
            $method = 'sendMediaGroup';
        }

        // อัปไฟล์จริงหลายใบ ใช้เวลานานกว่าส่งข้อความมาก จึงให้เวลามากกว่า
        [$pRes, $pCode, $pErr] = tg_call($token, $method, $fields, true, 60);

        // log เวลาที่ใช้ "ตอนสำเร็จ" ด้วย ไม่ใช่เฉพาะตอนพัง — อีกสองเดือนจะได้รู้
        // จากล็อกว่าปกติใช้กี่วินาที แทนที่จะมารู้ตอนที่มันเริ่มพังแล้ว
        error_log(sprintf(
            'telegram-notify: %s %d ใบ ใช้ %.1f วิ (limit 60) code=%d',
            $method, count($chunk), microtime(true) - $t0, $pCode
        ));

        if ($pRes === false || $pCode >= 400) {
            error_log('telegram-notify: ' . $method . ' ล้มเหลว ' . $pErr . ' ' . substr((string) $pRes, 0, 200));
            $ok = false;
            break;   // ก้อนแรกพังแล้วก้อนถัดไปมักพังด้วยเหตุเดียวกัน อย่ายิงซ้ำให้เปลือง
        }
        $photoSent += count($chunk);
    }
    if (!$ok) { $photoError = 'photo_failed'; }
}

reply(200, ['ok' => true] + ($photoSent > 0 ? ['photos_sent' => $photoSent] : [])
                          + ($photoError !== '' ? ['photo_error' => $photoError] : []));

// ================================================================ PHASE 2
/** ตรวจ Firebase ID token (RS256) กับใบรับรองสาธารณะของ Google */
function verify_firebase_id_token(string $jwt, string $projectId): bool {
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) { return false; }
    [$h64, $p64, $s64] = $parts;
    $b64 = static fn(string $s): string => (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));

    $head = json_decode($b64($h64), true);
    $body = json_decode($b64($p64), true);
    if (!is_array($head) || !is_array($body)) { return false; }
    if (($head['alg'] ?? '') !== 'RS256' || empty($head['kid'])) { return false; }

    $now = time();
    if (($body['aud'] ?? '') !== $projectId) { return false; }
    if (($body['iss'] ?? '') !== "https://securetoken.google.com/$projectId") { return false; }
    if (($body['exp'] ?? 0) < $now || ($body['iat'] ?? 0) > $now + 300) { return false; }
    if (empty($body['sub'])) { return false; }

    $cacheFile = '/tmp/firebase-x509.json';
    $certs = null;
    if (is_readable($cacheFile) && (time() - (int) filemtime($cacheFile)) < 3600) {
        $certs = json_decode((string) file_get_contents($cacheFile), true);
    }
    if (!is_array($certs)) {
        $url  = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
        $json = @file_get_contents($url);
        $certs = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($certs)) { return false; }
        @file_put_contents($cacheFile, json_encode($certs), LOCK_EX);
    }
    if (empty($certs[$head['kid']])) { return false; }

    $pub = openssl_pkey_get_public($certs[$head['kid']]);
    if ($pub === false) { return false; }
    return openssl_verify("$h64.$p64", $b64($s64), $pub, OPENSSL_ALGO_SHA256) === 1;
}
