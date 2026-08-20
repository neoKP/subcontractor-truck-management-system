import { roundHalfUp } from './format';

/**
 * ฐานดีเซลสหพัฒน์ — %สะสม = ราคาดีเซล − BASE
 * ค่านี้มาจากข้อตกลงกับสหพัฒน์ ไม่ใช่ตัวเลขที่คำนวณได้ ห้ามแก้โดยไม่ยืนยันกับฝ่ายบัญชี
 */
export const OIL_BASE = 31.94;

export interface OilRound {
    startIso: string;
    day: number;
    month: number;
    year: number;
    pctCum: number;   // %สะสม ณ งวดนั้น
    delta: number;    // ปรับครั้งนี้ (เทียบงวดก่อนหน้า)
    diesel: number;   // ราคาดีเซล = OIL_BASE + pctCum
    seq: number;      // ลำดับครั้งที่ปรับ (0 = งวดฐาน)
    days: number;     // ราคานี้ใช้อยู่กี่วัน
}

export const daysBetween = (a: string, b: string): number => {
    const toN = (s: string) => {
        const [y, m, d] = s.split('-').map(Number);
        return Date.UTC(y, m - 1, d);
    };
    return Math.round((toN(b) - toN(a)) / 86400000);
};

/**
 * สร้างรายการ "งวดปรับ" จาก byDate — วันที่ %เปลี่ยน คือจุดเริ่มงวดใหม่
 *
 * todayIso ใช้ปิดท้ายงวดล่าสุด เพราะตารางหยุดอยู่ที่วันที่บันทึกล่าสุด ไม่ใช่วันนี้
 * ถ้านับถึงวันสุดท้ายในตารางแทน งวดล่าสุดจะแสดงจำนวนวันน้อยกว่าที่ใช้จริง
 */
export function buildOilRounds(byDate: Record<string, number>, todayIso: string): OilRound[] {
    const dates = Object.keys(byDate).sort();
    const rounds: OilRound[] = [];
    let prevPct: number | null = null;
    let seq = 0;

    for (const iso of dates) {
        const pct = byDate[iso];
        if (prevPct === null || pct !== prevPct) {
            const [y, m, d] = iso.split('-').map(Number);
            rounds.push({
                startIso: iso,
                day: d,
                month: m,
                year: y,
                pctCum: pct,
                delta: prevPct === null ? pct : roundHalfUp(pct - prevPct),
                diesel: roundHalfUp(OIL_BASE + pct),
                seq: prevPct === null ? 0 : ++seq,
                days: 0,
            });
            prevPct = pct;
        }
    }

    if (!rounds.length) return rounds;

    const lastIso = dates[dates.length - 1];
    const endLast = todayIso > lastIso ? todayIso : lastIso;  // กันเคสข้อมูลล้ำหน้าวันนี้
    for (let i = 0; i < rounds.length; i++) {
        const isLast = i + 1 >= rounds.length;
        const end = isLast ? endLast : rounds[i + 1].startIso;
        // งวดกลาง: วันเริ่มงวดถัดไปเป็นของงวดใหม่ ไม่นับ · งวดล่าสุด: +1 เพราะนับวันเริ่มงวดด้วย
        rounds[i].days = daysBetween(rounds[i].startIso, end) + (isLast ? 1 : 0);
    }
    return rounds;
}

/** วันนี้ในรูป ISO (yyyy-mm-dd) ตามเวลาเครื่องผู้ใช้ */
export const todayIsoLocal = (d: Date = new Date()): string =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** %สะสมรายวัน — key = วันที่มีผล (ISO), value = %สะสม */
export type OilBands = Record<string, number>;

/**
 * รวมงวดจากหลายแหล่ง โดยให้แหล่งที่น่าเชื่อกว่า "แทนที่ทั้งช่วง" ไม่ใช่ทับทีละวัน
 *
 * ไฟล์ที่ bundle มาบันทึกทุกวัน แต่ NAS/RTDB บันทึกเฉพาะวันที่ราคาเปลี่ยน
 * ถ้ารวมด้วยการทับทีละวัน ค่าเก่าจะค้างอยู่ในวันระหว่างงวด แล้วตารางจะนับงวดเกินจริง
 * (ทดสอบแล้ว: NAS ส่ง 4 งวด แต่รวมแบบทับได้ 30 งวด)
 *
 * เรียงจากน่าเชื่อน้อยไปมาก — แหล่งหลังชนะเสมอในช่วงที่ตัวเองครอบคลุม
 */
export function mergeOilBands(...sources: (OilBands | null | undefined)[]): OilBands {
    let result: OilBands = {};
    for (const src of sources) {
        if (!src) continue;
        const dates = Object.keys(src).sort();
        if (!dates.length) continue;
        const from = dates[0];
        // เก็บเฉพาะวันก่อนหน้าที่แหล่งนี้เริ่มครอบคลุม แล้ววางชุดของแหล่งนี้ต่อท้าย
        const kept: OilBands = {};
        for (const [d, v] of Object.entries(result)) if (d < from) kept[d] = v;
        result = { ...kept, ...src };
    }
    return result;
}
