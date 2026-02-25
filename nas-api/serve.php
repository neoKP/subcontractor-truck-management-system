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

// CORS
header('Access-Control-Allow-Origin: *');

$filePath = isset($_GET['file']) ? $_GET['file'] : '';
$filePath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $filePath);

if (empty($filePath)) {
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
    if ($realBase !== false && $realCandidate !== false && strpos($realCandidate, $realBase) === 0 && is_file($realCandidate)) {
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
$mimeMap = array(
    'webp' => 'image/webp',
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'pdf' => 'application/pdf',
    'json' => 'application/json'
);

$ext = strtolower(pathinfo($realFile, PATHINFO_EXTENSION));
$mime = isset($mimeMap[$ext]) ? $mimeMap[$ext] : 'application/octet-stream';

// Cache 30 days
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($realFile));
header('Cache-Control: public, max-age=2592000');
header('ETag: "' . md5_file($realFile) . '"');

readfile($realFile);
