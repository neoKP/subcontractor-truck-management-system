import { describe, it, expect } from 'vitest';
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
