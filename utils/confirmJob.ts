import type { Job } from '../types';
import { JobStatus, AccountingStatus } from '../types';

/**
 * ตรวจว่าใบงานยังอยู่ในสถานะที่ "ยืนยันและล็อกราคา" ได้อยู่ไหม
 *
 * หน้าตรวจทานถูกเปิดค้างไว้ได้นาน ระหว่างนั้นงานอาจถูกจบ วางบิล หรือยกเลิกไปแล้ว
 * ถ้ายืนยันจาก snapshot เก่าโดยไม่เช็ค งานจะถูกดึงกลับมาเป็น "ดำเนินการ"
 * และสถานะบัญชีถูกรีเซ็ต — ใบที่วางบิลไปแล้วย้อนกลับมาอยู่ในคิวตรวจ
 */

export type ConfirmBlockReason =
    | 'missing'        // ใบงานหายไปจากระบบ (ถูกลบ)
    | 'not-assigned'   // สถานะเปลี่ยนไปแล้ว เช่น จบงาน/ยกเลิก
    | 'already-locked' // มีคนยืนยันไปแล้ว
    | 'past-review'    // ผ่านขั้นตรวจของบัญชีไปแล้ว (อนุมัติ/ปิดงวด/จ่ายแล้ว)
    | 'incomplete';    // ข้อมูลไม่ครบ ณ ตอนที่กดยืนยัน

export interface ConfirmCheck {
    ok: boolean;
    reason?: ConfirmBlockReason;
    /** ข้อความอธิบายให้ผู้ใช้อ่าน */
    message?: string;
}

/** สถานะบัญชีที่ถือว่าเลยขั้นตรวจทานไปแล้ว — ยืนยันซ้ำจะทำให้ย้อนขั้น */
const PAST_REVIEW: AccountingStatus[] = [
    AccountingStatus.APPROVED,
    AccountingStatus.LOCKED,
    AccountingStatus.PAID,
];

/**
 * @param latest ใบงานฉบับล่าสุดจากฐานข้อมูล — null = หาไม่เจอ
 */
export function canConfirmJob(
    latest: Job | null,
    /** ราคากลางทั้งหมด — ส่งมาเพื่อตรวจว่าเส้นทางของฉบับล่าสุดยังมีราคาอยู่ */
    priceMatrix?: { origin?: string; destination?: string; truckType?: string; subcontractor?: string }[]
): ConfirmCheck {
    if (!latest) {
        return { ok: false, reason: 'missing', message: 'ไม่พบใบงานนี้ในระบบ อาจถูกลบไปแล้ว' };
    }

    if (latest.status !== JobStatus.ASSIGNED) {
        return {
            ok: false,
            reason: 'not-assigned',
            message: `ใบงานเปลี่ยนสถานะเป็น "${latest.status}" แล้ว ยืนยันจากหน้านี้ไม่ได้`,
        };
    }

    if (latest.accountingStatus && PAST_REVIEW.includes(latest.accountingStatus)) {
        return {
            ok: false,
            reason: 'past-review',
            message: `ใบงานอยู่ในขั้นตอนบัญชีแล้ว (${latest.accountingStatus}) ยืนยันซ้ำจะทำให้ย้อนขั้น`,
        };
    }

    // ล็อกแล้วยังยืนยันซ้ำได้ 2 กรณี:
    //   1. บัญชีตีกลับมาแก้ (REJECTED) — เส้นทางปกติ
    //   2. ล็อกแล้วแต่ไม่มีสถานะบัญชี — งานที่เขียนข้อมูลไม่ครบ ต้องให้ยืนยันใหม่เพื่อกู้คืน
    //      (หน้า dashboard ดึงงานกลุ่มนี้กลับมาแสดง ถ้าบล็อกตรงนี้จะเห็นแต่กดไม่ได้)
    const recoverable = latest.accountingStatus === AccountingStatus.REJECTED
        || !latest.accountingStatus;
    if (latest.isBaseCostLocked && !recoverable) {
        return {
            ok: false,
            reason: 'already-locked',
            message: 'ใบงานนี้ถูกยืนยันและล็อกราคาไปแล้ว',
        };
    }

    // ตรวจความครบกับ "ฉบับล่าสุด" ไม่ใช่ที่เห็นตอนเปิดหน้า
    // ปุ่มยืนยันเปิดจาก snapshot เก่า ถ้าคนอื่นลบทะเบียนรถหรือเปลี่ยนเส้นทางระหว่างนั้น
    // จะส่งงานที่ข้อมูลไม่ครบเข้าบัญชีโดยที่ผู้ตรวจไม่เคยเห็นข้อมูลชุดนั้น
    // รายการนี้ต้องตรงกับที่ ReviewConfirmModal บังคับ (isDataComplete + isFleetInfoComplete)
    // ไม่งั้นจะเกิดช่องว่าง: ปุ่มเปิดให้กดได้ตามกฎหนึ่ง แต่บันทึกตามอีกกฎหนึ่ง
    const missingFields: string[] = [];
    if (!(latest.subcontractor || '').trim()) missingFields.push('ผู้รับเหมา');
    if (!(latest.truckType || '').trim()) missingFields.push('ประเภทรถ');
    if (!(latest.driverName || '').trim()) missingFields.push('ชื่อคนขับ');
    if (!(latest.driverPhone || '').trim()) missingFields.push('เบอร์คนขับ');
    if (!(latest.licensePlate || '').trim()) missingFields.push('ทะเบียนรถ');
    if (!(latest.cost && latest.cost > 0)) missingFields.push('ต้นทุน');

    if (missingFields.length) {
        return {
            ok: false,
            reason: 'incomplete',
            message: `ข้อมูลใบงานไม่ครบแล้ว (${missingFields.join(', ')}) — อาจมีผู้อื่นแก้ไขระหว่างที่เปิดหน้านี้`,
        };
    }

    if (priceMatrix) {
        const norm = (v?: string) => (v || '').trim();
        const hasPrice = priceMatrix.some(p =>
            norm(p.origin) === norm(latest.origin) &&
            norm(p.destination) === norm(latest.destination) &&
            norm(p.truckType) === norm(latest.truckType) &&
            norm(p.subcontractor) === norm(latest.subcontractor)
        );
        if (!hasPrice) {
            return {
                ok: false,
                reason: 'incomplete',
                message: 'เส้นทางหรือผู้รับเหมาของใบงานเปลี่ยนไปและไม่มีราคากลางรองรับ — กรุณาตรวจใหม่',
            };
        }
    }

    return { ok: true };
}

