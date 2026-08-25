<?php
// ห้าม deploy ไฟล์นี้ขึ้น NAS — ไม่มีด่านตรวจคีย์ และเปิดโครงสร้างโฟลเดอร์ให้คนนอกอ่าน
// ถ้าจะใช้ ต้องใส่ ALLOWED_ORIGINS จริง + เพิ่มการตรวจ X-API-Key ก่อนเสมอ
//
// ถูกถอดออกจาก $files ใน deploy/deploy-nas-api.ps1 แล้ว (2026-08-25)
// CORS ข้างล่างกันได้แค่เบราว์เซอร์ ไม่ได้กัน curl — จึงไม่ใช่ด่านตรวจสิทธิ์
// ฝั่งเว็บไม่ได้เรียกไฟล์นี้แล้วเช่นกัน (utils/nasUpload.ts เปลี่ยนไป probe upload.php แทน)
//
// Diagnostic v2 — ค้นหา path จริงบน NAS
// ลบไฟล์นี้ทิ้งหลังใช้งาน!
header('Content-Type: application/json; charset=utf-8');
// CORS — ตอบเฉพาะโดเมนที่รู้จัก (กันเบราว์เซอร์เว็บอื่นเรียกแทนผู้ใช้)
$ALLOWED_ORIGINS = array(
    'http://localhost:3000',
    'http://192.168.1.82',
    'https://neosiam.dscloud.biz',
    // ⚠️ ก่อน deploy ต้องเพิ่มโดเมน Vercel จริงของหน้าเว็บที่นี่ ให้ตรงกับ upload.php
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
    header('Vary: Origin');
}

// ค้นหาทุก path ที่เป็นไปได้
$dirs = array(
    '/tmp/nas-uploads',
    '/volume1/@tmp/nas-uploads',
    '/volume1/Operation/paweewat/subcontractor-truck-management',
    '/volume1/Operation/paweewat',
    '/volume1/Operation',
    '/volume1/homes/paweewat',
    '/volume1/home/paweewat',
    '/volume1/web/uploads',
    '/volume1/web',
    '/volume1',
    '/tmp',
    '/volume1/@tmp'
);

$result = array('scan' => array());

foreach ($dirs as $dir) {
    $info = array(
        'path' => $dir,
        'exists' => is_dir($dir),
        'readable' => is_readable($dir)
    );

    if ($info['exists'] && $info['readable']) {
        $items = @scandir($dir);
        if ($items) {
            $children = array_values(array_filter($items, function($i) { return $i !== '.' && $i !== '..'; }));
            $info['children'] = array_slice($children, 0, 20);
        }

        // ถ้ามี pod-images ให้ดูข้างใน
        $podDir = $dir . '/pod-images';
        if (is_dir($podDir) && is_readable($podDir)) {
            $podItems = @scandir($podDir);
            if ($podItems) {
                $folders = array_values(array_filter($podItems, function($i) { return $i !== '.' && $i !== '..'; }));
                $info['pod_images_count'] = count($folders);
                $info['pod_images_sample'] = array_slice($folders, 0, 5);
            }
        }
    }

    $result['scan'][] = $info;
}

// ด่านตรวจชนิดไฟล์ใน upload.php ทั้งหมดแขวนอยู่กับ finfo
// ถ้าส่วนขยายนี้ไม่ได้เปิดบน NAS ระบบจะเหลือแค่ความเชื่อในนามสกุลไฟล์
// (ไฟล์ HTML ที่ตั้งชื่อ .pdf จะผ่าน) — หลัง deploy ต้องเช็คว่าค่านี้เป็น true
$result['finfo'] = function_exists('finfo_open');
$result['php_user'] = exec('whoami');
$result['document_root'] = $_SERVER['DOCUMENT_ROOT'] ?? 'unknown';
$result['script_filename'] = $_SERVER['SCRIPT_FILENAME'] ?? 'unknown';

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
