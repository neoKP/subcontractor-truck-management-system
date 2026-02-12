<?php
/**
 * NAS Upload API — รับไฟล์จากแอป React แล้วบันทึกลง Synology NAS
 * วางไฟล์นี้ที่: /web/api/upload.php บน Synology NAS
 */

// ===== CONFIG =====
$API_KEY = 'NAS_UPLOAD_KEY_sansan856';
$UPLOAD_DIR = '/tmp/nas-uploads';
$BASE_URL = 'https://neosiam.dscloud.biz/api/serve.php?file=';
$MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
$ALLOWED_TYPES = array('image/webp', 'image/jpeg', 'image/png', 'image/gif', 'application/pdf');

// ===== CORS =====
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json; charset=utf-8');

// Preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ===== AUTH =====
$apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
if ($apiKey !== $API_KEY) {
    http_response_code(401);
    echo json_encode(array('error' => 'Unauthorized'));
    exit;
}

// ===== VALIDATE =====
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Method not allowed'));
    exit;
}

if (!isset($_FILES['file'])) {
    http_response_code(400);
    echo json_encode(array('error' => 'No file uploaded'));
    exit;
}

$file = $_FILES['file'];

if ($file['error'] !== UPLOAD_ERR_OK) {
    http_response_code(400);
    echo json_encode(array('error' => 'Upload error', 'code' => $file['error']));
    exit;
}

if ($file['size'] > $MAX_FILE_SIZE) {
    http_response_code(413);
    echo json_encode(array('error' => 'File too large', 'maxSize' => '10MB'));
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

if (!in_array($mimeType, $ALLOWED_TYPES)) {
    http_response_code(415);
    echo json_encode(array('error' => 'File type not allowed', 'type' => $mimeType));
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
    http_response_code(500);
    echo json_encode(array('error' => 'Failed to save file'));
    exit;
}

chmod($fullPath, 0644);

// ===== RESPONSE =====
$publicUrl = $BASE_URL . '/' . $subPath;

echo json_encode(array(
    'success' => true,
    'url' => $publicUrl,
    'path' => $subPath,
    'size' => $file['size'],
    'type' => $mimeType
));
