import { describe, it, expect } from 'vitest';
import { invoiceYearCode, formatInvoiceNo, nextSeqFromInvoices } from './invoiceNoFormat';

describe('formatInvoiceNo', () => {
    it('ใช้รูปแบบเดิมของระบบ INV-ปี-ลำดับ 4 หลัก', () => {
        expect(formatInvoiceNo('2026', 1)).toBe('INV-2026-0001');
        expect(formatInvoiceNo('2026', 42)).toBe('INV-2026-0042');
    });

    it('เลขเกิน 4 หลักไม่ถูกตัด', () => {
        expect(formatInvoiceNo('2026', 12345)).toBe('INV-2026-12345');
    });

    it('ปีเป็น ค.ศ. เต็ม ไม่ใช่ พ.ศ. และไม่ใช่สองหลัก', () => {
        expect(invoiceYearCode(new Date(2026, 0, 1))).toBe('2026');
    });
});

describe('nextSeqFromInvoices', () => {
    it('ต่อจากเลขสูงสุด', () => {
        expect(nextSeqFromInvoices(
            ['INV-2026-0001', 'INV-2026-0002', 'INV-2026-0003'], '2026'
        )).toBe(4);
    });

    it('ลบใบกลางทิ้งแล้วต้องไม่ย้อนไปทับใบที่ออกไปแล้ว', () => {
        // บั๊กเดิม: นับจำนวนใบ (3 ใบ + 1 = 4) ซึ่งทับ INV-2026-0004 ที่มีอยู่
        expect(nextSeqFromInvoices(
            ['INV-2026-0001', 'INV-2026-0003', 'INV-2026-0004'], '2026'
        )).toBe(5);
    });

    it('ไม่มีใบเลย เริ่มที่ 1', () => {
        expect(nextSeqFromInvoices([], '2026')).toBe(1);
    });

    it('ใบของปีอื่นไม่ถูกนับรวม', () => {
        expect(nextSeqFromInvoices(
            ['INV-2025-0099', 'INV-2026-0002'], '2026'
        )).toBe(3);
        expect(nextSeqFromInvoices(['INV-2025-0099'], '2026')).toBe(1);
    });

    it('เลขที่อ่านไม่ออกถูกข้าม ไม่ทำให้พัง', () => {
        expect(nextSeqFromInvoices(
            ['INV-2026-abcd', 'INV-2026-0007', '', 'ขยะ'] as string[], '2026'
        )).toBe(8);
    });

    it('ค่าที่ไม่ใช่สตริงไม่ทำให้ระเบิด', () => {
        expect(nextSeqFromInvoices(
            [undefined, null, 'INV-2026-0002'] as unknown as string[], '2026'
        )).toBe(3);
    });
});
