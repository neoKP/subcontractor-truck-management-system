<#
  รันบน Windows จากโฟลเดอร์ที่วางสคริปต์ทั้ง 3 ไฟล์:
    powershell -ExecutionPolicy Bypass -File .\deploy-nas-api.ps1 -NasUser <ชื่อผู้ใช้ NAS>

  ต้องมี OpenSSH client (Windows 10/11 มีมาให้แล้ว: ssh, scp)
  จะถูกถามรหัสผ่าน NAS 1-2 ครั้ง (ssh + sudo) — สคริปต์ไม่เก็บรหัสผ่านไว้ที่ไหน

  คีย์จะถูกวางที่ /volume1/nas-secrets/api-key.php (นอก web root)
  ไม่มีการอัปไฟล์คีย์เข้า /volume1/web/api/ อีกต่อไป
#>
param(
  [Parameter(Mandatory=$true)][string]$NasUser,
  [string]$NasHost = "192.168.1.82",
  [string]$Src     = "D:\subcontractor-truck-management-system\nas-api",
  [string]$RemoteScript = "$PSScriptRoot\nas-remote-deploy.sh"
)

$ErrorActionPreference = "Stop"
# copy-to-drive.php ถูกถอดออกจาก repo แล้ว — ไม่อัป และจะถูกลบออกจาก NAS โดยสคริปต์ฝั่ง NAS
$files = @("api-key.php","upload.php","serve.php","diag.php","list-files.php")

Write-Host "== ตรวจไฟล์ต้นทางใน $Src ==" -ForegroundColor Cyan
foreach ($f in $files) {
  $p = Join-Path $Src $f
  if (-not (Test-Path $p)) { throw "ขาดไฟล์: $p" }
  Write-Host ("  ok {0,-20} {1,8} bytes" -f $f, (Get-Item $p).Length)
}
if (-not (Test-Path $RemoteScript)) { throw "ขาดไฟล์: $RemoteScript" }

if (Test-Path (Join-Path $Src "copy-to-drive.php")) {
  Write-Warning "ยังเจอ copy-to-drive.php ใน $Src — repo ถอดออกแล้ว สคริปต์นี้จะไม่อัปให้ และจะลบตัวบน NAS ทิ้ง"
}
Get-ChildItem $Src -Filter *.txt -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Warning "พบไฟล์ .txt ในโฟลเดอร์ต้นทาง: $($_.Name) — ตรวจว่าไม่มีคีย์อยู่ข้างใน"
}


# โดเมนของหน้าเว็บต้องเป็นค่าจริง ไม่ใช่ตัวยึด — ถ้ายังไม่ได้ใส่ การอัปโหลดจากเว็บจริง
# จะถูกเบราว์เซอร์บล็อกทันทีหลัง deploy และจะหาสาเหตุยากเพราะข้อความที่เห็นคือ CORS error
foreach ($f in @('upload.php', 'serve.php', 'diag.php', 'list-files.php')) {
  $p = Join-Path $Src $f
  if (-not (Test-Path $p)) { continue }
  if ((Get-Content $p -Raw) -match 'REPLACE-ME') {
    throw "$f ยังมี REPLACE-ME.vercel.app อยู่ — ต้องใส่โดเมน Vercel จริงใน `$ALLOWED_ORIGINS ก่อน deploy"
  }
}
$target = "$NasUser@$NasHost"
Write-Host "`n== ส่งไฟล์ขึ้น staging บน NAS ==" -ForegroundColor Cyan
ssh $target "rm -rf /tmp/nas-api-deploy && mkdir -p /tmp/nas-api-deploy && chmod 700 /tmp/nas-api-deploy"
if ($LASTEXITCODE -ne 0) { throw "ssh ล้มเหลว" }

foreach ($f in $files) {
  scp (Join-Path $Src $f) "${target}:/tmp/nas-api-deploy/$f"
  if ($LASTEXITCODE -ne 0) { throw "scp $f ล้มเหลว" }
}
scp $RemoteScript "${target}:/tmp/nas-remote-deploy.sh"
if ($LASTEXITCODE -ne 0) { throw "scp remote script ล้มเหลว" }

Write-Host "`n== รันขั้นที่ 0/4/3/2 บน NAS (จะถามรหัสผ่าน sudo) ==" -ForegroundColor Cyan
# ต้องเก็บ exit code ของสคริปต์ไว้ก่อนลบไฟล์ ไม่งั้น rm ที่สำเร็จจะกลายเป็นผลลัพธ์สุดท้าย
# แล้ว $LASTEXITCODE เป็น 0 ทั้งที่ deploy ล้มกลางคัน = สคริปต์รายงานว่าสำเร็จ
ssh -t $target "sudo sh /tmp/nas-remote-deploy.sh; rc=`$?; rm -f /tmp/nas-remote-deploy.sh; exit `$rc"
if ($LASTEXITCODE -ne 0) { throw "สคริปต์ฝั่ง NAS ล้มเหลว — ดูข้อความด้านบน แล้วใช้แผนย้อนกลับ" }

Write-Host "`nเสร็จขั้นที่ 0-4 แล้ว ขั้นต่อไป: deploy ฝั่ง truck-maintenance แล้วรัน verify-nas-api.sh" -ForegroundColor Green
