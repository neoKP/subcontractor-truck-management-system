/**
 * Migrate Base64 drop-POD images -> NAS storage
 * --------------------------------------------------------------------------
 * Legacy jobs embed per-drop POD images as Base64 data URIs in drops[].podUrl.
 * ~57 jobs do this and bloat the /jobs payload (24.8MB). This script uploads each
 * Base64 image to the same NAS the app uses (upload.php) and replaces podUrl with
 * the returned URL — bringing the full /jobs load from ~27MB down to ~1.8MB.
 *
 * 🔒 Safe by default:
 *   - DRY RUN unless --apply
 *   - Per drop: upload FIRST, only replace podUrl if upload returns a URL
 *     (Base64 is kept on any failure → no image is ever lost)
 *   - Writes back only the `drops` field of each job
 *
 *   node scripts/migrateDropPodImages.mjs            # dry run
 *   node scripts/migrateDropPodImages.mjs --apply    # upload + rewrite
 */

const DB_URL =
  process.env.RTDB_URL ||
  'https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app';
const NAS_BASE = process.env.NAS_BASE || 'https://neosiam.dscloud.biz/api';
const NAS_API_KEY = process.env.NAS_API_KEY || 'NAS_UPLOAD_KEY_sansan856';

const APPLY = process.argv.includes('--apply');
const isData = (v) => typeof v === 'string' && v.startsWith('data:');
const mb = (n) => (n / 1024 / 1024).toFixed(2);

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

function parseDataUri(uri) {
  const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  const mime = m[1] || 'image/webp';
  const ext = (mime.split('/')[1] || 'webp').replace('+xml', '');
  const buf = m[2] ? Buffer.from(m[3], 'base64') : Buffer.from(decodeURIComponent(m[3]));
  return { mime, ext, buf };
}

async function uploadToNAS(buf, mime, path) {
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: mime }), path.split('/').pop());
  fd.append('path', path);
  const res = await fetch(`${NAS_BASE}/upload.php`, {
    method: 'POST',
    headers: { 'X-API-Key': NAS_API_KEY },
    body: fd,
  });
  const text = await res.text();
  let r;
  try { r = JSON.parse(text); } catch { throw new Error(`invalid JSON: ${text.slice(0, 150)}`); }
  if (!res.ok || !r?.success || !r?.url) throw new Error(`upload failed: ${r?.error || res.status}`);
  return r.url;
}

async function main() {
  console.log(`\n${APPLY ? '🔴 APPLY — อัปโหลด + เขียนจริง' : '🟢 DRY RUN — แสดงอย่างเดียว'}`);
  console.log(`📡 DB:  ${DB_URL}\n📦 NAS: ${NAS_BASE}\n`);

  const jobs = Object.values(await getNode('jobs'));
  const targets = jobs.filter((j) => Array.isArray(j.drops) && j.drops.some((d) => d && isData(d.podUrl)));

  let totalImgs = 0, totalBytes = 0;
  for (const j of targets)
    for (const d of j.drops)
      if (d && isData(d.podUrl)) { totalImgs++; totalBytes += d.podUrl.length; }

  const line = '─'.repeat(70);
  console.log(line);
  console.log(`งานที่ต้อง migrate: ${targets.length} ใบ | รูป Base64 ใน drops: ${totalImgs} รูป | ~${mb(totalBytes)} MB`);
  console.log(line);
  for (const j of targets) {
    const n = j.drops.filter((d) => d && isData(d.podUrl)).length;
    console.log(`  ${j.id} [${j.status}] — ${n} รูป / ${j.drops.length} จุดส่ง`);
  }

  if (!APPLY) {
    console.log(`\n🟢 DRY RUN จบ — ใส่ --apply เพื่ออัปโหลดจริง\n`);
    return;
  }

  console.log(`\n✍️ เริ่ม migrate...`);
  let okJobs = 0, okImgs = 0, failImgs = 0;
  for (const job of targets) {
    let changed = false;
    const drops = job.drops.map((d) => ({ ...d }));
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      if (!d || !isData(d.podUrl)) continue;
      const parsed = parseDataUri(d.podUrl);
      if (!parsed) { console.log(`  ⚠️ ${job.id} drop ${i}: parse ไม่ได้ ข้าม`); failImgs++; continue; }
      const path = `pod-images/${job.id}/drop_${i}_${Date.now()}.${parsed.ext}`;
      try {
        const url = await uploadToNAS(parsed.buf, parsed.mime, path);
        drops[i].podUrl = url; // แทนเฉพาะเมื่ออัปโหลดสำเร็จ
        changed = true; okImgs++;
      } catch (e) {
        console.log(`  ❌ ${job.id} drop ${i}: ${e.message} (คง Base64 ไว้)`);
        failImgs++;
      }
    }
    if (changed) {
      try {
        await patchNode(`jobs/${job.id}`, { drops });
        okJobs++;
        console.log(`  ✅ ${job.id}`);
      } catch (e) {
        console.log(`  ❌ ${job.id} เขียน DB ไม่สำเร็จ: ${e.message}`);
      }
    }
  }
  console.log(`\n${line}`);
  console.log(`เสร็จ: ${okJobs} ใบ | รูปอัปโหลดสำเร็จ ${okImgs} | ล้มเหลว ${failImgs}`);
  console.log(line + '\n');
}

main().catch((err) => { console.error('เกิดข้อผิดพลาด:', err.message); process.exit(1); });
