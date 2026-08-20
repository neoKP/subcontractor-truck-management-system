import { db, ref, set, get, remove, authReady } from '../firebaseConfig';
import type { FuelRateRow, ParseIssue } from './fuelRateParser';

/**
 * เก็บ/อ่านตารางเรทค่าขนส่งตามราคาน้ำมันใน RTDB
 *
 * เก็บทุกครั้งที่อัปโหลดเป็น "รุ่น" แยกกัน ไม่เขียนทับของเดิม เพราะเรทที่หน่วยงาน
 * ส่งมาเป็นตัวคิดเงินจริง ถ้าอัปไฟล์ผิดแล้วทับของเก่าทิ้งจะกู้ไม่ได้
 *
 * โครงสร้าง:
 *   fuelRates/meta/<id>      — ข้อมูลสรุปของแต่ละรุ่น (ไม่มี rows)
 *   fuelRates/versions/<id>  — ข้อมูลเต็มพร้อม rows
 *   fuelRates/activeId       — ชี้ว่ารุ่นไหนกำลังใช้งานอยู่
 *
 * แยก meta ออกจาก versions เพราะหน้าประวัติต้องการแค่ชื่อไฟล์/วันที่/จำนวนแถว
 * ถ้าเก็บรวมกัน การเปิดหน้าจะดึงตารางเรทของทุกรุ่นลงมาด้วย (หลักหมื่นแถว)
 */

export interface FuelRateVersion {
    id: string;
    /** ชื่อไฟล์ที่อัปโหลด */
    fileName: string;
    /** ผู้อัปโหลด (ชื่อผู้ใช้ในระบบ) */
    uploadedBy: string;
    /** เวลาอัปโหลด ISO */
    uploadedAt: string;
    /** รูปแบบไฟล์ที่ตัวอ่านตรวจพบ */
    layout: string;
    /** จำนวนเส้นทางในรุ่นนี้ */
    rowCount: number;
    /** ปัญหาที่ตรวจพบตอนอัปโหลด — เก็บไว้ให้ตรวจสอบย้อนหลังได้ */
    issues: ParseIssue[];
    /** หมายเหตุที่ผู้อัปโหลดกรอก */
    note: string;
    rows: FuelRateRow[];
}

/** metadata ของรุ่น (ไม่รวม rows) — ใช้แสดงรายการประวัติโดยไม่ต้องโหลดข้อมูลทั้งก้อน */
export type FuelRateVersionMeta = Omit<FuelRateVersion, 'rows'>;

const VERSIONS_PATH = 'fuelRates/versions';
const META_PATH = 'fuelRates/meta';
const ACTIVE_PATH = 'fuelRates/activeId';

/**
 * id ของรุ่น = เวลาอัปโหลด + ตัวสุ่มสั้น ๆ
 * เรียงตาม id แล้วได้ลำดับเวลา และกันชนกันเมื่อสองคนอัปโหลดวินาทีเดียวกัน
 */
const makeVersionId = (): string => {
    const now = new Date();
    const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
        String(now.getSeconds()).padStart(2, '0'),
    ].join('');
    const rand = Math.random().toString(36).slice(2, 6);
    return `${stamp}-${rand}`;
};

/** RTDB ไม่รับ undefined — ตัดทิ้งก่อนเขียน ไม่งั้น set() จะ throw ทั้งก้อน */
const stripUndefined = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value, (_k, v) => (v === undefined ? null : v)));

export interface SaveVersionInput {
    fileName: string;
    uploadedBy: string;
    layout: string;
    issues: ParseIssue[];
    note: string;
    rows: FuelRateRow[];
}

/** บันทึกรุ่นใหม่และตั้งเป็นรุ่นที่ใช้งาน — คืน id ของรุ่นที่สร้าง */
export async function saveFuelRateVersion(input: SaveVersionInput): Promise<string> {
    await authReady;
    const id = makeVersionId();
    const version: FuelRateVersion = {
        id,
        fileName: input.fileName,
        uploadedBy: input.uploadedBy,
        uploadedAt: new Date().toISOString(),
        layout: input.layout,
        rowCount: input.rows.length,
        issues: input.issues,
        note: input.note,
        rows: input.rows,
    };
    const { rows, ...meta } = version;
    await set(ref(db, `${VERSIONS_PATH}/${id}`), stripUndefined(version));
    await set(ref(db, `${META_PATH}/${id}`), stripUndefined(meta));
    await set(ref(db, ACTIVE_PATH), id);
    return id;
}

/** อ่านรุ่นที่กำลังใช้งาน — null เมื่อยังไม่เคยอัปโหลด */
export async function loadActiveFuelRates(): Promise<FuelRateVersion | null> {
    await authReady;
    const activeSnap = await get(ref(db, ACTIVE_PATH));
    const activeId = activeSnap.val() as string | null;
    if (!activeId) return null;

    const snap = await get(ref(db, `${VERSIONS_PATH}/${activeId}`));
    const v = snap.val() as FuelRateVersion | null;
    if (!v) return null;
    // รุ่นที่ไม่มีแถวข้อมูลถือว่าใช้ไม่ได้ ดีกว่าปล่อยให้หน้าจอแสดงตารางว่าง
    return Array.isArray(v.rows) && v.rows.length ? v : null;
}

/** รายการรุ่นทั้งหมด เรียงใหม่สุดก่อน (ไม่รวม rows เพื่อไม่ดึงข้อมูลหนักเกินจำเป็น) */
export async function listFuelRateVersions(): Promise<{
    versions: FuelRateVersionMeta[];
    activeId: string | null;
}> {
    await authReady;
    const [metaSnap, activeSnap] = await Promise.all([
        get(ref(db, META_PATH)),
        get(ref(db, ACTIVE_PATH)),
    ]);
    const raw = (metaSnap.val() || {}) as Record<string, FuelRateVersionMeta>;
    const versions = Object.values(raw)
        .map(m => ({
            ...m,
            issues: Array.isArray(m.issues) ? m.issues : [],
            rowCount: typeof m.rowCount === 'number' ? m.rowCount : 0,
        }))
        .sort((a, b) => b.id.localeCompare(a.id));
    return { versions, activeId: (activeSnap.val() as string | null) ?? null };
}

/** สลับไปใช้รุ่นอื่น (ย้อนกลับเมื่ออัปโหลดผิด) */
export async function activateFuelRateVersion(id: string): Promise<void> {
    await authReady;
    const snap = await get(ref(db, `${VERSIONS_PATH}/${id}`));
    if (!snap.exists()) throw new Error('ไม่พบรุ่นที่เลือก อาจถูกลบไปแล้ว');
    await set(ref(db, ACTIVE_PATH), id);
}

/** ลบรุ่นที่ไม่ใช้แล้ว — ลบรุ่นที่กำลังใช้งานอยู่ไม่ได้ */
export async function deleteFuelRateVersion(id: string): Promise<void> {
    await authReady;
    const activeSnap = await get(ref(db, ACTIVE_PATH));
    if (activeSnap.val() === id) {
        throw new Error('ลบรุ่นที่กำลังใช้งานอยู่ไม่ได้ — เปลี่ยนไปใช้รุ่นอื่นก่อน');
    }
    await remove(ref(db, `${VERSIONS_PATH}/${id}`));
    await remove(ref(db, `${META_PATH}/${id}`));
}
