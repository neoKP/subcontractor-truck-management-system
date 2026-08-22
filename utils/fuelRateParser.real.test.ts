import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFuelRateWorkbook, findRateAt } from './fuelRateParser';

// อ่านไฟล์จริงที่หน่วยงานส่งมา — ไฟล์อยู่นอก git (ดู .gitignore) จึงข้ามเทสต์เมื่อไม่มี
// ใช้ import.meta.url แทน __dirname เพราะโปรเจกต์เป็น ESM ("type": "module")
const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXCEL_DIR = path.resolve(HERE, '..', 'Excel');
const load = (name: string): ArrayBuffer | null => {
    const p = path.join(EXCEL_DIR, name);
    if (!fs.existsSync(p)) return null;
    const b = fs.readFileSync(p);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

const FILE_1 = 'อัตราผันน้ำมัน ทุกค่าย(1).xlsx';
const FILE_2 = 'รถร่วม วสรรณ์(1).xlsx';

describe.skipIf(!load(FILE_1))(`ไฟล์จริง — ${FILE_1}`, () => {
    const result = parseFuelRateWorkbook(load(FILE_1)!);

    it('อ่านครบ 164 เส้นทาง', () => {
        expect(result.rows.length).toBe(164);
    });

    it('ตรวจพบว่าเป็นไฟล์ช่วงละ 1 บาท', () => {
        expect(result.layout).toBe('wide-1baht');
    });

    it('พบครบทั้ง 8 บริษัท', () => {
        const companies = new Set(result.rows.map(r => r.company));
        expect(companies.size).toBe(8);
        expect(companies.has('KNN DYNAMIC')).toBe(true);
        expect(companies.has('พรแม่ย่า')).toBe(true);
    });

    it('อ่านราคาแถวแรกตรงกับไฟล์', () => {
        const r = result.rows[0];
        expect(r.company).toBe('KNN DYNAMIC');
        expect(r.destination).toBe('แม่สอด');
        expect(r.truckType).toBe('6W');
        // ช่อง 31, 32 บาท = 13500 · ช่อง 33 บาท = 13905 (ตามไฟล์)
        expect(findRateAt(r, 31.5)?.price).toBe(13500);
        expect(findRateAt(r, 33.5)?.price).toBe(13905);
    });

    it('รายงานทั้ง 3 ปัญหาที่พบในไฟล์นี้', () => {
        const kinds = result.issues.map(i => i.kind);
        expect(kinds).toContain('price-decreases');   // วิวัฒน์ทรานส์ | ลงท่า
        expect(kinds).toContain('missing-band');      // พรแม่ย่า | เมืองเชียงราย
        expect(kinds).toContain('duplicate-route');   // KNN | นิคมสมุทรสาคร → แม่สอด
    });

    it('ไม่เดาราคาให้ช่วงที่หน่วยงานเว้นว่าง', () => {
        const gap = result.rows.find(r =>
            r.company === 'พรแม่ย่า' && r.destination === 'เมืองเชียงราย' && r.truckType === '6W');
        expect(gap).toBeDefined();
        expect(findRateAt(gap!, 40.5)).toBeNull();
    });

    it('หาค่าขนส่งที่ราคาน้ำมันปัจจุบัน 38.39 บาทได้', () => {
        const withRate = result.rows.filter(r => findRateAt(r, 38.39) !== null);
        expect(withRate.length).toBeGreaterThan(140);
    });
});

describe.skipIf(!load(FILE_2))(`ไฟล์จริง — ${FILE_2}`, () => {
    const result = parseFuelRateWorkbook(load(FILE_2)!);

    it('อ่านเส้นทางได้ครบ', () => {
        expect(result.rows.length).toBeGreaterThan(30);
    });

    it('ตรวจพบว่าเป็นไฟล์ช่วงละ 2 บาท', () => {
        expect(result.layout).toBe('wide-2baht');
    });

    it('อ่านประเภทรถที่อยู่คนละแถวกับหัวตารางได้', () => {
        expect(result.rows[0].truckType).toContain('4w');
    });

    it('อ่านราคาแถวแรกตรงกับไฟล์ (1880 → 1920 → 1960 → 2000)', () => {
        const prices = result.rows[0].bands.slice(0, 4).map(b => b.price);
        expect(prices).toEqual([1880, 1920, 1960, 2000]);
    });

    it('ช่วงราคาน้ำมันกว้าง 2 บาทตามไฟล์', () => {
        const b = result.rows[0].bands[0];
        expect(b.fuelFrom).toBe(28.99);
        expect(b.fuelTo).toBe(30.98);
    });

    it('หาค่าขนส่งที่ราคาน้ำมันปัจจุบัน 38.39 บาทได้', () => {
        const hit = findRateAt(result.rows[0], 38.39);
        expect(hit).not.toBeNull();
        expect(hit!.price).toBe(2040);   // ช่วง 36.99–38.98
    });
});

describe.skipIf(!load(FILE_2))('ข้ามแถวหมายเหตุที่ไม่ใช่เส้นทาง', () => {
    const result = parseFuelRateWorkbook(load(FILE_2)!);

    it('ไม่นับแถว "* ส่ง สินค้า อ.เมือง / ศูนย์กระจาย" เป็นเส้นทาง', () => {
        const note = result.rows.find(r => r.origin.startsWith('*') || r.destination.startsWith('*'));
        expect(note).toBeUndefined();
    });

    it('ไม่มีเส้นทางไหนที่ค่าขนส่งต่ำผิดปกติ (ต่ำกว่า 100 บาท)', () => {
        for (const r of result.rows) {
            const prices = r.bands.map(b => b.price).filter((p): p is number => p !== null && p > 0);
            if (!prices.length) continue;
            expect(Math.min(...prices)).toBeGreaterThanOrEqual(100);   // ทุกช่อง ไม่ใช่แค่ช่องสูงสุด
        }
    });

    it('เส้นทางจริงยังอยู่ครบ', () => {
        expect(result.rows.length).toBeGreaterThan(30);
        expect(result.rows[0].bands[0].price).toBe(1880);
    });
});

describe.skipIf(!load(FILE_1))('ไฟล์ที่ 1 ไม่ได้รับผลกระทบจากตัวกรองหมายเหตุ', () => {
    it('ยังอ่านได้ 164 เส้นทางเท่าเดิม', () => {
        expect(parseFuelRateWorkbook(load(FILE_1)!).rows.length).toBe(164);
    });
});

describe.skipIf(!load(FILE_2))('ตารางย่อย "นีโอสยาม วางบิล sunlee" ในไฟล์ที่ 2', () => {
    const result = parseFuelRateWorkbook(load(FILE_2)!);
    const main = result.rows.filter(r => !r.section);
    const side = result.rows.filter(r => r.section);
    const pick = (truck: string, dest: string) =>
        side.find(r => r.truckType === truck && r.destination === dest)!;

    it('อ่านได้ 3 บล็อก (4w / 6w / 10w) บล็อกละ 11 ปลายทาง', () => {
        expect(main.length).toBe(38);
        expect(side.length).toBe(33);
        const perTruck = new Map<string, number>();
        for (const r of side) perTruck.set(r.truckType, (perTruck.get(r.truckType) ?? 0) + 1);
        expect([...perTruck.entries()].sort()).toEqual([['10w', 11], ['4w', 11], ['6w', 11]]);
    });

    it('ติดชื่อตารางตามที่เขียนไว้ในไฟล์', () => {
        expect([...new Set(side.map(r => r.section))]).toEqual(['นีโอสยาม วางบิล sunlee']);
    });

    it('ช่วงราคาน้ำมัน 16 ช่วง ตั้งแต่ 30 ถึง 61.99 บาท', () => {
        const b = side[0].bands;
        expect(b.length).toBe(16);
        expect(b[0]).toMatchObject({ fuelFrom: 30, fuelTo: 31.99 });
        expect(b[15]).toMatchObject({ fuelFrom: 60, fuelTo: 61.99 });
    });

    it('ราคาตรงกับไฟล์ในจุดที่สุ่มตรวจ', () => {
        expect(pick('4w', '7-11 บางบัวทอง').bands[0].price).toBe(2350);
        expect(pick('6w', '7-11 บุรีรัมย์').bands[0].price).toBe(13160);
        expect(pick('10w', '7-11 หาดใหญ่').bands[0].price).toBe(26790);
        expect(pick('10w', '7-11 นครสวรรค์').bands[15].price).toBe(19460);
    });

    it('หาค่าขนส่งที่ราคาน้ำมันปัจจุบัน 38.39 บาทได้ครบทุกแถว', () => {
        expect(side.every(r => findRateAt(r, 38.39) !== null)).toBe(true);
        expect(findRateAt(pick('4w', '7-11 บางบัวทอง'), 38.39)!.price).toBe(2650);
    });

    it('ไม่เดาต้นทาง แต่เติมชื่อคู่สัญญาจากที่ไฟล์เขียนไว้', () => {
        // ตารางย่อยไม่มีคอลัมน์ต้นทาง — ปล่อยว่าง ไม่เดา
        expect(side.every(r => r.origin === '')).toBe(true);
        // ชื่อบริษัทมาจากหัวตารางย่อย ส่วนตารางหลักมาจากชื่อชีต ทั้งคู่เป็นข้อความในไฟล์
        expect(side.every(r => r.company === 'นีโอสยาม วางบิล sunlee')).toBe(true);
        expect(main.every(r => r.company === 'รถร่วมคุณหนึ่ง')).toBe(true);
    });

    it('แถวของตารางหลักไม่ถูกติดชื่อตารางย่อย', () => {
        expect(main.every(r => r.section === undefined)).toBe(true);
        expect(main[0].bands[0].price).toBe(1880);
    });

    it('คัดลอกครบทุกช่อง ไม่ขาดไม่เกิน — เทียบกับไฟล์ Excel ตรง ๆ', () => {
        const wb = XLSX.read(load(FILE_2)!, { type: 'array' });
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], {
            header: 1, raw: true, defval: null,
        });
        // โซนตารางย่อยเริ่มที่คอลัมน์ 23 (W) — ตารางหลักกว้างถึงคอลัมน์ 19 เท่านั้น
        const inFile: number[] = [];
        for (const r of grid) {
            (r || []).forEach((v, c) => {
                if (c >= 23 && typeof v === 'number' && v >= 100) inFile.push(Math.round(v * 100) / 100);
            });
        }
        const parsed = side.flatMap(r => r.bands.map(b => b.price))
            .filter((p): p is number => p !== null && p >= 100);

        expect(parsed.length).toBe(inFile.length);
        expect(parsed.reduce((a, b) => a + b, 0)).toBeCloseTo(inFile.reduce((a, b) => a + b, 0), 2);
    });
});

