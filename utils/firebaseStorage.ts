import { compressImageFile } from './imageCompression';
import { uploadToNAS } from './nasUpload';

/**
 * Upload a File object to NAS and return the download URL.
 * บีบอัดรูปเป็น WebP (800px, q0.6) ก่อนอัปโหลด
 * 
 * @param file - The File object to upload
 * @param path - Storage path e.g. 'pod-images/JRS-2026-0001/photo1.webp'
 * @returns Download URL string
 */
export const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    const compressed = await compressImageFile(file, { maxWidth: 800, quality: 0.6, outputType: 'image/webp' });
    const url = await uploadToNAS(compressed, path);
    return url;
};

/**
 * Upload multiple files to NAS.
 * Returns array of download URLs.
 * 
 * @param files - Array of File objects
 * @param basePath - Base storage path e.g. 'pod-images/JRS-2026-0001'
 * @returns Array of download URL strings
 */
/**
 * จำนวนไฟล์ที่อัปโหลดพร้อมกันได้สูงสุด
 *
 * เดิมใช้ Promise.all ยิงทุกไฟล์พร้อมกันหมด · งานจริงแนบได้ถึง 20 รูป
 * ซึ่งหมายถึงเปิด 20 การเชื่อมต่อไปที่ NAS พร้อมกัน แล้วแต่ละรูปยังต้อง
 * ถอดรหัสและบีบอัดในเบราว์เซอร์ก่อนด้วย · บนมือถือหรือเน็ตช้า
 * มีโอกาสที่บางไฟล์ timeout แล้ว Promise.all ทำให้ล้มทั้งชุด
 * ทั้งที่อีก 19 ไฟล์ขึ้นไปเรียบร้อยแล้ว
 *
 * 4 ไฟล์ต่อรอบเป็นค่าที่เบราว์เซอร์จัดการไหวและ NAS ไม่หนักเกินไป
 */
const UPLOAD_BATCH_SIZE = 4;

export const uploadFilesToStorage = async (files: File[], basePath: string): Promise<string[]> => {
    const urls: string[] = [];

    for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
        const batch = files.slice(i, i + UPLOAD_BATCH_SIZE);
        const batchUrls = await Promise.all(
            batch.map((file, offset) => {
                const index = i + offset;
                const timestamp = Date.now();
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
                // ไม่ต้องบังคับเป็น .webp ตรงนี้ — uploadToNAS จะตั้งนามสกุลให้ตรงกับไบต์ที่ส่งจริง
                // หลังบีบอัดเสร็จ (ดู alignPathExtension ใน utils/nasUpload.ts)
                // ของเดิมเปลี่ยนทุกอย่างเป็น .webp รวมทั้งไฟล์ PDF ที่ไม่ได้ถูกบีบอัดเลย
                const path = `${basePath}/${timestamp}_${index}_${safeName}`;
                return uploadFileToStorage(file, path);
            })
        );
        urls.push(...batchUrls);
    }

    return urls;
};
