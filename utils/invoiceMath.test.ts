import { describe, it, expect } from 'vitest';
import { jobPayable, sumJobsPayable, invoiceTotals, withholdingTax, checkPaymentAmount } from './invoiceMath';

describe('jobPayable', () => {
    it('รวมค่าขนส่งกับค่าใช้จ่ายเพิ่ม', () => {
        expect(jobPayable({ cost: 10000, extraCharge: 500 })).toBe(10500);
    });

    it('งานที่ไม่มีค่าใช้จ่ายเพิ่มได้ค่าขนส่งอย่างเดียว', () => {
        expect(jobPayable({ cost: 10000 })).toBe(10000);
        expect(jobPayable({ cost: 10000, extraCharge: 0 })).toBe(10000);
    });

    it('ค่าที่ใช้ไม่ได้ถือเป็น 0 ไม่ใช่ NaN', () => {
        expect(jobPayable({ cost: NaN, extraCharge: 500 })).toBe(500);
        expect(jobPayable({ cost: undefined, extraCharge: undefined })).toBe(0);
    });

    it('ปัดเศษสองตำแหน่ง', () => {
        expect(jobPayable({ cost: 1000.005, extraCharge: 0 })).toBe(1000.01);
    });
});

describe('sumJobsPayable', () => {
    it('รวมหลายงานพร้อมค่าใช้จ่ายเพิ่ม', () => {
        expect(sumJobsPayable([
            { cost: 10000, extraCharge: 500 },
            { cost: 3500 },
        ])).toBe(14000);
    });

    it('งานว่างได้ 0', () => {
        expect(sumJobsPayable([])).toBe(0);
    });
});

describe('invoiceTotals', () => {
    it('คิดยอดรวม ยอดหัก และยอดสุทธิ', () => {
        const t = invoiceTotals([{ cost: 10000 }], [{ amount: 100 }]);
        expect(t).toEqual({ totalAmount: 10000, totalDeductions: 100, netAmount: 9900 });
    });

    it('ยอดหักเกินยอดรวมถูกจำกัด — ยอดสุทธิห้ามติดลบ', () => {
        // เกิดจริงในระบบ: INV-2026-0004 ยอดสุทธิ -35
        const t = invoiceTotals([{ cost: 10000 }], [{ amount: 12000 }]);
        expect(t.totalDeductions).toBe(10000);
        expect(t.netAmount).toBe(0);
    });

    it('ยอดหักติดลบไม่ถูกนับ', () => {
        expect(invoiceTotals([{ cost: 10000 }], [{ amount: -500 }]).netAmount).toBe(10000);
    });

    it('รวมค่าใช้จ่ายเพิ่มเข้ายอดรวมด้วย', () => {
        // จุดที่สองหน้าเคยคิดต่างกัน
        expect(invoiceTotals([{ cost: 10000, extraCharge: 500 }], []).totalAmount).toBe(10500);
    });
});

describe('withholdingTax', () => {
    it('ปัดสองตำแหน่ง ไม่ใช่จำนวนเต็ม', () => {
        // 10,049 × 1% = 100.49 — เดิมปัดเป็น 100 จ่ายเกิน 0.49
        expect(withholdingTax(10049)).toBe(100.49);
    });

    it('ปัดครึ่งขึ้นถูกต้อง', () => {
        expect(withholdingTax(1007.5)).toBe(10.08);
    });

    it('รับอัตราอื่นได้', () => {
        expect(withholdingTax(10000, 3)).toBe(300);
    });
});

describe('checkPaymentAmount', () => {
    it('ผ่านเมื่อยอดตรงกัน', () => {
        expect(checkPaymentAmount(9900, 9900).ok).toBe(true);
    });

    it('ยอมให้ต่างได้จากการปัดเศษเล็กน้อย', () => {
        expect(checkPaymentAmount(9900.004, 9900).ok).toBe(true);
    });

    it('ปฏิเสธเมื่อจ่าย 0 — เกิดจริงกับ INV-2026-0001', () => {
        const r = checkPaymentAmount(0, 10000);
        expect(r.ok).toBe(false);
        expect(r.message).toContain('มากกว่า 0');
    });

    it('ปฏิเสธเมื่อยอดสุทธิเป็น 0 หรือติดลบ', () => {
        expect(checkPaymentAmount(18315, 0).ok).toBe(false);
        expect(checkPaymentAmount(3465, -35).ok).toBe(false);
    });

    it('ปฏิเสธเมื่อจ่ายไม่ตรงยอดสุทธิ', () => {
        const r = checkPaymentAmount(3465, 10000);
        expect(r.ok).toBe(false);
        expect(r.message).toContain('ไม่ตรง');
    });

    it('ปฏิเสธค่าที่ใช้ไม่ได้', () => {
        expect(checkPaymentAmount(NaN, 10000).ok).toBe(false);
        expect(checkPaymentAmount(-500, 10000).ok).toBe(false);
    });
});
