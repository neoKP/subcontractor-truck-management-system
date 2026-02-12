<?php
/**
 * Proxy Download: รับ URL จาก Firebase Storage → Download → บันทึกลง NAS → คืน NAS URL
 * แก้ปัญหา CORS ที่ browser download จาก Firebase ไม่ได้
 */

$API_KEY = 'NAS_UPLOAD_KEY_sansan856';
$UPLOAD_DIR = '/tmp/nas-uploads';
$BASE_URL = 'https://neosiam.dscloud.biz/api/serve.php?file=';

// CORS
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-API-Key');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Auth
$apiKey = isset($_SERVER['HTTP_X_API_KEY']) ? $_SERVER['HTTP_X_API_KEY'] : '';
if ($apiKey !== $API_KEY) {
    http_response_code(401);
    echo json_encode(array('error' => 'Unauthorized'));
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(array('error' => 'Method not allowed'));
    exit;
}

// Read JSON body
$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['sourceUrl']) || !isset($input['path'])) {
    http_response_code(400);
    echo json_encode(array('error' => 'Missing sourceUrl or path'));
    exit;
}

$sourceUrl = $input['sourceUrl'];
$destPath = preg_replace('/[^a-zA-Z0-9_\-\/\.]/', '_', $input['path']);

// Download from Firebase Storage
$ch = curl_init($sourceUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 30);
curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
$fileData = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
$curlError = curl_error($ch);
curl_close($ch);

if ($httpCode !== 200 || $fileData === false) {
    http_response_code(502);
    echo json_encode(array(
        'error' => 'Failed to download from source',
        'httpCode' => $httpCode,
        'curlError' => $curlError
    ));
    exit;
}

// Save to NAS
$fullPath = $UPLOAD_DIR . '/' . $destPath;
$dir = dirname($fullPath);

if (!is_dir($dir)) {
    mkdir($dir, 0755, true);
}

$result = file_put_contents($fullPath, $fileData);
if ($result === false) {
    http_response_code(500);
    echo json_encode(array('error' => 'Failed to save file'));
    exit;
}

$publicUrl = $BASE_URL . '/' . $destPath;

echo json_encode(array(
    'success' => true,
    'url' => $publicUrl,
    'path' => $destPath,
    'size' => strlen($fileData),
    'type' => $contentType
));
