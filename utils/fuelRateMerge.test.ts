import { describe, it, expect } from 'vitest';
import { diffFuelRates } from './fuelRateDiff';
import { mergeFuelRateRows } from './fuelRateMerge';
import type { FuelRateRow } from './fuelRateParser';

/**
 * เทสต์การรวมเรทตอนอัปโหลด
 *
 * หน่วยงานส่งไฟล์มาทีละเจ้า ไม่ใช่ไฟล์รวมทุกเจ้า การบันทึกจึงต้องไม่ลบ
 * เรทของเจ้าอื่นทิ้ง — เคสนี้เคยเกิดจริง ไฟล์ 8 เส้นทางกำลังจะลบของเดิม 38 เส้นทาง
 */

const mk = (over: Partial<FuelRateRow> = {}): FuelRateRow => ({
    seq: 0,
    company: 'รถร่วมวสรรณ์',
    origin: 'อาหารสากล (นครปฐม)',
    destination: 'CJ ขอนแก่น',
    truckType: '4w',
    note: '',
    bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 5814 }],
    ...over,
});

describe('mergeFuelRateRows', () => {
    it('เก็บเส้นทางเดิมที่ไฟล์ใหม่ไม่มีไว้ครบ', () => {
        const current = [
            mk({ destination: 'A' }),
            mk({ destination: 'B' }),
            mk({ destination: 'C' }),
        ];
        const incoming = [mk({ destination: 'D' })];

        const merged = mergeFuelRateRows(current, incoming);

        expect(merged).toHaveLength(4);
        expect(merged.map(r => r.destination).sort()).toEqual(['A', 'B', 'C', 'D']);
    });

    it('อัปเดตราคาเมื่อเส้นทางซ้ำ ไม่สร้างแถวใหม่', () => {
        const current = [mk({ bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 1000 }] })];
        const incoming = [mk({ bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 2000 }] })];

        const merged = mergeFuelRateRows(current, incoming);

        expect(merged).toHaveLength(1);
        expect(merged[0].bands[0].price).toBe(2000);
    });

    it('แยกเส้นทางตามประเภทรถ — 4w กับ 4wj คนละเส้นทาง', () => {
        const current = [mk({ truckType: '4w' })];
        const incoming = [mk({ truckType: '4wj' })];

        const merged = mergeFuelRateRows(current, incoming);

        expect(merged).toHaveLength(2);
    });

    it('แยกเส้นทางตามบริษัท — คนละเจ้าไม่ทับกัน', () => {
        const current = [mk({ company: 'เจ้า ก' })];
        const incoming = [mk({ company: 'เจ้า ข' })];

        const merged = mergeFuelRateRows(current, incoming);

        expect(merged).toHaveLength(2);
    });

    it('ชื่อบริษัทที่เป็นชื่อพ้องกันถือเป็นเจ้าเดียวกัน', () => {
        // rowKey ใช้ canonicalSubcontractor ชื่อพ้องจึงต้องทับกัน ไม่ใช่เพิ่มแถวซ้ำ
        const current = [mk({ company: 'รถร่วมคุณหนึ่ง', bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 1000 }] })];
        const incoming = [mk({ company: 'รถร่วมวสรรณ์', bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 2000 }] })];

        const merged = mergeFuelRateRows(current, incoming);

        expect(merged).toHaveLength(1);
        expect(merged[0].bands[0].price).toBe(2000);
    });

    it('เคสจริง: ไฟล์ 8 เส้นทาง รวมกับรุ่นเดิม 38 เส้นทาง ต้องได้ 46', () => {
        const current = Array.from({ length: 38 }, (_, i) =>
            mk({ company: 'เจ้าอื่น', destination: `ปลายทาง ${i}` })
        );
        const incoming = Array.from({ length: 8 }, (_, i) =>
            mk({ destination: `ใหม่ ${i}` })
        );

        const merged = mergeFuelRateRows(current, incoming);

        expect(merged).toHaveLength(46);
    });

    it('รุ่นเดิมว่าง = ได้เฉพาะแถวจากไฟล์', () => {
        const incoming = [mk(), mk({ destination: 'X' })];
        expect(mergeFuelRateRows([], incoming)).toHaveLength(2);
    });

    it('ไฟล์ว่าง = ของเดิมอยู่ครบ ไม่ถูกล้าง', () => {
        const current = [mk(), mk({ destination: 'Y' })];
        expect(mergeFuelRateRows(current, [])).toHaveLength(2);
    });

    it('คงลำดับเดิมไว้ แถวใหม่ต่อท้าย', () => {
        const current = [mk({ destination: 'A' }), mk({ destination: 'B' })];
        const incoming = [mk({ destination: 'Z' })];

        const merged = mergeFuelRateRows(current, incoming);

        expect(merged.map(r => r.destination)).toEqual(['A', 'B', 'Z']);
    });
});

