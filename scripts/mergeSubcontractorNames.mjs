/**
 * รวมชื่อผู้รับเหมาที่สะกดต่างกันให้เหลือชื่อเดียว
 * --------------------------------------------------------------------------
 * ทะเบียนผู้รับเหมามีแค่ 1 รายจาก 36 ชื่อที่ใช้จริง ทุกหน้าจึงให้พิมพ์ชื่อเอง
 * ผลคือเจ้าเดียวกันถูกบันทึกหลายสะกด แล้วระบบมองเป็นคนละบริษัท:
 *
 *   - รายงานและวิเคราะห์กำไรแยกยอดเป็นหลายเจ้า
 *   - BillingView บล็อกไม่ให้วางบิลรวม (เช็ค subcontractor ต้องตรงกันเป๊ะ)
 *   - PaymentDashboard กรองงานด้วยชื่อตรง ๆ จึงเห็นงานไม่ครบ
 *
 * สคริปต์นี้รวมเฉพาะกลุ่มที่ "พิสูจน์แล้วว่าเป็นเจ้าเดียวกัน" ตามรายการ GROUPS
 * ด้านล่าง ไม่ใช่การเดาจากความคล้ายของชื่อ
 *
 * ที่ตั้งใจไม่รวม:
 *   - "นิวทำดี" / "นิวทำดี KTD" — เส้นทางเดียวกันแต่ราคาต่างกัน 420 บาท
 *     (13,440 vs 13,020) และงานจริงสลับใช้ทั้งสองราคา การรวมชื่อจะทำให้
 *     ราคาหนึ่งหายไปและงานถูกตั้งราคาผิด ต้องรอย้ายไปใช้ตารางเรทตามน้ำมันก่อน
 *   - "PTK" / "พีทีเคทรานสปอร์ต(พี่อ้อย)" — เส้นทางไม่ทับกันเลยสักเส้น
 *     PTK มีราคากลาง 46 แถวแต่ไม่มีใครวิ่งเส้นทางกลุ่มนั้นเลย ชื่อพ้องกันเฉย ๆ
 *
 * สิ่งที่แก้: jobs.subcontractor และ priceMatrix.subcontractor
 *
 * ไม่แก้ fuelRates โดยตั้งใจ — ข้อมูลนั้นคัดลอกมาจากไฟล์ที่หน่วยงานส่งมา ต้องตรง
 * กับต้นฉบับเสมอเพื่อให้ตรวจย้อนได้ การแปลงชื่อทำที่ utils/subcontractorAliases.ts
 * ซึ่งหน้าจอและตัวเทียบรุ่นเรียกใช้ตอนแสดงผล ทำให้ไฟล์รอบหน้าที่ยังใช้ชื่อเดิม
 * ยังจับคู่ได้เองโดยไม่ต้องรันสคริปต์ซ้ำ
 *
 * DRY RUN เป็นค่าเริ่มต้น (แสดงอย่างเดียว ไม่เขียน DB)
 *   node scripts/mergeSubcontractorNames.mjs            # ดูว่าจะแก้อะไรบ้าง
 *   node scripts/mergeSubcontractorNames.mjs --apply    # เขียนจริง + Audit Log
 */

import { randomUUID } from 'node:crypto';

const DB_URL =
  process.env.RTDB_URL ||
  'https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app';

const APPLY = process.argv.includes('--apply');

/**
 * โทเคนสำหรับเรียก REST — ต้องใช้เมื่อกฎฐานข้อมูลบังคับ auth แล้ว
 * ไม่ใส่ค่านี้ในโค้ดเด็ดขาด — อ่านจาก environment เท่านั้น
 */
const AUTH_TOKEN = process.env.FIREBASE_TOKEN || process.env.RTDB_AUTH || '';
const authQuery = AUTH_TOKEN ? `?auth=${encodeURIComponent(AUTH_TOKEN)}` : '';

/**
 * กลุ่มที่ยืนยันแล้วว่าเป็นเจ้าเดียวกัน
 *
 * canonical = ชื่อที่จะใช้ต่อไป เลือกจากชื่อที่ใช้มากที่สุดเพื่อให้แก้น้อยที่สุด
 * aliases   = ชื่อที่จะถูกเปลี่ยนเป็น canonical
 */
const GROUPS = [
  {
    canonical: 'รถร่วมคุณวสรรณ์',
    aliases: ['รถร่วมวสรรณ์', 'รถร่วมนายวสรรณ์', 'รถร่วมคุณหนึ่ง'],
    why: 'แก่นชื่อเดียวกัน ไม่มีเส้นทางชนกัน ผู้ใช้ยืนยันว่า "รถร่วมคุณหนึ่ง" คือเจ้าเดียวกัน',
  },
  {
    canonical: 'วิวัฒน์ทรานส์',
    aliases: ['วิวัฒน์ทราน'],
    why: 'เส้นทางเดียวกัน รถแบบเดียวกัน ราคาเท่ากันเป๊ะ (18,500) — พิมพ์ตก "ส์"',
  },
];

