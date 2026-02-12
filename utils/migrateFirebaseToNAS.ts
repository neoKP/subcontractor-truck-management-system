import { db, ref, get, update, storage, storageRef, getBlob } from '../firebaseConfig';
import { uploadToNAS } from './nasUpload';

/**
 * Migration Script: ย้ายรูปจาก Firebase Storage → NAS
 * 
 * วิธีการ:
 * 1. อ่าน jobs + invoices ทั้งหมดจาก DB
 * 2. หา URL ที่ชี้ไป Firebase Storage
 * 3. ใช้ Firebase SDK getBlob() download รูป (ไม่มีปัญหา CORS)
 * 4. Upload blob ไป NAS ผ่าน uploadToNAS() (FormData ที่ทำงานอยู่แล้ว)
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

/**
 * แปลง Firebase Storage download URL → storage path
 * เช่น: https://firebasestorage.googleapis.com/v0/b/BUCKET/o/pod-images%2FJOB%2Ffile.webp?alt=media&token=...
 * → pod-images/JOB/file.webp
 */
const extractStoragePath = (url: string): string | null => {
    try {
        const match = url.match(/\/o\/([^?]+)/);
        if (match) return decodeURIComponent(match[1]);
    } catch {}
    return null;
};

/**
 * Download จาก Firebase Storage ด้วย SDK แล้ว upload ไป NAS
 */
const downloadAndUploadToNAS = async (firebaseUrl: string, nasPath: string): Promise<string> => {
    const storagePath = extractStoragePath(firebaseUrl);
    if (!storagePath) throw new Error('Cannot parse Firebase URL');

    const fileRef = storageRef(storage, storagePath);
    const blob = await getBlob(fileRef);
    const nasUrl = await uploadToNAS(blob, nasPath);
    return nasUrl;
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
                                const nasUrl = await downloadAndUploadToNAS(url, path);
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
                        const nasUrl = await downloadAndUploadToNAS(job.paymentSlipUrl, path);
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
                        const nasUrl = await downloadAndUploadToNAS(invoice.paymentSlipUrl, path);
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
