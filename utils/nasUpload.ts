// NAS Upload Utility — อัปโหลดไฟล์ไป Synology NAS ผ่าน PHP API
// แทนที่ Firebase Storage

/**
 * คีย์สำหรับเรียก NAS — อ่านจาก environment ไม่ฝังในโค้ดอีกแล้ว
 *
 * ที่ต้องเข้าใจให้ตรงกัน: ตัวแปรที่ขึ้นต้นด้วย VITE_ จะถูกฝังลงไฟล์ JS ตอน build
 * ดังนั้น **ผู้ใช้ที่เปิดหน้าเว็บยังอ่านคีย์นี้ได้อยู่** การย้ายมาที่นี่แก้ได้แค่
 * "ไม่ให้คีย์อยู่ใน GitHub สาธารณะ" เท่านั้น ไม่ได้ทำให้คีย์เป็นความลับจริง
 * ความลับจริงเกิดขึ้นเมื่อย้ายการอัปโหลดไปหลัง Cloud Function (ระยะที่ 4 ของแผนความปลอดภัย)
 *
 * ตั้งค่าที่ไฟล์ .env (เครื่องตัวเอง) และที่ Netlify environment variables (ตอน deploy)
 */
const NAS_API_KEY = import.meta.env.VITE_NAS_API_KEY ?? '';

let cachedBase: string | null = null;

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

const getCandidates = (): string[] => {
    const list: string[] = [];
    if (typeof window !== 'undefined') {
        try {
            const o = window.localStorage?.getItem('NAS_API_BASE_OVERRIDE');
            if (o) list.push(o);
            const t = window.localStorage?.getItem('NAS_API_TUNNEL');
            if (t) list.push(t);
        } catch {}
    }
    list.push('https://neosiam.dscloud.biz/api');
    list.push('http://192.168.1.82/api');
    return uniq(list);
};

/**
 * เช็คว่า base ไหนใช้ได้ — ยิงไปที่ upload.php ตัวจริง ไม่ใช่ diag.php
 *
 * เดิมใช้ diag.php เป็นตัวเคาะประตู ซึ่งผิดฝาผิดตัว 2 ทาง:
 *   1. diag.php ไม่ตรวจคีย์ และเปิดโครงสร้างโฟลเดอร์ทั้ง NAS ให้คนนอกอ่านได้
 *      เป็นไฟล์ที่ควรถูกปิด ไม่ใช่ไฟล์ที่ระบบต้องพึ่งพา
 *   2. พอปิดมันทิ้ง (404) การอัปโหลดตายทั้งระบบ ทั้งที่ upload.php ยังทำงานปกติดี
 * ตัวชี้วัดว่า "อัปโหลดได้ไหม" จึงควรถามไฟล์ที่ใช้อัปโหลดจริงเท่านั้น
 *
 * เกณฑ์ที่ใช้: upload.php ตอบ HTTP 200 เสมอ แล้วใส่ผลไว้ใน JSON body
 * (ห้ามใช้ status อื่น เพราะ Nginx ของ Synology จะแทน response ที่ไม่ใช่ 200
 *  ด้วยหน้า error ของตัวเอง แล้ว CORS header จะหาย — ดู NAS-UPLOAD-GUIDE ข้อ 2)
 * ดังนั้น 401 จะไม่เกิดขึ้นกับ NAS ตัวนี้ ต้องดูที่ body ว่าเป็น JSON ของเราจริงหรือเปล่า
 * ซึ่งกันหน้า login ของ router หรือ captive portal ที่ตอบ 200 มาหลอกได้ด้วย
 */
const probe = async (base: string): Promise<boolean> => {
    try {
        const c = new AbortController();
        const timer = setTimeout(() => c.abort(), 2500);
        // POST เปล่า ไม่ใส่คีย์ — upload.php หยุดที่ด่านตรวจคีย์ ไม่แตะดิสก์เลย
        // ไม่ใส่ header เพิ่ม เพื่อให้เป็น simple request จะได้ไม่ต้องมี preflight
        const res = await fetch(`${base}/upload.php`, {
            method: 'POST',
            cache: 'no-store',
            signal: c.signal,
        });
        clearTimeout(timer);
        // เผื่อเวอร์ชันในอนาคตที่ไม่ได้อยู่หลัง Nginx ของ Synology แล้วตอบ 401 ได้จริง
        if (res.status === 401) return true;
        if (!res.ok) return false;
        const body = await res.json().catch(() => null);
        return !!body && typeof body.success === 'boolean';
    } catch {
        // รวมกรณี CORS บล็อกด้วย — ถ้าอ่าน response ไม่ได้ ก็อัปโหลดไม่ได้อยู่ดี
        return false;
    }
};

const resolveBaseUrl = async (): Promise<string> => {
    if (cachedBase) return cachedBase;
    if (typeof window !== 'undefined') {
        try {
            const raw = window.localStorage?.getItem('NAS_API_BASE_CACHE');
            if (raw) {
                const { base, ts } = JSON.parse(raw);
                if (base && ts && Date.now() - Number(ts) < 10 * 60 * 1000) {
                    cachedBase = base;
                    return cachedBase;
                }
            }
        } catch {}
    }
    for (const base of getCandidates()) {
        if (typeof window !== 'undefined' && window.location.protocol === 'https:' && base.startsWith('http://')) continue;
        if (await probe(base)) {
            cachedBase = base;
            if (typeof window !== 'undefined') {
                try { window.localStorage?.setItem('NAS_API_BASE_CACHE', JSON.stringify({ base, ts: Date.now() })); } catch {}
            }
            return cachedBase;
        }
    }
    throw new Error('No NAS endpoint reachable');
};

