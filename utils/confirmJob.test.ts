import { describe, it, expect } from 'vitest';
import { canConfirmJob, markJobReviewed, describeChanges } from './confirmJob';
import { JobStatus, AccountingStatus, type Job } from '../types';

const mk = (over: Partial<Job> = {}): Job => ({
    id: 'JRS-2026-0001',
    status: JobStatus.ASSIGNED,
    dateOfService: '2026-08-22',
    origin: 'สมุทรสาคร',
    destination: 'แม่สอด',
    truckType: '6w',
    subcontractor: 'KNN',
    driverName: 'สมชาย',
    driverPhone: '0812345678',
    licensePlate: '1กก-1234',
    cost: 10000,
    sellingPrice: 12000,
    requestedBy: 'BOOKING_001',
    requestedByName: 'ผู้จอง',
    createdAt: '2026-08-22T01:00:00.000Z',
    drops: [],
    ...over,
} as Job);

describe('canConfirmJob', () => {
    it('ยืนยันได้เมื่อยังไม่ล็อกและสถานะเป็น Assigned', () => {
        expect(canConfirmJob(mk()).ok).toBe(true);
    });

    it('ยืนยันได้เมื่อบัญชีตีกลับมาแก้ แม้จะเคยล็อกแล้ว', () => {
        expect(canConfirmJob(mk({
            isBaseCostLocked: true,
            accountingStatus: AccountingStatus.REJECTED,
        })).ok).toBe(true);
    });

    it('ปฏิเสธเมื่อหาใบงานไม่เจอ', () => {
        const r = canConfirmJob(null);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('missing');
    });

    it.each([JobStatus.COMPLETED, JobStatus.BILLED, JobStatus.CANCELLED])(
        'ปฏิเสธเมื่อสถานะเปลี่ยนเป็น %s แล้ว',
        (status) => {
            const r = canConfirmJob(mk({ status }));
            expect(r.ok).toBe(false);
            expect(r.reason).toBe('not-assigned');
        }
    );

    it.each([AccountingStatus.APPROVED, AccountingStatus.LOCKED, AccountingStatus.PAID])(
        'ปฏิเสธเมื่อบัญชีดำเนินการไปแล้ว (%s) — ยืนยันซ้ำจะย้อนขั้น',
        (accountingStatus) => {
            const r = canConfirmJob(mk({ isBaseCostLocked: true, accountingStatus }));
            expect(r.ok).toBe(false);
            expect(r.reason).toBe('past-review');
        }
    );

    it('ปฏิเสธเมื่อมีคนยืนยันไปแล้ว', () => {
        const r = canConfirmJob(mk({
            isBaseCostLocked: true,
            accountingStatus: AccountingStatus.PENDING_REVIEW,
        }));
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('already-locked');
    });

    it('ยืนยันได้เมื่อล็อกแล้วแต่ไม่มีสถานะบัญชี — งานที่เขียนข้อมูลไม่ครบ', () => {
        // สถานะนี้หลุดจากทั้งหน้าตรวจทานและหน้าบัญชี ต้องกู้คืนได้
        // ไม่งั้นงานจะโผล่ในคิวแต่กดยืนยันไม่ได้ กลายเป็นทางตัน
        expect(canConfirmJob(mk({ isBaseCostLocked: true, accountingStatus: undefined })).ok).toBe(true);
    });

    it('มีข้อความอธิบายทุกกรณีที่ปฏิเสธ', () => {
        for (const job of [
            null,
            mk({ status: JobStatus.COMPLETED }),
            mk({ isBaseCostLocked: true, accountingStatus: AccountingStatus.PAID }),
            mk({ isBaseCostLocked: true, accountingStatus: AccountingStatus.PENDING_REVIEW }),
        ]) {
            const r = canConfirmJob(job);
            expect(r.ok).toBe(false);
            expect(r.message && r.message.length).toBeGreaterThan(0);
        }
    });
});

