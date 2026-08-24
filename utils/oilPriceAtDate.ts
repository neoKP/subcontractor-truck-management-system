import { OIL_BASE, type OilBands } from './oilRounds';

/**
 * ราคาดีเซล ณ วันที่ที่กำหนด
 *
 * เรทค่าขนส่งของหน่วยงานผูกกับช่วงราคาน้ำมัน ราคาที่ใช้เปิดตารางจึงต้องเป็น
 * ราคาของ "วันที่ต้องการรถ" ไม่ใช่ราคาวันที่กรอกใบงาน
 *
 * งานที่บันทึกย้อนหลังคือกรณีปกติในระบบนี้ (2,459 จาก 2,482 ใบ) ถ้าใช้ราคาวันนี้
 * ค่าขนส่งจะผิดทั้งเกินและขาด เช่น งานวันที่ 10 ก.ค. ที่ดีเซล 34.94 ควรได้ 1,960
 * แต่คิดด้วยราคาวันนี้ (38.39) จะได้ 2,040 — เกินไป 80 บาทต่อเที่ยว
 */

export type OilAtDateStatus =
    /** พบราคาของงวดที่ครอบคลุมวันนั้น */
    | 'exact'
    /** วันที่อยู่ในอนาคต — ใช้งวดล่าสุดไปก่อน ราคาอาจเปลี่ยนก่อนถึงวันงาน */
    | 'future'
    /** วันที่เก่ากว่างวดแรกที่มีข้อมูล — ไม่รู้ราคาจริง ต้องไม่เดา */
    | 'before-history'
    /** ไม่มีข้อมูลราคาเลย */
    | 'no-data';

export interface OilAtDate {
    /** ราคาดีเซลที่ควรใช้ — 0 เมื่อหาไม่ได้ */
    diesel: number;
    /** วันที่งวดที่ราคานี้มาจาก — ว่างเมื่อหาไม่ได้ */
    effectiveDate: string;
    status: OilAtDateStatus;
    /** ใช้ราคานี้คิดเงินได้ไหม */
    usable: boolean;
    /** จำนวนวันที่วันงานอยู่ข้างหน้า — 0 เมื่อไม่ใช่อนาคต */
    daysAhead: number;
}

const dayOf = (v?: string | null): string => (v || '').split('T')[0];

/** ผลต่างเป็นวัน — บวก = b อยู่หลัง a */
const diffDays = (a: string, b: string): number => {
    const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
    return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : 0;
};

/**
 * หาราคาดีเซลที่ใช้กับวันที่นี้
 *
 * @param byDate ประวัติ %สะสมรายวัน (key = วันแรกของงวด)
 * @param date   วันที่ต้องการรถ
 * @param today  วันนี้ตามเวลาเครื่อง — ใช้บอกว่าวันงานเป็นอนาคตไหม
 *
 * งวดถูกเก็บเป็น "วันแรกที่ราคานี้มีผล" ราคาของวันหนึ่งจึงเป็นของงวดล่าสุด
 * ที่เริ่มไม่เกินวันนั้น ไม่ใช่งวดที่ตรงวันเป๊ะ
 */
export function oilPriceAtDate(
    byDate: OilBands | null | undefined,
    date: string,
    today: string
): OilAtDate {
    const empty: OilAtDate = { diesel: 0, effectiveDate: '', status: 'no-data', usable: false, daysAhead: 0 };
    const want = dayOf(date);
    if (!want) return empty;

    const dates = Object.keys(byDate || {}).filter(Boolean).sort();
    if (!dates.length) return empty;

    const dieselOf = (d: string) => OIL_BASE + (byDate as OilBands)[d];

    // อนาคต — ใช้งวดล่าสุดไปก่อน แต่ต้องบอกผู้ใช้ว่าราคาอาจเปลี่ยน
    // ไม่เดาราคาน้ำมันล่วงหน้า เพราะไม่มีใครรู้ และหน่วยงานเป็นผู้กำหนดเรท
    const todayDay = dayOf(today);
    if (todayDay && want > todayDay) {
        const last = dates[dates.length - 1];
        return {
            diesel: dieselOf(last),
            effectiveDate: last,
            status: 'future',
            usable: true,
            daysAhead: diffDays(todayDay, want),
        };
    }

    // งวดล่าสุดที่เริ่มไม่เกินวันที่ต้องการ
    let hit = '';
    for (const d of dates) {
        if (d <= want) hit = d;
        else break;
    }

    // เก่ากว่างวดแรกที่มี — ไม่รู้ราคาจริง ห้ามใช้งวดแรกแทน
    // ราคาน้ำมันก่อนหน้านั้นอาจต่างมาก การเดาคือคิดเงินผิดโดยไม่มีใครรู้
    if (!hit) {
        return { ...empty, status: 'before-history', effectiveDate: dates[0] };
    }

    return {
        diesel: dieselOf(hit),
        effectiveDate: hit,
        status: 'exact',
        usable: true,
        daysAhead: 0,
    };
}
