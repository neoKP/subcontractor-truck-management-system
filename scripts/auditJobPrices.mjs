/**
 * Audit Job Prices
 * --------------------------------------------------------------------------
 * ตรวจสอบงานทั้งหมดว่า "ราคาต้นทุนที่บันทึกไว้ (job.cost)" ตรงกับราคาของ
 * "บริษัทรถร่วมที่จัดจริง (job.subcontractor)" ในตารางราคากลาง (priceMatrix) หรือไม่
 *
 * สาเหตุของบั๊ก: เส้นทาง+ประเภทรถเดียวกันมีรถร่วมหลายเจ้าคนละราคา ระบบเดิมเคย
 * ดึงราคาด้วย .find() ตามเส้นทางอย่างเดียว (ไม่ดูรถร่วม) ทำให้ราคาที่บันทึก
 * อาจเป็นของรถร่วมอีกเจ้าได้ เช่น 27,000 (เบญจวรรณ) แทน 12,000 (ธนโชค)
 *
 * วิธีรัน:
 *   node scripts/auditJobPrices.mjs              # รายงานบนหน้าจอ
 *   node scripts/auditJobPrices.mjs --csv        # เขียนไฟล์ price-audit.csv ด้วย
 *
 * อ่านอย่างเดียว (read-only) ไม่แก้ไขข้อมูลใน Firebase
 */

import fs from 'node:fs';

const DB_URL =
  process.env.RTDB_URL ||
  'https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app';

const WRITE_CSV = process.argv.includes('--csv');
const TOLERANCE = 0.5; // บาท — กันความคลาดเคลื่อนทศนิยม

const norm = (v) => (v ?? '').toString().trim();
const baht = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

async function fetchNode(path) {
  const res = await fetch(`${DB_URL}/${path}.json`);
  if (!res.ok) throw new Error(`อ่าน ${path} ไม่สำเร็จ: HTTP ${res.status}`);
  const data = await res.json();
  return data || {};
}

// คืนแถวราคาทั้งหมดของเส้นทาง+รถ (ทุกรถร่วม) เรียงราคาถูก->แพง
function rowsForRoute(matrix, job) {
  return matrix
    .filter(
      (p) =>
        norm(p.origin) === norm(job.origin) &&
        norm(p.destination) === norm(job.destination) &&
        norm(p.truckType) === norm(job.truckType),
    )
    .sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
}

function expectedCost(row, dropCount) {
  return (row.basePrice || 0) + dropCount * (row.dropOffFee || 0);
}

