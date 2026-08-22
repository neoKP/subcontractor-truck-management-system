/**
 * ซ่อมใบแจ้งหนี้รถร่วมที่ออกก่อนมีการผูกใบงาน
 * --------------------------------------------------------------------------
 * ใบแจ้งหนี้ 4 ใบแรกถูกออกตอนที่ระบบยังไม่ผูกใบงานกับใบแจ้งหนี้ ทำให้เกิดสองปัญหา:
 *
 *   1. ใบงานยังอยู่สถานะ "รอวางบิล" ทั้งที่ออกใบไปแล้ว (2 ใบจ่ายเงินไปแล้วด้วย)
 *      จึงยังโผล่ให้ออกใบซ้ำและจ่ายซ้ำได้ — นี่คือความเสี่ยงเรื่องเงินที่แท้จริง
 *
 *   2. ยอดในใบถูกบันทึกผิด เพราะตอนนั้นยังไม่มีตัวคำนวณกลาง (utils/invoiceMath.ts)
 *      INV-2026-0001 เก็บยอดรวม 0 / หัก 0 ทั้งที่งานจริง 18,500 และหัก ณ ที่จ่าย 185
 *      INV-2026-0004 เก็บยอดรวม 0 จึงได้ยอดสุทธิ -35
 *
 * สำคัญ: เงินที่จ่ายออกไปจริง "ถูกต้องแล้วทั้งสองใบ"
 *   INV-2026-0001 จ่าย 18,315 = 18,500 - 185 (หัก ณ ที่จ่าย 1%)  ถูกต้อง
 *   INV-2026-0004 จ่าย 3,465  = 3,500 - 35   (หัก ณ ที่จ่าย 1%)  ถูกต้อง
 * สคริปต์นี้จึงแก้ "ตัวเลขที่บันทึกไว้ให้ตรงกับเงินที่จ่ายจริง" ไม่ได้แตะยอดเงิน
 * และไม่สร้างรายการจ่ายใหม่
 *
 * สิ่งที่ทำ:
 *   - ใบแจ้งหนี้: เติม totalAmount / netAmount จากยอดงานจริง (ไม่แตะ paidAmount)
 *   - ใบงาน: เติม subcontractorInvoiceId, billingDocNo, billingDate, status = Billed
 *   - ใบงานในใบที่จ่ายแล้ว: เติม accountingStatus = Paid, paymentDate
 *   - เขียน Audit Log ทุกครั้ง
 *
 * ตรวจก่อนแก้: ถ้ายอดสุทธิที่คำนวณได้ไม่ตรงกับเงินที่จ่ายจริง จะข้ามใบนั้นและเตือน
 * เพราะแปลว่าสมมติฐานข้างต้นไม่จริงสำหรับใบนั้น ต้องให้คนตัดสินใจ
 *
 * DRY RUN เป็นค่าเริ่มต้น (แสดงอย่างเดียว ไม่เขียน DB)
 *   node scripts/repairInvoiceLinks.mjs            # ดูว่าจะแก้อะไรบ้าง
 *   node scripts/repairInvoiceLinks.mjs --apply    # เขียนจริง + Audit Log
 */

import { randomUUID } from 'node:crypto';

const DB_URL =
  process.env.RTDB_URL ||
  'https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app';

const APPLY = process.argv.includes('--apply');

/**
 * ใบที่อนุญาตให้ซ่อมเท่านั้น — สคริปต์นี้เป็นการซ่อมครั้งเดียวสำหรับใบชุดแรก
 * ที่ออกก่อนระบบผูกใบงาน ไม่ใช่เครื่องมือซ่อมทั่วไป
 *
 * ถ้าปล่อยให้วนซ่อมทุกใบ การรันในอนาคตจะเขียนทับใบที่ถูกต้องอยู่แล้ว เช่น ใบที่
 * ต้นทุนงานถูกแก้หลังวางบิล จะถูกดึงกลับมาเป็นยอดวันนี้ทั้งที่เอกสารส่งไปแล้ว
 *
 * ส่งชื่อใบเพิ่มทาง --only=INV-2026-0009,INV-2026-0010 ได้ถ้าจำเป็น
 */
const DEFAULT_ALLOWLIST = ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003', 'INV-2026-0004'];
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const ALLOWLIST = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : DEFAULT_ALLOWLIST;

