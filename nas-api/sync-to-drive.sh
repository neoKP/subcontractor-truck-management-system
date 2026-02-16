#!/bin/bash
# ============================================================
# sync-to-drive.sh — Synology Task Scheduler (root, every 5 min)
#
# Bi-directional sync:
#   1) /tmp/nas-uploads → Synology Drive (สำรองข้อมูล)
#   2) Synology Drive → /tmp/nas-uploads (ให้ serve.php อ่านได้)
#
# เหตุผล: PHP user http อ่าน /volume1/Operation/ ไม่ได้
# จึงต้อง sync กลับมาที่ /tmp/nas-uploads ด้วย
#
# วิธีใช้: bash /volume1/web/api/sync-to-drive.sh
# ============================================================

SRC="/tmp/nas-uploads"
DEST="/volume1/Operation/paweewat/subcontractor-truck-management"
FOLDERS="pod-images payment-slips"

# สร้าง /tmp/nas-uploads ถ้ายังไม่มี
mkdir -p "$SRC"

# 1) Upload → Synology Drive (สำรองไฟล์ใหม่)
for folder in $FOLDERS; do
    if [ -d "$SRC/$folder" ]; then
        mkdir -p "$DEST/$folder"
        rsync -av "$SRC/$folder/" "$DEST/$folder/"
    fi
done

# 2) Synology Drive → /tmp/nas-uploads (กู้คืนไฟล์ที่หายจาก /tmp)
for folder in $FOLDERS; do
    if [ -d "$DEST/$folder" ]; then
        mkdir -p "$SRC/$folder"
        rsync -av "$DEST/$folder/" "$SRC/$folder/"
    fi
done

# ให้สิทธิ์ PHP user http อ่านได้
chmod -R 755 "$SRC" 2>/dev/null
chown -R http:http "$SRC" 2>/dev/null
