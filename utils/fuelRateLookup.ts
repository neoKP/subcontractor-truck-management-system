import { findRateAt, type FuelRateRow } from './fuelRateParser';
import { canonicalSubcontractor } from './subcontractorAliases';
import { canonicalTruckType, truckTypeSpec } from './truckTypeAliases';
import { matchRoute, type RouteMatch } from './placeZones';

/**
 * หาเรทค่าขนส่งตามราคาน้ำมัน สำหรับเส้นทางที่กำลังสร้างใบงาน
 *
 * เรทชุดนี้หน่วยงานคิดมาให้และส่งเป็นไฟล์ ระบบคัดลอกมาตรง ๆ ไม่มีสูตรคำนวณเอง
 * ราคาที่ได้จึงขึ้นกับ "ราคาน้ำมัน ณ ตอนที่เปิดตาราง" ต่างจากราคากลางที่คงที่
 *
 * ไฟล์นี้ทำหน้าที่จับคู่อย่างเดียว การตัดสินใจว่าจะใช้เรทไหนเป็นของผู้ใช้
 */

export interface FuelRateOption {
    /** ผู้รับเหมา — ชื่อมาตรฐานที่ระบบใช้ ไม่ใช่ชื่อดิบในไฟล์ */
    subcontractor: string;
    /** ราคา ณ ราคาน้ำมันที่ส่งเข้ามา */
    price: number;
    /** ช่วงราคาน้ำมันที่ราคานี้ใช้ เช่น "36.99–38.98" — ต้องแสดงให้ผู้ใช้เห็น */
    fuelBand: string;
    /** พิกัดน้ำหนักที่หน่วยงานเขียนไว้ เช่น "บรรทุกไม่เกิน 3000 กก." — ว่างได้ */
    truckSpec: string;
    /** ชื่อตารางย่อยที่แถวนี้มาจาก — ว่างเมื่อมาจากตารางหลัก */
    section: string;
    /** หมายเหตุที่หน่วยงานเขียนกำกับแถวไว้ — ว่างได้ */
    note: string;
    /** แถวต้นทาง เผื่อต้องอ้างอิงย้อนกลับ */
    row: FuelRateRow;
}

const eq = (a: string, b: string): boolean =>
    (a || '').trim().toLowerCase().replace(/\s+/g, ' ') ===
    (b || '').trim().toLowerCase().replace(/\s+/g, ' ');

export interface RouteQuery {
    origin: string;
    destination: string;
    truckType: string;
}

/**
 * หาเรททุกตัวที่ตรงกับเส้นทางนี้ ณ ราคาน้ำมันที่กำหนด
 *
 * ชื่อผู้รับเหมาและประเภทรถถูกปรับให้ตรงมาตรฐานก่อนเทียบ เพราะไฟล์จากหน่วยงาน
 * เขียนคนละแบบกับที่ระบบใช้ ("รถร่วมคุณหนึ่ง" = "รถร่วมคุณวสรรณ์",
 * "4w (บรรทุกไม่เกิน 3000 กก.)" = "4w") ถ้าเทียบดิบ ๆ จะไม่เจอสักแถว
 *
 * แถวที่ราคาน้ำมันปัจจุบันไม่อยู่ในช่วงใดเลย หรือช่วงนั้นราคาเป็น 0 จะไม่ถูกคืน
 * เพราะหน่วยงานยังไม่ได้กำหนดราคาไว้ — ไม่ใช่ค่าขนส่งฟรี และเราเดาแทนไม่ได้
 *
 * @param rows      แถวเรททั้งหมดของรุ่นที่ใช้งาน
 * @param query     เส้นทางที่กำลังสร้าง
 * @param fuelPrice ราคาน้ำมันที่ใช้เปิดตาราง
 */
