<?php
// แสดงรายการไฟล์ที่อัปโหลดบน NAS — ลบไฟล์นี้ทิ้งหลังใช้งาน!
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
        if (is_dir($path)) {
            $files = array_merge($files, listFilesRecursive($path, $rel, $baseUrl));
        } else {
            $size = filesize($path);
            $date = date('Y-m-d H:i:s', filemtime($path));
            $url = $baseUrl . $rel;
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
