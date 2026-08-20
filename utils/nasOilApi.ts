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

const NAS_BASE = 'https://neosiam.dscloud.biz:8443';
const TIMEOUT_MS = 12000;

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

const fetchJson = async <T>(path: string): Promise<T | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(`${NAS_BASE}${path}`, { signal: controller.signal });
        if (!res.ok) return null;
        return (await res.json()) as T;
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
