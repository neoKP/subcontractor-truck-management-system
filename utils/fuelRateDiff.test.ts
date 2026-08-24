import { describe, it, expect } from 'vitest';
import { diffFuelRates, rowKey } from './fuelRateDiff';
import type { FuelRateRow } from './fuelRateParser';

const FUEL = 38.39;

/** สร้างแถวทดสอบ — ช่วง 36.99-38.98 ครอบราคาน้ำมันที่ใช้ทดสอบ */
const mk = (over: Partial<FuelRateRow> & { price?: number | null }): FuelRateRow => ({
    seq: 1,
    company: 'KNN',
    origin: 'สมุทรสาคร',
    destination: 'แม่สอด',
    truckType: '6w',
    note: '',
    bands: [
        { fuelFrom: 34.99, fuelTo: 36.98, price: 1000 },
        { fuelFrom: 36.99, fuelTo: 38.98, price: over.price === undefined ? 2000 : over.price },
    ],
    ...over,
});

describe('diffFuelRates — ครั้งแรกของระบบ', () => {
    it('นับทุกแถวเป็นของใหม่เมื่อยังไม่เคยมีรุ่น', () => {
        const d = diffFuelRates([mk({}), mk({ destination: 'ลำปาง' })], null, FUEL);
        expect(d.isFirstUpload).toBe(true);
        expect(d.added.length).toBe(2);
        expect(d.updated.length).toBe(0);
        expect(d.removed.length).toBe(0);
    });

    it('ถือว่าเป็นครั้งแรกเมื่อรุ่นเดิมไม่มีแถวเลย', () => {
        expect(diffFuelRates([mk({})], [], FUEL).isFirstUpload).toBe(true);
    });
});

describe('diffFuelRates — เทียบกับรุ่นเดิม', () => {
    const current = [
        mk({}),
        mk({ destination: 'ลำปาง', price: 3000 }),
        mk({ destination: 'เชียงใหม่', price: 4000 }),
    ];

    it('แยกของใหม่ ของแก้ไข และของเหมือนเดิมได้', () => {
        const incoming = [
            mk({}),                                        // เหมือนเดิม
            mk({ destination: 'ลำปาง', price: 3300 }),      // ราคาเปลี่ยน
            mk({ destination: 'เชียงใหม่', price: 4000 }),  // เหมือนเดิม
            mk({ destination: 'ภูเก็ต', price: 9000 }),     // ใหม่
        ];
        const d = diffFuelRates(incoming, current, FUEL);
        expect(d.isFirstUpload).toBe(false);
        expect(d.added.map(c => c.row.destination)).toEqual(['ภูเก็ต']);
        expect(d.updated.map(c => c.row.destination)).toEqual(['ลำปาง']);
        expect(d.unchanged.length).toBe(2);
        expect(d.removed.length).toBe(0);
    });

    it('รายงานเส้นทางที่หายไปจากไฟล์ใหม่', () => {
        const d = diffFuelRates([mk({})], current, FUEL);
        expect(d.removed.map(c => c.row.destination).sort()).toEqual(['ลำปาง', 'เชียงใหม่']);
    });

    it('บอกราคาเดิมและราคาใหม่ของแถวที่แก้ไข', () => {
        const d = diffFuelRates([mk({ price: 2500 })], current, FUEL);
        expect(d.updated[0].oldPrice).toBe(2000);
        expect(d.updated[0].newPrice).toBe(2500);
    });

    it('นับเฉพาะแถวที่ราคา ณ ราคาน้ำมันปัจจุบันเปลี่ยนจริง', () => {
        // แก้เฉพาะช่วงที่ไม่ครอบราคาปัจจุบัน → ถือว่าแก้ไข แต่ราคาที่ใช้ยังเท่าเดิม
        const changedElsewhere = mk({});
        changedElsewhere.bands[0] = { fuelFrom: 34.99, fuelTo: 36.98, price: 1111 };
        const d = diffFuelRates([changedElsewhere], current, FUEL);
        expect(d.updated.length).toBe(1);
        expect(d.priceChangedCount).toBe(0);
    });

    it('เส้นทางที่ไม่มีเรทในช่วงปัจจุบันให้ราคาเป็น null ไม่ใช่ 0', () => {
        const noRate = mk({ price: null });
        const d = diffFuelRates([noRate], current, FUEL);
        expect(d.updated[0].newPrice).toBeNull();
    });
});

describe('rowKey', () => {
    it('แยกเส้นทางเดียวกันที่ต่างประเภทรถ', () => {
        expect(rowKey(mk({ truckType: '4w' }))).not.toBe(rowKey(mk({ truckType: '4wj' })));
    });

    it('แยกแถวที่ต่างกันที่หมายเหตุ (พิกัดน้ำหนัก)', () => {
        expect(rowKey(mk({ note: 'ไม่เกิน 3000 กก.' })))
            .not.toBe(rowKey(mk({ note: '3001-3500 กก.' })));
    });

    it('ไม่สนใจตัวพิมพ์และช่องว่างเกิน', () => {
        expect(rowKey(mk({ company: ' knn ' }))).toBe(rowKey(mk({ company: 'KNN' })));
    });

    it('แยกตารางย่อยออกจากตารางหลัก', () => {
        expect(rowKey(mk({ section: 'นีโอสยาม วางบิล sunlee' }))).not.toBe(rowKey(mk({})));
    });
});

describe('ชื่อบริษัทที่หน่วยงานเขียนต่างกัน', () => {
    it('ชื่อพ้องของเจ้าเดียวกันได้กุญแจเดียวกัน', () => {
        expect(rowKey(mk({ company: 'รถร่วมคุณหนึ่ง' })))
            .toBe(rowKey(mk({ company: 'รถร่วมคุณวสรรณ์' })));
    });

    it('คนละเจ้ายังแยกกันเหมือนเดิม', () => {
        expect(rowKey(mk({ company: 'KNN' })))
            .not.toBe(rowKey(mk({ company: 'YSK' })));
    });

    it('ไฟล์ที่ใช้ชื่อเดิมต้องถูกมองว่า "ไม่เปลี่ยนแปลง" ไม่ใช่ "เพิ่มใหม่ทั้งหมด"', () => {
        // เคสจริง: ในระบบเก็บชื่อ "รถร่วมคุณวสรรณ์" แต่หน่วยงานส่งไฟล์ใหม่ที่ยังเขียน
        // "รถร่วมคุณหนึ่ง" — ถ้าเทียบชื่อดิบ จะรายงานว่าเพิ่ม 1 + หาย 1 ทั้งที่ไม่มีอะไรเปลี่ยน
        const incoming = [mk({ company: 'รถร่วมคุณหนึ่ง' })];
        const current = [mk({ company: 'รถร่วมคุณวสรรณ์' })];
        const d = diffFuelRates(incoming, current, 38.39);

        expect(d.added).toHaveLength(0);
        expect(d.removed).toHaveLength(0);
        expect(d.unchanged).toHaveLength(1);
    });
});
