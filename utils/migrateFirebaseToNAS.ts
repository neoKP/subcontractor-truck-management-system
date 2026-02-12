import { db, ref, get, update } from '../firebaseConfig';

/**
 * Migration Script: ย้ายรูปจาก Firebase Storage → NAS
 * 
 * ทำงาน:
 * 1. อ่าน jobs + invoices ทั้งหมดจาก DB
 * 2. หา URL ที่ชี้ไป Firebase Storage (firebasestorage.googleapis.com)
 * 3. Download รูปจาก Firebase Storage
 * 4. Upload ไป NAS
 * 5. เปลี่ยน URL ใน DB เป็น NAS URL
 */

export interface FirebaseMigrationProgress {
    totalJobs: number;
    processedJobs: number;
    totalImages: number;
    migratedImages: number;
    totalSlips: number;
    migratedSlips: number;
    skippedAlreadyNAS: number;
    errors: string[];
    status: 'idle' | 'running' | 'done' | 'error';
}

const isFirebaseStorageUrl = (url: string): boolean => {
    return typeof url === 'string' && url.includes('firebasestorage.googleapis.com');
};

const isNASUrl = (url: string): boolean => {
    return typeof url === 'string' && url.includes('neosiam.dscloud.biz');
};

const NAS_PROXY_URL = 'https://neosiam.dscloud.biz/api/upload.php';
const NAS_API_KEY = 'NAS_UPLOAD_KEY_sansan856';

const proxyDownloadToNAS = async (sourceUrl: string, destPath: string): Promise<string> => {
    const response = await fetch(NAS_PROXY_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': NAS_API_KEY,
        },
        body: JSON.stringify({ sourceUrl, path: destPath }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(err.error || `Proxy failed: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success || !result.url) {
        throw new Error(`Proxy failed: ${JSON.stringify(result)}`);
    }

    return result.url;
};

export const migrateFirebaseToNAS = async (
    onProgress?: (progress: FirebaseMigrationProgress) => void
): Promise<FirebaseMigrationProgress> => {
    const progress: FirebaseMigrationProgress = {
        totalJobs: 0,
        processedJobs: 0,
        totalImages: 0,
        migratedImages: 0,
        totalSlips: 0,
        migratedSlips: 0,
        skippedAlreadyNAS: 0,
        errors: [],
        status: 'running'
    };

    const report = () => onProgress?.({ ...progress, errors: [...progress.errors] });

    try {
        // ========== STEP 1: Migrate POD images in jobs ==========
        console.log('🔄 Starting Firebase→NAS migration: jobs/podImageUrls...');
        const jobsSnap = await get(ref(db, 'jobs'));
        const jobsData = jobsSnap.val();

        if (jobsData) {
            const jobEntries = Object.entries(jobsData) as [string, any][];
            progress.totalJobs = jobEntries.length;
            report();

            for (const [jobKey, job] of jobEntries) {
                // POD images
                if (job.podImageUrls && Array.isArray(job.podImageUrls)) {
                    const newUrls: string[] = [];
                    let hasFirebaseUrl = false;

                    for (let i = 0; i < job.podImageUrls.length; i++) {
                        const url = job.podImageUrls[i];
                        progress.totalImages++;

                        if (isNASUrl(url)) {
                            progress.skippedAlreadyNAS++;
                            newUrls.push(url);
                        } else if (isFirebaseStorageUrl(url)) {
                            hasFirebaseUrl = true;
                            try {
                                const path = `pod-images/${jobKey}/${Date.now()}_${i}.webp`;
                                const nasUrl = await proxyDownloadToNAS(url, path);
                                newUrls.push(nasUrl);
                                progress.migratedImages++;
                                console.log(`  ✅ Job ${jobKey} image ${i} → NAS`);
                            } catch (err: any) {
                                progress.errors.push(`Job ${jobKey} img ${i}: ${err.message}`);
                                newUrls.push(url); // keep old URL on error
                                console.error(`  ❌ Job ${jobKey} image ${i}: ${err.message}`);
                            }
                        } else {
                            newUrls.push(url); // keep other URLs as-is
                        }
                        report();
                    }

                    if (hasFirebaseUrl) {
                        await update(ref(db, `jobs/${jobKey}`), { podImageUrls: newUrls });
                    }
                }

                // Payment slip in jobs
                if (job.paymentSlipUrl && isFirebaseStorageUrl(job.paymentSlipUrl)) {
                    progress.totalSlips++;
                    try {
                        const path = `payment-slips/${jobKey}/${Date.now()}_slip.webp`;
                        const nasUrl = await proxyDownloadToNAS(job.paymentSlipUrl, path);
                        await update(ref(db, `jobs/${jobKey}`), { paymentSlipUrl: nasUrl });
                        progress.migratedSlips++;
                        console.log(`  ✅ Job ${jobKey} slip → NAS`);
                    } catch (err: any) {
                        progress.errors.push(`Job ${jobKey} slip: ${err.message}`);
                    }
                    report();
                } else if (job.paymentSlipUrl && isNASUrl(job.paymentSlipUrl)) {
                    progress.skippedAlreadyNAS++;
                }

                progress.processedJobs++;
                report();
            }
        }

        // ========== STEP 2: Migrate payment slips in invoices ==========
        console.log('🔄 Starting Firebase→NAS migration: invoices/paymentSlipUrl...');
        const invoicesSnap = await get(ref(db, 'invoices'));
        const invoicesData = invoicesSnap.val();

        if (invoicesData) {
            const invoiceEntries = Object.entries(invoicesData) as [string, any][];

            for (const [invKey, invoice] of invoiceEntries) {
                if (invoice.paymentSlipUrl && isFirebaseStorageUrl(invoice.paymentSlipUrl)) {
                    progress.totalSlips++;
                    try {
                        const path = `payment-slips/invoices/${invKey}/${Date.now()}_slip.webp`;
                        const nasUrl = await proxyDownloadToNAS(invoice.paymentSlipUrl, path);
                        await update(ref(db, `invoices/${invKey}`), { paymentSlipUrl: nasUrl });
                        progress.migratedSlips++;
                        console.log(`  ✅ Invoice ${invKey} slip → NAS`);
                    } catch (err: any) {
                        progress.errors.push(`Invoice ${invKey}: ${err.message}`);
                    }
                    report();
                }
            }
        }

        progress.status = 'done';
        console.log('🎉 Firebase→NAS migration complete!', progress);
    } catch (err: any) {
        progress.status = 'error';
        progress.errors.push(`Fatal: ${err.message}`);
        console.error('💀 Migration failed:', err);
    }

    report();
    return progress;
};