async function main() {
  console.log(`\n📡 กำลังดึงข้อมูลจาก: ${DB_URL}\n`);

  const [jobsObj, matrixObj] = await Promise.all([fetchNode('jobs'), fetchNode('priceMatrix')]);

  const jobs = Object.values(jobsObj);
  const matrix = Object.values(matrixObj);

  console.log(`พบงานทั้งหมด ${jobs.length} ใบ | ราคากลาง ${matrix.length} แถว\n`);

  const mismatches = []; // ราคาผิด (มีสัญญาของรถร่วมเจ้านั้น แต่ cost ไม่ตรง)
  const manualPrice = []; // ตั้งใจกรอกราคาเอง — ไม่มีราคากลางของเจ้านั้นในเส้นทางนี้ (ปกติ ไม่ใช่ปัญหา)
  const skipped = { spot: 0, noSub: 0, noCost: 0 };

  for (const job of jobs) {
    const sub = norm(job.subcontractor);

    if (job.isSpotRate) { skipped.spot++; continue; }       // Spot Rate กำหนดราคาเอง
    if (!sub) { skipped.noSub++; continue; }                 // ยังไม่จัดรถร่วม
    if (!(job.cost > 0)) { skipped.noCost++; continue; }     // ยังไม่มีราคา

    const dropCount = Array.isArray(job.drops) ? job.drops.length : 0;
    const routeRows = rowsForRoute(matrix, job);
    const myRow = routeRows.find((p) => norm(p.subcontractor) === sub);

    if (!myRow) {
      manualPrice.push({ job, routeRows });
      continue;
    }

    const expect = expectedCost(myRow, dropCount);
    const diff = (job.cost || 0) - expect;

    if (Math.abs(diff) > TOLERANCE) {
      // cost ที่บันทึก ตรงกับราคาของรถร่วมเจ้าอื่นในเส้นทางนี้หรือไม่?
      const matchedOther = routeRows.find(
        (p) => norm(p.subcontractor) !== sub && Math.abs(expectedCost(p, dropCount) - (job.cost || 0)) <= TOLERANCE,
      );
      mismatches.push({ job, myRow, expect, diff, matchedOther, dropCount });
    }
  }

  // ---------- รายงาน ----------
  const line = '─'.repeat(78);

  console.log(line);
  console.log(`❌ งานที่ราคาเพี้ยน (cost ไม่ตรงราคาของรถร่วมที่จัดจริง): ${mismatches.length} ใบ`);
  console.log(line);
  for (const m of mismatches) {
    const j = m.job;
    console.log(`\n  • ${j.id}  [${norm(j.status)}]`);
    console.log(`    เส้นทาง : ${norm(j.origin)} → ${norm(j.destination)} | ${norm(j.truckType)} | จุดส่ง ${m.dropCount}`);
    console.log(`    รถร่วม  : ${norm(j.subcontractor)}`);
    console.log(`    cost ที่บันทึก : ฿${baht(j.cost)}`);
    console.log(`    cost ที่ควรเป็น: ฿${baht(m.expect)}  (ส่วนต่าง ${m.diff > 0 ? '+' : ''}${baht(m.diff)})`);
    if (m.matchedOther) {
      console.log(`    ⚠️ ราคาที่บันทึกตรงกับของ "${norm(m.matchedOther.subcontractor)}" (฿${baht(expectedCost(m.matchedOther, m.dropCount))}) — น่าจะดึงผิดเจ้า`);
    }
  }
  if (mismatches.length === 0) console.log('  — ไม่พบ —');

  console.log(`\n${line}`);
  console.log(`ℹ️ ราคากรอกเอง (ตั้งใจ — ไม่มีราคากลางของเจ้านั้นในเส้นทางนี้ ถือว่าปกติ): ${manualPrice.length} ใบ`);
  console.log(line);
  for (const n of manualPrice) {
    const j = n.job;
    const others = n.routeRows.map((p) => `${norm(p.subcontractor)} ฿${baht(p.basePrice)}`).join(', ') || '— ไม่มีราคากลางเส้นทางนี้เลย —';
    console.log(`\n  • ${j.id}  [${norm(j.status)}]  cost=฿${baht(j.cost)}`);
    console.log(`    ${norm(j.origin)} → ${norm(j.destination)} | ${norm(j.truckType)} | รถร่วม: ${norm(j.subcontractor)}`);
    console.log(`    รถร่วมอื่นที่มีราคากลางในเส้นทางนี้: ${others}`);
  }
  if (manualPrice.length === 0) console.log('  — ไม่พบ —');

  console.log(`\n${line}`);
  console.log('สรุป (SUMMARY)');
  console.log(line);
  console.log(`  งานทั้งหมด            : ${jobs.length}`);
  console.log(`  ❌ ราคาเพี้ยน         : ${mismatches.length}`);
  console.log(`  ℹ️ ราคากรอกเอง (ปกติ) : ${manualPrice.length}`);
  console.log(`  ข้าม (Spot Rate)      : ${skipped.spot}`);
  console.log(`  ข้าม (ยังไม่จัดรถ)    : ${skipped.noSub}`);
  console.log(`  ข้าม (ยังไม่มีราคา)   : ${skipped.noCost}`);
  console.log(line + '\n');

  if (WRITE_CSV) {
    const rows = [
      ['JobID', 'Status', 'Origin', 'Destination', 'TruckType', 'Drops', 'Subcontractor', 'StoredCost', 'ExpectedCost', 'Diff', 'MatchedOtherSub', 'Issue'],
      ...mismatches.map((m) => [
        m.job.id, norm(m.job.status), norm(m.job.origin), norm(m.job.destination), norm(m.job.truckType),
        m.dropCount, norm(m.job.subcontractor), m.job.cost || 0, m.expect, m.diff,
        m.matchedOther ? norm(m.matchedOther.subcontractor) : '', 'PRICE_MISMATCH',
      ]),
      ...manualPrice.map((n) => [
        n.job.id, norm(n.job.status), norm(n.job.origin), norm(n.job.destination), norm(n.job.truckType),
        Array.isArray(n.job.drops) ? n.job.drops.length : 0, norm(n.job.subcontractor), n.job.cost || 0, '', '', '', 'MANUAL_PRICE_INTENTIONAL',
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    fs.writeFileSync('price-audit.csv', '﻿' + csv, 'utf8'); // BOM ให้ Excel อ่านภาษาไทยถูก
    console.log('💾 เขียนไฟล์ price-audit.csv เรียบร้อย\n');
  }
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาด:', err.message);
  process.exit(1);
});
