/**
 * เทียบวันที่แบบ "วันล้วน" สำหรับตัวกรองช่วงงวด
 *
 * วันที่ในระบบเก็บสองแบบปนกัน: `2026-08-31` จากช่องกรอกวันที่ กับ ISO เต็ม
 * `2026-08-31T08:30:00.000Z` จากค่าที่ระบบเขียนเอง (เช่น วันที่ออกเอกสาร)
 *
 * ถ้าเทียบสตริงตรง ๆ กับปลายงวด `2026-08-31` แบบ ISO จะ "มากกว่า" เสมอ
 * เพราะมีตัว T ต่อท้าย งานของวันสุดท้ายในงวดจึงหายไปจากใบแจ้งหนี้เงียบ ๆ
 * โดยไม่มีอะไรเตือน — ผู้ใช้เห็นแค่ยอดน้อยกว่าที่ควร
 *
 * จึงตัดเวลาออกก่อนเทียบเสมอ และเทียบเป็นสตริง `YYYY-MM-DD` ซึ่งเรียงตรงกับ
 * ลำดับเวลาอยู่แล้ว ไม่ต้องแปลงเป็น Date ให้เจอปัญหาเขตเวลาซ้อนเข้ามาอีก
 */

/** ตัดเวลาออก เหลือเฉพาะ `YYYY-MM-DD` */
export const dayOf = (value?: string | null): string =>
    (value || '').split('T')[0];

/**
 * วันที่นี้อยู่ในช่วงงวดไหม (นับวันต้นงวดและปลายงวดด้วย)
 *
 * @param start ต้นงวด `YYYY-MM-DD` — ค่าว่าง = ไม่จำกัด
 * @param end   ปลายงวด `YYYY-MM-DD` — ค่าว่าง = ไม่จำกัด
 */
export function isWithinPeriod(
    value: string | null | undefined,
    start?: string | null,
    end?: string | null
): boolean {
    const day = dayOf(value);
    if (!day) return false;
    if (start && day < dayOf(start)) return false;
    if (end && day > dayOf(end)) return false;
    return true;
}
