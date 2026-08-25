<#
  01-rotate-nas-key.ps1
  สุ่มคีย์ NAS ใหม่ แล้วแก้ให้ตรงกันทั้ง 2 ที่บนเครื่อง (.env + nas-api/api-key.php)
  ส่วนที่ 3 (ไฟล์บน NAS) สคริปต์จะพิมพ์คำสั่งให้ไปวางเอง

  วิธีใช้:
    cd D:\subcontractor-truck-management-system
    powershell -ExecutionPolicy Bypass -File .\scripts\01-rotate-nas-key.ps1

  ปลอดภัย: สำรองไฟล์เดิมเป็น .bak-<timestamp> ก่อนเขียนทับทุกครั้ง
#>

$ErrorActionPreference = 'Stop'
$Root = 'D:\subcontractor-truck-management-system'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

function Write-Utf8NoBom([string]$Path, [string]$Text) {
    $enc = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Text, $enc)
}

function Backup([string]$Path) {
    if (Test-Path $Path) {
        Copy-Item $Path "$Path.bak-$Stamp"
        Write-Host "  สำรองไว้: $(Split-Path -Leaf $Path).bak-$Stamp" -ForegroundColor DarkGray
    }
}

Set-Location $Root

# ---------- 1. สุ่มคีย์ใหม่ 32 ไบต์ (64 hex) ----------
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$NewKey = ($bytes | ForEach-Object { $_.ToString('x2') }) -join ''

Write-Host ''
Write-Host '=== คีย์ NAS ใหม่ ===' -ForegroundColor Cyan
Write-Host $NewKey
Write-Host ''

# ---------- 2. แก้ .env ----------
$EnvPath = Join-Path $Root '.env'
if (-not (Test-Path $EnvPath)) { throw "ไม่พบไฟล์ .env ที่ $EnvPath" }
Backup $EnvPath

$lines = Get-Content $EnvPath
$found = $false
$out = foreach ($l in $lines) {
    if ($l -match '^\s*VITE_NAS_API_KEY\s*=') { $found = $true; "VITE_NAS_API_KEY=$NewKey" }
    else { $l }
}
if (-not $found) { $out = @($out) + "VITE_NAS_API_KEY=$NewKey" }
Write-Utf8NoBom $EnvPath (($out -join "`n") + "`n")
Write-Host '[ok] แก้ .env -> VITE_NAS_API_KEY' -ForegroundColor Green

# ---------- 3. แก้ nas-api/api-key.php บนเครื่อง ----------
$PhpPath = Join-Path $Root 'nas-api\api-key.php'
Backup $PhpPath
Write-Utf8NoBom $PhpPath "<?php`nreturn '$NewKey';`n"
Write-Host '[ok] แก้ nas-api\api-key.php' -ForegroundColor Green

# ---------- 4. กันพลาด: ทั้งสองไฟล์ต้องไม่โผล่ใน git ----------
Write-Host ''
Write-Host '=== เช็ค git ว่าไฟล์ลับไม่ถูก track ===' -ForegroundColor Cyan
$tracked = @()
foreach ($f in @('.env', 'nas-api/api-key.php', 'functions/service-account.json')) {
    $r = git ls-files --error-unmatch $f 2>$null
    if ($LASTEXITCODE -eq 0) { $tracked += $f; Write-Host "  [!! อันตราย] $f ถูก git track อยู่" -ForegroundColor Red }
    else { Write-Host "  [ok] $f ไม่ถูก track" -ForegroundColor Green }
}
if ($tracked.Count -gt 0) {
    Write-Host ''
    Write-Host 'หยุดก่อน! เอาออกจาก git ด้วยคำสั่งนี้ แล้วค่อยไปต่อ:' -ForegroundColor Red
    foreach ($f in $tracked) { Write-Host "  git rm --cached `"$f`"" }
    throw 'มีไฟล์ลับถูก track อยู่ใน git'
}

# ---------- 5. คำสั่งที่ต้องไปรันบน NAS ----------
Write-Host ''
Write-Host '=== ขั้นต่อไป: ไปรันบน NAS (SSH) ===' -ForegroundColor Yellow
Write-Host @"
  sudo tee /volume1/nas-secrets/api-key.php >/dev/null <<'EOF'
<?php
return '$NewKey';
EOF
  sudo chown http:http /volume1/nas-secrets/api-key.php
  sudo chmod 640      /volume1/nas-secrets/api-key.php
"@
Write-Host ''
Write-Host 'ทำ NAS เสร็จแล้วค่อยรัน .\scripts\02-build-and-push.ps1' -ForegroundColor Yellow
