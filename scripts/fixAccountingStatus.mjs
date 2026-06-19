/**
 * Fix accountingStatus value inconsistency
 * --------------------------------------------------------------------------
 * บางงานเก็บ accountingStatus เป็น "PENDING_REVIEW" (key ของ enum) แทนค่าจริง
 * "Pending Review" (value) — สาเหตุจาก ReviewConfirmDashboard เคยเขียน
 * `'PENDING_REVIEW' as any`. งานเหล่านี้จะ "ล่องหน" จากคิวรอตรวจบัญชี เพราะตัวกรอง
 * เทียบ === 'Pending Review' แบบเป๊ะ
 *
 * สคริปต์นี้ normalize "PENDING_REVIEW" -> "Pending Review"
 *
 * 🔒 DRY RUN เป็นค่าเริ่มต้น (แสดงอย่างเดียว ไม่เขียน DB)
 *   node scripts/fixAccountingStatus.mjs            # ดูว่าจะแก้ใบไหนบ้าง
 *   node scripts/fixAccountingStatus.mjs --apply    # เขียนจริง + Audit Log
 */

import { randomUUID } from 'node:crypto';

const DB_URL =
  process.env.RTDB_URL ||
  'https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app';

const APPLY = process.argv.includes('--apply');
const BAD = 'PENDING_REVIEW';       // ค่าที่ผิด (enum key)
const GOOD = 'Pending Review';      // ค่าที่ถูก (enum value)

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

async function main() {
  console.log(`\n${APPLY ? '🔴 APPLY MODE — จะเขียนข้อมูลจริง' : '🟢 DRY RUN — แสดงอย่างเดียว ไม่เขียน DB'}`);
  console.log(`📡 ${DB_URL}\n`);

  const jobsObj = await getNode('jobs');
  const jobs = Object.values(jobsObj);
  const targets = jobs.filter((j) => j.accountingStatus === BAD);

  const line = '─'.repeat(70);
  console.log(line);
  console.log(`พบงานที่ accountingStatus = "${BAD}" (ผิด): ${targets.length} ใบ → จะแก้เป็น "${GOOD}"`);
  console.log(line);
  for (const j of targets) {
    console.log(`  ${j.id}  [${j.status}]  วันที่ ${j.dateOfService || '-'}  | ${(j.subcontractor || '').trim()}`);
  }

  if (!APPLY) {
    console.log(`\n🟢 DRY RUN จบ — ใส่ --apply เพื่อเขียนจริง\n`);
    return;
  }

  console.log(`\n✍️ กำลังเขียน...`);
  let ok = 0;
  for (const j of targets) {
    try {
      await patchNode(`jobs/${j.id}`, { accountingStatus: GOOD });
      const logId = randomUUID();
      await putNode(`logs/${logId}`, {
        id: logId,
        jobId: j.id,
        userId: 'SYSTEM_BOT',
        userName: 'System Status Normalize',
        userRole: 'ADMIN',
        timestamp: new Date().toISOString(),
        field: 'Accounting Status',
        oldValue: BAD,
        newValue: GOOD,
        reason: 'Normalize accountingStatus enum key -> value (job was hidden from review queue)',
      });
      ok++;
      console.log(`  ✅ ${j.id}`);
    } catch (e) {
      console.log(`  ❌ ${j.id}  ล้มเหลว: ${e.message}`);
    }
  }
  console.log(`\n${line}\nเขียนสำเร็จ ${ok}/${targets.length} ใบ\n${line}\n`);
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});
