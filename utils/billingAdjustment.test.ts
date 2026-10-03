import { describe, it, expect } from 'vitest';
import { adjustJob, summarizeMonth, monthsWithJobs } from './billingAdjustment';
import { OIL_BASE } from './oilRounds';
import type { FuelRateRow } from './fuelRateParser';
import type { Job } from '../types';

/*
  ยอดที่ควรจ่ายเมื่อคิดจากค่าเฉลี่ยรายเดือน

  ข้อตกลงกับหน่วยงาน (2 ต.ค. 2569)
    เปิดใบงาน — ราคาน้ำมันรายวัน (ไม่เปลี่ยน)
    วางบิล    — ค่าเฉลี่ยทั้งเดือนของ "เดือนที่วิ่งงาน"
    วางบิลก่อนสิ้นเดือนไม่ได้ ต้องรอ

  ไฟล์นี้คำนวณให้ดูอย่างเดียว ไม่แก้ยอดในใบงาน เพราะทีมทำบิลนอกระบบ
*/

const pct = (diesel: number): number => Math.round((diesel - OIL_BASE) * 1e6) / 1e6;

/**
 * ก.ย. ครึ่งแรก 40.50 (วันที่ 1-15) ครึ่งหลัง 39.50 (16-30) — ค่าเฉลี่ย 40.00 พอดี
 *
 * ราคาวันที่วิ่งกับค่าเฉลี่ยต้องต่างกัน ไม่งั้นเทสต์แยกไม่ออกว่าส่วนต่างมาจาก
 * ค่าเฉลี่ยจริง หรือมาจากการเอายอดในใบงานไปลบ (บั๊กของรุ่นแรก)
 *   งานวันที่ 15 — วันนั้น 40.50 ช่วง 40.01-41 = 6,050 · ค่าเฉลี่ยช่วง 39.01-40 = 5,940
 *   งานวันที่ 20 — วันนั้น 39.50 ช่วง 39.01-40 = 5,940 · เท่ากับค่าเฉลี่ย
 */
const BANDS = { '2026-01-01': pct(40.50), '2026-09-16': pct(39.50) };

const rateRow = (over: Partial<FuelRateRow> = {}): FuelRateRow => ({
    seq: 1,
    company: 'YSK TRANSPORT',
    origin: 'กทม ปริมณฑล',
    destination: 'อุทัยธานี / ชัยนาท',
    truckType: '6W',
    note: '',
    bands: [
        { fuelFrom: 38.01, fuelTo: 39.00, price: 5830 },
        { fuelFrom: 39.01, fuelTo: 40.00, price: 5940 },
        { fuelFrom: 40.01, fuelTo: 41.00, price: 6050 },
    ],
    ...over,
});

const job = (over: Partial<Job> = {}): Job => ({
    id: 'JOB-1',
    dateOfService: '2026-09-15',
    origin: 'กทม ปริมณฑล',
    destination: 'อุทัยธานี / ชัยนาท',
    truckType: '6W',
    subcontractor: 'YSK TRANSPORT',
    cost: 6050,
    ...over,
} as Job);

