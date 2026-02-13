<?php
/**
 * คัดลอกรูปเก่าจาก /tmp/nas-uploads → Synology Drive folder
 * รัน: https://neosiam.dscloud.biz/api/copy-to-drive.php?key=NAS_UPLOAD_KEY_sansan856
 * ลบไฟล์นี้หลังใช้งานเสร็จ
 */

error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(300);

$API_KEY = 'NAS_UPLOAD_KEY_sansan856';
$SOURCE = '/tmp/nas-uploads';
$DEST = '/volume1/Operation/paweewat/subcontractor-truck-management';

header('Content-Type: text/plain; charset=utf-8');

// Auth
if (!isset($_GET['key']) || $_GET['key'] !== $API_KEY) {
    http_response_code(401);
    echo "Unauthorized\n";
    exit;
}

echo "=== Copy /tmp/nas-uploads -> Synology Drive ===\n\n";

// Debug
echo "whoami: " . trim(shell_exec('whoami 2>&1')) . "\n";
echo "Source: $SOURCE (" . (is_dir($SOURCE) ? 'EXISTS' : 'NOT FOUND') . ")\n";
echo "Dest:   $DEST (" . (is_dir($DEST) ? 'EXISTS' : 'NOT FOUND') . ")\n\n";

// Step 1: สร้าง destination ด้วย shell command
echo "Step 1: mkdir -p ...\n";
echo shell_exec("mkdir -p '$DEST' 2>&1");
echo "Dest after mkdir: " . (is_dir($DEST) ? 'EXISTS' : 'STILL NOT FOUND') . "\n\n";

if (!is_dir($DEST)) {
    echo "Trying sudo mkdir...\n";
    echo shell_exec("sudo mkdir -p '$DEST' 2>&1");
    echo "Dest after sudo: " . (is_dir($DEST) ? 'EXISTS' : 'STILL NOT FOUND') . "\n\n";
}

if (!is_dir($DEST)) {
    echo "ERROR: Cannot create destination. Aborting.\n";
    exit;
}

// Step 2: คัดลอกไฟล์ด้วย cp -r
echo "Step 2: cp -r ...\n";
$result = shell_exec("cp -rv $SOURCE/* $DEST/ 2>&1");
echo $result ? $result : "(no output)\n";

// Step 3: ตรวจสอบผล
echo "\nStep 3: Checking...\n";
$count = trim(shell_exec("find '$DEST' -type f 2>/dev/null | wc -l"));
echo "Files in destination: $count\n";

echo "\n=== Done ===\n";
