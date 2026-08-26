import { rowKey } from './fuelRateDiff';
import type { FuelRateRow } from './fuelRateParser';

/**
 * รวมแถวจากไฟล์เข้ากับรุ่นที่ใช้อยู่
 *
 * ใช้ rowKey ตัวเดียวกับที่หน้าเปรียบเทียบใช้ (บริษัท|ต้นทาง|ปลายทาง|ประเภทรถ|หมายเหตุ|section)
 * เพื่อให้สิ่งที่ผู้ใช้เห็นในตาราง "เพิ่มใหม่ / อัปเดต / หายไป" ตรงกับสิ่งที่บันทึกจริง
 * ถ้าใช้กุญแจคนละชุด ตัวเลขบนหน้าจอจะโกหก
 *
 * แถวจากไฟล์ชนะเสมอเมื่อกุญแจตรงกัน — ไฟล์ใหม่คือสิ่งที่หน่วยงานเพิ่งส่งมา
 * ลำดับผลลัพธ์: ของเดิมก่อน (คงลำดับไว้) แล้วต่อท้ายด้วยเส้นทางที่เพิ่งเพิ่ม
 */
export function mergeFuelRateRows(current: FuelRateRow[], incoming: FuelRateRow[]): FuelRateRow[] {
    /*
      ไฟล์เดียวกันมีเส้นทางซ้ำในตัวเองได้ (parser เตือนเป็น duplicate-route
      แต่ผู้ใช้กดผ่านได้) — ต้องตัดสินให้ชัดว่าเอาแถวไหน

      เลือก "แถวแรก" เพราะเป็นแถวที่ผู้ใช้เห็นก่อนในตารางตัวอย่าง และตรงกับ
      ลำดับที่หน้าเปรียบเทียบไล่อ่าน · ถ้าใช้ Map(incoming.map(...)) ตรง ๆ
      จะได้แถวสุดท้ายแทน แล้วสิ่งที่บันทึกจะไม่ตรงกับสิ่งที่แสดงบนหน้าจอ
    */
    const incomingByKey = new Map<string, FuelRateRow>();
    for (const row of incoming) {
        const k = rowKey(row);
        if (!incomingByKey.has(k)) {
            incomingByKey.set(k, row);
        }
    }

    const used = new Set<string>();

    const merged: FuelRateRow[] = current.map(row => {
        const k = rowKey(row);
        const replacement = incomingByKey.get(k);
        if (replacement) {
            used.add(k);
            return replacement;
        }
        return row;
    });

    /*
      ต่อท้ายเฉพาะเส้นทางที่ยังไม่เคยถูกใส่ — ทั้งที่ไม่ตรงกับของเดิม
      และที่ซ้ำกันเองในไฟล์ · used ทำหน้าที่ทั้งสองอย่าง จึงไม่มีทาง
      ได้แถวที่มี rowKey เดียวกันสองแถวในผลลัพธ์
    */
    for (const row of incoming) {
        const k = rowKey(row);
        if (!used.has(k)) {
            used.add(k);
            merged.push(row);
        }
    }
    return merged;
}