describe('adjustJob — ยอดที่ควรจ่ายของงานใบเดียว', () => {
    it('คิดจากค่าเฉลี่ยของเดือนที่วิ่งงาน ไม่ใช่ราคาวันที่วิ่ง', () => {
        // งานเปิดไว้ 6,050 (ราคาวันนั้น 40.50 อยู่ช่วง 40.01-41)
        // ค่าเฉลี่ยทั้งเดือน 40.00 ซึ่งอยู่ช่วง 39.01-40 = 5,940
        const r = adjustJob(job(), [rateRow()], BANDS, '2026-10-02');

        expect(r.status).toBe('adjusted');
        expect(r.dailyDiesel).toBe(40.5);
        expect(r.dailyCost).toBe(6050);
        expect(r.dailyBand).toBe('40.01–41');
        expect(r.adjustedCost).toBe(5940);
        expect(r.difference).toBe(-110);
        expect(r.avgDiesel).toBe(40);
        expect(r.band).toBe('39.01–40');
    });

    it('ยอดเท่าเดิมต้องบอกว่า unchanged ไม่ใช่ adjusted', () => {
        // คนอ่านรายงานต้องแยกออกว่าแถวไหนต้องแก้ แถวไหนปล่อยได้
        const r = adjustJob(job({ dateOfService: '2026-09-20', cost: 5940 }), [rateRow()], BANDS, '2026-10-02');

        expect(r.status).toBe('unchanged');
        expect(r.difference).toBe(0);
    });

    /*
      เดือนที่ยังไม่จบ ต้องไม่คืนยอด — ข้อตกลงคือ "รอ"

      ถ้าคืนยอดชั่วคราวออกไป คนทำบิลอาจเอาไปใช้แล้วต้องตามแก้ทีหลัง
      ซึ่งเป็นสิ่งที่ข้อตกลงตั้งใจเลี่ยง
    */
    it('เดือนที่ยังไม่จบ ต้องบอกให้รอ ไม่คืนยอด', () => {
        const r = adjustJob(job(), [rateRow()], BANDS, '2026-09-20');

        expect(r.status).toBe('month-not-over');
        expect(r.adjustedCost).toBeNull();
        expect(r.difference).toBeNull();
    });

    it('หาเรทของเส้นทางนี้ไม่เจอ ต้องบอกว่า no-rate ไม่ใช่เดาราคา', () => {
        const r = adjustJob(
            job({ destination: 'ปลายทางที่ไม่มีในตาราง' }),
            [rateRow()],
            BANDS,
            '2026-10-02'
        );

        expect(r.status).toBe('no-rate');
        expect(r.adjustedCost).toBeNull();
    });

    it('เส้นทางเดียวกันคนละผู้รับเหมา ต้องไม่หยิบเรทผิดเจ้า', () => {
        // ใบงานเป็นของ KNN แต่ในตารางมีแต่ของ YSK — ห้ามเอาราคา YSK มาใช้
        const r = adjustJob(
            job({ subcontractor: 'KNN DYNAMIC' }),
            [rateRow()],
            BANDS,
            '2026-10-02'
        );

        expect(r.status).toBe('no-rate');
    });

    it('ชื่อสถานที่สะกดต่างจากตารางเรท แต่อยู่ในทะเบียน ต้องหาเรทเจอ', () => {
        // ใบงานเขียน "มาม่า ลำพูน" ตารางเรทเขียน "มาม่าลำพูน" — ที่เดียวกัน
        const r = adjustJob(
            job({ origin: 'มาม่า ลำพูน' }),
            [rateRow({ origin: 'มาม่าลำพูน' })],
            BANDS,
            '2026-10-02'
        );

        expect(r.status).toBe('adjusted');
        expect(r.adjustedCost).toBe(5940);
    });

    /*
      บั๊กของรุ่นแรก (เจอกับข้อมูลจริง ก.ย. 2569)

      ใบงานซีโน่ → แม่สอด เปิดด้วยราคาตกลง 23,500 ซึ่งไม่ตรงช่องไหนในตาราง
      รุ่นแรกเอา 27,440 (ราคาตามค่าเฉลี่ย) ลบ 23,500 ได้ +3,940 ต่อใบ
      ทั้งที่ผลของค่าเฉลี่ยจริงอยู่หลักสิบ · ยอดรวมทั้งเดือนจึงสูงเกินจริงหลายพัน
    */
    it('ยอดในใบงานไม่ตรงกับตาราง ต้องแยกเป็น cost-mismatch และส่วนต่างต้องไม่ลบด้วยยอดในใบงาน', () => {
        const r = adjustJob(job({ cost: 23500 }), [rateRow()], BANDS, '2026-10-02');

        expect(r.status).toBe('cost-mismatch');
        expect(r.originalCost).toBe(23500);
        expect(r.dailyCost).toBe(6050);
        // ส่วนต่างคือผลของค่าเฉลี่ยตามตารางเท่านั้น
        expect(r.difference).toBe(-110);
    });

    it('ไม่รู้ราคาตามตารางของวันที่วิ่ง ต้องบอกว่า no-daily-rate ไม่ใช่เดาตัวตั้ง', () => {
        // วันที่ 1 ราคา 43 — ตารางมีถึง 41 เท่านั้น จึงไม่รู้ว่าวันนั้นควรเปิดงานที่เท่าไร
        // ค่าเฉลี่ย (43 + 29×39.5)/30 = 39.617 ยังอยู่ในตาราง
        const bands = { '2026-01-01': pct(43), '2026-09-02': pct(39.50) };
        const r = adjustJob(job({ dateOfService: '2026-09-01' }), [rateRow()], bands, '2026-10-02');

        expect(r.status).toBe('no-daily-rate');
        expect(r.adjustedCost).toBe(5940);
        expect(r.dailyCost).toBeNull();
        expect(r.difference).toBeNull();
    });

    it('ใบงานที่ข้อมูลไม่ครบ ต้องบอกว่า incomplete', () => {
        for (const miss of [{ dateOfService: '' }, { origin: '' }, { destination: '' }, { truckType: '' }]) {
            const r = adjustJob(job(miss), [rateRow()], BANDS, '2026-10-02');
            expect(r.status, JSON.stringify(miss)).toBe('incomplete');
        }
    });

    it('ใช้เดือนจากวันที่วิ่งงาน ไม่ใช่เดือนที่วางบิล', () => {
        /*
          งานวันที่ 28 ส.ค. ที่มาวางบิลเดือน ต.ค. ต้องใช้ค่าเฉลี่ยเดือนสิงหาคม
          ถ้าใช้เดือนที่วางบิล ยอดจะผิดทุกใบที่ข้ามเดือน
        */
        const bands = { '2026-01-01': pct(38.50), '2026-09-01': pct(40.50) };
        const r = adjustJob(job({ dateOfService: '2026-08-28' }), [rateRow()], bands, '2026-10-02');

        expect(r.month).toBe('2026-08');
        expect(r.avgDiesel).toBe(38.5);
        expect(r.adjustedCost).toBe(5830);   // ช่วง 38.01-39
    });

    it('รับวันที่แบบ timestamp เต็มได้', () => {
        const r = adjustJob(job({ dateOfService: '2026-09-15T08:30:00Z' }), [rateRow()], BANDS, '2026-10-02');

        expect(r.dateOfService).toBe('2026-09-15');
        expect(r.month).toBe('2026-09');
        expect(r.status).toBe('adjusted');
    });
});