/**
 * นามสกุลที่ upload.php ยอมให้เขียนลงดิสก์
 * ต้องตรงกับ $ALLOWED_EXT ใน nas-api/upload.php
 */
const NAS_ALLOWED_EXT = ['webp', 'jpg', 'jpeg', 'png', 'gif', 'pdf'];

/** ชนิดไฟล์ → นามสกุล (รวมชื่อพ้องที่บางเบราว์เซอร์ส่งมา) */
const MIME_TO_EXT: Record<string, string> = {
    'image/webp': 'webp',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/pjpeg': 'jpg',
    'image/png': 'png',
    'image/x-png': 'png',
    'image/gif': 'gif',
    'application/pdf': 'pdf',
};

/**
 * ตั้งนามสกุลใน path ให้ตรงกับ "ไบต์ที่กำลังจะส่งจริง"
 *
 * upload.php ตรวจเนื้อไฟล์ด้วย finfo แล้วเทียบกับนามสกุลปลายทาง ถ้าไม่ตรงจะปฏิเสธ
 * ("Extension does not match file content") — กฎนี้มีไว้กันไฟล์ที่ปลอมเป็นรูป
 * แต่ถูกเขียนลงดิสก์เป็น .php
 *
 * โค้ดฝั่งนี้ตั้งชื่อ path เป็น .webp ไว้ล่วงหน้าก่อนบีบอัดเสมอ ซึ่งไม่ตรงกับของจริงสองทาง
 *   - ไฟล์ PDF (สลิปโอนเงิน) ไม่ถูกบีบอัด แต่ path ถูกเปลี่ยนเป็น .webp
 *   - รูปที่บีบอัดไม่สำเร็จ (เช่น HEIC จาก iPhone) compressImageFile คืนไฟล์เดิมมา
 *     แต่ path เป็น .webp ไปแล้ว
 * ทั้งสองแบบจะถูกปฏิเสธทันที จึงต้องแก้นามสกุลที่นี่ที่เดียว ก่อนยิงขึ้น NAS
 */
const alignPathExtension = (path: string, file: File | Blob): string => {
    const fromMime = MIME_TO_EXT[(file.type || '').toLowerCase()];
    const nameForExt = file instanceof File ? file.name : path;
    const fromName = (nameForExt.split('.').pop() || '').toLowerCase();
    const ext = fromMime || fromName;

    if (!NAS_ALLOWED_EXT.includes(ext)) {
        // เช่น HEIC ที่บีบอัดเป็น WebP ไม่สำเร็จ — เดิมอัปขึ้นไปได้แต่เปิดดูไม่ได้
        // ฟ้องตรงนี้ให้ผู้ใช้รู้ตัวดีกว่าปล่อยให้เก็บไฟล์ที่แสดงผลไม่ได้ลงระบบ
        throw new Error(
            `อัปโหลดไม่ได้: ไฟล์ชนิด ${file.type || fromName || 'ไม่ทราบชนิด'} ไม่รองรับ ` +
            `(รองรับ JPG, PNG, WebP, GIF และ PDF เท่านั้น)`
        );
    }

    // ตัดเฉพาะนามสกุลของชื่อไฟล์ ไม่ข้ามไปแตะจุดที่อยู่ในชื่อโฟลเดอร์
    return path.replace(/\.[^./]*$/, '') + '.' + ext;
};

/**
 * Upload a File/Blob to NAS and return the public download URL.
 */
export const uploadToNAS = async (
    fileOrBlob: File | Blob,
    rawPath: string
): Promise<string> => {
    // ล้มให้ชัดตั้งแต่ต้น ดีกว่าปล่อยไปแล้วได้ 401 จาก NAS ซึ่งอ่านไม่ออกว่าเกิดอะไรขึ้น
    if (!NAS_API_KEY) {
        throw new Error('ยังไม่ได้ตั้งค่า VITE_NAS_API_KEY — ใส่ในไฟล์ .env (เครื่องตัวเอง) หรือ environment variables ของ Vercel ก่อนใช้งานการอัปโหลดไฟล์');
    }

    const path = alignPathExtension(rawPath, fileOrBlob);

    const formData = new FormData();
    formData.append('file', fileOrBlob, path.split('/').pop() || 'file');
    formData.append('path', path);

    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/upload.php`, {
        method: 'POST',
        headers: {
            'X-API-Key': NAS_API_KEY,
        },
        body: formData,
    });

    const text = await response.text();
    let result: any;
    try {
        result = JSON.parse(text);
    } catch (e) {
        throw new Error(`NAS upload: invalid JSON response: ${text.substring(0, 200)}`);
    }
    
    if (!response.ok || !result?.success || !result?.url) {
        throw new Error(`NAS upload failed: ${result?.error || response.status}`);
    }

    return result.url as string;
};
