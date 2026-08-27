#!/bin/sh
# Health check for NAS web API endpoints. If check fails, attempt to restart web services
# Optional: if CLOUDFLARED_CMD is provided, also (re)start cloudflared.

set -eu

# ค่าเริ่มต้นต้องชี้ไป endpoint ที่ "มีอยู่จริงและตั้งใจให้อยู่ถาวร"
#
# เดิมชี้ไป diag.php ซึ่งถูกถอดออกจาก webroot โดยตั้งใจ (ตัวไฟล์เขียนเองว่า
# ห้าม deploy และให้ลบทิ้งหลังใช้) — พอมันหายไป การตรวจจะได้ 404 ทุกครั้ง
# แล้ว -f ทำให้ curl ถือว่าล้มเหลว → รีสตาร์ต Web Station + Nginx ทุกคืน
# โดยที่ระบบไม่ได้มีอะไรผิดเลย · อาการที่ตามมาคือ API กับรูป POD สะดุดสั้น ๆ
# ตอนเที่ยงคืน ซึ่งถ้ามีคนรายงานจะชี้ไปผิดที่ (นึกว่า serve.php มีปัญหา)
#
# test.php เป็นไฟล์ถาวรขนาด 71 ไบต์ ตอบ 200 — เบาและไม่มีข้อมูลอะไรให้รั่ว
ENDPOINT="${ENDPOINT:-https://neosiam.dscloud.biz/api/test.php}"
CURL="/usr/bin/curl"
LOGGER="/usr/bin/logger"
LOGTAG="nas-health"
TS="$(date '+%Y-%m-%d %H:%M:%S')"

# กันคำสั่งเก่าใน Task Scheduler ที่ยังส่ง ENDPOINT=.../diag.php มาทับค่าเริ่มต้น
#
# แก้ค่าเริ่มต้นในไฟล์นี้อย่างเดียวไม่พอ เพราะงานใน Task Scheduler ตั้งค่าไว้ว่า
#   ENDPOINT="https://neosiam.dscloud.biz/api/diag.php" sh /volume1/scripts/healthcheck-nas.sh
# ตัวแปรที่ส่งมาหน้าคำสั่งชนะค่าเริ่มต้นเสมอ ต่อให้อัปสคริปต์ใหม่ขึ้นไปก็ยังยิงไป diag.php อยู่ดี
# และ diag.php ถูกถอดออกจาก webroot ถาวรแล้ว (404) → ถือว่าไม่สุขภาพดีทุกครั้ง → รีสตาร์ตฟรี
#
# ดักไว้ตรงนี้เพื่อให้แก้ที่เดียวจบ ไม่ต้องรอใครไปแก้คำสั่งใน DSM
case "${ENDPOINT}" in
  *diag.php*|*list-files.php*)
    ${LOGGER} -t "${LOGTAG}" "${TS} ENDPOINT ${ENDPOINT} ถูกถอดออกจาก webroot แล้ว — ใช้ test.php แทน (แก้คำสั่งใน Task Scheduler ด้วย)"
    ENDPOINT="https://neosiam.dscloud.biz/api/test.php"
    ;;
esac

# ตรวจสองครั้งก่อนตัดสินว่าไม่สุขภาพดี
#
# การรีสตาร์ต Web Station ตัดการเชื่อมต่อที่ค้างอยู่ทั้งหมด ทั้งอัปโหลดรูป POD
# และ API ที่กำลังทำงาน ราคาของการตัดสินผิดจึงสูงกว่าการรอเพิ่มอีกไม่กี่วินาทีมาก
# เน็ตกระตุกชั่วขณะหรือ DNS ช้าครั้งเดียวไม่ควรทำให้ทั้งระบบสะดุด
attempt=1
while [ "${attempt}" -le 2 ]; do
  if ${CURL} -fsS -m 10 "${ENDPOINT}" >/dev/null 2>&1; then
    exit 0
  fi
  attempt=$((attempt + 1))
  [ "${attempt}" -le 2 ] && sleep 5
done

${LOGGER} -t "${LOGTAG}" "${TS} health check failed for ${ENDPOINT} (ลอง 2 ครั้ง); restarting Web Station and Nginx"

# Best-effort restarts on Synology DSM
if command -v synoservice >/dev/null 2>&1; then
  synoservice --restart pkgctl-WebStation >/dev/null 2>&1 || true
  synoservice --restart nginx >/dev/null 2>&1 || true
fi

# Optionally (re)start cloudflared if requested
if [ -n "${CLOUDFLARED_CMD:-}" ]; then
  ${LOGGER} -t "${LOGTAG}" "${TS} restarting cloudflared via CLOUDFLARED_CMD"
  nohup sh -c "${CLOUDFLARED_CMD}" >/var/log/cloudflared.log 2>&1 &
fi

exit 0