/**
 * ทำเครื่องหมายว่าใบงานผ่านการตรวจทานแล้ว
 *
 * ใช้ใบงาน "ฉบับล่าสุดจากฐานข้อมูล" เป็นฐานทั้งหมด ไม่ใช่ snapshot ตอนเปิดหน้า
 * เพราะหน้าตรวจทานเป็นหน้าอ่านอย่างเดียว (การแก้ไขไปทำที่ modal แก้ไขแยกต่างหาก
 * ซึ่งบันทึกทันทีที่กดบันทึก) จึงไม่มีค่าที่ต้องเอามาจากหน้าจอเลย
 *
 * ถ้าเผลอเอา snapshot เก่ามาทับ สิ่งที่คนอื่นแก้ระหว่างที่หน้าเปิดค้าง —
 * ทะเบียนรถที่ dispatcher ใส่ หรือ POD ที่หน้างานอัปโหลด — จะหายไป
 */
export function markJobReviewed(
    latest: Job,
    reviewer: { name: string; at: string }
): Job {
    return {
        ...latest,
        isBaseCostLocked: true,
        status: JobStatus.ASSIGNED,
        accountingStatus: AccountingStatus.PENDING_REVIEW,
        reviewedAt: reviewer.at,
        reviewedBy: reviewer.name,
    };
}

/**
 * ใบงานเปลี่ยนไปจากตอนที่ผู้ตรวจเปิดหน้าไหม
 *
 * ใช้บอกในประวัติว่าผู้ตรวจกดยืนยันโดยเห็นข้อมูลชุดไหน — ถ้าคนอื่นแก้ราคาหรือ
 * ผู้รับเหมาระหว่างนั้น ผู้ตรวจอาจยืนยันโดยไม่ทันเห็นค่าใหม่
 */
export function describeChanges(opened: Job, latest: Job): { field: string; from: string; to: string }[] {
    const watch: (keyof Job)[] = [
        'cost', 'sellingPrice', 'subcontractor', 'driverName', 'driverPhone', 'licensePlate',
    ];
    const out: { field: string; from: string; to: string }[] = [];
    for (const key of watch) {
        const before = opened[key];
        const after = latest[key];
        if ((before ?? '') !== (after ?? '')) {
            out.push({ field: String(key), from: String(before ?? '-'), to: String(after ?? '-') });
        }
    }
    return out;
}
