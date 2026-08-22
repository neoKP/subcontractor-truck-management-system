import { describe, it, expect } from 'vitest';
import { jobYearCode, formatJobId, nextSeqFromJobs } from './jobIdFormat';

describe('formatJobId', () => {
    it('คงรูปแบบเดิมของระบบ JRS-ปี-ลำดับ4หลัก', () => {
        expect(formatJobId('2026', 1)).toBe('JRS-2026-0001');
        expect(formatJobId('2026', 42)).toBe('JRS-2026-0042');
        expect(formatJobId('2026', 1234)).toBe('JRS-2026-1234');
    });

    it('เลขเกินสี่หลักไม่ถูกตัดทิ้ง', () => {
        expect(formatJobId('2026', 12345)).toBe('JRS-2026-12345');
    });
});

describe('jobYearCode', () => {
    it('ใช้ ค.ศ. เต็ม ไม่ใช่ พ.ศ.', () => {
        expect(jobYearCode(new Date(2026, 0, 1))).toBe('2026');
    });
});

describe('nextSeqFromJobs', () => {
    it('เริ่มที่ 1 เมื่อยังไม่มีงานในปีนั้น', () => {
        expect(nextSeqFromJobs([], '2026')).toBe(1);
        expect(nextSeqFromJobs(['JRS-2025-0099'], '2026')).toBe(1);
    });

    it('ต่อจากเลขสูงสุดของปีนั้น', () => {
        expect(nextSeqFromJobs(['JRS-2026-0001', 'JRS-2026-0007', 'JRS-2026-0003'], '2026')).toBe(8);
    });

    it('ไม่นับงานของปีอื่น', () => {
        expect(nextSeqFromJobs(['JRS-2025-9999', 'JRS-2026-0002'], '2026')).toBe(3);
    });

    it('ข้ามเลขที่อ่านไม่ได้แทนที่จะพัง', () => {
        expect(nextSeqFromJobs(['JRS-2026-abcd', 'JRS-2026-0005'], '2026')).toBe(6);
    });

    it('ไม่สับสนกับ id ที่ขึ้นต้นคล้ายกัน', () => {
        // "JRS-20260-0001" ไม่ใช่ของปี 2026 เพราะ prefix ต้องมีขีดคั่น
        expect(nextSeqFromJobs(['JRS-20260-0009'], '2026')).toBe(1);
    });
});