describe('mergeFuelRateRows — ไฟล์มีเส้นทางซ้ำในตัวเอง', () => {
    // parser เตือน duplicate-route แต่ผู้ใช้กดผ่านได้ การรวมจึงต้องตัดสินให้ชัด
    it('เส้นทางซ้ำที่ไม่มีของเดิม — เก็บแถวแรก ไม่ใช่แถวสุดท้าย', () => {
        const incoming = [
            mk({ bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 100 }] }),
            mk({ bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 999 }] }),
        ];
        const merged = mergeFuelRateRows([], incoming);
        expect(merged).toHaveLength(1);
        expect(merged[0].bands[0].price).toBe(100);
    });

    it('เส้นทางซ้ำที่ทับของเดิม — ได้แถวเดียว ไม่ใช่สองแถว', () => {
        const current = [mk({ bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 1 }] })];
        const incoming = [
            mk({ bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 100 }] }),
            mk({ bands: [{ fuelFrom: 28.99, fuelTo: 40, price: 999 }] }),
        ];
        const merged = mergeFuelRateRows(current, incoming);
        expect(merged).toHaveLength(1);
        expect(merged[0].bands[0].price).toBe(100);
    });

    it('ผลลัพธ์ไม่มี rowKey ซ้ำกันเลย', () => {
        const current = [mk({ destination: 'A' }), mk({ destination: 'B' })];
        const incoming = [
            mk({ destination: 'A' }), mk({ destination: 'A' }),
            mk({ destination: 'C' }), mk({ destination: 'C' }),
        ];
        const merged = mergeFuelRateRows(current, incoming);
        const keys = merged.map(r => `${r.company}|${r.destination}|${r.truckType}`);
        expect(new Set(keys).size).toBe(keys.length);
        expect(merged).toHaveLength(3);
    });
});

describe('แถวต้นทางรวม "แทน" แถวเดิม (ไฟล์ 19 ต.ค. 2569)', () => {
    /*
      ไฟล์ใหม่เปลี่ยนต้นทางพรแม่ย่าจาก "บางปะอิน (นมไทย)" เป็น "บางปะอิน (นมไทย) / คลอง13 / กทม"
      รวมแบบเดิมแถวเก่าจะค้าง (กุญแจต่างที่ต้นทาง) แล้วราคาเก่าแข่งกับราคาใหม่ (codex P1)
    */
    const r = (origin: string, destination: string, truckType: string, price: number, company = 'พรแม่ย่า'): FuelRateRow => ({
        seq: 1, company, origin, destination, truckType, note: '',
        bands: [{ fuelFrom: 39.01, fuelTo: 40, price }],
    });
    const oldRow = r('บางปะอิน (นมไทย)', 'เมืองเชียงราย', '6W', 12000);
    const newRow = r('บางปะอิน (นมไทย) / คลอง13 / กทม', 'เมืองเชียงราย', '6W', 11500);

    it('รวมแล้วเหลือแถวใหม่แถวเดียว', () => {
        const out = mergeFuelRateRows([oldRow], [newRow]);
        expect(out).toHaveLength(1);
        expect(out[0].origin).toBe('บางปะอิน (นมไทย) / คลอง13 / กทม');
    });

    it('ไม่แทนเมื่อปลายทาง รถ หรือผู้รับเหมาต่างกัน', () => {
        const others = [
            r('บางปะอิน (นมไทย)', 'แม่สาย เชียงราย', '6W', 1),
            r('บางปะอิน (นมไทย)', 'เมืองเชียงราย', '10W', 1),
            r('บางปะอิน (นมไทย)', 'เมืองเชียงราย', '6W', 1, 'YSK TRANSPORT'),
        ];
        expect(mergeFuelRateRows(others, [newRow])).toHaveLength(4);
    });

    it('ไม่แทนแถวที่หมายเหตุ (พิกัดน้ำหนัก) ต่างกัน — แทนเฉพาะแบบที่ตรง', () => {
        const heavy = { ...oldRow, note: 'บรรทุก 3001-3500 กก.' };
        const out = mergeFuelRateRows([oldRow, heavy], [newRow]);
        expect(out.map(x => x.note).sort()).toEqual(['', 'บรรทุก 3001-3500 กก.'].sort());
        expect(out.find(x => x.note === '')!.origin).toBe('บางปะอิน (นมไทย) / คลอง13 / กทม');
    });

    it('ไม่แทนต้นทางที่ไม่ได้อยู่ในชื่อรวม', () => {
        const other = r('สมุทรปราการ', 'เมืองเชียงราย', '6W', 1);
        expect(mergeFuelRateRows([other], [newRow])).toHaveLength(2);
    });

    it('แถวที่ถูกแทนและราคาต่างจากเดิม ต้องนับใน "ราคาเปลี่ยน"', () => {
        // เดิม 12,000 แถวใหม่ 11,500 — ราคาที่ใช้จริงเปลี่ยน หน้าตัวอย่างต้องบอก
        const d = diffFuelRates([newRow], [oldRow], 40);
        expect(d.priceChangedCount).toBe(1);
        expect(d.superseded[0]).toMatchObject({ oldPrice: 12000, newPrice: 11500 });
    });

    it('หน้าตัวอย่างนับแถวที่ถูกแทนแยกจาก "หายไป" — ตัวเลขบนจอต้องตรงกับที่บันทึก', () => {
        const keep = r('สมุทรปราการ', 'ลำพูน', '6W', 1);
        const d = diffFuelRates([newRow], [oldRow, keep], 40);
        expect(d.superseded.map(c => c.row.origin)).toEqual(['บางปะอิน (นมไทย)']);
        expect(d.removed.map(c => c.row.origin)).toEqual(['สมุทรปราการ']);
        expect(d.added).toHaveLength(1);
        // หลังบันทึก: แถวใหม่ + แถวที่หายไป (เก็บไว้) — แถวที่ถูกแทนไม่อยู่
        expect(mergeFuelRateRows([oldRow, keep], [newRow]).map(x => x.origin).sort())
            .toEqual(['บางปะอิน (นมไทย) / คลอง13 / กทม', 'สมุทรปราการ'].sort());
    });
});
