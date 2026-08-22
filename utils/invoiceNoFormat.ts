/**
 * รูปแบบเลขใบแจ้งหนี้รถร่วม — แยกจาก invoiceNo.ts เพราะไฟล์นั้น import
 * firebaseConfig ซึ่งโหลด SDK จาก URL ทำให้ทดสอบตรง ๆ ไม่ได้
 *
 * รูปแบบเดิมของระบบคือ INV-2026-0001 (ค.ศ. เต็ม) ห้ามเปลี่ยน ไม่งั้นเลขจะไม่
 * ต่อเนื่องกับใบที่ออกไปแล้วและการค้นหาจะพลาด
 */

export const invoiceYearCode = (d: Date = new Date()): string => String(d.getFullYear());

export const formatInvoiceNo = (yearCode: string, seq: number): string =>
    `INV-${yearCode}-${String(seq).padStart(4, '0')}`;

/**
 * เลขลำดับถัดไปจากใบที่มีอยู่ — ใช้ตั้งต้นตัวนับเท่านั้น
 *
 * ต้องเอา "เลขสูงสุด + 1" ไม่ใช่ "จำนวนใบ + 1" เพราะถ้ามีใบถูกลบไป
 * การนับจำนวนจะย้อนกลับไปทับเลขที่ออกไปแล้ว
 */
export function nextSeqFromInvoices(invoiceNos: string[], yearCode: string): number {
    const prefix = `INV-${yearCode}-`;
    const seqs = invoiceNos
        .filter(no => typeof no === 'string' && no.startsWith(prefix))
        .map(no => parseInt(no.slice(prefix.length), 10))
        .filter(n => Number.isFinite(n));
    return seqs.length ? Math.max(...seqs) + 1 : 1;
}