/** ชื่อเดิม -> ชื่อใหม่ */
const RENAME = new Map();
for (const g of GROUPS) {
  for (const a of g.aliases) RENAME.set(a, g.canonical);
}

const n = (s) => (s || '').trim();

async function getNode(path) {
  const res = await fetch(`${DB_URL}/${path}.json${authQuery}`);
  if (!res.ok) throw new Error(`อ่าน ${path} ไม่สำเร็จ: HTTP ${res.status}`);
  return (await res.json()) || {};
}

async function patchNode(path, body) {
  const res = await fetch(`${DB_URL}/${path}.json${authQuery}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`เขียน ${path} ไม่สำเร็จ: HTTP ${res.status} ${await res.text()}`);
}

async function putNode(path, body) {
  const res = await fetch(`${DB_URL}/${path}.json${authQuery}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`เขียน ${path} ไม่สำเร็จ: HTTP ${res.status} ${await res.text()}`);
}

async function writeLog(jobId, oldValue, newValue) {
  const logId = randomUUID();
  await putNode(`logs/${logId}`, {
    id: logId,
    jobId,
    userId: 'SYSTEM_BOT',
    userName: 'Subcontractor Name Merge',
    userRole: 'ADMIN',
    timestamp: new Date().toISOString(),
    field: 'Subcontractor',
    oldValue,
    newValue,
    reason: 'รวมชื่อผู้รับเหมาที่สะกดต่างกันให้เป็นชื่อเดียว — ไม่มีการเปลี่ยนแปลงต้นทุนหรือยอดเงิน',
  });
}

