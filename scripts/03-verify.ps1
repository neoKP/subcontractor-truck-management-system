<#
  03-verify.ps1
  ตรวจ 2 อย่าง:
    A) ไฟล์ลับเข้าจากเว็บไม่ได้ (ต้องได้ 404 หรือ 403 ทุกบรรทัด)
    B) bundle ที่ build ออกมาไม่มีคีย์เก่าฝังอยู่

  วิธีใช้:
    powershell -ExecutionPolicy Bypass -File .\scripts\03-verify.ps1
#>
$ErrorActionPreference = 'Continue'
$Root = 'D:\subcontractor-truck-management-system'
$Site = 'https://subcontractor-truck-management-syst.vercel.app'
Set-Location $Root

# ---------- A. ตรวจ URL ----------
Write-Host '=== A. ไฟล์ลับต้องเข้าไม่ได้ (404/403) ===' -ForegroundColor Cyan
$paths = @('.env', '.env.local', '.env.production', 'price-audit.csv',
           'functions/service-account.json', 'nas-api/api-key.php', '.git/config')
$allGood = $true
foreach ($p in $paths) {
    try {
        $r = Invoke-WebRequest -Uri "$Site/$p" -Method Get -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 20
        $code = $r.StatusCode
    } catch { $code = 'ERR' }
    $ok = ($code -eq 404 -or $code -eq 403)
    if (-not $ok) { $allGood = $false }
    $color = if ($ok) { 'Green' } else { 'Red' }
    Write-Host ("  {0,-40} {1}" -f "/$p", $code) -ForegroundColor $color
}
Write-Host ''
if ($allGood) { Write-Host '[ok] เข้าไม่ได้ทุกไฟล์' -ForegroundColor Green }
else { Write-Host '[!!] มีไฟล์ที่ยังเข้าได้ — ตรวจ .vercelignore' -ForegroundColor Red }

# ---------- B. ตรวจ bundle หาคีย์เก่า ----------
Write-Host ''
Write-Host '=== B. bundle ต้องไม่มีคีย์เก่า ===' -ForegroundColor Cyan
$oldMarkers = @{
    'Telegram bot เก่า (8682944058)' = '8682944058'
    # เก็บแค่ 10 ตัวแรกพอ — repo นี้เป็น public ไม่ต้องแปะเลขอ้างอิงเต็ม ๆ ไว้ให้คนอ่าน
    # ตรวจจับได้เท่าเดิม: ถ้ากุญแจเต็มหลุดเข้า bundle 10 ตัวแรกก็ต้องโผล่ด้วยเสมอ
    'private_key_id เก่า'            = '8cd5259a29'
    'service account email'          = 'firebase-adminsdk-fbsvc@'
    'BEGIN PRIVATE KEY'              = 'BEGIN PRIVATE KEY'
}
$dist = Join-Path $Root 'dist'
if (-not (Test-Path $dist)) {
    Write-Host '  ไม่พบโฟลเดอร์ dist — รัน npm run build ก่อน' -ForegroundColor Yellow
} else {
    foreach ($k in $oldMarkers.Keys) {
        $hits = Select-String -Path "$dist\**\*" -Pattern ([regex]::Escape($oldMarkers[$k])) -SimpleMatch -List -ErrorAction SilentlyContinue
        if ($hits) {
            Write-Host "  [!!] เจอ $k ใน:" -ForegroundColor Red
            $hits | ForEach-Object { Write-Host "        $($_.Path)" -ForegroundColor Red }
        } else {
            Write-Host "  [ok] ไม่เจอ $k" -ForegroundColor Green
        }
    }
}

# ---------- C. เตือนสิ่งที่ยังต้องทำมือ ----------
Write-Host ''
Write-Host '=== C. ตรวจด้วยมือ (สคริปต์ทำแทนไม่ได้) ===' -ForegroundColor Yellow
Write-Host '  [ ] เข้าเว็บ -> สร้างใบงานใหม่ได้'
Write-Host '  [ ] อัปโหลดรูป POD ได้ (ถ้าไม่ได้ = คีย์ NAS สองฝั่งไม่ตรง)'
Write-Host '  [ ] แจ้งเตือน Telegram เข้ากลุ่ม'
Write-Host '  [ ] Google Cloud Console -> KEYS -> ไม่มีแถว 8cd5259a29... แล้ว'