describe('canConfirmJob — ตรวจความครบกับฉบับล่าสุด', () => {
    it.each([
        ['ผู้รับเหมา', { subcontractor: '' }],
        ['ประเภทรถ', { truckType: '' }],
        ['ชื่อคนขับ', { driverName: '' }],
        ['เบอร์คนขับ', { driverPhone: '' }],
        ['ทะเบียนรถ', { licensePlate: '' }],
        ['ต้นทุน', { cost: 0 }],
    ])('ปฏิเสธเมื่อ %s หายไประหว่างที่หน้าเปิดค้าง', (_label, patch) => {
        const r = canConfirmJob(mk(patch as Partial<Job>));
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('incomplete');
    });

    it('ยืนยันได้เมื่อเส้นทางยังมีราคากลางรองรับ', () => {
        const matrix = [{ origin: 'สมุทรสาคร', destination: 'แม่สอด', truckType: '6w', subcontractor: 'KNN' }];
        expect(canConfirmJob(mk(), matrix).ok).toBe(true);
    });

    it('ปฏิเสธเมื่อเส้นทางถูกเปลี่ยนจนไม่มีราคากลาง', () => {
        const matrix = [{ origin: 'สมุทรสาคร', destination: 'แม่สอด', truckType: '6w', subcontractor: 'KNN' }];
        const r = canConfirmJob(mk({ subcontractor: 'YSK' }), matrix);
        expect(r.ok).toBe(false);
        expect(r.reason).toBe('incomplete');
    });

    it('ข้ามการตรวจราคากลางเมื่อไม่ได้ส่งตารางมา', () => {
        expect(canConfirmJob(mk()).ok).toBe(true);
    });
});

describe('markJobReviewed', () => {
    const reviewer = { name: 'บัญชี A', at: '2026-08-22T05:00:00.000Z' };

    it('ใช้ข้อมูลล่าสุดทั้งหมด ไม่เอา snapshot เก่ามาทับ', () => {
        // ทะเบียนรถที่ dispatcher เพิ่งใส่ และ POD ที่หน้างานเพิ่งอัปโหลด ต้องอยู่ครบ
        const latest = mk({
            licensePlate: '1กก-1234',
            driverName: 'สมชาย',
            podImageUrls: ['pod.jpg'],
        });
        const merged = markJobReviewed(latest, reviewer);
        expect(merged.licensePlate).toBe('1กก-1234');
        expect(merged.driverName).toBe('สมชาย');
        expect(merged.podImageUrls).toEqual(['pod.jpg']);
    });

    it('ไม่แตะราคาที่บันทึกไว้', () => {
        const merged = markJobReviewed(mk({ cost: 12345, sellingPrice: 15000 }), reviewer);
        expect(merged.cost).toBe(12345);
        expect(merged.sellingPrice).toBe(15000);
    });

    it('ตั้งสถานะยืนยันและผู้ตรวจถูกต้อง', () => {
        const merged = markJobReviewed(mk(), reviewer);
        expect(merged.isBaseCostLocked).toBe(true);
        expect(merged.status).toBe(JobStatus.ASSIGNED);
        expect(merged.accountingStatus).toBe(AccountingStatus.PENDING_REVIEW);
        expect(merged.reviewedBy).toBe('บัญชี A');
        expect(merged.reviewedAt).toBe(reviewer.at);
    });
});

describe('describeChanges', () => {
    it('บอกช่องที่คนอื่นแก้ระหว่างที่หน้าเปิดค้าง', () => {
        const opened = mk({ cost: 10000 });
        const latest = mk({ cost: 11500 });
        const changes = describeChanges(opened, latest);
        expect(changes.map(c => c.field)).toEqual(['cost']);
        expect(changes[0]).toMatchObject({ from: '10000', to: '11500' });
    });

    it('ไม่รายงานอะไรเมื่อไม่มีใครแก้', () => {
        expect(describeChanges(mk(), mk())).toEqual([]);
    });

    it('จับการเปลี่ยนผู้รับเหมาและคนขับได้', () => {
        const opened = mk({ subcontractor: 'KNN', driverName: 'สมชาย' });
        const latest = mk({ subcontractor: 'YSK', driverName: 'สมหญิง' });
        expect(describeChanges(opened, latest).map(c => c.field).sort())
            .toEqual(['driverName', 'subcontractor']);
    });
});
