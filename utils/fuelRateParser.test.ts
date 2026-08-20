import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseFuelRateWorkbook, findRateAt, type FuelRateRow } from './fuelRateParser';

/** สร้างไฟล์ Excel ในหน่วยความจำจากตาราง 2 มิติ เพื่อทดสอบตัวอ่านจริง */
const makeWorkbook = (rows: (string | number | null)[][]): ArrayBuffer => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};

// เลียนโครงไฟล์ "อัตราผันน้ำมัน ทุกค่าย" — แถวบนเป็นเพดานช่วง แถวหัวเป็นพื้น
const WIDE_1BAHT = [
    [null, null, null, null, null, 29.01, 30.01, 31.01, 32.01],
    ['ลำดับ', 'บริษัท', 'ต้นทาง', 'ปลายทาง', 'ประเภทรถ', 30, 31, 32, 33],
    [1, 'KNN DYNAMIC', 'นิคมสมุทรสาคร', 'แม่สอด', '6W', 13500, 13500, 13905, 13905],
    [2, 'YSK TRANSPORT', 'บางปะกง', 'นครสวรรค์', '10W', 5500, 5500, 5610, 5610],
];

describe('parseFuelRateWorkbook — ไฟล์แบบช่วงละ 1 บาท', () => {
    const result = parseFuelRateWorkbook(makeWorkbook(WIDE_1BAHT));

    it('อ่านครบทุกแถวข้อมูล', () => {
        expect(result.rows.length).toBe(2);
    });

    it('อ่านคอลัมน์ข้อความถูกต้อง', () => {
        const r = result.rows[0];
        expect(r.company).toBe('KNN DYNAMIC');
        expect(r.origin).toBe('นิคมสมุทรสาคร');
        expect(r.destination).toBe('แม่สอด');
        expect(r.truckType).toBe('6W');
    });

    it('เก็บราคาตามไฟล์ ไม่คำนวณเอง', () => {
        const prices = result.rows[0].bands.map(b => b.price);
        expect(prices).toEqual([13500, 13500, 13905, 13905]);
    });

    it('ตรวจพบว่าเป็นไฟล์แบบช่วงละ 1 บาท', () => {
        expect(result.layout).toBe('wide-1baht');
    });

    it('ไม่รายงานปัญหาเมื่อข้อมูลปกติ', () => {
        expect(result.issues).toEqual([]);
    });
});

describe('parseFuelRateWorkbook — ตรวจจับข้อมูลผิดปกติ', () => {
    it('เตือนเมื่อค่าขนส่งลดลงทั้งที่น้ำมันแพงขึ้น', () => {
        const rows = JSON.parse(JSON.stringify(WIDE_1BAHT));
        rows[2][8] = 13000;   // ต่ำกว่าช่องก่อนหน้า
        const { issues } = parseFuelRateWorkbook(makeWorkbook(rows));
        const hit = issues.find(i => i.kind === 'price-decreases');
        expect(hit).toBeDefined();
        expect(hit!.rows).toContain(0);
    });

    it('เตือนเมื่อมีช่องว่างกลางตาราง', () => {
        const rows = JSON.parse(JSON.stringify(WIDE_1BAHT));
        rows[2][7] = null;    // ว่างตรงกลาง ระหว่างช่องที่มีค่า
        const { issues } = parseFuelRateWorkbook(makeWorkbook(rows));
        expect(issues.find(i => i.kind === 'missing-band')).toBeDefined();
    });

    it('ไม่เตือนเมื่อช่องว่างอยู่หัวหรือท้ายตาราง', () => {
        const rows = JSON.parse(JSON.stringify(WIDE_1BAHT));
        rows[2][5] = null;    // ว่างช่องแรก เป็นเรื่องปกติ
        const { issues } = parseFuelRateWorkbook(makeWorkbook(rows));
        expect(issues.find(i => i.kind === 'missing-band')).toBeUndefined();
    });

    it('เตือนเมื่อเส้นทางและประเภทรถซ้ำกัน', () => {
        const rows = JSON.parse(JSON.stringify(WIDE_1BAHT));
        rows.push([3, 'KNN DYNAMIC', 'นิคมสมุทรสาคร', 'แม่สอด', '6W', 18500, 18500, 19055, 19055]);
        const { issues } = parseFuelRateWorkbook(makeWorkbook(rows));
        const hit = issues.find(i => i.kind === 'duplicate-route');
        expect(hit).toBeDefined();
        expect(hit!.rows.length).toBe(2);
    });

    it('เตือนเมื่อแถวไม่มีราคาเลย', () => {
        const rows = JSON.parse(JSON.stringify(WIDE_1BAHT));
        rows.push([3, 'พรแม่ย่า', 'บางปะกง', 'เชียงราย', '6W', null, null, null, null]);
        const { issues } = parseFuelRateWorkbook(makeWorkbook(rows));
        expect(issues.find(i => i.kind === 'no-bands')).toBeDefined();
    });
});

