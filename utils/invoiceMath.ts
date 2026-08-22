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

/**
 * แบ่งยอดรวมออกเป็นส่วน ๆ ตามน้ำหนัก โดยผลรวมต้องเท่ากับยอดตั้งต้นเป๊ะ
 *
 * ปัดแต่ละส่วนแยกกันแล้วรวม จะไม่เท่ากับยอดเดิมเมื่อเศษไม่ลงตัว
 * เช่น VAT 7.07 แบ่งครึ่ง ได้ 3.54 + 3.54 = 7.08 เกินมา 1 สตางค์
 * ยอดที่เก็บไว้ในแต่ละงานจึงรวมแล้วไม่ตรงกับที่พิมพ์ในเอกสาร
 *
 * แก้โดยยกเศษที่เหลือให้ส่วนสุดท้าย
 */
export function splitProportionally(total: number, weights: number[]): number[] {
    if (!weights.length) return [];
    const sumWeights = weights.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(total) || sumWeights <= 0) return weights.map(() => 0);

    const parts = weights.map(w => roundHalfUp((total * w) / sumWeights));
    const assigned = roundHalfUp(parts.slice(0, -1).reduce((a, b) => a + b, 0));
    parts[parts.length - 1] = roundHalfUp(total - assigned);
    return parts;
}

/**
 * งานใบนี้จ่ายจากหน้า Billing (จ่ายรายใบงาน) ได้ไหม
 *
 * มีสองทางจ่ายเงินในระบบ และทั้งสองทางไม่รู้จักกัน:
 *   1. หน้า Billing แท็บ "รอจ่าย" — จ่ายรายใบงาน ไม่รู้จักรายการหัก
 *   2. หน้า "จ่ายเงิน" — จ่ายเป็นใบแจ้งหนี้ มีรายการหักระดับใบ (ค่าปรับ ฯลฯ)
 *
 * ถ้างานที่อยู่ในใบแจ้งหนี้แล้วยังจ่ายจากทางที่ 1 ได้ จะเกิดสองปัญหาพร้อมกัน:
 * จ่ายเกินเพราะไม่หัก และใบแจ้งหนี้ยังค้างสถานะรอจ่าย จึงกดจ่ายซ้ำได้อีกรอบ
 */
export const isPayableFromBilling = (
    job: Pick<Job, 'subcontractorInvoiceId'>
): boolean => !job.subcontractorInvoiceId;

export interface ResolvedPaymentTargets<T> {
    /** ใบงานฉบับล่าสุดที่จ่ายได้ — ใช้ตัวนี้เขียนลงฐานข้อมูล ไม่ใช่ snapshot ตอนเปิดหน้าต่าง */
    payable: T[];
    /** ใบงานที่ถูกออกใบแจ้งหนี้ไปแล้ว ต้องไปจ่ายที่หน้า "จ่ายเงิน" */
    blocked: T[];
    /** ใบงานที่หายไปจากระบบระหว่างที่หน้าต่างเปิดค้าง */
    missingIds: string[];
}

/**
 * หาใบงานฉบับล่าสุดก่อนบันทึกการจ่ายเงิน
 *
 * หน้าต่างยืนยันการจ่ายถูกเปิดค้างไว้ได้นาน ระหว่างนั้นอาจมีคนออกใบแจ้งหนี้ให้งานเดียวกัน
 * หรือแก้ค่าจ้าง ถ้าบันทึกจาก snapshot ตอนกดเลือก จะได้ทั้งจ่ายซ้ำ (การ์ดตรวจจาก
 * ข้อมูลเก่าที่ยังไม่มีเลขใบแจ้งหนี้) และเขียนทับค่าที่คนอื่นเพิ่งแก้
 *
 * @param selected ใบงานที่ผู้ใช้เลือกไว้ตอนเปิดหน้าต่าง
 * @param latest   ใบงานทั้งหมดฉบับล่าสุดจากฐานข้อมูล
 */
export function resolvePaymentTargets<T extends { id: string; subcontractorInvoiceId?: string }>(
    selected: { id: string }[],
    latest: T[]
): ResolvedPaymentTargets<T> {
    const byId = new Map(latest.map(j => [j.id, j]));
    const payable: T[] = [];
    const blocked: T[] = [];
    const missingIds: string[] = [];

    for (const sel of selected) {
        const current = byId.get(sel.id);
        if (!current) {
            missingIds.push(sel.id);
        } else if (isPayableFromBilling(current)) {
            payable.push(current);
        } else {
            blocked.push(current);
        }
    }

    return { payable, blocked, missingIds };
}
