<?php
/**
 * NAS Upload API — รับไฟล์จากแอป React แล้วบันทึกลง Synology NAS
 * วางไฟล์นี้ที่: /web/api/upload.php บน Synology NAS
 */

// ===== CONFIG =====
$API_KEY = 'NAS_UPLOAD_KEY_sansan856';
$UPLOAD_DIR = '/tmp/nas-uploads';
$PROJECT_KEY = 'subcontractor-truck-management';
// Build BASE_URL dynamically based on the request scheme and host so that the returned
// public URL matches the access endpoint that actually succeeded (neosiam / tunnel / local)
$scheme = 'http';
if (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && !empty($_SERVER['HTTP_X_FORWARDED_PROTO'])) {
    $scheme = $_SERVER['HTTP_X_FORWARDED_PROTO'];
} elseif (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
    $scheme = 'https';
}
$host = isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : 'localhost';
$BASE_URL = $scheme . '://' . $host . '/api/serve.php?file=';
$MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
$ALLOWED_TYPES = array('image/webp', 'image/jpeg', 'image/jpg', 'image/png', 'image/x-png', 'image/pjpeg', 'image/gif', 'application/pdf', 'application/octet-stream');

// ===== CORS =====
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// ===== AUTH =====
$apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
if ($apiKey !== $API_KEY) {
    echo json_encode(array('success' => false, 'error' => 'Unauthorized'));
    exit;
}

// ===== VALIDATE =====
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(array('success' => false, 'error' => 'Method not allowed'));
    exit;
}

// ===== PROXY DOWNLOAD MODE =====
// ถ้าส่ง FormData มี action=proxy_download → download จาก URL แล้วบันทึกลง NAS
if (isset($_POST['action']) && $_POST['action'] === 'proxy_download' && isset($_POST['sourceUrl']) && isset($_POST['path'])) {
    $sourceUrl = $_POST['sourceUrl'];
    $destPath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $_POST['path']);

    $ctx = stream_context_create(array(
        'http' => array('timeout' => 30, 'follow_location' => true),
        'ssl' => array('verify_peer' => false, 'verify_peer_name' => false)
    ));
    $fileData = @file_get_contents($sourceUrl, false, $ctx);

    if ($fileData === false) {
        echo json_encode(array('success' => false, 'error' => 'Download failed from source URL'));
        exit;
    }

    $dlType = 'application/octet-stream';
    if (isset($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (stripos($h, 'Content-Type:') === 0) {
                $dlType = trim(substr($h, 13));
                break;
            }
        }
    }

    $fullPath = $UPLOAD_DIR . '/' . $destPath;
    $dir = dirname($fullPath);
    if (!is_dir($dir)) mkdir($dir, 0755, true);

    if (file_put_contents($fullPath, $fileData) === false) {
        echo json_encode(array('success' => false, 'error' => 'Failed to save file'));
        exit;
    }

    $sha256 = @hash_file('sha256', $fullPath);
    $parts = explode('/', $destPath);
    $kind = isset($parts[0]) ? $parts[0] : '';
    $jobId = ($kind === 'pod-images' && isset($parts[1])) ? $parts[1] : null;
    $publicUrl = $BASE_URL . '/' . $destPath;

    $meta = array(
        'project' => $PROJECT_KEY,
        'kind' => $kind,
        'jobId' => $jobId,
        'originalName' => basename($destPath),
        'mime' => $dlType,
        'size' => strlen($fileData),
        'sha256' => $sha256 ? $sha256 : '',
        'createdAt' => gmdate('c'),
        'serveUrl' => $publicUrl,
        'source' => 'proxy_download'
    );
    $metaPath = preg_replace('/\.[^.]+$/', '', $fullPath) . '.json';
    @file_put_contents($metaPath, json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

    echo json_encode(array(
        'success' => true,
        'url' => $publicUrl,
        'path' => $destPath,
        'size' => strlen($fileData),
        'type' => $dlType,
        'sha256' => $sha256 ? $sha256 : ''
    ));
    exit;
}

if (!isset($_FILES['file'])) {
    echo json_encode(array('success' => false, 'error' => 'No file uploaded'));
    exit;
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    echo json_encode(array('success' => false, 'error' => 'Upload error', 'code' => $file['error']));
    exit;
}

if ($file['size'] > $MAX_FILE_SIZE) {
    echo json_encode(array('success' => false, 'error' => 'File too large', 'maxSize' => '10MB'));
    exit;
}

$mimeType = '';
if (function_exists('finfo_open')) {
    $finfo = finfo_open(FILEINFO_MIME_TYPE);
    $mimeType = finfo_file($finfo, $file['tmp_name']);
    finfo_close($finfo);
} else {
    $mimeType = $file['type'];
}

$clientType = isset($file['type']) ? $file['type'] : '';
if ((!$mimeType || $mimeType === 'application/octet-stream') && $clientType) {
    $mimeType = $clientType;
}
if (!in_array($mimeType, $ALLOWED_TYPES)) {
    $ext = strtolower(pathinfo($_POST['path'] ?? ($file['name'] ?? ''), PATHINFO_EXTENSION));
    $map = array(
        'webp' => 'image/webp',
        'jpg'  => 'image/jpeg',
        'jpeg' => 'image/jpeg',
        'png'  => 'image/png',
        'gif'  => 'image/gif',
        'pdf'  => 'application/pdf'
    );
    if (isset($map[$ext])) {
        $mimeType = $map[$ext];
    }
}
if (!in_array($mimeType, $ALLOWED_TYPES)) {
    echo json_encode(array('success' => false, 'error' => 'File type not allowed', 'type' => $mimeType, 'clientType' => $clientType));
    exit;
}

// ===== SAVE FILE =====
$subPath = isset($_POST['path']) ? $_POST['path'] : '';
$subPath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $subPath);

if (empty($subPath)) {
    $extMap = array(
        'image/webp' => 'webp',
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/gif' => 'gif',
        'application/pdf' => 'pdf'
    );
    $ext = isset($extMap[$mimeType]) ? $extMap[$mimeType] : 'bin';
    $subPath = 'misc/' . time() . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
}

$fullPath = $UPLOAD_DIR . '/' . $subPath;
$dir = dirname($fullPath);

if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

if (!move_uploaded_file($file['tmp_name'], $fullPath)) {
    echo json_encode(array('success' => false, 'error' => 'Failed to save file'));
    exit;
}

chmod($fullPath, 0644);

// ===== RESPONSE =====
$publicUrl = $BASE_URL . '/' . $subPath;
$sha256 = @hash_file('sha256', $fullPath);
$parts = explode('/', $subPath);
$kind = isset($parts[0]) ? $parts[0] : '';
$jobId = ($kind === 'pod-images' && isset($parts[1])) ? $parts[1] : null;
$meta = array(
    'project' => $PROJECT_KEY,
    'kind' => $kind,
    'jobId' => $jobId,
    'originalName' => isset($file['name']) ? $file['name'] : basename($subPath),
    'mime' => $mimeType,
    'size' => filesize($fullPath),
    'sha256' => $sha256 ? $sha256 : '',
    'createdAt' => gmdate('c'),
    'serveUrl' => $publicUrl,
    'source' => 'upload'
);
$metaPath = preg_replace('/\.[^.]+$/', '', $fullPath) . '.json';
@file_put_contents($metaPath, json_encode($meta, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

echo json_encode(array(
    'success' => true,
    'url' => $publicUrl,
    'path' => $subPath,
    'size' => $file['size'],
    'type' => $mimeType,
    'sha256' => $sha256 ? $sha256 : ''
));
