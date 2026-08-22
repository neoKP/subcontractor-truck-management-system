import { roundHalfUp } from './format';
import type { Job } from '../types';

/**
 * การคำนวณเงินของใบแจ้งหนี้รถร่วม — ที่เดียวสำหรับทุกหน้า
 *
 * เดิม PaymentDashboard รวมยอดจาก `cost` อย่างเดียว ส่วน BillingView และใบวางบิล
 * รวม `cost + extraCharge` ทำให้สองหน้าให้ยอดคนละชุดกับงานเดียวกัน
 *
 * ข้อมูลจริงในระบบมีใบที่จ่ายไปแล้วโดยยอดไม่ตรง (INV-2026-0001 ยอดสุทธิ 0
 * แต่จ่าย 18,315 · INV-2026-0004 ยอดสุทธิ -35 แต่จ่าย 3,465) ไฟล์นี้จึงมี
 * ตัวตรวจไว้กันไม่ให้บันทึกแบบนั้นซ้ำอีก
 */

/** ยอดของงานหนึ่งใบที่ต้องจ่ายรถร่วม — ค่าขนส่ง + ค่าใช้จ่ายเพิ่ม */
export const jobPayable = (job: Pick<Job, 'cost' | 'extraCharge'>): number => {
    const cost = Number(job.cost);
    const extra = Number(job.extraCharge);
    return roundHalfUp((Number.isFinite(cost) ? cost : 0) + (Number.isFinite(extra) ? extra : 0));
};

/** ยอดรวมของหลายงาน */
export const sumJobsPayable = (jobs: Pick<Job, 'cost' | 'extraCharge'>[]): number =>
    roundHalfUp(jobs.reduce((sum, j) => sum + jobPayable(j), 0));

export interface InvoiceTotals {
    totalAmount: number;
    totalDeductions: number;
    netAmount: number;
}

/**
 * ยอดของใบแจ้งหนี้
 *
 * ยอดหักถูกจำกัดไม่ให้เกินยอดรวม — ยอดสุทธิติดลบไม่มีความหมายในการจ่ายเงิน
 * และเคยเกิดขึ้นจริงในระบบ (INV-2026-0004 ยอดสุทธิ -35)
 */
export function invoiceTotals(
    jobs: Pick<Job, 'cost' | 'extraCharge'>[],
    deductions: { amount: number }[]
): InvoiceTotals {
    const totalAmount = sumJobsPayable(jobs);
    const rawDeductions = roundHalfUp(
        deductions.reduce((sum, d) => {
            const n = Number(d.amount);
            return sum + (Number.isFinite(n) && n > 0 ? n : 0);
        }, 0)
    );
    const totalDeductions = Math.min(rawDeductions, totalAmount);
    return {
        totalAmount,
        totalDeductions,
        netAmount: roundHalfUp(totalAmount - totalDeductions),
    };
}

/** ภาษีหัก ณ ที่จ่าย — ปัดสองตำแหน่งเหมือนใบวางบิล ไม่ใช่ปัดเป็นจำนวนเต็ม */
export const withholdingTax = (base: number, ratePercent = 1): number =>
    roundHalfUp((base * ratePercent) / 100);

export interface PaymentCheck {
    ok: boolean;
    message?: string;
}

/**
 * ตรวจก่อนบันทึกการจ่ายเงิน
 *
 * @param paidAmount ยอดที่กรอก
 * @param netAmount  ยอดสุทธิของใบ
 */
export function checkPaymentAmount(paidAmount: number, netAmount: number): PaymentCheck {
    if (!Number.isFinite(paidAmount) || paidAmount <= 0) {
        return { ok: false, message: 'กรุณาระบุจำนวนเงินที่จ่ายให้มากกว่า 0' };
    }
    if (!Number.isFinite(netAmount) || netAmount <= 0) {
        return {
            ok: false,
            message: `ยอดสุทธิของใบนี้เป็น ${netAmount} บาท ซึ่งจ่ายไม่ได้ — ตรวจสอบยอดงานและรายการหักก่อน`,
        };
    }
    // ยอมให้ต่างได้เล็กน้อยจากการปัดเศษ แต่ไม่ใช่ต่างกันเป็นหลักบาท
    if (Math.abs(roundHalfUp(paidAmount) - roundHalfUp(netAmount)) > 0.01) {
        return {
            ok: false,
            message: `จำนวนเงินที่จ่าย (${paidAmount.toLocaleString()}) ไม่ตรงกับยอดสุทธิของใบ (${netAmount.toLocaleString()})`,
        };
    }
    return { ok: true };
}
