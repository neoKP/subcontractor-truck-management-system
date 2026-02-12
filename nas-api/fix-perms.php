<?php
// แก้สิทธิ์ uploads ด้วย PHP shell_exec — ลบไฟล์นี้ทิ้งหลังใช้งาน!
header('Content-Type: application/json; charset=utf-8');

$info = array();
$dir = '/volume1/web/uploads';

// ตรวจ whoami
$info['whoami'] = trim(@shell_exec('whoami 2>&1'));

// สั่ง chmod ผ่าน shell
$info['chmod_result'] = trim(@shell_exec('chmod 777 ' . $dir . ' 2>&1'));
$info['ls_before'] = trim(@shell_exec('ls -la /volume1/web/ 2>&1'));

// ทดสอบเขียน
$testFile = $dir . '/test-write.txt';
$writeResult = @file_put_contents($testFile, 'test ' . date('Y-m-d H:i:s'));
$info['write_test'] = ($writeResult !== false);

if (!$info['write_test']) {
    // ถ้ายังเขียนไม่ได้ ลองสร้างโฟลเดอร์ใหม่ใน /tmp แล้ว symlink
    $tmpDir = '/tmp/nas-uploads';
    if (!is_dir($tmpDir)) mkdir($tmpDir, 0777, true);
    $tmpWrite = @file_put_contents($tmpDir . '/test.txt', 'ok');
    $info['tmp_dir_writable'] = ($tmpWrite !== false);
    $info['tmp_dir'] = $tmpDir;
}

$info['uploads_writable'] = is_writable($dir);
$info['uploads_perms'] = substr(sprintf('%o', @fileperms($dir)), -4);

echo json_encode($info, JSON_PRETTY_PRINT);
