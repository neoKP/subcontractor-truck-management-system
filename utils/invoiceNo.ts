import { db, ref, runTransaction, authReady } from '../firebaseConfig';

export { invoiceYearCode, formatInvoiceNo, nextSeqFromInvoices } from './invoiceNoFormat';

/**
 * ออกเลขใบแจ้งหนี้แบบกันชนกัน — วิธีเดียวกับเลขใบงาน (utils/jobId.ts)
 *
 * เดิมนับจากจำนวนใบที่อยู่ในหน้าจอ ซึ่งพังสองแบบ:
 *   1. สองคนกดออกใบพร้อมกันจาก snapshot เดียวกัน ได้เลขเดียวกัน
 *   2. ลบใบทิ้งไปหนึ่งใบ เลขถัดไปย้อนกลับไปทับใบที่ออกไปแล้ว
 *
 * จึงจองเลขผ่าน transaction ที่ `invoiceCounters/<ปี>` ซึ่ง Firebase รับประกันว่า
 * ผู้เรียกสองคนจะได้คนละเลขเสมอ
 */

const COUNTER_PATH = 'invoiceCounters';

/**
 * @param fallbackSeq เลขที่คำนวณจากใบที่มีอยู่ — ใช้ตั้งต้นตัวนับครั้งแรก
 *                    เพื่อไม่ให้ทับใบเก่าที่ออกก่อนมีตัวนับ
 */
export async function reserveInvoiceSeq(yearCode: string, fallbackSeq: number): Promise<number> {
    await authReady;
    const result = await runTransaction(
        ref(db, `${COUNTER_PATH}/${yearCode}`),
        (current: number | null) => {
            // ต้องไม่ต่ำกว่าเลขที่ใบจริงใช้ไปแล้ว ไม่ใช่แค่ +1 จากตัวนับ
            // ตัวนับตามหลังใบจริงได้ เช่น ตั้งค่าครั้งแรกจาก snapshot ที่โหลดมาไม่ครบ
            const stored = typeof current === 'number' && Number.isFinite(current) ? current : 0;
            const seen = Number.isFinite(fallbackSeq) ? fallbackSeq - 1 : 0;
            return Math.max(stored, seen, 0) + 1;
        }
    );

    const seq = result.snapshot.val() as number | null;
    if (typeof seq !== 'number' || !Number.isFinite(seq) || seq < 1) {
        throw new Error('ออกเลขใบแจ้งหนี้ไม่สำเร็จ กรุณาลองใหม่');
    }
    return seq;
}
