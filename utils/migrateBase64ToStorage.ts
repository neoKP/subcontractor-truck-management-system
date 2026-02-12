import { db, ref, get, update, storage, storageRef, uploadBytes, getDownloadURL } from '../firebaseConfig';
import { compressBlobToWebP } from './imageCompression';

/**
 * Migration Script: ย้ายรูป Base64 จาก Realtime DB → Firebase Storage
 * 
 * ทำงาน:
 * 1. อ่าน jobs ทั้งหมดจาก DB
 * 2. หา jobs ที่มี podImageUrls เป็น Base64 (เริ่มด้วย "data:")
 * 3. Upload แต่ละรูปไป Firebase Storage
 * 4. เปลี่ยน Base64 ใน DB เป็น download URL
 * 5. ทำเหมือนกันกับ paymentSlipUrl ใน jobs และ invoices
 * 
 * ผลลัพธ์: DB size ลดจาก ~57MB → ~5MB
 */

export interface MigrationProgress {
    totalJobs: number;
    processedJobs: number;
    totalImages: number;
    migratedImages: number;
    totalSlips: number;
    migratedSlips: number;
    errors: string[];
    status: 'idle' | 'running' | 'done' | 'error';
}

const isBase64 = (str: string): boolean => {
    return typeof str === 'string' && str.startsWith('data:');
};