describe('parseFuelRateWorkbook — ไฟล์แบบช่วงละ 2 บาท', () => {
    // เลียนโครงไฟล์ "รถร่วม วสรรณ์" — ช่วงกว้าง 2 บาท
    const WIDE_2BAHT = [
        [null, null, null, 28.99, 30.99, 32.99, 34.99],
        ['ต้นทาง', 'ปลายทาง', 'ประเภทรถ', 30.98, 32.98, 34.98, 36.98],
        ['ซันลี บางปะกง', '7-11 ลาดกระบัง', '4w', 1880, 1920, 1960, 2000],
    ];
    const result = parseFuelRateWorkbook(makeWorkbook(WIDE_2BAHT));

    it('อ่านได้แม้ไม่มีคอลัมน์ลำดับและบริษัท', () => {
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].origin).toBe('ซันลี บางปะกง');
        expect(result.rows[0].truckType).toBe('4w');
    });

    it('ตรวจพบว่าเป็นไฟล์แบบช่วงละ 2 บาท', () => {
        expect(result.layout).toBe('wide-2baht');
    });

    it('เก็บราคาที่ขึ้นทีละ 40 บาทตามไฟล์ ไม่แปลงเป็น %', () => {
        expect(result.rows[0].bands.map(b => b.price)).toEqual([1880, 1920, 1960, 2000]);
    });
});

describe('parseFuelRateWorkbook — ไฟล์ที่อ่านไม่ได้', () => {
    it('แจ้ง error เมื่อไม่พบหัวตาราง', () => {
        expect(() => parseFuelRateWorkbook(makeWorkbook([['a', 'b'], [1, 2]])))
            .toThrow(/ไม่พบหัวตาราง/);
    });

    it('แจ้ง error เมื่อไม่มีคอลัมน์ช่วงราคาน้ำมัน', () => {
        expect(() => parseFuelRateWorkbook(makeWorkbook([
            ['ลำดับ', 'บริษัท', 'ต้นทาง', 'ปลายทาง', 'ประเภทรถ'],
            [1, 'KNN', 'A', 'B', '6W'],
        ]))).toThrow();
    });
});

describe('findRateAt', () => {
    const row: FuelRateRow = {
        seq: 1, company: 'KNN', origin: 'A', destination: 'B', truckType: '6W', note: '',
        bands: [
            { fuelFrom: 29.01, fuelTo: 30, price: 13500 },
            { fuelFrom: 30.01, fuelTo: 31, price: 13905 },
            { fuelFrom: 31.01, fuelTo: 32, price: null },
        ],
    };

    it('คืนราคาของช่วงที่ครอบคลุมราคาน้ำมันนั้น', () => {
        expect(findRateAt(row, 30.5)?.price).toBe(13905);
        expect(findRateAt(row, 29.5)?.price).toBe(13500);
    });

    it('รวมค่าที่ขอบช่วงทั้งสองด้าน', () => {
        expect(findRateAt(row, 30)?.price).toBe(13500);
        expect(findRateAt(row, 30.01)?.price).toBe(13905);
    });

    it('คืน null เมื่อช่วงนั้นไม่มีราคา แทนที่จะเดาจากช่วงใกล้เคียง', () => {
        expect(findRateAt(row, 31.5)).toBeNull();
    });

    it('คืน null เมื่อราคาน้ำมันอยู่นอกทุกช่วง', () => {
        expect(findRateAt(row, 25)).toBeNull();
        expect(findRateAt(row, 60)).toBeNull();
    });
});
