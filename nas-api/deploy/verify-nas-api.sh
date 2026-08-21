#!/usr/bin/env bash
# เกณฑ์ตรวจรับ — รันจากเครื่องนอก NAS (Git Bash / WSL / macOS / Linux)
#   NAS_KEY='<คีย์ใหม่>' ./verify-nas-api.sh
# (ส่งเป็น argument ก็ได้ แต่คีย์จะโผล่ในรายการ process ของเครื่องตัวเอง)
set -u
BASE="https://neosiam.dscloud.biz/api"
KEY="${1:-${NAS_KEY:-}}"
OLDKEY="NAS_UPLOAD_KEY_sansan856"
[ -n "$KEY" ] || { echo "ใช้: NAS_KEY='<คีย์ใหม่>' $0"; exit 1; }

pass=0; fail=0
ok()  { echo "  ✅ $1"; pass=$((pass+1)); }
bad() { echo "  ❌ $1"; fail=$((fail+1)); }
cut80(){ printf '%.80s' "$1" | tr -d '\n'; }

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.\x27 ",#\x1c\x1c(7),01444\x1f\x27=9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xfe\x8a(\xa2\x8a(\xa2\x8a\xff\xd9' > "$TMP/test.jpg"

echo "1) ไฟล์ที่ต้องหายไปจาก NAS (คาด 404)"
for f in fix-perms.php proxy-download.php copy-to-drive.php; do
  c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/$f")
  [ "$c" = "404" ] && ok "$f -> $c" || bad "$f -> $c (คาด 404)"
done

echo "2) api-key.php ต้องไม่อยู่ในโฟลเดอร์เว็บแล้ว (คาด 404)"
c=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api-key.php")
body=$(curl -s "$BASE/api-key.php")
[ "$c" = "404" ] && ok "api-key.php -> 404" || bad "api-key.php -> $c (คาด 404)"
case "$body" in *"$KEY"*) bad "!!! คีย์รั่วออกทาง HTTP — ย้อนกลับทันที";; esac

echo "3) list-files.php ต้องกันคนไม่มีคีย์ และรับคีย์ทาง header เท่านั้น"
nokey=$(curl -s "$BASE/list-files.php")
case "$nokey" in
  *Unauthorized*|*"<form"*|*"<input"*) ok "ไม่มีคีย์ -> ได้ฟอร์ม/Unauthorized ไม่ใช่รายการไฟล์";;
  *) bad "ไม่มีคีย์ -> $(cut80 "$nokey")";;
esac

withkey=$(curl -s -H "X-API-Key: $KEY" "$BASE/list-files.php")
if [ -z "${withkey//[[:space:]]/}" ]; then
  bad "ส่ง header -> ได้หน้าว่าง"
else
  case "$withkey" in
    *Unauthorized*) bad "ส่ง header -> ยัง Unauthorized (โค้ดยังไม่อ่าน X-API-Key?)";;
    *) [ "$withkey" != "$nokey" ] && ok "ส่ง header -> ได้รายการไฟล์ ($(cut80 "$withkey"))" \
                                  || bad "ส่ง header -> เนื้อหาเหมือนตอนไม่มีคีย์ (คีย์ไม่ถูกใช้)";;
  esac
fi

qkey=$(curl -s --get --data-urlencode "key=$KEY" "$BASE/list-files.php")
if [ "$qkey" = "$withkey" ] && [ "$withkey" != "$nokey" ]; then
  bad "?key= ยังใช้ได้อยู่ — ต้องถอดออกแล้ว (คีย์จะติดใน access log)"
else
  ok "?key= ใช้ไม่ได้แล้ว"
fi

echo "4) คีย์เก่าต้องใช้ไม่ได้"
r=$(curl -s -X POST -H "X-API-Key: $OLDKEY" -F "file=@$TMP/test.jpg" -F "path=test/old-key.jpg" "$BASE/upload.php")
case "$r" in *'"success":false'*|*Unauthorized*) ok "คีย์เก่าถูกปฏิเสธ";; *) bad "คีย์เก่ายังผ่าน: $(cut80 "$r")";; esac

echo "5) คีย์ใหม่ต้องอัปโหลดได้ (พิสูจน์ว่าอ่าน /volume1/nas-secrets/api-key.php ได้)"
r=$(curl -s -X POST -H "X-API-Key: $KEY" -F "file=@$TMP/test.jpg" -F "path=test/new-key.jpg" "$BASE/upload.php")
case "$r" in
  *'"success":true'*) ok "อัปโหลดผ่าน";;
  *"Server key not configured"*) bad "PHP อ่านไฟล์คีย์ไม่ได้ — ตรวจ chown http:http + chmod 750 ที่ /volume1/nas-secrets";;
  *) bad "อัปโหลดไม่ผ่าน: $(cut80 "$r")";;
esac

echo "6) โหมด SSRF ต้องไม่ทำงาน"
r=$(curl -s -X POST -H "X-API-Key: $KEY" -F "action=proxy_download" -F "sourceUrl=http://192.168.1.1/" -F "path=test/ssrf.html" "$BASE/upload.php")
case "$r" in *'"success":true'*) bad "proxy_download ยังทำงานอยู่: $(cut80 "$r")";; *) ok "ถูกปฏิเสธ";; esac

echo "7) CORS ต้องยอมเฉพาะโดเมนที่รู้จัก"
h=$(curl -s -D - -o /dev/null -H "Origin: https://example.com" "$BASE/serve.php?file=test.jpg" | grep -i access-control-allow-origin)
[ -z "$h" ] && ok "example.com ไม่ได้ CORS header" || bad "example.com ได้ header: $h"
h=$(curl -s -D - -o /dev/null -H "Origin: http://localhost:3000" "$BASE/serve.php?file=test.jpg" | grep -i access-control-allow-origin)
case "$h" in
  *'*'*) bad "ได้ '*' กลับมา (ต้องเป็นโดเมนเจาะจง): $h";;
  "")    bad "localhost:3000 ไม่ได้ CORS header";;
  *)     ok "localhost:3000 ได้ header เจาะจง";;
esac

echo
echo "ผ่าน $pass / ไม่ผ่าน $fail"
echo "ตรวจด้วยตาอีก 1 ข้อ: เปิด $BASE/list-files.php ในเบราว์เซอร์ ต้องเจอฟอร์มให้ใส่คีย์ ไม่ใช่รายการไฟล์"
[ "$fail" -eq 0 ] || { echo "มีข้อไม่ผ่าน — พิจารณาแผนย้อนกลับ (อย่าเอา fix-perms.php / proxy-download.php กลับมา และอย่าเปลี่ยน CORS เป็น *)"; exit 1; }