const base64ToBlob = (base64: string): Blob | null => {
    try {
        const parts = base64.split(';base64,');
        if (parts.length < 2) return null;
        const contentType = parts[0].split(':')[1];
        const raw = window.atob(parts[1]);
        const rawLength = raw.length;
        const uInt8Array = new Uint8Array(rawLength);
        for (let i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        return new Blob([uInt8Array], { type: contentType });
    } catch (e) {
        console.error('Error converting base64 to blob:', e);
        return null;
    }
};

const getFileExtension = (base64: string): string => {
    if (base64.startsWith('data:image/jpeg')) return 'jpg';
    if (base64.startsWith('data:image/png')) return 'png';
    if (base64.startsWith('data:image/webp')) return 'webp';
    if (base64.startsWith('data:application/pdf')) return 'pdf';
    return 'bin';
};

const isImageExt = (ext: string) => ['jpg', 'jpeg', 'png', 'webp'].includes(ext.toLowerCase());

export const migrateBase64ToStorage = async (
    onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationProgress> => {
    const progress: MigrationProgress = {
        totalJobs: 0,
        processedJobs: 0,
        totalImages: 0,
        migratedImages: 0,
        totalSlips: 0,
        migratedSlips: 0,
        errors: [],
        status: 'running'
    };

    const report = () => onProgress?.({ ...progress, errors: [...progress.errors] });

    try {
        // ========== STEP 1: Migrate POD images in jobs ==========
        console.log('🔄 Starting migration: jobs/podImageUrls...');
        const jobsSnap = await get(ref(db, 'jobs'));
        const jobsData = jobsSnap.val();

        if (jobsData) {
            const jobEntries = Object.entries(jobsData) as [string, any][];
            progress.totalJobs = jobEntries.length;
            report();

            for (const [jobKey, job] of jobEntries) {
                if (job.podImageUrls && Array.isArray(job.podImageUrls)) {
                    const newUrls: string[] = [];
                    let hasBase64 = false;

                    for (let i = 0; i < job.podImageUrls.length; i++) {
                        const url = job.podImageUrls[i];
                        progress.totalImages++;

                        if (isBase64(url)) {
                            hasBase64 = true;
                            try {
                                const blob = base64ToBlob(url);
                                if (!blob) {
                                    progress.errors.push(`Job ${jobKey} image ${i}: Failed to convert base64`);
                                    newUrls.push(url);
                                    continue;
                                }

                                const ext = getFileExtension(url);
                                const finalBlob = isImageExt(ext)
                                    ? await compressBlobToWebP(blob, { maxWidth: 800, quality: 0.6, outputType: 'image/webp' })
                                    : blob;
                                const path = `pod-images/${jobKey}/${Date.now()}_${i}.${isImageExt(ext) ? 'webp' : ext}`;
                                const fileRef = storageRef(storage, path);
                                await uploadBytes(fileRef, finalBlob);
                                const downloadUrl = await getDownloadURL(fileRef);
                                newUrls.push(downloadUrl);
                                progress.migratedImages++;
                                console.log(`  ✅ Job ${jobKey} image ${i} → Storage (${(finalBlob.size / 1024).toFixed(0)}KB)`);
                            } catch (err: any) {
                                progress.errors.push(`Job ${jobKey} image ${i}: ${err.message}`);
                                newUrls.push(url);
                                console.error(`  ❌ Job ${jobKey} image ${i}: ${err.message}`);
                            }
                        } else {
                            newUrls.push(url);
                        }
                        report();
                    }

                    if (hasBase64) {
                        await update(ref(db, `jobs/${jobKey}`), { podImageUrls: newUrls });
                    }
                }

                // Also check paymentSlipUrl in jobs
                if (job.paymentSlipUrl && isBase64(job.paymentSlipUrl)) {
                    progress.totalSlips++;
                    try {
                        const blob = base64ToBlob(job.paymentSlipUrl);
                        if (!blob) {
                            progress.errors.push(`Job ${jobKey} slip: Failed to convert`);
                        } else {
                            const ext = getFileExtension(job.paymentSlipUrl);
                            const finalBlob = isImageExt(ext)
                                ? await compressBlobToWebP(blob, { maxWidth: 800, quality: 0.6, outputType: 'image/webp' })
                                : blob;
                            const path = `payment-slips/${jobKey}/${Date.now()}_slip.${isImageExt(ext) ? 'webp' : ext}`;
                            const fileRef = storageRef(storage, path);
                            await uploadBytes(fileRef, finalBlob);
                            const downloadUrl = await getDownloadURL(fileRef);
                            await update(ref(db, `jobs/${jobKey}`), { paymentSlipUrl: downloadUrl });
                            progress.migratedSlips++;
                            console.log(`  ✅ Job ${jobKey} slip → Storage (${(finalBlob.size / 1024).toFixed(0)}KB)`);
                        }
                    } catch (err: any) {
                        progress.errors.push(`Job ${jobKey} slip: ${err.message}`);
                    }
                    report();
                }

                progress.processedJobs++;
                report();
            }
        }

        // ========== STEP 2: Migrate payment slips in invoices ==========
        console.log('🔄 Starting migration: invoices/paymentSlipUrl...');
        const invoicesSnap = await get(ref(db, 'invoices'));
        const invoicesData = invoicesSnap.val();

        if (invoicesData) {
            const invoiceEntries = Object.entries(invoicesData) as [string, any][];

            for (const [invKey, invoice] of invoiceEntries) {
                if (invoice.paymentSlipUrl && isBase64(invoice.paymentSlipUrl)) {
                    progress.totalSlips++;
                    try {
                        const blob = base64ToBlob(invoice.paymentSlipUrl);
                        if (!blob) {
                            progress.errors.push(`Invoice ${invKey}: Failed to convert slip`);
                            continue;
                        }

                        const ext = getFileExtension(invoice.paymentSlipUrl);
                        const finalBlob = isImageExt(ext)
                            ? await compressBlobToWebP(blob, { maxWidth: 800, quality: 0.6, outputType: 'image/webp' })
                            : blob;
                        const path = `payment-slips/invoices/${invKey}/${Date.now()}_slip.${isImageExt(ext) ? 'webp' : ext}`;
                        const fileRef = storageRef(storage, path);
                        await uploadBytes(fileRef, finalBlob);
                        const downloadUrl = await getDownloadURL(fileRef);
                        await update(ref(db, `invoices/${invKey}`), { paymentSlipUrl: downloadUrl });
                        progress.migratedSlips++;
                        console.log(`  ✅ Invoice ${invKey} slip → Storage (${(finalBlob.size / 1024).toFixed(0)}KB)`);
                    } catch (err: any) {
                        progress.errors.push(`Invoice ${invKey}: ${err.message}`);
                    }
                    report();
                }
            }
        }

        progress.status = 'done';
        console.log('🎉 Migration complete!', progress);
    } catch (err: any) {
        progress.status = 'error';
        progress.errors.push(`Fatal: ${err.message}`);
        console.error('💀 Migration failed:', err);
    }

    report();
    return progress;
};