async function main() {
  console.log(`\n${APPLY ? 'APPLY MODE — จะเขียนข้อมูลจริง' : 'DRY RUN — แสดงอย่างเดียว ไม่เขียน DB'}`);
  console.log(`${DB_URL}`);
  console.log(`โทเคน: ${AUTH_TOKEN ? 'มี (อ่านจาก environment)' : 'ไม่มี — ใช้ได้เฉพาะตอนที่กฎยังเปิดให้เขียนโดยไม่ต้องล็อกอิน'}`);
  console.log('');

  const [jobsObj, pmObj] = await Promise.all([getNode('jobs'), getNode('priceMatrix')]);

  const line = '-'.repeat(78);
  console.log(line);
  for (const g of GROUPS) {
    console.log(`[${g.canonical}]  <-  ${g.aliases.join(', ')}`);
    console.log(`   เหตุผล: ${g.why}`);
  }
  console.log(line);

  // ---- ใบงาน ----
  //
  // งานที่วางบิลหรือจ่ายเงินไปแล้ว ชื่อผู้รับเหมาถูกพิมพ์ลงเอกสารที่ส่งออกไปแล้ว
  // เปลี่ยนชื่อในระบบจะทำให้ไม่ตรงกับเอกสาร — ต้องให้คนตัดสิน ไม่ใช่แก้เงียบ ๆ
  const isLocked = (job) =>
    job.status === 'Billed' ||
    job.accountingStatus === 'Paid' ||
    Boolean(job.billingDocNo) ||
    Boolean(job.subcontractorInvoiceId);

  const candidates = [];
  for (const [key, job] of Object.entries(jobsObj)) {
    const to = RENAME.get(n(job.subcontractor));
    if (to) candidates.push({ key, job, from: n(job.subcontractor), to });
  }

  /**
   * ชื่อที่มีใบงานล็อกอยู่แม้ใบเดียว ต้องพักทั้งชื่อ
   *
   * ทุกหน้าจับคู่ใบงานกับราคากลางด้วยชื่อผู้รับเหมาแบบตรงตัว (App.tsx,
   * InvoicePreviewModal, AccountingVerificationView) การเปลี่ยนชื่อจึงต้องขยับ
   * "ทั้งชุด" พร้อมกัน — ใบงานทุกใบของชื่อนั้นและราคากลางทุกแถวของชื่อนั้น
   *
   * ถ้าขยับแค่บางส่วน ฝั่งที่ถูกทิ้งไว้จะหาอีกฝั่งไม่เจอ แล้วตกไปใช้ค่าเริ่มต้น
   * เงียบ ๆ — วิธีจ่ายเงินและค่าจุดส่งเพิ่มหายไปโดยไม่มีอะไรเตือน
   */
  const heldBack = new Set(candidates.filter((c) => isLocked(c.job)).map((c) => c.from));

  const jobPlans = candidates.filter((c) => !heldBack.has(c.from));
  const blocked = candidates.filter((c) => heldBack.has(c.from));

  // ---- ราคากลาง ----
  // ใช้ heldBack ชุดเดียวกับใบงาน เพื่อให้ทั้งสองฝั่งขยับพร้อมกันเสมอ
  const pmPlans = [];
  const pmHeld = [];
  for (const [key, row] of Object.entries(pmObj)) {
    const from = n(row.subcontractor);
    const to = RENAME.get(from);
    if (!to) continue;
    if (heldBack.has(from)) pmHeld.push({ key, row, from, to });
    else pmPlans.push({ key, row, from, to });
  }

  console.log(`\nใบงานที่จะเปลี่ยนชื่อ: ${jobPlans.length} ใบ`);
  const byPair = {};
  for (const p of jobPlans) {
    const k = `${p.from} -> ${p.to}`;
    byPair[k] = (byPair[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byPair)) console.log(`   ${k} : ${v} ใบ`);

  console.log(`\nราคากลางที่จะเปลี่ยนชื่อ: ${pmPlans.length} แถว`);
  const byPairPm = {};
  for (const p of pmPlans) {
    const k = `${p.from} -> ${p.to}`;
    byPairPm[k] = (byPairPm[k] || 0) + 1;
  }
  for (const [k, v] of Object.entries(byPairPm)) console.log(`   ${k} : ${v} แถว`);

  console.log(`\nตารางเรทค่าขนส่ง: ไม่แก้ (เก็บตามไฟล์ต้นฉบับ — แปลงชื่อตอนแสดงผลผ่าน utils/subcontractorAliases.ts)`);

  if (heldBack.size) {
    console.log(`\n${line}`);
    console.log(`พักไว้ทั้งชุด ${heldBack.size} ชื่อ: ${[...heldBack].join(', ')}`);
    console.log(`เพราะมีใบงานที่วางบิล/จ่ายเงินไปแล้วใช้ชื่อนี้อยู่ — ชื่อถูกพิมพ์ลงเอกสารที่ส่งออกไปแล้ว`);
    console.log(`ต้องเปลี่ยนพร้อมกันทั้งชื่อ (ใบงานทุกใบ + ราคากลางทุกแถว) ไม่งั้นฝั่งที่เหลือจะหาอีกฝั่งไม่เจอ`);
    console.log(`\n   ใบงานที่พักไว้ ${blocked.length} ใบ:`);
    for (const b of blocked) {
      const lock = isLocked(b.job) ? 'ล็อก' : 'ไม่ล็อก แต่ชื่อเดียวกัน';
      console.log(`     ${b.job.id} | ${b.from} -> ${b.to} | ${b.job.status} | ${lock} | ใบวางบิล ${b.job.billingDocNo || '-'}`);
    }
    if (pmHeld.length) {
      console.log(`   ราคากลางที่พักไว้ ${pmHeld.length} แถว`);
    }
  }

  if (!jobPlans.length && !pmPlans.length) {
    console.log(`\nไม่มีอะไรต้องแก้ — รวมชื่อไปเรียบร้อยแล้ว\n`);
    return;
  }

  if (!APPLY) {
    console.log(`\nDRY RUN จบ — ใส่ --apply เพื่อเขียนจริง\n`);
    return;
  }

  console.log(`\nกำลังเขียน...`);
  let okJob = 0;
  let okPm = 0;
  let fail = 0;

  for (const p of jobPlans) {
    try {
      await patchNode(`jobs/${p.key}`, { subcontractor: p.to });
      await writeLog(p.job.id || p.key, p.from, p.to);
      okJob++;
      console.log(`  OK ${p.job.id || p.key} (ใบงาน)`);
    } catch (e) {
      console.log(`  FAIL ${p.job.id || p.key}: ${e.message}`);
      fail++;
    }
  }

  for (const p of pmPlans) {
    try {
      await patchNode(`priceMatrix/${p.key}`, { subcontractor: p.to });
      okPm++;
    } catch (e) {
      console.log(`  FAIL ราคากลาง ${p.key}: ${e.message}`);
      fail++;
    }
  }
  if (okPm) console.log(`  OK ราคากลาง ${okPm} แถว`);

  console.log(`\nเสร็จ — ใบงาน ${okJob} ใบ, ราคากลาง ${okPm} แถว, ล้มเหลว ${fail}\n`);
}

main().catch((e) => {
  console.error('\nล้มเหลว:', e.message, '\n');
  process.exit(1);
});
