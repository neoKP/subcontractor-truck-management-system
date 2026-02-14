#!/bin/bash
# ============================================================
# sync-to-drive.sh — Synology Task Scheduler (root, every 5 min)
# 
# แก้ปัญหา: rsync ทั้ง /tmp/nas-uploads/ ทำให้ folder จากระบบอื่น
# (migrated-ncr, migrated-returns) ปนเข้ามาใน subcontractor folder
#
# วิธีใช้: วาง script นี้ที่ /web/api/sync-to-drive.sh บน NAS
# แล้วเปลี่ยน Task Scheduler script เป็น: bash /web/api/sync-to-drive.sh
# ============================================================

SRC="/tmp/nas-uploads"
DEST="/volume1/Operation/paweewat/subcontractor-truck-management"

# Sync เฉพาะ folder ของระบบ subcontractor-truck-management เท่านั้น
FOLDERS="pod-images payment-slips"

for folder in $FOLDERS; do
    if [ -d "$SRC/$folder" ]; then
        mkdir -p "$DEST/$folder"
        rsync -av "$SRC/$folder/" "$DEST/$folder/"
    fi
done
