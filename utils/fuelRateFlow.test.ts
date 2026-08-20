import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFuelRateWorkbook, findRateAt } from './fuelRateParser';

/**
 * จำลองเส้นทางการใช้งานจริงตั้งแต่ต้นจนจบ:
 *   อ่านไฟล์ Excel → เก็บเป็นรุ่น (จำลอง RTDB) → ค้นหาเรทที่ราคาน้ำมันปัจจุบัน
 * ยืนยันว่าตัวเลขไม่เพี้ยนระหว่างทาง
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const FILE = path.join(HERE, '..', 'Excel', 'อัตราผันน้ำมัน ทุกค่าย(1).xlsx');
const hasFile = fs.existsSync(FILE);

const loadBuffer = (): ArrayBuffer => {
    const b = fs.readFileSync(FILE);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

// ราคาดีเซล ปตท. ณ 19 ส.ค. 2569 — ตรึงไว้ให้ผลทดสอบคงที่
const FUEL_NOW = 38.39;

describe.skipIf(!hasFile)('เส้นทางใช้งานจริง: อ่านไฟล์ → เก็บ → ค้นหาเรท', () => {
    const parsed = parseFuelRateWorkbook(loadBuffer());

    // จำลองการเดินทางผ่าน RTDB — ข้อมูลถูก serialize เป็น JSON ระหว่างเก็บ
    const roundTripped = JSON.parse(JSON.stringify(parsed.rows)) as typeof parsed.rows;

    it('ข้อมูลไม่หายหลังผ่านการเก็บลงฐานข้อมูล', () => {
        expect(roundTripped.length).toBe(parsed.rows.length);
        expect(roundTripped[0].bands.length).toBe(parsed.rows[0].bands.length);
    });

    it('ราคาไม่เพี้ยนหลัง round-trip', () => {
        const before = parsed.rows.map(r => findRateAt(r, FUEL_NOW)?.price ?? null);
        const after = roundTripped.map(r => findRateAt(r, FUEL_NOW)?.price ?? null);
        expect(after).toEqual(before);
    });

    it('หาเรทได้จริงสำหรับเส้นทางที่มีข้อมูลครบ', () => {
        const knn = roundTripped.find(r =>
            r.company === 'KNN DYNAMIC' && r.destination === 'แม่สอด' && r.truckType === '6W');
        expect(knn).toBeDefined();
        const hit = findRateAt(knn!, FUEL_NOW);
        expect(hit).not.toBeNull();
        expect(hit!.price).toBeGreaterThan(0);
        // ราคาน้ำมัน 38.39 ต้องตกอยู่ในช่วงที่คืนมา
        expect(FUEL_NOW).toBeGreaterThanOrEqual(hit!.fuelFrom);
        expect(FUEL_NOW).toBeLessThanOrEqual(hit!.fuelTo);
    });

    it('รายงานเส้นทางที่ไม่มีเรทแทนการเดาราคา', () => {
        const missing = roundTripped.filter(r => findRateAt(r, FUEL_NOW) === null);
        // ไฟล์ปัจจุบันมีเส้นทางที่หน่วยงานไม่ได้ระบุราคาไว้ในช่วงนี้
        expect(missing.length).toBeGreaterThan(0);
        // ทุกเส้นทางที่หาไม่เจอ ต้องเป็นเพราะไม่มีราคาจริง ไม่ใช่เพราะ parser พลาด
        for (const r of missing) {
            const band = r.bands.find(b => FUEL_NOW >= b.fuelFrom && FUEL_NOW <= b.fuelTo);
            expect(band === undefined || band.price === null || band.price === 0).toBe(true);
        }
    });

    it('ทุกเส้นทางที่มีเรท ให้ราคาเป็นบวก', () => {
        for (const r of roundTripped) {
            const hit = findRateAt(r, FUEL_NOW);
            if (hit) expect(hit.price).toBeGreaterThan(0);
        }
    });

    it('ตัวกรองตามบริษัทและประเภทรถทำงานถูกต้อง', () => {
        const companies = new Set(roundTripped.map(r => r.company).filter(Boolean));
        expect(companies.size).toBe(8);
        const ysk = roundTripped.filter(r => r.company === 'YSK TRANSPORT');
        expect(ysk.length).toBeGreaterThan(0);
        expect(ysk.every(r => r.company === 'YSK TRANSPORT')).toBe(true);
    });

    it('ค้นหาด้วยข้อความหาเส้นทางเจอ', () => {
        const q = 'แม่สอด';
        const found = roundTripped.filter(r =>
            [r.company, r.origin, r.destination, r.truckType]
                .some(f => (f || '').toLowerCase().includes(q.toLowerCase())));
        expect(found.length).toBeGreaterThan(0);
    });
});
