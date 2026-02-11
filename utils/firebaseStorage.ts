import { storage, storageRef, uploadBytes, getDownloadURL } from '../firebaseConfig';

/**
 * Upload a File object to Firebase Storage and return the download URL.
 * This replaces the old Base64-in-DB pattern that was causing massive bandwidth usage.
 * 
 * @param file - The File object to upload
 * @param path - Storage path e.g. 'pod-images/JRS-2026-0001/photo1.jpg'
 * @returns Download URL string
 */
export const uploadFileToStorage = async (file: File, path: string): Promise<string> => {
    const fileRef = storageRef(storage, path);
    await uploadBytes(fileRef, file);
    const url = await getDownloadURL(fileRef);
    return url;
};

/**
 * Upload multiple files to Firebase Storage.
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
        const path = `${basePath}/${timestamp}_${index}_${safeName}`;
        return uploadFileToStorage(file, path);
    });
    return Promise.all(uploadPromises);
};
