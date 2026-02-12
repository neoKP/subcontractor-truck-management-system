<?php
/**
 * Serve files from /tmp/nas-uploads/ — ทำหน้าที่เป็น static file server
 * URL: /api/serve.php?file=pod-images/JOB-001/123_0.webp
 */

$UPLOAD_DIR = '/tmp/nas-uploads';

// CORS
header('Access-Control-Allow-Origin: *');

$filePath = isset($_GET['file']) ? $_GET['file'] : '';
$filePath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $filePath);

if (empty($filePath)) {
    http_response_code(400);
    echo 'Missing file parameter';
    exit;
}

$fullPath = $UPLOAD_DIR . '/' . $filePath;

// ป้องกัน path traversal
$realBase = realpath($UPLOAD_DIR);
$realFile = realpath($fullPath);

if ($realFile === false || strpos($realFile, $realBase) !== 0) {
    http_response_code(404);
    echo 'File not found';
    exit;
}

if (!is_file($realFile)) {
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
    'pdf' => 'application/pdf'
);

$ext = strtolower(pathinfo($realFile, PATHINFO_EXTENSION));
$mime = isset($mimeMap[$ext]) ? $mimeMap[$ext] : 'application/octet-stream';

// Cache 30 days
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($realFile));
header('Cache-Control: public, max-age=2592000');
header('ETag: "' . md5_file($realFile) . '"');

readfile($realFile);
