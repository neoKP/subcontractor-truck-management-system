#!/bin/sh
# ทำงานบน Synology NAS ในนาม root:  sudo sh /tmp/nas-remote-deploy.sh
# ขั้นที่ 0, 2, 3, 4 ของแผน — ต้อง scp ไฟล์ไป /tmp/nas-api-deploy/ ก่อน
set -e

# ล้างโฟลเดอร์พักไฟล์เสมอ แม้สคริปต์จะตายกลางคัน — ใน $STAGE มี api-key.php ตัวจริงอยู่
# ถ้าไม่มี trap แล้วสคริปต์ exit ก่อนถึงบรรทัดล้างท้ายไฟล์ (เช่นเจอ symlink แล้วหยุด)
# คีย์จะค้างอยู่ใน /tmp ต่อไปเรื่อย ๆ
# ใช้ single quote เพื่อให้ $STAGE ถูกแทนค่าตอน trap ทำงาน ไม่ใช่ตอนตั้ง trap
# ปิดท้ายด้วย || true กัน trap ล้มเองแล้วไปเปลี่ยน exit code ของสคริปต์
trap 'rm -rf "$STAGE" 2>/dev/null || true' EXIT

DEST=/volume1/web/api
SECRETS=/volume1/nas-secrets
# ที่เก็บสำรอง ต้องอยู่ "นอก" /volume1/web เสมอ
# เดิมสำรองไว้ที่ $DEST.bak-<วันที่> ซึ่งอยู่ใน web root — Web Station เสิร์ฟโฟลเดอร์นั้นด้วย
# แปลว่า upload.php ตัวเก่า (คีย์ hardcode + โหมด proxy_download ที่เป็น SSRF) จะยังมีชีวิต
# ต่อที่ https://<โดเมน>/api.bak-<วันที่>/upload.php = หมุนคีย์ไปก็ไม่ได้ปิดอะไรเลย
BACKUPS="$SECRETS/api-backups"
STAGE=/tmp/nas-api-deploy
STAMP=$(date +%Y%m%d-%H%M)
BAKDIR="$BACKUPS/api.bak-$STAMP"
# ต้องตรงกับ $files ใน deploy-nas-api.ps1 เสมอ — สคริปต์นี้ exit 1 ถ้าไฟล์ใน STAGE ไม่ครบ
# diag.php และ list-files.php ถูกถอดออกแล้ว (2026-08-25) ดูเหตุผลใน deploy-nas-api.ps1
APPFILES="upload.php serve.php"

echo "== ตรวจไฟล์ที่ stage ไว้ =="
for f in api-key.php $APPFILES; do
  [ -f "$STAGE/$f" ] || { echo "!! ขาดไฟล์ $STAGE/$f — หยุด"; exit 1; }
done
head -c 200 "$STAGE/api-key.php" | grep -q "^<?php" || { echo "!! api-key.php ไม่ขึ้นต้นด้วย <?php — หยุด"; exit 1; }
grep -q "return" "$STAGE/api-key.php" || { echo "!! api-key.php ไม่มี return — หยุด"; exit 1; }

# กันพลาด: โค้ดใหม่ต้องชี้ไปที่ path ใหม่ ไม่ใช่ไฟล์ข้าง ๆ ตัวเอง
for f in upload.php; do
  grep -q "$SECRETS/api-key.php" "$STAGE/$f" || \
    echo "!! เตือน: $f ไม่มีสตริง $SECRETS/api-key.php — ตรวจว่าอ่านคีย์จาก path ใหม่จริงหรือยัง"
done

echo "== ขั้นที่ 0: สำรอง (ปลายทางอยู่นอก web root) =="
# root เป็นเจ้าของ / http อยู่ในกลุ่ม = PHP "อ่านได้ แต่เขียนทับไม่ได้"
# (ถ้าให้ http เป็นเจ้าของ ช่องโหว่ path traversal ใน upload.php จะเขียนทับไฟล์คีย์ตัวเองได้)
# ตั้งสิทธิ์ตั้งแต่ตอนสร้าง ไม่รอถึงขั้นที่ 4 เพราะตัวสำรองลงมาอยู่ในนี้ก่อนแล้ว
mkdir -p "$SECRETS"
chown root:http "$SECRETS"
chmod 750 "$SECRETS"
# ตัวสำรองมีทั้ง upload.php ตัวเก่าและอาจมี api-key.php เก่าติดมาด้วย
# ไม่มีใครต้องอ่านมันนอกจาก root — ไม่ให้ PHP (user http) เข้าถึงเลย
mkdir -p "$BACKUPS"
chown root:root "$BACKUPS"
chmod 700 "$BACKUPS"
cp -a "$DEST" "$BAKDIR"
echo "สำรองไว้ที่ $BAKDIR"
ls -la "$BAKDIR" | head -30

echo "== ขั้นที่ 4: วางไฟล์คีย์นอก web root ก่อน =="
# สิทธิ์ของ $SECRETS ตั้งไว้แล้วที่ขั้นที่ 0
cp "$STAGE/api-key.php" "$SECRETS/api-key.php"
chown root:http "$SECRETS/api-key.php"
chmod 640 "$SECRETS/api-key.php"
ls -la "$SECRETS"

echo "== ขั้นที่ 3: อัปไฟล์ PHP ชุดใหม่ =="
for f in $APPFILES; do
  cp "$STAGE/$f" "$DEST/$f"
  chown http:http "$DEST/$f"
  chmod 644 "$DEST/$f"
  echo "  ok $f"
done

