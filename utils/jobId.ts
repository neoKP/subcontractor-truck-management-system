import { db, ref, runTransaction, authReady } from '../firebaseConfig';

export { jobYearCode, formatJobId, nextSeqFromJobs } from './jobIdFormat';

/**
 * ออกเลขใบงานแบบกันชนกัน
 *
 * เดิมนับเลขจากรายการงานที่อยู่ในหน้าจอ แล้วเขียนทับ `jobs/<id>` ตรง ๆ
 * ถ้าสองคนกดสร้างพร้อมกันจาก snapshot เดียวกัน จะได้เลขเดียวกัน และคนที่บันทึก
 * ทีหลัง "เขียนทับ" ใบของคนแรก — ใบงานหายไปเลย ไม่ใช่แค่เลขซ้ำ
 *
 * จึงจองเลขผ่าน transaction ที่ `jobCounters/<ปี>` ซึ่ง Firebase รับประกันว่า
 * ผู้เรียกสองคนจะได้คนละเลขเสมอ
 */

const COUNTER_PATH = 'jobCounters';

/**
 * จองเลขลำดับถัดไปของปีนั้น
 *
 * @param fallbackSeq เลขที่คำนวณจากงานที่มีอยู่ — ใช้ตั้งต้นตัวนับครั้งแรก
 *                    เพื่อไม่ให้ทับใบงานเก่าที่สร้างก่อนมีตัวนับ
 */
export async function reserveJobSeq(yearCode: string, fallbackSeq: number): Promise<number> {
    await authReady;
    const result = await runTransaction(
        ref(db, `${COUNTER_PATH}/${yearCode}`),
        (current: number | null) => {
            // ต้องไม่ต่ำกว่าเลขที่งานจริงใช้ไปแล้ว ไม่ใช่แค่ +1 จากตัวนับ
            //
            // ตัวนับตามหลังงานจริงได้ในหลายกรณี: ตั้งค่าครั้งแรกจาก snapshot ที่โหลดมาไม่ครบ,
            // งานที่นำเข้าจากที่อื่น, หรือไคลเอนต์รุ่นเก่าที่ยังสร้างงานโดยไม่ขยับตัวนับ
            // ถ้าออกเลขที่ถูกใช้ไปแล้ว การเขียน jobs/<id> จะทับใบงานเดิมหายไป
            const stored = typeof current === 'number' && Number.isFinite(current) ? current : 0;
            const seen = Number.isFinite(fallbackSeq) ? fallbackSeq - 1 : 0;
            return Math.max(stored, seen, 0) + 1;
        }
    );

    const seq = result.snapshot.val() as number | null;
    if (typeof seq !== 'number' || !Number.isFinite(seq) || seq < 1) {
        throw new Error('ออกเลขใบงานไม่สำเร็จ กรุณาลองใหม่');
    }
    return seq;
}
