import { describe, it, expect } from 'vitest';
import { jobPayable, sumJobsPayable, invoiceTotals, withholdingTax, checkPaymentAmount, splitProportionally, isPayableFromBilling, resolvePaymentTargets } from './invoiceMath';

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

describe('splitProportionally', () => {
    const sum = (a: number[]) => Math.round(a.reduce((x, y) => x + y, 0) * 100) / 100;

    it('รวมกันแล้วตรงกับยอดตั้งต้นเสมอ แม้เศษไม่ลงตัว', () => {
        // กรณีจริง: VAT 7.07 แบ่งครึ่ง — ปัดแยกกันจะได้ 3.54+3.54 = 7.08 เกินมา 1 สตางค์
        expect(sum(splitProportionally(7.07, [50.5, 50.5]))).toBe(7.07);
    });

    it.each([
        [7.07, [50.5, 50.5]],
        [100.49, [3333, 3333, 3334]],
        [246.58, [1007.5, 2015, 500]],
        [0.01, [1, 1, 1]],
        [1234.56, [1, 2, 3, 4, 5, 6, 7]],
    ])('ยอด %s แบ่งตามน้ำหนัก %j แล้วรวมกลับได้เท่าเดิม', (total, weights) => {
        expect(sum(splitProportionally(total as number, weights as number[]))).toBe(total);
    });

    it('แบ่งตามสัดส่วนจริง ไม่ใช่หารเท่ากัน', () => {
        const parts = splitProportionally(100, [75, 25]);
        expect(parts[0]).toBe(75);
        expect(parts[1]).toBe(25);
    });

    it('คืนอาร์เรย์ว่างเมื่อไม่มีรายการ', () => {
        expect(splitProportionally(100, [])).toEqual([]);
    });

    it('น้ำหนักรวมเป็น 0 ได้ทุกส่วนเป็น 0 ไม่ใช่ NaN', () => {
        expect(splitProportionally(100, [0, 0])).toEqual([0, 0]);
    });

    it('ยอดที่ใช้ไม่ได้ให้ 0 ทุกส่วน', () => {
        expect(splitProportionally(NaN, [1, 1])).toEqual([0, 0]);
    });

    it('รายการเดียวได้ยอดเต็ม', () => {
        expect(splitProportionally(123.45, [10])).toEqual([123.45]);
    });
});

describe('isPayableFromBilling — กันจ่ายซ้ำสองทาง', () => {
    // จำลองตัวกรองแท็บ "รอจ่าย" ของ BillingView ให้ตรงกับของจริง
    const inToPayTab = (j: any) =>
        j.status === 'Billed' && isPayableFromBilling(j)
        && j.accountingStatus !== 'Paid' && j.accountingStatus !== 'Locked';

    it('งานที่วางบิลแล้วแต่ยังไม่ได้ออกใบแจ้งหนี้ ยังจ่ายที่หน้า Billing ได้', () => {
        expect(inToPayTab({ status: 'Billed', accountingStatus: 'Approved' })).toBe(true);
    });

    it('งานที่อยู่ในใบแจ้งหนี้แล้ว ไม่โผล่ในแท็บรอจ่ายของหน้า Billing', () => {
        expect(inToPayTab({
            status: 'Billed',
            accountingStatus: 'Approved',
            subcontractorInvoiceId: 'INV-2026-0005',
        })).toBe(false);
    });

    it('จ่ายจากใบแจ้งหนี้แล้ว ก็ยังไม่กลับมาโผล่อีก', () => {
        expect(inToPayTab({
            status: 'Billed',
            accountingStatus: 'Paid',
            subcontractorInvoiceId: 'INV-2026-0005',
        })).toBe(false);
    });

    it('ค่าว่างไม่ถือว่าผูกกับใบแจ้งหนี้', () => {
        expect(isPayableFromBilling({ subcontractorInvoiceId: '' })).toBe(true);
        expect(isPayableFromBilling({})).toBe(true);
    });
});

describe('resolvePaymentTargets — อ่านฉบับล่าสุดก่อนบันทึก', () => {
    const j = (id: string, extra: Record<string, unknown> = {}) => ({ id, cost: 1000, ...extra });

    it('ใช้ค่าฉบับล่าสุด ไม่ใช่ค่าที่ค้างอยู่ในหน้าต่าง', () => {
        const opened = [j('J1', { cost: 1000 })];
        const latest = [j('J1', { cost: 1200 })];   // มีคนแก้ค่าจ้างระหว่างนั้น
        const { payable } = resolvePaymentTargets(opened, latest);
        expect(payable[0].cost).toBe(1200);
    });

    it('จับได้ว่ามีคนออกใบแจ้งหนี้ให้งานนี้ระหว่างที่หน้าต่างเปิดค้าง', () => {
        const opened = [j('J1'), j('J2')];
        const latest = [j('J1'), j('J2', { subcontractorInvoiceId: 'INV-2026-0007' })];
        const { payable, blocked } = resolvePaymentTargets(opened, latest);
        expect(payable.map(x => x.id)).toEqual(['J1']);
        expect(blocked.map(x => x.id)).toEqual(['J2']);
    });

    it('รายงานใบงานที่ถูกลบไปแล้ว แทนที่จะเขียนกลับเข้าไปใหม่', () => {
        const { payable, missingIds } = resolvePaymentTargets([j('J1'), j('J9')], [j('J1')]);
        expect(payable.map(x => x.id)).toEqual(['J1']);
        expect(missingIds).toEqual(['J9']);
    });

    it('ปกติแล้วจ่ายได้ทุกใบ', () => {
        const jobs = [j('J1'), j('J2')];
        const r = resolvePaymentTargets(jobs, jobs);
        expect(r.payable).toHaveLength(2);
        expect(r.blocked).toHaveLength(0);
        expect(r.missingIds).toHaveLength(0);
    });
});
