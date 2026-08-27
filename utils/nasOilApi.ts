/**
 * ดึงราคาดีเซลจาก backend บน NAS ของบริษัท
 *
 * NAS ดึงราคาจาก ปตท. ทุก 3 ชั่วโมงและเก็บประวัติงวดไว้ครบอยู่แล้ว (ใช้ร่วมกับระบบ KPI)
 * เราจึงอ่านต่อจากที่นั่นแทนการตั้ง Cloud Function ใหม่ — ไม่มีค่าใช้จ่ายเพิ่ม
 * และหน้าเว็บเรียก ปตท. ตรง ๆ ไม่ได้อยู่แล้วเพราะหน้านั้นไม่ส่ง CORS header
 *
 * ⚠️ NAS จำกัดว่าเว็บโดเมนใดเรียกได้ (allowlist) — โดเมนที่ไม่อยู่ในรายชื่อจะได้ HTTP 500
 * ตรวจแล้วเมื่อ 2026-08-20: localhost:3000 ผ่าน · โดเมนจริงตอน deploy ต้องแจ้งเพิ่มใน NAS
 */

/*
  ดึงผ่าน proxy บนพอร์ต 443 ไม่ใช่ยิงไป :8443 ตรง ๆ

  backend :8443 เป็นของระบบ KPI ซึ่งมี allowlist ว่าเว็บโดเมนไหนเรียกได้
  โดเมนของระบบนี้ไม่อยู่ในรายชื่อ เบราว์เซอร์จึงถูกปฏิเสธ (ได้ HTTP 500
  เพราะฝั่งนั้นใช้ callback(new Error(...)) ซึ่ง Express แปลงเป็น 500)

  nas-api/oil-proxy.php บน NAS ยิงต่อให้จากฝั่งเซิร์ฟเวอร์ ซึ่งไม่ส่ง header
  Origin จึงผ่าน allowlist ได้ตามปกติ · เจ้าของระบบทั้งสองฝั่งเป็นคนเดียวกัน
  และเลือกวิธีนี้เพื่อไม่ต้องแตะ .env ของระบบ KPI ที่มีรหัสฐานข้อมูลปนอยู่

  ถ้าวันหนึ่งเพิ่มโดเมนใน CORS_ORIGIN ของระบบ KPI แล้ว ให้เปลี่ยนกลับมาใช้
  DIRECT_BASE ตรง ๆ แล้วลบ oil-proxy.php ทิ้ง
*/
const PROXY_BASE = 'https://neosiam.dscloud.biz/api/oil-proxy.php';
const DIRECT_BASE = 'https://neosiam.dscloud.biz:8443';
const TIMEOUT_MS = 12000;

/** แปลง path ของ backend เป็นพารามิเตอร์ที่ proxy รู้จัก */
const PROXY_PARAM: Record<string, string> = {
    '/api/oil/ptt': 'ptt',
    '/api/oil/history': 'history',
};

export interface NasOilPrice {
    diesel: number;
    base: number;
    pct: number;
    effectiveDate: string;   // ISO ค.ศ.
    source: string;
}

/** งวดปรับหนึ่งงวด — from = วันที่ราคานี้เริ่มมีผล */
export interface NasOilBand {
    from: string;
    diesel: number;
}

const requestJson = async <T>(url: string, signal: AbortSignal): Promise<T | null> => {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    /*
      proxy ตอบ HTTP 200 เสมอตามกฎของ NAS (Nginx ของ Synology จะแทน response
      ที่ไม่ใช่ 200 แล้ว CORS header หาย) ความล้มเหลวจึงอยู่ในเนื้อ JSON
      ต้องเช็ค ok:false ด้วย ไม่ใช่ดูแค่ res.ok
    */
    if (data && data.ok === false) return null;
    return data as T;
};

const fetchJson = async <T>(path: string): Promise<T | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const param = PROXY_PARAM[path];
        if (param) {
            const viaProxy = await requestJson<T>(`${PROXY_BASE}?p=${param}`, controller.signal);
            if (viaProxy) return viaProxy;
        }
        /*
          proxy ยังไม่ถูกอัปขึ้น NAS หรือถูกลบไปแล้ว — ลองยิงตรงเป็นทางสำรอง
          จะได้ผลเฉพาะเมื่อโดเมนนี้อยู่ใน allowlist ของระบบ KPI แล้วเท่านั้น
          ถ้าไม่อยู่ก็ล้มเหลวเงียบ ๆ แล้วผู้เรียกไปใช้ค่าสำรองต่อ ไม่ได้แย่ลงกว่าเดิม
        */
        return await requestJson<T>(`${DIRECT_BASE}${path}`, controller.signal);
    } catch {
        // NAS ปิดอยู่ / อยู่นอกวง / โดเมนไม่อยู่ใน allowlist — ผู้เรียกใช้ค่าสำรองต่อไป
        return null;
    } finally {
        clearTimeout(timer);
    }
};

/** ราคาดีเซลล่าสุด — null เมื่อ NAS ไม่ตอบหรือข้อมูลใช้ไม่ได้ */
export async function getNasOilPrice(): Promise<NasOilPrice | null> {
    const d = await fetchJson<Partial<NasOilPrice>>('/api/oil/ptt');
    if (!d || typeof d.diesel !== 'number' || !d.effectiveDate) return null;
    return {
        diesel: d.diesel,
        base: typeof d.base === 'number' ? d.base : 31.94,
        pct: typeof d.pct === 'number' ? d.pct : Math.round((d.diesel - 31.94) * 100) / 100,
        effectiveDate: d.effectiveDate,
        source: d.source || 'pttor.com',
    };
}

/** ประวัติงวดปรับทั้งหมด — null เมื่อ NAS ไม่ตอบ */
export async function getNasOilHistory(): Promise<NasOilBand[] | null> {
    const r = await fetchJson<{ bands?: NasOilBand[] }>('/api/oil/history');
    const bands = r?.bands;
    if (!Array.isArray(bands) || !bands.length) return null;
    // กันข้อมูลเสียหายบางแถวไม่ให้ทำให้ทั้งชุดใช้ไม่ได้
    const clean = bands.filter(b => b && typeof b.diesel === 'number' && typeof b.from === 'string');
    return clean.length ? clean : null;
}
