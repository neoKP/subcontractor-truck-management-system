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

    console.log('[NAS Upload] Sending:', path, 'size:', fileOrBlob.size);
    const response = await fetch(NAS_API_URL, {
        method: 'POST',
        headers: {
            'X-API-Key': NAS_API_KEY,
        },
        body: formData,
    });

    const text = await response.text();
    console.log('[NAS Upload] Response status:', response.status, 'body:', text);
    
    let result;
    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error(`NAS upload: invalid JSON response: ${text.substring(0, 200)}`);
    }
    
    if (!result.success || !result.url) {
        throw new Error(`NAS upload failed: ${result.error || JSON.stringify(result)}`);
    }

    return result.url;
};