echo "== ตรวจโปรเจกต์เพื่อนบ้าน truck-maintenance ก่อนลบไฟล์คีย์เก่า =="
MAINT="$DEST/Maintenance-api"
if [ -d "$MAINT" ] || [ -d /volume1/web/Maintenance-api ]; then
  for d in "$MAINT" /volume1/web/Maintenance-api; do
    [ -d "$d" ] && { echo "--- $d ---"; ls -la "$d"; }
  done
  echo "!! หมายเหตุ: สคริปต์นี้ไม่แตะไฟล์ในสองโฟลเดอร์นั้นเลย แค่แสดงให้ดู"
  # ทั้งสองโปรเจกต์มี upload.php คนละตัว - ยืนยันว่าไม่ใช่ symlink ชี้ไฟล์เดียวกัน
  for f in "$DEST/upload.php" "$MAINT/upload.php" /volume1/web/Maintenance-api/upload.php; do
    [ -e "$f" ] || continue
    if [ -L "$f" ]; then
      echo "!! $f เป็น symlink -> $(readlink -f "$f") -- หยุดตรวจด้วยตาก่อน"; exit 1
    fi
    echo "  $f  inode=$(ls -i "$f" | awk '{print $1}')  $(ls -la "$f")"
  done
  echo "  (inode ต่างกัน = คนละไฟล์จริง ถ้าเท่ากันคือ hard link ให้หยุด)"
fi

echo "== ขั้นที่ 2: ลบไฟล์ที่ไม่ต้องมีอีกแล้ว =="
rm -f "$DEST/fix-perms.php" "$DEST/proxy-download.php" "$DEST/copy-to-drive.php"
echo "ลบ fix-perms.php, proxy-download.php, copy-to-drive.php แล้ว"

# api-key.php ตัวเก่าใน web root: ลบได้ต่อเมื่อไม่มีใครอ้างถึงอยู่
if [ -f "$DEST/api-key.php" ]; then
  REFS=$(grep -rl "api-key" "$DEST" --include="*.php" 2>/dev/null | grep -v "^$DEST/api-key.php$" | grep -v "^$DEST/upload.php$" | grep -v "^$DEST/list-files.php$" || true)
  if [ -n "$REFS" ]; then
    echo "!! ไม่ลบ $DEST/api-key.php เพราะยังมีไฟล์อ้างถึง:"
    echo "$REFS" | sed 's/^/     /'
    echo "!! แก้ไฟล์เหล่านั้นให้ชี้ไป $SECRETS/api-key.php ก่อน แล้วค่อยลบเอง"
    echo "!! ตราบใดที่ยังอยู่ใน web root ถือว่ายังแก้ช่องโหว่ไม่ครบ"
  else
    rm -f "$DEST/api-key.php"
    echo "ลบ api-key.php ที่ค้างใน web root แล้ว"
  fi
fi
echo "(ทุกไฟล์ที่ลบยังกู้ได้จาก $BAKDIR)"

echo "== ผลลัพธ์ =="
ls -la "$DEST"
echo "--- $SECRETS ---"
ls -la "$SECRETS"

# ตรวจซ้ำว่าไม่มีคีย์ค้างใน web root
if grep -rl "return '" "$DEST" 2>/dev/null | grep -q api-key; then
  echo "!! ยังพบไฟล์คีย์ใน $DEST — ตรวจด้วยตัวเอง"
fi

echo "== ตรวจสุดท้าย: ต้องไม่มีของแปลกปลอมใน /volume1/web =="
# ทุกอย่างที่วางใน /volume1/web ถูก Web Station เสิร์ฟออกอินเทอร์เน็ต และไฟล์ .php ในนั้น
# "รันได้" ไม่ใช่แค่โหลดได้ สำเนาเก่าของ upload.php จึงเท่ากับ endpoint ที่ยังเปิดอยู่จริง
# โฟลเดอร์ที่รู้จักและตั้งใจให้มี — นอกเหนือจากนี้ต้องมาดูด้วยตา
KNOWN_API_DIRS="api Maintenance-api ncr-api"
STRAY=0
for d in /volume1/web/*; do
  [ -d "$d" ] || continue
  name=$(basename "$d")
  case "$name" in
    *.bak-*|*.bak|*.old-*|*.orig|*~)
      echo "  !! โฟลเดอร์สำรองอยู่ใน web root: $d"
      echo "     เข้าถึงได้จากอินเทอร์เน็ต — ย้ายไป $BACKUPS แล้วลบตัวใน web root"
      STRAY=1
      continue
      ;;
  esac
  case "$name" in
    *api*|*API*)
      if ! echo " $KNOWN_API_DIRS " | grep -q " $name "; then
        echo "  !! โฟลเดอร์ชื่อคล้าย api ที่ไม่รู้จัก: $d — ตรวจว่ามี .php เก่าค้างอยู่ไหม"
        STRAY=1
      fi
      ;;
  esac
done
if [ "$STRAY" -eq 0 ]; then
  echo "  [ok] ไม่พบโฟลเดอร์สำรองหรือโฟลเดอร์ api แปลกปลอมใน /volume1/web"
else
  echo "  !! ยังถือว่า deploy ไม่เสร็จ จนกว่าจะจัดการรายการข้างบน"
fi

rm -rf "$STAGE"
echo
echo "เสร็จ. ถ้าต้องย้อนกลับ:  sudo rm -rf $DEST && sudo cp -a $BAKDIR $DEST"
echo "  (ใช้ cp ไม่ใช่ mv — ตัวสำรองจะได้ยังอยู่นอก web root เผื่อต้องย้อนซ้ำ)"
echo "  แล้วสั่ง: sudo chown -R http:http $DEST"
echo "(ไฟล์คีย์ที่ $SECRETS/api-key.php ปล่อยไว้ได้ ไม่ได้อยู่ในโฟลเดอร์เว็บ)"
