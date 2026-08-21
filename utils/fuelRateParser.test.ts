import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseFuelRateWorkbook, findRateAt, type FuelRateRow } from './fuelRateParser';

/** สร้างไฟล์ Excel ในหน่วยความจำจากตาราง 2 มิติ เพื่อทดสอบตัวอ่านจริง */
const makeWorkbook = (rows: (string | number | null)[][], sheetName = 'Sheet1'): ArrayBuffer => {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
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

// เลียนไฟล์ "รถร่วม วสรรณ์" ที่มีตารางที่สองวางอยู่ทางขวาของตารางหลักในชีตเดียวกัน
// คอลัมน์ 12 = ปลายทางของตารางย่อย, คอลัมน์ 13-14 = ช่วงราคาน้ำมัน 2 ช่วง
const WITH_SIDE_TABLE = [
    [null, null, null, null, null, 29.01, 30.01, 31.01, 32.01, null, null, null, null, 0.94, 0.97],
    ['ลำดับ', 'บริษัท', 'ต้นทาง', 'ปลายทาง', 'ประเภทรถ', 30, 31, 32, 33, null, null, null, 'บิลลูกค้า A', 30, 32],
    [1, 'KNN DYNAMIC', 'นิคมสมุทรสาคร', 'แม่สอด', '6W', 13500, 13500, 13905, 13905, null, null, null, null, 31.99, 33.99],
    [2, 'YSK TRANSPORT', 'บางปะกง', 'นครสวรรค์', '10W', 5500, 5500, 5610, 5610, null, null, null, 'ปลายทาง', '6w', '6w'],
    [null, null, null, null, null, null, null, null, null, null, null, null, 'สาขาบางนา', 5000, 5200],
    [null, null, null, null, null, null, null, null, null, null, null, null, 'ปลายทางพิเศษ ระยอง', 6000, 6200],
];

describe('parseFuelRateWorkbook — ตารางย่อยทางขวาของชีต', () => {
    const result = parseFuelRateWorkbook(makeWorkbook(WITH_SIDE_TABLE));
    const main = result.rows.filter(r => !r.section);
    const side = result.rows.filter(r => r.section);

    it('อ่านทั้งตารางหลักและตารางย่อย', () => {
        expect(main.length).toBe(2);
        expect(side.length).toBe(2);
    });

    it('ตารางหลักยังอ่านได้เหมือนเดิม ไม่โดนตารางย่อยกวน', () => {
        expect(main[0].destination).toBe('แม่สอด');
        expect(main[0].bands.map(b => b.price)).toEqual([13500, 13500, 13905, 13905]);
    });

    it('ติดชื่อตารางย่อยไว้ที่แถว เพื่อให้รู้ว่ามาจากตารางไหน', () => {
        expect(side[0].section).toBe('บิลลูกค้า A');
        expect(side[0].destination).toBe('สาขาบางนา');
        expect(side[0].truckType).toBe('6w');
    });

    it('ไม่เดาต้นทางที่ไฟล์ไม่ได้ระบุ แต่ใช้ชื่อตารางเป็นชื่อบริษัท', () => {
        expect(side[0].origin).toBe('');
        expect(side[0].company).toBe('บิลลูกค้า A');   // ชื่อที่เขียนไว้ในไฟล์ ไม่ใช่ชื่อที่คิดขึ้นเอง
    });

    it('เก็บราคาและช่วงน้ำมันตามไฟล์', () => {
        expect(side[0].bands.map(b => b.price)).toEqual([5000, 5200]);
        expect(side[0].bands[0]).toMatchObject({ fuelFrom: 30, fuelTo: 31.99 });
        expect(side[0].bands[1]).toMatchObject({ fuelFrom: 32, fuelTo: 33.99 });
    });

    it('ไม่นับแถวตัวคูณ (0.94 / 0.97) เป็นเส้นทาง', () => {
        expect(result.rows.some(r => r.bands.some(b => b.price !== null && b.price < 100))).toBe(false);
    });

    it('ปลายทางที่มีคำว่า "ปลายทาง" อยู่ในชื่อ ไม่ถูกมองว่าเป็นหัวตาราง', () => {
        const hit = side.find(r => r.destination === 'ปลายทางพิเศษ ระยอง');
        expect(hit).toBeDefined();
        expect(hit!.bands.map(b => b.price)).toEqual([6000, 6200]);
    });

    it('หาค่าขนส่งของตารางย่อยที่ราคาน้ำมันหนึ่ง ๆ ได้', () => {
        expect(findRateAt(side[0], 33)!.price).toBe(5200);
        expect(findRateAt(side[0], 40)).toBeNull();   // นอกช่วงที่ไฟล์ระบุ ไม่เดาให้
    });
});

describe('parseFuelRateWorkbook — ตารางย่อยที่อ่านไม่ได้', () => {
    it('รายงานไว้ ไม่เดาช่วงราคาน้ำมันให้ และไม่นำเข้าแถวนั้น', () => {
        const rows = JSON.parse(JSON.stringify(WITH_SIDE_TABLE));
        rows[2][13] = null;   // ลบแถวเพดานช่วง เหลือแต่พื้นช่วง → ไม่รู้ว่าช่วงกว้างเท่าไร
        rows[2][14] = null;
        const result = parseFuelRateWorkbook(makeWorkbook(rows));
        expect(result.rows.every(r => !r.section)).toBe(true);
        const hit = result.issues.find(i => i.kind === 'side-table-unreadable');
        expect(hit).toBeDefined();
        expect(hit!.message).toContain('บิลลูกค้า A');
    });
});

// เคสที่ Codex ทักไว้: ปลายทางที่ชื่อมีคำว่า "ปลายทาง" และราคายังเป็น 0 หรือว่าง
// ต้องไม่ถูกเข้าใจผิดว่าเป็นหัวตารางบล็อกใหม่ ไม่งั้นแถวจะหาย และบล็อกจะถูกหั่นกลางคัน
describe('parseFuelRateWorkbook — แถวตารางย่อยที่ราคายังไม่ตกลง', () => {
    it('แถวราคา 0 ยังถูกนำเข้าและถูกรายงาน ไม่ถูกตัดทิ้ง', () => {
        const rows = JSON.parse(JSON.stringify(WITH_SIDE_TABLE));
        rows[5][13] = 0;
        rows[5][14] = 0;
        const result = parseFuelRateWorkbook(makeWorkbook(rows));
        const hit = result.rows.find(r => r.destination === 'ปลายทางพิเศษ ระยอง');
        expect(hit).toBeDefined();
        expect(hit!.section).toBe('บิลลูกค้า A');
        expect(hit!.bands.map(b => b.price)).toEqual([0, 0]);
        expect(result.issues.find(i => i.kind === 'zero-price')).toBeDefined();
    });

    it('แถวที่ยังไม่มีราคาเลย ไม่ทำให้บล็อกถูกหั่นและแถวถัดไปเพี้ยน', () => {
        const rows = JSON.parse(JSON.stringify(WITH_SIDE_TABLE));
        rows[5][13] = null;
        rows[5][14] = null;
        rows.push([null, null, null, null, null, null, null, null, null, null, null, null, 'สาขาชลบุรี', 7000, 7200]);
        const result = parseFuelRateWorkbook(makeWorkbook(rows));
        const last = result.rows.find(r => r.destination === 'สาขาชลบุรี');
        expect(last).toBeDefined();
        expect(last!.section).toBe('บิลลูกค้า A');
        // ช่วงราคาน้ำมันต้องยังเป็น 30–31.99 ตามหัวตารางเดิม ไม่ใช่ค่าที่เดามาจากแถวราคา
        expect(last!.bands[0]).toMatchObject({ fuelFrom: 30, fuelTo: 31.99 });
        expect(last!.bands.map(b => b.price)).toEqual([7000, 7200]);
    });
});

// เคสที่ Codex ทักไว้รอบสอง: ตารางย่อยคนละใบวางบิล มีปลายทางซ้ำกันได้ตามปกติ
const twoSideTables = (secondTitle: string) => {
    const rows = JSON.parse(JSON.stringify(WITH_SIDE_TABLE));
    const blank = () => [null, null, null, null, null, null, null, null, null, null, null, null];
    rows.push([...blank().slice(0, 12), secondTitle, 30, 32]);
    rows.push([...blank().slice(0, 12), null, 31.99, 33.99]);
    rows.push([...blank().slice(0, 12), 'ปลายทาง', '6w', '6w']);
    rows.push([...blank().slice(0, 12), 'สาขาบางนา', 5100, 5300]);
    return rows;
};

describe('parseFuelRateWorkbook — ตารางย่อยหลายใบในชีตเดียว', () => {
    it('ปลายทางซ้ำกันข้ามตาราง ไม่ถือว่าซ้ำ', () => {
        const result = parseFuelRateWorkbook(makeWorkbook(twoSideTables('บิลลูกค้า B')));
        const bangna = result.rows.filter(r => r.destination === 'สาขาบางนา');
        expect(bangna.map(r => r.section)).toEqual(['บิลลูกค้า A', 'บิลลูกค้า B']);
        expect(bangna.map(r => r.bands[0].price)).toEqual([5000, 5100]);
        expect(result.issues.find(i => i.kind === 'duplicate-route')).toBeUndefined();
    });

    it('ปลายทางซ้ำกันในตารางเดียวกัน ยังเตือนเหมือนเดิม', () => {
        const result = parseFuelRateWorkbook(makeWorkbook(twoSideTables('บิลลูกค้า A')));
        const hit = result.issues.find(i => i.kind === 'duplicate-route');
        expect(hit).toBeDefined();
        expect(hit!.rows.length).toBe(2);
    });
});


// ไฟล์บางไฟล์ไม่มีคอลัมน์ "บริษัท" แต่เขียนชื่อคู่สัญญาไว้ที่ชื่อชีต
const NO_COMPANY_COL = [
    [null, null, null, 29.01, 30.01],
    ['ต้นทาง', 'ปลายทาง', 'ประเภทรถ', 30, 31],
    ['บางปะกง', 'นครสวรรค์', '6W', 5500, 5610],
];

describe('parseFuelRateWorkbook — ชื่อบริษัทเมื่อไฟล์ไม่มีคอลัมน์บริษัท', () => {
    it('ใช้ชื่อชีตเป็นชื่อบริษัท', () => {
        const { rows } = parseFuelRateWorkbook(makeWorkbook(NO_COMPANY_COL, 'รถร่วมคุณหนึ่ง'));
        expect(rows[0].company).toBe('รถร่วมคุณหนึ่ง');
    });

    it('ไม่ใช้ชื่อชีตโหลที่โปรแกรม Excel ตั้งให้เอง', () => {
        for (const generic of ['Sheet1', 'แผ่นงาน1', 'ชีต1', 'Worksheet 2']) {
            const { rows } = parseFuelRateWorkbook(makeWorkbook(NO_COMPANY_COL, generic));
            expect(rows[0].company, generic).toBe('');
        }
    });

    it('ไฟล์ที่มีคอลัมน์บริษัทอยู่แล้ว ใช้ค่าจากคอลัมน์ ไม่ใช่ชื่อชีต', () => {
        const { rows } = parseFuelRateWorkbook(makeWorkbook(WIDE_1BAHT, 'ชื่อชีตอะไรก็ตาม'));
        expect(rows[0].company).toBe('KNN DYNAMIC');
    });

    it('ตารางย่อยที่ไม่มีหัวเรื่อง ไม่เอาป้ายที่ระบบตั้งเองมาเป็นชื่อบริษัท', () => {
        const rows = JSON.parse(JSON.stringify(WITH_SIDE_TABLE));
        rows[1][12] = null;   // ลบหัวเรื่อง "บิลลูกค้า A" ออก
        const result = parseFuelRateWorkbook(makeWorkbook(rows));
        const side = result.rows.filter(r => r.section);
        expect(side.length).toBeGreaterThan(0);
        expect(side[0].company).toBe('');
        expect(side[0].section).toContain('ตารางย่อย');   // ป้ายไว้ดูว่ามาจากตารางไหนเท่านั้น
    });
});
