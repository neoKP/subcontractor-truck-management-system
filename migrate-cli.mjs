#!/usr/bin/env node
/**
 * Firebase Storage → NAS Migration CLI
 * รันบนเครื่อง: node migrate-cli.mjs
 * 
 * ไม่มีปัญหา CORS เพราะรันจาก Node.js ไม่ใช่บราวเซอร์
 */

const DB_URL = 'https://subtruckmanagementsystem-default-rtdb.asia-southeast1.firebasedatabase.app';
const NAS_UPLOAD_URL = 'https://neosiam.dscloud.biz/api/upload.php';
// อ่านจาก environment เท่านั้น ไม่ฝังคีย์ในโค้ด (repo นี้เป็น public)
// รันแบบ: NAS_API_KEY=<คีย์> node migrate-cli.mjs
const NAS_API_KEY = process.env.NAS_API_KEY || '';
if (!NAS_API_KEY) {
    console.error('ต้องตั้ง NAS_API_KEY ก่อน เช่น  NAS_API_KEY=<คีย์> node migrate-cli.mjs');
    process.exit(1);
}

const isFirebaseUrl = (url) => typeof url === 'string' && url.includes('firebasestorage.googleapis.com');
const isNASUrl = (url) => typeof url === 'string' && url.includes('neosiam.dscloud.biz');

let stats = { images: 0, slips: 0, errors: 0, skipped: 0 };

async function downloadFromFirebase(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    return await res.blob();
}

async function uploadToNAS(blob, path) {
    const formData = new FormData();
    formData.append('file', blob, path.split('/').pop() || 'file');
    formData.append('path', path);

    const res = await fetch(NAS_UPLOAD_URL, {
        method: 'POST',
        headers: { 'X-API-Key': NAS_API_KEY },
        body: formData,
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`NAS upload failed: ${res.status} - ${err}`);
    }

    const result = await res.json();
    if (!result.success || !result.url) throw new Error(`NAS: ${JSON.stringify(result)}`);
    return result.url;
}

async function migrateUrl(firebaseUrl, nasPath) {
    const blob = await downloadFromFirebase(firebaseUrl);
    const nasUrl = await uploadToNAS(blob, nasPath);
    return nasUrl;
}

async function dbRead(path) {
    const res = await fetch(`${DB_URL}/${path}.json`);
    if (!res.ok) throw new Error(`DB read failed: ${res.status}`);
    return await res.json();
}

async function dbUpdate(path, data) {
    const res = await fetch(`${DB_URL}/${path}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`DB update failed: ${res.status}`);
}

async function main() {
    console.log('🔄 Firebase Storage → NAS Migration');
    console.log('====================================\n');

    // ===== STEP 1: Jobs =====
    console.log('📦 Reading jobs from Firebase DB...');
    const jobs = await dbRead('jobs');
    if (!jobs) { console.log('No jobs found.'); return; }

    const jobEntries = Object.entries(jobs);
    console.log(`Found ${jobEntries.length} jobs\n`);

    for (const [jobKey, job] of jobEntries) {
        // POD images
        if (job.podImageUrls && Array.isArray(job.podImageUrls)) {
            const newUrls = [];
            let changed = false;

            for (let i = 0; i < job.podImageUrls.length; i++) {
                const url = job.podImageUrls[i];

                if (isNASUrl(url)) {
                    stats.skipped++;
                    newUrls.push(url);
                } else if (isFirebaseUrl(url)) {
                    try {
                        const path = `pod-images/${jobKey}/${Date.now()}_${i}.webp`;
                        const nasUrl = await migrateUrl(url, path);
                        newUrls.push(nasUrl);
                        changed = true;
                        stats.images++;
                        process.stdout.write(`\r  ✅ ${jobKey} img ${i} → NAS (total: ${stats.images})`);
                    } catch (err) {
                        stats.errors++;
                        newUrls.push(url);
                        console.log(`\n  ❌ ${jobKey} img ${i}: ${err.message}`);
                    }
                } else {
                    newUrls.push(url);
                }
            }

            if (changed) {
                await dbUpdate(`jobs/${jobKey}`, { podImageUrls: newUrls });
            }
        }

        // Payment slip
        if (job.paymentSlipUrl && isFirebaseUrl(job.paymentSlipUrl)) {
            try {
                const path = `payment-slips/${jobKey}/${Date.now()}_slip.webp`;
                const nasUrl = await migrateUrl(job.paymentSlipUrl, path);
                await dbUpdate(`jobs/${jobKey}`, { paymentSlipUrl: nasUrl });
                stats.slips++;
                process.stdout.write(`\r  ✅ ${jobKey} slip → NAS (total slips: ${stats.slips})`);
            } catch (err) {
                stats.errors++;
                console.log(`\n  ❌ ${jobKey} slip: ${err.message}`);
            }
        }
    }

    // ===== STEP 2: Invoices =====
    console.log('\n\n📄 Reading invoices...');
    const invoices = await dbRead('invoices');

    if (invoices) {
        const invEntries = Object.entries(invoices);
        console.log(`Found ${invEntries.length} invoices\n`);

        for (const [invKey, invoice] of invEntries) {
            if (invoice.paymentSlipUrl && isFirebaseUrl(invoice.paymentSlipUrl)) {
                try {
                    const path = `payment-slips/invoices/${invKey}/${Date.now()}_slip.webp`;
                    const nasUrl = await migrateUrl(invoice.paymentSlipUrl, path);
                    await dbUpdate(`invoices/${invKey}`, { paymentSlipUrl: nasUrl });
                    stats.slips++;
                    process.stdout.write(`\r  ✅ Invoice ${invKey} slip → NAS`);
                } catch (err) {
                    stats.errors++;
                    console.log(`\n  ❌ Invoice ${invKey}: ${err.message}`);
                }
            }
        }
    }

    // ===== DONE =====
    console.log('\n\n====================================');
    console.log('🎉 Migration Complete!');
    console.log(`  📷 Images migrated: ${stats.images}`);
    console.log(`  📄 Slips migrated:  ${stats.slips}`);
    console.log(`  ⏭️  Skipped (NAS):  ${stats.skipped}`);
    console.log(`  ❌ Errors:          ${stats.errors}`);
}

main().catch(err => {
    console.error('💀 Fatal error:', err);
    process.exit(1);
});
