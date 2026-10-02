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

/** ราคาน้ำมันคงที่ 40.00 ทั้งเดือน ก.ย. — ค่าเฉลี่ยจึงเป็น 40.00 พอดี */
const BANDS = { '2026-01-01': pct(40.00) };

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
        // งานเปิดไว้ 6,050 (ราคาวันนั้นอยู่ช่วง 40.01-41)
        // ค่าเฉลี่ยทั้งเดือน 40.00 ซึ่งอยู่ช่วง 39.01-40 = 5,940
        const r = adjustJob(job(), [rateRow()], BANDS, '2026-10-02');

        expect(r.status).toBe('adjusted');
        expect(r.adjustedCost).toBe(5940);
        expect(r.difference).toBe(-110);
        expect(r.avgDiesel).toBe(40);
        expect(r.band).toBe('39.01–40');
    });

    it('ยอดเท่าเดิมต้องบอกว่า unchanged ไม่ใช่ adjusted', () => {
        // คนอ่านรายงานต้องแยกออกว่าแถวไหนต้องแก้ แถวไหนปล่อยได้
        const r = adjustJob(job({ cost: 5940 }), [rateRow()], BANDS, '2026-10-02');

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
            job({ id: 'B', cost: 5940 }),                             // unchanged
            job({ id: 'C', cost: 6050, truckType: '' }),              // incomplete
        ];

        const s = summarizeMonth(jobs, '2026-09', rows, BANDS, '2026-10-02');

        expect(s.adjustedCount).toBe(1);
        expect(s.unchangedCount).toBe(1);
        expect(s.problemCount).toBe(1);
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
