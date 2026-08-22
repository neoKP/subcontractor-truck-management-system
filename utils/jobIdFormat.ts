/**
 * รูปแบบเลขใบงาน — แยกจาก jobId.ts เพราะไฟล์นั้น import firebaseConfig
 * ซึ่งโหลด SDK จาก URL ทำให้ทดสอบตรง ๆ ไม่ได้
 */

/**
 * ปีของเลขใบงาน — ใช้ ค.ศ. เต็มตามรูปแบบเดิมของระบบ (JRS-2026-0001)
 * ห้ามเปลี่ยนรูปแบบ ไม่งั้นเลขใบงานจะไม่ต่อเนื่องกับของเก่า และการค้นหาจะพลาด
 */
export const jobYearCode = (d: Date = new Date()): string => String(d.getFullYear());

export const formatJobId = (yearCode: string, seq: number): string =>
    `JRS-${yearCode}-${String(seq).padStart(4, '0')}`;

/** เลขลำดับถัดไปจากรายการงานที่มีอยู่ — ใช้ตั้งต้นตัวนับเท่านั้น */
export function nextSeqFromJobs(jobIds: string[], yearCode: string): number {
    const prefix = `JRS-${yearCode}-`;
    const seqs = jobIds
        .filter(id => id.startsWith(prefix))
        .map(id => parseInt(id.split('-')[2], 10))
        .filter(n => Number.isFinite(n));
    return seqs.length ? Math.max(...seqs) + 1 : 1;
}