describe.skipIf(!load(FILE_1))('ไฟล์ที่ 1 ไม่มีตารางย่อย', () => {
    it('ไม่มีแถวไหนถูกติดชื่อตารางย่อย และยังได้ 164 เส้นทางเท่าเดิม', () => {
        const result = parseFuelRateWorkbook(load(FILE_1)!);
        expect(result.rows.length).toBe(164);
        expect(result.rows.some(r => r.section)).toBe(false);
        expect(result.issues.some(i => i.kind === 'side-table-unreadable')).toBe(false);
    });
});

describe.skipIf(!load(FILE_1))('ตัวกรองแถวสรุปไม่ตัดเส้นทางจริงทิ้ง', () => {
    const result = parseFuelRateWorkbook(load(FILE_1)!);

    it('ยังอ่านได้ครบ 164 เส้นทางเท่าเดิม', () => {
        expect(result.rows.length).toBe(164);
    });

    it('ไม่มีแถวสรุปหลุดเข้ามาเป็นเส้นทาง', () => {
        const words = ['รวม', 'ขั้นต่ำ', 'คิดเพิ่ม', 'เงื่อนไข', 'สรุป'];
        for (const r of result.rows) {
            for (const w of words) {
                expect(r.origin.startsWith(w)).toBe(false);
                expect(r.destination.startsWith(w)).toBe(false);
            }
        }
    });
});

describe.skipIf(!load(FILE_2))('เลือกชีตข้อมูลถูกต้อง', () => {
    it('ยังอ่านไฟล์ต้นฉบับที่มีชีตเดียวได้', () => {
        const result = parseFuelRateWorkbook(load(FILE_2)!);
        expect(result.rows.length).toBeGreaterThan(30);
        expect(result.rows[0].bands[0].price).toBe(1880);
    });
});