/**
 * โทเคนสำหรับเรียก REST — ต้องใช้เมื่อกฎฐานข้อมูลบังคับ auth แล้ว
 * (database.rules.json กำหนด "auth != null" สำหรับ invoices/jobs/logs)
 *
 *   FIREBASE_TOKEN=<idToken หรือ database secret> node scripts/repairInvoiceLinks.mjs
 *
 * ไม่ใส่ค่านี้ในโค้ดเด็ดขาด — อ่านจาก environment เท่านั้น
 */
const AUTH_TOKEN = process.env.FIREBASE_TOKEN || process.env.RTDB_AUTH || '';
const authQuery = AUTH_TOKEN ? `?auth=${encodeURIComponent(AUTH_TOKEN)}` : '';

const JOB_STATUS_BILLED = 'Billed';
const ACC_STATUS_PAID = 'Paid';
const INVOICE_PAID = 'PAID';

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

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

async function writeLog(jobId, field, oldValue, newValue, reason) {
  const logId = randomUUID();
  await putNode(`logs/${logId}`, {
    id: logId,
    jobId,
    userId: 'SYSTEM_BOT',
    userName: 'Invoice Link Repair',
    userRole: 'ADMIN',
    timestamp: new Date().toISOString(),
    field,
    oldValue: String(oldValue ?? '-'),
    newValue: String(newValue ?? '-'),
    reason,
  });
}

