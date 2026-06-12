/**
 * Fix Job Prices (Remediation)
 * --------------------------------------------------------------------------
 * แก้ค่า job.cost ของงานที่ราคาเพี้ยน ให้ตรงกับราคาของ "รถร่วมที่จัดจริง"
 * (basePrice + จุดส่ง × dropOffFee) ตามตารางราคากลาง
 *
 * 🔒 ปลอดภัยโดยดีฟอลต์:
 *   - DRY RUN เป็นค่าเริ่มต้น (แสดงอย่างเดียว ไม่เขียน Firebase)
 *   - ข้ามใบที่ฝ่ายบัญชีล็อกแล้ว (isBaseCostLocked) เว้นแต่ใส่ --include-locked
 *   - แก้เฉพาะ cost (ไม่ยุ่งกับ sellingPrice) และเฉพาะใบที่มีสัญญาของรถร่วมเจ้านั้น
 *   - ทุกการแก้จะเขียน Audit Log (logs/{uuid}) ระบุ SYSTEM_BOT เหมือนแอป
 *
 * วิธีใช้:
 *   node scripts/fixJobPrices.mjs                       # DRY RUN ทั้งหมด
 *   node scripts/fixJobPrices.mjs --only=JRS-2026-0005  # ดู/แก้เฉพาะใบ (ลองทีละใบ)
 *   node scripts/fixJobPrices.mjs --only=JRS-2026-0005 --apply   # เขียนจริง 1 ใบ
 *   node scripts/fixJobPrices.mjs --apply               # เขียนจริงทั้งหมด (ยกเว้นใบที่ล็อก)
 *   node scripts/fixJobPrices.mjs --apply --include-locked       # รวมใบที่ล็อกด้วย
 */

import { randomUUID } from 'node:crypto';

const DB_URL =
  process.env.RTDB_URL ||
  'https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app';

const APPLY = process.argv.includes('--apply');
const INCLUDE_LOCKED = process.argv.includes('--include-locked');
const ONLY = (process.argv.find((a) => a.startsWith('--only=')) || '').replace('--only=', '');
const ONLY_IDS = ONLY ? ONLY.split(',').map((s) => s.trim()).filter(Boolean) : null;
const TOLERANCE = 0.5;

const norm = (v) => (v ?? '').toString().trim();
const baht = (n) => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });

async function getNode(path) {
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`อ่าน ${path} ไม่สำเร็จ: HTTP ${res.status}`);
  return (await res.json()) || {};
}

async function patchNode(path, body) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`เขียน ${path} ไม่สำเร็จ: HTTP ${res.status} ${await res.text()}`);
}

async function putNode(path, body) {
  const res = await fetch(`${DB_URL}/${path}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`เขียน ${path} ไม่สำเร็จ: HTTP ${res.status} ${await res.text()}`);
}

function expectedCost(row, dropCount) {
  return (row.basePrice || 0) + dropCount * (row.dropOffFee || 0);
}

async function main() {
  console.log(`\n${APPLY ? '🔴 APPLY MODE — จะเขียนข้อมูลจริง' : '🟢 DRY RUN — แสดงอย่างเดียว ไม่เขียน DB'}`);
  console.log(`📡 ${DB_URL}\n`);

  const [jobsObj, matrixObj] = await Promise.all([getNode('jobs'), getNode('priceMatrix')]);
  const jobs = Object.values(jobsObj);
  const matrix = Object.values(matrixObj);

  const planned = [];
  const skippedLocked = [];

  for (const job of jobs) {
    if (ONLY_IDS && !ONLY_IDS.includes(job.id)) continue;
    if (job.isSpotRate) continue;
    const sub = norm(job.subcontractor);
    if (!sub || !(job.cost > 0)) continue;

    const dropCount = Array.isArray(job.drops) ? job.drops.length : 0;
    const myRow = matrix.find(
      (p) =>
        norm(p.origin) === norm(job.origin) &&
        norm(p.destination) === norm(job.destination) &&
        norm(p.truckType) === norm(job.truckType) &&
        norm(p.subcontractor) === sub,
    );
    if (!myRow) continue; // ไม่มีสัญญาของรถร่วมเจ้านี้ — ไม่แตะ (อยู่ในกลุ่ม NO_CONTRACT)

    const expect = expectedCost(myRow, dropCount);
    if (Math.abs((job.cost || 0) - expect) <= TOLERANCE) continue; // ตรงอยู่แล้ว

    if (job.isBaseCostLocked && !INCLUDE_LOCKED) {
      skippedLocked.push({ job, expect });
      continue;
    }
    planned.push({ job, expect, oldCost: job.cost || 0 });
  }

  // ---------- แสดงแผนการแก้ ----------
  const line = '─'.repeat(78);
  console.log(line);
  console.log(`จะแก้ ${planned.length} ใบ` + (skippedLocked.length ? ` | ข้ามเพราะล็อก ${skippedLocked.length} ใบ` : ''));
  console.log(line);

  for (const p of planned) {
    console.log(
      `  ${p.job.id} [${norm(p.job.status)}]  ฿${baht(p.oldCost)} → ฿${baht(p.expect)}  (${p.expect - p.oldCost > 0 ? '+' : ''}${baht(p.expect - p.oldCost)})  | ${norm(p.job.subcontractor)}`,
    );
  }
  if (skippedLocked.length && !INCLUDE_LOCKED) {
    console.log(`\n  🔒 ข้ามใบที่ล็อก (ใส่ --include-locked หากต้องการแก้):`);
    for (const s of skippedLocked) {
      console.log(`     ${s.job.id} [${norm(s.job.status)}]  ฿${baht(s.job.cost)} → ควรเป็น ฿${baht(s.expect)}`);
    }
  }

  if (!APPLY) {
    console.log(`\n${line}`);
    console.log(`🟢 DRY RUN จบ — ยังไม่ได้เขียนอะไร ใส่ --apply เพื่อเขียนจริง`);
    console.log(line + '\n');
    return;
  }

  // ---------- เขียนจริง ----------
  console.log(`\n✍️ กำลังเขียน...`);
  let ok = 0;
  for (const p of planned) {
    try {
      await patchNode(`jobs/${p.job.id}`, { cost: p.expect });
      const logId = randomUUID();
      await putNode(`logs/${logId}`, {
        id: logId,
        jobId: p.job.id,
        userId: 'SYSTEM_BOT',
        userName: 'System Price Correction',
        userRole: 'ADMIN',
        timestamp: new Date().toISOString(),
        field: 'Cost (Price)',
        oldValue: String(p.oldCost),
        newValue: String(p.expect),
        reason: 'แก้ราคาให้ตรงกับรถร่วมที่จัดจริง (Price remediation — wrong-subcontractor pull)',
      });
      ok++;
      console.log(`  ✅ ${p.job.id}  ฿${baht(p.oldCost)} → ฿${baht(p.expect)}`);
    } catch (e) {
      console.log(`  ❌ ${p.job.id}  ล้มเหลว: ${e.message}`);
    }
  }
  console.log(`\n${line}`);
  console.log(`เขียนสำเร็จ ${ok}/${planned.length} ใบ`);
  console.log(line + '\n');
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});
