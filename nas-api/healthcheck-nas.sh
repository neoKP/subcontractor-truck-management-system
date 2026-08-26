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

# Try request with 10s timeout. Treat any failure as unhealthy.
if ${CURL} -fsS -m 10 "${ENDPOINT}" >/dev/null 2>&1; then
  exit 0
fi

${LOGGER} -t "${LOGTAG}" "${TS} health check failed for ${ENDPOINT}; restarting Web Station and Nginx"

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