async function main() {
  console.log(`\n${APPLY ? 'APPLY MODE — จะเขียนข้อมูลจริง' : 'DRY RUN — แสดงอย่างเดียว ไม่เขียน DB'}`);
  console.log(`${DB_URL}\n`);

  console.log(`ขอบเขตที่จะซ่อม: ${ALLOWLIST.join(', ')}`);
  console.log(`โทเคน: ${AUTH_TOKEN ? 'มี (อ่านจาก environment)' : 'ไม่มี — ใช้ได้เฉพาะตอนที่กฎยังเปิดให้เขียนโดยไม่ต้องล็อกอิน'}`);
  console.log('');

  const [invoicesObj, jobsObj] = await Promise.all([getNode('invoices'), getNode('jobs')]);
  const line = '-'.repeat(78);

  const plans = [];
  const skipped = [];

  for (const [invKey, inv] of Object.entries(invoicesObj)) {
    // ซ่อมเฉพาะใบที่ระบุไว้ — กันไม่ให้การรันในอนาคตไปแตะใบที่ถูกต้องอยู่แล้ว
    if (!ALLOWLIST.includes(inv.invoiceNo)) continue;

    const jobIds = inv.jobIds || [];
    const jobs = jobIds.map((id) => ({ id, job: jobsObj[id] }));

    const missing = jobs.filter((x) => !x.job).map((x) => x.id);
    if (missing.length) {
      skipped.push({ inv, why: `ไม่พบใบงาน ${missing.join(', ')} ในระบบ` });
      continue;
    }

    const realTotal = r2(jobs.reduce((s, { job }) => s + (job.cost || 0) + (job.extraCharge || 0), 0));
    const deductions = r2((inv.deductions || []).reduce((s, d) => s + (Number(d.amount) || 0), 0));
    const realNet = r2(realTotal - deductions);
    const isPaid = inv.status === INVOICE_PAID;

    // ถ้าใบจ่ายไปแล้ว ยอดสุทธิที่คำนวณได้ต้องตรงกับเงินที่จ่ายจริง
    // ไม่ตรง = สมมติฐานไม่จริง ต้องให้คนดู ไม่ใช่ให้สคริปต์เดา
    if (isPaid && r2(inv.paidAmount) !== realNet) {
      skipped.push({
        inv,
        why: `ยอดสุทธิที่คำนวณได้ ${realNet} ไม่ตรงกับเงินที่จ่ายจริง ${r2(inv.paidAmount)} (ต่าง ${r2(inv.paidAmount - realNet)} บาท)`,
      });
      continue;
    }

    const invoiceChanges = {};
    if (r2(inv.totalAmount) !== realTotal) invoiceChanges.totalAmount = realTotal;
    if (r2(inv.netAmount) !== realNet) invoiceChanges.netAmount = realNet;

    const jobChanges = [];
    for (const { id, job } of jobs) {
      const change = {};
      if (job.subcontractorInvoiceId !== invKey) change.subcontractorInvoiceId = invKey;
      if (job.billingDocNo !== inv.invoiceNo) change.billingDocNo = inv.invoiceNo;
      if (!job.billingDate && inv.createdAt) change.billingDate = inv.createdAt;
      if (job.status !== JOB_STATUS_BILLED) change.status = JOB_STATUS_BILLED;
      if (isPaid) {
        if (job.accountingStatus !== ACC_STATUS_PAID) change.accountingStatus = ACC_STATUS_PAID;
        if (!job.paymentDate && inv.paidDate) change.paymentDate = inv.paidDate;
        if (!job.isBaseCostLocked) change.isBaseCostLocked = true;
      }
      if (Object.keys(change).length) jobChanges.push({ id, job, change });
    }

    if (Object.keys(invoiceChanges).length || jobChanges.length) {
      plans.push({ invKey, inv, realTotal, deductions, realNet, isPaid, invoiceChanges, jobChanges });
    }
  }

  console.log(line);
  console.log(`ใบแจ้งหนี้ที่ต้องซ่อม: ${plans.length} ใบ | ข้าม: ${skipped.length} ใบ`);
  console.log(line);

  for (const p of plans) {
    console.log(`\n[${p.inv.invoiceNo}]  สถานะ ${p.inv.status}  ผู้รับเหมา ${p.inv.subcontractor}`);
    console.log(`   ยอดงานจริง ${p.realTotal.toLocaleString()} - หัก ${p.deductions.toLocaleString()} = สุทธิ ${p.realNet.toLocaleString()}`);
    if (p.isPaid) {
      console.log(`   จ่ายไปแล้ว ${r2(p.inv.paidAmount).toLocaleString()} เมื่อ ${p.inv.paidDate} -> ตรงกับยอดสุทธิ (ไม่แตะยอดเงิน)`);
    }

    for (const [k, v] of Object.entries(p.invoiceChanges)) {
      console.log(`   ใบแจ้งหนี้: ${k}  ${p.inv[k]} -> ${v}`);
    }
    for (const { id, job, change } of p.jobChanges) {
      const parts = Object.entries(change).map(([k, v]) => `${k}: ${job[k] ?? '-'} -> ${v}`);
      console.log(`   ใบงาน ${id}: ${parts.join(' | ')}`);
    }
  }

  if (skipped.length) {
    console.log(`\n${line}`);
    console.log('ข้ามใบเหล่านี้ ต้องให้คนตรวจเอง:');
    for (const s of skipped) console.log(`   ${s.inv.invoiceNo}: ${s.why}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN จบ — ใส่ --apply เพื่อเขียนจริง\n`);
    return;
  }

  console.log(`\nกำลังเขียน...`);
  let okInv = 0;
  let okJob = 0;
  let fail = 0;

  for (const p of plans) {
    try {
      if (Object.keys(p.invoiceChanges).length) {
        await patchNode(`invoices/${p.invKey}`, p.invoiceChanges);
        console.log(`  OK ${p.inv.invoiceNo} (ใบแจ้งหนี้)`);
        okInv++;
      }
      for (const { id, job, change } of p.jobChanges) {
        await patchNode(`jobs/${id}`, change);
        await writeLog(
          id,
          'Invoice Link Repair',
          job.status,
          change.status || job.status,
          `ผูกกับใบแจ้งหนี้ ${p.inv.invoiceNo} ย้อนหลัง (ออกใบก่อนที่ระบบจะผูกใบงาน) — ไม่มีการเปลี่ยนแปลงยอดเงินที่จ่าย`
        );
        console.log(`  OK ${id} (ใบงาน)`);
        okJob++;
      }
    } catch (e) {
      console.log(`  FAIL ${p.inv.invoiceNo}: ${e.message}`);
      fail++;
    }
  }

  console.log(`\nเสร็จ — ใบแจ้งหนี้ ${okInv} ใบ, ใบงาน ${okJob} ใบ, ล้มเหลว ${fail}\n`);
}

main().catch((e) => {
  console.error('\nล้มเหลว:', e.message, '\n');
  process.exit(1);
});
