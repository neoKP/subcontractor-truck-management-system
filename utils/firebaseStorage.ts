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
export const uploadFilesToStorage = async (files: File[], basePath: string): Promise<string[]> => {
    const uploadPromises = files.map((file, index) => {
        const timestamp = Date.now();
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const path = `${basePath}/${timestamp}_${index}_${safeName.replace(/\.[^.]+$/, '')}.webp`;
        return uploadFileToStorage(file, path);
    });
    return Promise.all(uploadPromises);
};
