<?php
// แสดงรายการไฟล์ที่อัปโหลดบน NAS — เครื่องมือของผู้ดูแลระบบเท่านั้น
//
// เดิมเปิดให้ใครเปิด URL นี้ก็เห็นรายการไฟล์ทั้งหมด รวมรูป POD ของงานจริง
// พร้อมลิงก์เปิดดูได้ทันที โดยไม่ต้องยืนยันตัวตนเลย
// ตอนนี้ต้องส่งคีย์เดียวกับ upload.php มาด้วย ทาง header หรือฟอร์ม POST เท่านั้น
// คีย์อ่านจากไฟล์นอก web root ไม่ฝังในโค้ด — ดูคำอธิบายใน upload.php
// ต้องเช็ค is_string ก่อน — `include` ของไฟล์ที่ไม่มี `return` คืน int 1
// ถ้าแคสต์ตรง ๆ คีย์จะกลายเป็น "1" (บั๊กเดียวกับที่เจอใน upload.php)
$KEY_FILE = getenv('NAS_API_KEY_FILE') ?: '/volume1/nas-secrets/api-key.php';
$rawKey = is_readable($KEY_FILE) ? @include $KEY_FILE : null;
$API_KEY = is_string($rawKey) ? trim($rawKey) : '';

// รับคีย์ทาง header หรือ POST เท่านั้น — **ห้ามรับผ่าน ?key=**
// เพราะ query string จะถูกบันทึกลง access log ของ Nginx และหลุดไปกับ Referer
// ถ้าหน้านี้มีลิงก์ออกไปที่อื่น · หน้าเว็บจึงใช้ฟอร์ม POST แทน คนยังเปิดใช้ได้ตามปกติ
$key = '';
if (isset($_SERVER['HTTP_X_API_KEY'])) {
    $key = (string) $_SERVER['HTTP_X_API_KEY'];
} elseif (isset($_POST['key'])) {
    $key = (string) $_POST['key'];
}

if ($API_KEY === '' || !hash_equals($API_KEY, $key)) {
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><html lang="th"><head><meta charset="utf-8">';
    echo '<title>NAS Uploads</title><style>body{font-family:sans-serif;margin:40px}';
    echo 'input,button{font-size:15px;padding:8px}</style></head><body>';
    echo '<h3>ต้องใส่คีย์ก่อนดูรายการไฟล์</h3>';
    if (isset($_POST['key'])) {
        echo '<p style="color:#c00">คีย์ไม่ถูกต้อง</p>';
    }
    echo '<form method="post"><input type="password" name="key" autofocus placeholder="API key">';
    echo ' <button type="submit">เข้าดู</button></form>';
    echo '</body></html>';
    exit;
}

header('Content-Type: text/html; charset=utf-8');

$dir = '/tmp/nas-uploads';

echo '<html><head><title>NAS Uploads</title>';
echo '<style>body{font-family:sans-serif;margin:20px}table{border-collapse:collapse;width:100%}';
echo 'th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}';
echo 'img{max-width:120px;max-height:120px}a{color:#0066cc}</style></head><body>';
echo '<h2>NAS Uploaded Files</h2>';

if (!is_dir($dir)) {
    echo '<p>No uploads yet.</p></body></html>';
    exit;
}

$baseUrl = 'https://neosiam.dscloud.biz/api/serve.php?file=';

function listFilesRecursive($dir, $base, $baseUrl) {
    $files = array();
    $items = @scandir($dir);
    if (!$items) return $files;
    foreach ($items as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = $dir . '/' . $item;
        $rel = $base . '/' . $item;
        if (is_link($path)) {
            continue;   // ไม่เดินตาม symlink — ลิงก์อาจพาออกไปนอกโฟลเดอร์อัปโหลด
        }
        if (is_dir($path)) {
            $files = array_merge($files, listFilesRecursive($path, $rel, $baseUrl));
        } else {
            // ข้ามไฟล์ .json ที่ upload.php เขียนคู่กับรูป — serve.php ไม่เสิร์ฟให้แล้ว
            // (ในนั้นมีชื่อไฟล์ต้นฉบับกับ sha256 และไม่มีการยืนยันตัวตน) ลิงก์จึงจะ 404
            if (strtolower(pathinfo($item, PATHINFO_EXTENSION)) === 'json') {
                continue;
            }
            $size = filesize($path);
            $date = date('Y-m-d H:i:s', filemtime($path));
            // ชื่อไฟล์ที่มี # หรือ & ทำให้ query string เพี้ยน ต้อง encode ทีละส่วน
            // (ไม่ encode สแลชคั่นโฟลเดอร์ เพราะ serve.php ต้องเห็นโครงสร้าง path)
            $url = $baseUrl . implode('/', array_map('rawurlencode', explode('/', ltrim($rel, '/'))));
            $isImage = preg_match('/\.(webp|jpg|jpeg|png|gif)$/i', $item);
            $files[] = array(
                'path' => $rel,
                'size' => round($size / 1024, 1) . ' KB',
                'date' => $date,
                'url' => $url,
                'isImage' => $isImage
            );
        }
    }
    return $files;
}

$files = listFilesRecursive($dir, '', $baseUrl);

echo '<p>Total: <strong>' . count($files) . '</strong> files</p>';
echo '<table><tr><th>Preview</th><th>Path</th><th>Size</th><th>Date</th><th>Link</th></tr>';

foreach ($files as $f) {
    echo '<tr>';
    echo '<td>' . ($f['isImage'] ? '<img src="' . htmlspecialchars($f['url']) . '">' : '-') . '</td>';
    echo '<td>' . htmlspecialchars($f['path']) . '</td>';
    echo '<td>' . $f['size'] . '</td>';
    echo '<td>' . $f['date'] . '</td>';
    echo '<td><a href="' . htmlspecialchars($f['url']) . '" target="_blank">Open</a></td>';
    echo '</tr>';
}

echo '</table></body></html>';
