// NAS Upload Utility — อัปโหลดไฟล์ไป Synology NAS ผ่าน PHP API
// แทนที่ Firebase Storage

const NAS_API_URL = 'https://neosiam.dscloud.biz/api/upload.php';
const NAS_API_KEY = 'NAS_UPLOAD_KEY_sansan856';

/**
 * Upload a File/Blob to NAS and return the public download URL.
 */
export const uploadToNAS = async (
    fileOrBlob: File | Blob,
    path: string
): Promise<string> => {
    const formData = new FormData();
    formData.append('file', fileOrBlob, path.split('/').pop() || 'file');
    formData.append('path', path);

    const response = await fetch(NAS_API_URL, {
        method: 'POST',
        headers: {
            'X-API-Key': NAS_API_KEY,
        },
        body: formData,
    });

    const result = await response.json();
    if (!result.success || !result.url) {
        throw new Error(`NAS upload failed: ${result.error || JSON.stringify(result)}`);
    }

    return result.url;
};