describe('summarizeMonth — สรุปทั้งเดือนสำหรับวางบิล', () => {
    const rows = [rateRow()];

    it('กรองเฉพาะงานของเดือนที่เลือก', () => {
        const jobs = [
            job({ id: 'A', dateOfService: '2026-09-05' }),
            job({ id: 'B', dateOfService: '2026-08-31' }),
            job({ id: 'C', dateOfService: '2026-10-01' }),
        ];

        const s = summarizeMonth(jobs, '2026-09', rows, BANDS, '2026-10-02');

        expect(s.jobs).toHaveLength(1);
        expect(s.jobs[0].jobId).toBe('A');
    });

    it('รวมยอดเฉพาะงานที่คำนวณได้ ไม่นับงานที่หาเรทไม่เจอ', () => {
        const jobs = [
            job({ id: 'A', cost: 6050 }),                                  // -> 5940
            job({ id: 'B', cost: 6050, destination: 'ไม่มีในตาราง' }),      // no-rate
        ];

        const s = summarizeMonth(jobs, '2026-09', rows, BANDS, '2026-10-02');

        expect(s.totalOriginal).toBe(6050);
        expect(s.totalAdjusted).toBe(5940);
        expect(s.totalDifference).toBe(-110);
        expect(s.problemCount).toBe(1);
    });

    it('นับแยกว่าแถวไหนต้องแก้ แถวไหนเท่าเดิม แถวไหนมีปัญหา', () => {
        const jobs = [
            job({ id: 'A', cost: 6050 }),                             // adjusted
            job({ id: 'B', cost: 5940, dateOfService: '2026-09-20' }), // unchanged
            job({ id: 'C', cost: 6050, truckType: '' }),              // incomplete
            job({ id: 'D', cost: 23500 }),                            // cost-mismatch
        ];

        const s = summarizeMonth(jobs, '2026-09', rows, BANDS, '2026-10-02');

        expect(s.adjustedCount).toBe(1);
        expect(s.unchangedCount).toBe(1);
        expect(s.mismatchCount).toBe(1);
        expect(s.problemCount).toBe(2);
    });

    it('ใบงานที่ยอดไม่ได้มาจากตาราง ต้องไม่ถูกนับรวมยอด', () => {
        // ถ้านับรวม ยอดรวมจะปนราคาตกลงเองเข้ามา — ตัวเลขที่ทำให้หน้าจอขึ้น +8,954
        const jobs = [
            job({ id: 'A', cost: 6050 }),     // 6,050 -> 5,940
            job({ id: 'D', cost: 23500 }),    // ไม่นับ
        ];

        const s = summarizeMonth(jobs, '2026-09', rows, BANDS, '2026-10-02');

        expect(s.totalOriginal).toBe(6050);
        expect(s.totalAdjusted).toBe(5940);
        expect(s.totalDifference).toBe(-110);
    });

    it('เดือนที่ยังไม่จบ ต้องไม่มียอดรวมออกมา', () => {
        const s = summarizeMonth([job()], '2026-09', rows, BANDS, '2026-09-20');

        expect(s.average.usable).toBe(false);
        expect(s.totalAdjusted).toBe(0);
        expect(s.problemCount).toBe(1);
    });

    it('ไม่มีงานในเดือนนั้น ต้องไม่พัง', () => {
        const s = summarizeMonth([], '2026-09', rows, BANDS, '2026-10-02');

        expect(s.jobs).toEqual([]);
        expect(s.totalDifference).toBe(0);
    });
});

