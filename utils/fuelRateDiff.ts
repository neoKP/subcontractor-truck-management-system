import { findRateAt, type FuelRateRow } from './fuelRateParser';
import { supersedes } from './placeZones';
import { canonicalSubcontractor } from './subcontractorAliases';

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
    /**
     * แถวเดิมที่ไฟล์นี้ "แทน" ด้วยแถวต้นทางรวม (ดู placeZones.supersedes)
     * ไม่นับใน removed — โหมดรวมจะลบแถวพวกนี้ ไม่ได้เก็บไว้ ถ้านับรวม หน้าจอจะบอกว่า
     * "เก็บไว้ตามเดิม" ทั้งที่จริงถูกแทน
     */
    superseded: RowChange[];
    /** จำนวนเส้นทางที่ราคา ณ ราคาน้ำมันปัจจุบันเปลี่ยนไป */
    priceChangedCount: number;
}

/**
 * กุญแจระบุเส้นทาง — ต้องตรงกับที่ระบบใช้จับคู่งานกับเรท
 * รวมหมายเหตุด้วยเพราะเส้นทางเดียวกันแยกตามพิกัดน้ำหนักได้ (4w กับ 4wj)
 *
 * ชื่อบริษัทถูกแปลงเป็นชื่อมาตรฐานก่อนเทียบ เพราะหน่วยงานเขียนชื่อเจ้าเดียวกัน
 * ได้หลายแบบ (เช่น "รถร่วมคุณหนึ่ง" กับ "รถร่วมคุณวสรรณ์") ถ้าเทียบดิบ ๆ ไฟล์
 * รอบถัดไปจะถูกรายงานว่า "เพิ่มใหม่ทั้งหมด + เส้นทางเดิมหายทั้งหมด" ทั้งที่
 * ไม่มีอะไรเปลี่ยน ทำให้ผู้ใช้ตัดสินใจจากข้อมูลที่ผิด
 */
export const rowKey = (r: FuelRateRow): string =>
    [canonicalSubcontractor(r.company), r.origin, r.destination, r.truckType, r.note, r.section ?? '']
        .map(v => (v || '').trim().toLowerCase().replace(/\s+/g, ' '))
        .join('|');

/** ช่วงราคาทั้งแถวเหมือนเดิมไหม — เทียบทุกช่อง ไม่ใช่แค่ราคาปัจจุบัน */
const sameBands = (a: FuelRateRow, b: FuelRateRow): boolean => {
    if (a.bands.length !== b.bands.length) return false;
    return a.bands.every((band, i) => {
        const other = b.bands[i];
        // ช่องว่างเทียบแบบ null = undefined — RTDB ไม่เก็บ null ช่องว่างของรุ่นในระบบจึง
        // ไม่มี key price เลย ส่วนไฟล์ที่เพิ่งอ่านเป็น null · ถ้าเทียบ === ตรง ๆ ทุกแถวที่มี
        // ช่องว่างจะขึ้นว่า "แก้ไข" (ไฟล์ 21.08(7): ขึ้น 68 แถว ทั้งที่ราคาเปลี่ยนจริงแถวเดียว)
        return band.fuelFrom === other.fuelFrom
            && band.fuelTo === other.fuelTo
            && (band.price ?? null) === (other.price ?? null);
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
        superseded: [],
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

    const removed: RowChange[] = [];
    const superseded: RowChange[] = [];
    for (const row of before.values()) {
        const oldPrice = findRateAt(row, fuelPrice)?.price ?? null;
        const by = incoming.find(n => supersedes(n, row));
        if (by) {
            // ราคาที่ใช้จริงเปลี่ยนจากแถวเดิมเป็นแถวที่มาแทน — ต้องนับ ไม่งั้นหน้าตัวอย่างบอก 0 (codex P2)
            const newPrice = findRateAt(by, fuelPrice)?.price ?? null;
            superseded.push({ status: 'removed', row, oldPrice, newPrice });
            if (oldPrice !== newPrice) priceChangedCount++;
        } else {
            removed.push({ status: 'removed', row, oldPrice, newPrice: null });
        }
    }

    return { isFirstUpload: false, added, updated, unchanged, removed, superseded, priceChangedCount };
}
