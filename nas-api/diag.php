<?php
// Diagnostic v2 — ค้นหา path จริงบน NAS
// ลบไฟล์นี้ทิ้งหลังใช้งาน!
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

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

$result['php_user'] = exec('whoami');
$result['document_root'] = $_SERVER['DOCUMENT_ROOT'] ?? 'unknown';
$result['script_filename'] = $_SERVER['SCRIPT_FILENAME'] ?? 'unknown';

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