describe('monthsWithJobs — เดือนที่มีงานให้เลือก', () => {
    it('เรียงจากใหม่ไปเก่า และไม่ซ้ำ', () => {
        const jobs = [
            job({ dateOfService: '2026-08-01' }),
            job({ dateOfService: '2026-09-15' }),
            job({ dateOfService: '2026-09-28' }),
            job({ dateOfService: '2026-07-10' }),
        ];

        expect(monthsWithJobs(jobs)).toEqual(['2026-09', '2026-08', '2026-07']);
    });

    it('ข้ามใบงานที่วันที่เสียหรือว่าง', () => {
        const jobs = [
            job({ dateOfService: '2026-09-01' }),
            job({ dateOfService: '' }),
            job({ dateOfService: 'ไม่ใช่วันที่' }),
        ];

        expect(monthsWithJobs(jobs)).toEqual(['2026-09']);
    });
});

describe('adjustJob — เรทตามเขต (utils/placeZones.ts)', () => {
    // ใบงานจากคลอง13 ไปร้านในนครสวรรค์ — ตาราง YSK เขียนเป็นเขต
    const zoneJob = (over: Partial<Job> = {}) => job({
        origin: 'นีโอคอร์ปอเรท คลอง13',
        destination: 'ร้านสล.โฮลเซลล์ นครสวรรค์',
        truckType: '10W',
        cost: 6050,
        ...over,
    });
    const zoneRow = (over: Partial<FuelRateRow> = {}) => rateRow({
        origin: 'กทม ปริมณฑล', destination: 'นครสวรรค์', truckType: '10W', ...over,
    });

    it('หาเรทเจอผ่านเขต และบอกว่าใช้แถวไหน', () => {
        const r = adjustJob(zoneJob(), [zoneRow()], BANDS, '2026-10-02');

        expect(r.status).toBe('adjusted');
        expect(r.matchedBy).toBe('inferred');
        expect(r.rateRoute).toBe('กทม ปริมณฑล → นครสวรรค์');
    });

    it('มีแถวชื่อตรง ต้องใช้แถวนั้น ไม่ใช่แถวเขต', () => {
        const shop = zoneRow({
            origin: 'นีโอคอร์ปอเรท คลอง13', destination: 'ร้านสล.โฮลเซลล์ นครสวรรค์',
            bands: [
                { fuelFrom: 39.01, fuelTo: 40.00, price: 5500 },
                { fuelFrom: 40.01, fuelTo: 41.00, price: 5600 },
            ],
        });
        // วางแถวเขตไว้ก่อน — ต้องยังเลือกแถวชื่อตรง
        const r = adjustJob(zoneJob({ cost: 5600 }), [zoneRow(), shop], BANDS, '2026-10-02');

        expect(r.matchedBy).toBe('exact');
        expect(r.adjustedCost).toBe(5500);
    });

    it('ตามเขตแล้วเจอหลายแถว ต้องไม่เลือกให้', () => {
        // ไม่รู้ว่าแถวไหนถูก — เลือกแถวแรกเงียบ ๆ คือการเดาราคา
        const a = zoneRow({ seq: 1 });
        const b = zoneRow({ seq: 2, origin: 'งานย่อย' });
        const r = adjustJob(zoneJob(), [a, b], BANDS, '2026-10-02');

        expect(r.status).toBe('no-rate');
    });

    it('ชื่อตรงอยู่แล้วต้องบอกว่า exact', () => {
        const r = adjustJob(job(), [rateRow()], BANDS, '2026-10-02');
        expect(r.matchedBy).toBe('exact');
        expect(r.rateRoute).toBe('กทม ปริมณฑล → อุทัยธานี / ชัยนาท');
    });
});
