// NAS Upload Utility — อัปโหลดไฟล์ไป Synology NAS ผ่าน PHP API
// แทนที่ Firebase Storage

const NAS_API_KEY = 'NAS_UPLOAD_KEY_sansan856';

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

const probe = async (base: string): Promise<boolean> => {
    try {
        const c = new AbortController();
        const timer = setTimeout(() => c.abort(), 2500);
        const res = await fetch(`${base}/diag.php`, { method: 'GET', cache: 'no-store', signal: c.signal });
        clearTimeout(timer);
        return res.ok;
    } catch {
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
 * Upload a File/Blob to NAS and return the public download URL.
 */
export const uploadToNAS = async (
    fileOrBlob: File | Blob,
    path: string
): Promise<string> => {
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
