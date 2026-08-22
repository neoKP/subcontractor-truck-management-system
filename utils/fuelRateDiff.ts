import { findRateAt, type FuelRateRow } from './fuelRateParser';

/**
 * เทียบไฟล์ที่กำลังจะอัปโหลด กับรุ่นที่ใช้งานอยู่
 *
 * ตอบคำถามว่า "ไฟล์นี้เพิ่มอะไร แก้อะไร และอะไรหายไป" ก่อนกดบันทึก
 * เพราะการอัปโหลดตั้งรุ่นใหม่เป็นรุ่นใช้งานทันที ถ้าไฟล์ขาดเส้นทางไปโดยไม่รู้ตัว
 * งานเส้นทางนั้นจะหาเรทไม่เจอตั้งแต่วินาทีที่กดบันทึก
 */

/** สถานะของเส้นทางหนึ่งเมื่อเทียบกับรุ่นเดิม */
export type RowStatus = 'new' | 'updated' | 'unchanged' | 'removed';

export interface RowChange {
    status: RowStatus;
    row: FuelRateRow;
    /** ราคาเดิม/ใหม่ ณ ราคาน้ำมันปัจจุบัน — ใช้แสดงให้เห็นว่าเงินขยับเท่าไหร่ */
    oldPrice: number | null;
    newPrice: number | null;
}

export interface RateDiff {
    /** true = ยังไม่เคยมีรุ่นในระบบ ไฟล์นี้เป็นชุดแรก */
    isFirstUpload: boolean;
    added: RowChange[];
    updated: RowChange[];
    unchanged: RowChange[];
    removed: RowChange[];
    /** จำนวนเส้นทางที่ราคา ณ ราคาน้ำมันปัจจุบันเปลี่ยนไป */
    priceChangedCount: number;
}

/**
 * กุญแจระบุเส้นทาง — ต้องตรงกับที่ระบบใช้จับคู่งานกับเรท
 * รวมหมายเหตุด้วยเพราะเส้นทางเดียวกันแยกตามพิกัดน้ำหนักได้ (4w กับ 4wj)
 */
export const rowKey = (r: FuelRateRow): string =>
    [r.company, r.origin, r.destination, r.truckType, r.note, r.section ?? '']
        .map(v => (v || '').trim().toLowerCase().replace(/\s+/g, ' '))
        .join('|');

/** ช่วงราคาทั้งแถวเหมือนเดิมไหม — เทียบทุกช่อง ไม่ใช่แค่ราคาปัจจุบัน */
const sameBands = (a: FuelRateRow, b: FuelRateRow): boolean => {
    if (a.bands.length !== b.bands.length) return false;
    return a.bands.every((band, i) => {
        const other = b.bands[i];
        return band.fuelFrom === other.fuelFrom
            && band.fuelTo === other.fuelTo
            && band.price === other.price;
    });
};

/**
 * เทียบสองชุดเรท
 *
 * @param incoming แถวจากไฟล์ที่กำลังอัปโหลด
 * @param current  แถวของรุ่นที่ใช้งานอยู่ — null เมื่อยังไม่เคยอัปโหลด
 * @param fuelPrice ราคาน้ำมันปัจจุบัน ใช้คิดว่าราคาที่ใช้จริงขยับไหม
 */
export function diffFuelRates(
    incoming: FuelRateRow[],
    current: FuelRateRow[] | null,
    fuelPrice: number
): RateDiff {
    const empty: RateDiff = {
        isFirstUpload: true,
        added: [],
        updated: [],
        unchanged: [],
        removed: [],
        priceChangedCount: 0,
    };

    if (!current || !current.length) {
        return {
            ...empty,
            added: incoming.map(row => ({
                status: 'new' as const,
                row,
                oldPrice: null,
                newPrice: findRateAt(row, fuelPrice)?.price ?? null,
            })),
        };
    }

    const before = new Map(current.map(r => [rowKey(r), r]));
    const added: RowChange[] = [];
    const updated: RowChange[] = [];
    const unchanged: RowChange[] = [];
    let priceChangedCount = 0;

    for (const row of incoming) {
        const key = rowKey(row);
        const old = before.get(key);
        const newPrice = findRateAt(row, fuelPrice)?.price ?? null;

        if (!old) {
            added.push({ status: 'new', row, oldPrice: null, newPrice });
            continue;
        }

        before.delete(key);   // ที่เหลือใน map = เส้นทางที่หายไปจากไฟล์ใหม่
        const oldPrice = findRateAt(old, fuelPrice)?.price ?? null;
        if (sameBands(row, old)) {
            unchanged.push({ status: 'unchanged', row, oldPrice, newPrice });
        } else {
            updated.push({ status: 'updated', row, oldPrice, newPrice });
            if (oldPrice !== newPrice) priceChangedCount++;
        }
    }

    const removed: RowChange[] = [...before.values()].map(row => ({
        status: 'removed' as const,
        row,
        oldPrice: findRateAt(row, fuelPrice)?.price ?? null,
        newPrice: null,
    }));

    return { isFirstUpload: false, added, updated, unchanged, removed, priceChangedCount };
}
