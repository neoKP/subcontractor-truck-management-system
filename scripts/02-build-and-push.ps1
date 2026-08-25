<#
  02-build-and-push.ps1
  build ใหม่ + ตรวจไม่ให้ไฟล์ลับหลุดเข้า commit + push ให้ Vercel build ใหม่

  วิธีใช้:
    powershell -ExecutionPolicy Bypass -File .\scripts\02-build-and-push.ps1 -Message "chore: rotate NAS api key"
#>
param(
    [string]$Message = 'chore: rotate leaked keys',
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$Root = 'D:\subcontractor-truck-management-system'
Set-Location $Root

$Secrets = @('.env', '.env.local', '.env.production', 'nas-api/api-key.php', 'functions/service-account.json')

# ---------- 1. ยาม: ไฟล์ลับต้องไม่อยู่ใน staging/tracked ----------
Write-Host '=== ตรวจไฟล์ลับก่อน commit ===' -ForegroundColor Cyan
$bad = @()
foreach ($f in $Secrets) {
    git ls-files --error-unmatch $f 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $bad += $f }
}
if ($bad.Count -gt 0) {
    Write-Host 'หยุด! ไฟล์ลับต่อไปนี้ถูก git track อยู่:' -ForegroundColor Red
    $bad | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
    Write-Host 'แก้ด้วย: git rm --cached <ไฟล์>  แล้วรันใหม่' -ForegroundColor Red
    exit 1
}
Write-Host '[ok] ไม่มีไฟล์ลับถูก track' -ForegroundColor Green

# ---------- 2. build ----------
if (-not $SkipBuild) {
    Write-Host ''
    Write-Host '=== npm run build ===' -ForegroundColor Cyan
    npm run build
    if ($LASTEXITCODE -ne 0) { Write-Host 'build ล้มเหลว หยุดก่อน' -ForegroundColor Red; exit 1 }
    Write-Host '[ok] build ผ่าน' -ForegroundColor Green
}

# ---------- 3. ดู diff ที่จะ commit ----------
Write-Host ''
Write-Host '=== ไฟล์ที่จะถูก commit ===' -ForegroundColor Cyan
git add -A
git status --short
$staged = git diff --cached --name-only
foreach ($f in $Secrets) {
    if ($staged -contains $f) {
        Write-Host "หยุด! $f หลุดเข้า staging" -ForegroundColor Red
        git restore --staged $f
        exit 1
    }
}

Write-Host ''
$ans = Read-Host 'commit + push เลยไหม? (y/N)'
if ($ans -ne 'y') { Write-Host 'ยกเลิก (ไฟล์ยัง staged อยู่ ใช้ git reset ถ้าอยากถอย)'; exit 0 }

git commit -m $Message
git push origin main
Write-Host ''
Write-Host '[ok] push แล้ว — Vercel จะ build ใหม่อัตโนมัติ (รอสัก 1-2 นาที)' -ForegroundColor Green
Write-Host 'จากนั้นรัน .\scripts\03-verify.ps1' -ForegroundColor Yellow