export function findFuelRateOptions(
    rows: FuelRateRow[],
    query: RouteQuery,
    fuelPrice: number
): FuelRateOption[] {
    if (!rows?.length) return [];
    const wantTruck = canonicalTruckType(query.truckType);
    if (!query.origin?.trim() || !query.destination?.trim() || !wantTruck) return [];

    /*
      จับคู่ชื่อตรงก่อน แล้วค่อยตามเขต (ดู utils/placeZones.ts)

      ผู้รับเหมาที่มีแถวชื่อตรงอยู่แล้ว ตัดแถวตามเขตของเจ้านั้นทิ้ง
      ไม่งั้นเส้นทางเดียวกันจะมีสองราคาให้เลือก (ราคาร้านนี้ กับ ราคาเขต)
      และราคาเฉพาะร้านคือสิ่งที่หน่วยงานตั้งใจกำหนดไว้มากกว่า
    */
    const matched: { row: FuelRateRow; how: RouteMatch }[] = [];
    for (const row of rows) {
        if (!eq(canonicalTruckType(row.truckType), wantTruck)) continue;
        const how = matchRoute(row, query.origin, query.destination);
        if (how) matched.push({ row, how });
    }
    const exactSubs = new Set(
        matched.filter(m => m.how === 'exact').map(m => canonicalSubcontractor(m.row.company))
    );

    const out: FuelRateOption[] = [];
    for (const { row, how } of matched) {
        if (how !== 'exact' && exactSubs.has(canonicalSubcontractor(row.company))) continue;

        const band = findRateAt(row, fuelPrice);
        if (!band) continue;   // ไม่มีเรทในช่วงราคาน้ำมันนี้ — ไม่เดา ไม่ใส่ 0

        out.push({
            subcontractor: canonicalSubcontractor(row.company),
            price: band.price as number,
            fuelBand: `${band.fuelFrom}–${band.fuelTo}`,
            truckSpec: truckTypeSpec(row.truckType),
            section: row.section ?? '',
            note: row.note || '',
            row,
        });
    }

    // ถูกสุดขึ้นก่อน ให้ตรงกับลำดับของตัวเลือกจากราคากลางในหน้าเดียวกัน
    return out.sort((a, b) => a.price - b.price);
}

/**
 * ยืนยันว่าราคาที่อยู่ในฟอร์มมาจากเรทของหน่วยงานจริง
 *
 * ต้องเรียกจาก "ทั้งตอนเรนเดอร์และตอนบันทึก" ด้วยฟังก์ชันเดียวกัน ไม่งั้นสองฝั่ง
 * จะเพี้ยนจากกัน — เคยเกิดมาแล้วว่าตอนบันทึกยอมรับเรทน้ำมัน แต่ปุ่มบันทึกเช็ค
 * เฉพาะราคากลาง ทำให้เส้นทางที่ฟีเจอร์นี้ตั้งใจรองรับกดบันทึกไม่ได้เลย
 *
 * ตรวจกับตารางเรทใหม่ทุกครั้ง ไม่เชื่อค่าที่ค้างในฟอร์ม เพราะผู้ใช้อาจเลือกเรท
 * แล้วย้อนไปแก้เส้นทางหรือประเภทรถ ทำให้ราคาที่ค้างอยู่ไม่ใช่ของเส้นทางจริง
 *
 * @returns ตัวเลือกที่ตรงกัน หรือ undefined ถ้าราคาในฟอร์มไม่ตรงกับเรทใด
 */
export function matchSelectedFuelRate(
    rows: FuelRateRow[],
    query: RouteQuery,
    fuelPrice: number,
    selected: { subcontractor: string; cost: number | string }
): FuelRateOption | undefined {
    const sub = (selected.subcontractor || '').trim();
    if (!sub) return undefined;
    const cost = Number(selected.cost);
    if (!Number.isFinite(cost) || cost <= 0) return undefined;

    return findFuelRateOptions(rows, query, fuelPrice)
        .find(o => o.subcontractor === canonicalSubcontractor(sub) && o.price === cost);
}

/**
 * เส้นทางนี้มีเรทตามน้ำมันอยู่ไหม โดยไม่สนราคาน้ำมันปัจจุบัน
 *
 * ใช้แยกสองกรณีที่ผู้ใช้ต้องเห็นต่างกัน:
 *   - ไม่มีเส้นทางนี้ในตารางเรทเลย
 *   - มีเส้นทาง แต่หน่วยงานยังไม่ได้กำหนดราคาที่ราคาน้ำมันวันนี้
 * ถ้าไม่แยก ผู้ใช้จะเข้าใจว่าเส้นทางไม่มีเรท ทั้งที่จริงแค่ต้องรอราคาจากหน่วยงาน
 */
export function hasFuelRateRoute(rows: FuelRateRow[], query: RouteQuery): boolean {
    if (!rows?.length) return false;
    const wantTruck = canonicalTruckType(query.truckType);
    return rows.some(row =>
        eq(canonicalTruckType(row.truckType), wantTruck) &&
        matchRoute(row, query.origin, query.destination) !== null
    );
}
