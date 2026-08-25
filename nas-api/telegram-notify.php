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

// ---------------------------------------------------------------- CORS
// ยกรายการมาจาก upload.php ทั้งก้อน — ห้ามมีสองมาตรฐาน
// โดเมนเดียวไม่พอ: ระบบจริงเสิร์ฟจากสามโดเมน บวก localhost ตอนพัฒนา
// และวงแลนสำหรับมือถือที่ถ่ายรูป POD · เพิ่มที่นี่แล้วต้องเพิ่มใน upload.php/serve.php ด้วย
$ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:5173',
    'http://192.168.1.82',
    'https://neosiam.dscloud.biz',
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

$payload = ['chat_id' => $chatId, 'text' => $text, 'disable_notification' => $silent];
if ($parseMode !== null) { $payload['parse_mode'] = $parseMode; }

$ch = curl_init("https://api.telegram.org/bot{$token}/sendMessage");
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
]);
$res  = curl_exec($ch);
$code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$err  = curl_error($ch);
curl_close($ch);

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

reply(200, ['ok' => true]);

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
