import { describe, it, expect } from 'vitest';
import { buildOilRounds, mergeOilBands, OIL_BASE } from './oilRounds';
import type { NasOilBand } from './nasOilApi';

/**
 * ยืนยันว่าการแปลงข้อมูลจาก NAS (ราคาดีเซล) เป็น %สะสม แล้วสร้างงวดปรับ
 * ให้ผลตรงกับที่หน้าเว็บแสดง — ใช้ข้อมูลจริงที่ NAS ตอบเมื่อ 2026-08-20
 */
const toByDate = (bands: NasOilBand[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const b of bands) out[b.from] = Math.round((b.diesel - OIL_BASE) * 100) / 100;
    return out;
};

// ตัวอย่างจริงจาก /api/oil/history (ตัดมาบางส่วน)
const SAMPLE: NasOilBand[] = [
    { from: '2026-03-25', diesel: 31.94 },
    { from: '2026-03-26', diesel: 38.94 },
    { from: '2026-03-31', diesel: 40.74 },
    { from: '2026-04-05', diesel: 50.54 },
    { from: '2026-08-19', diesel: 38.39 },
];

describe('แปลงข้อมูล NAS เป็นงวดปรับ', () => {
    const byDate = toByDate(SAMPLE);

    it('งวดแรกเป็นฐาน 0%', () => {
        expect(byDate['2026-03-25']).toBe(0);
    });

    it('คำนวณ %สะสมจากราคาดีเซลถูกต้อง', () => {
        expect(byDate['2026-03-26']).toBe(7);
        expect(byDate['2026-04-05']).toBe(18.6);
        expect(byDate['2026-08-19']).toBe(6.45);
    });

    it('สร้างงวดปรับได้ครบและราคาย้อนกลับตรงกับต้นทาง', () => {
        const rounds = buildOilRounds(byDate, '2026-08-20');
        expect(rounds.length).toBe(SAMPLE.length);
        for (const r of rounds) {
            const src = SAMPLE.find(b => b.from === r.startIso)!;
            expect(r.diesel).toBe(src.diesel);
        }
    });

    it('ไม่ปัดจนราคาเพี้ยน', () => {
        // 38.39 - 31.94 = 6.45 ในทางทศนิยม แต่ floating point ให้ 6.450000000000003
        expect(byDate['2026-08-19']).toBe(6.45);
        expect(OIL_BASE + byDate['2026-08-19']).toBeCloseTo(38.39, 10);
    });
});

describe('mergeBands — รวมงวดจากหลายแหล่ง', () => {
    // ไฟล์ bundle บันทึกทุกวัน · NAS บันทึกเฉพาะวันที่ราคาเปลี่ยน
    const bundled = {
        '2026-03-25': 0,
        '2026-03-26': 7,
        '2026-03-27': 7,
        '2026-03-28': 7,
        '2026-03-31': 8.8,
    };

    it('ใช้ชุดของแหล่งที่น่าเชื่อกว่าแทนทั้งช่วง ไม่ทับทีละวัน', () => {
        const nas = { '2026-03-26': 9, '2026-03-31': 10 };
        const merged = mergeOilBands(bundled, nas);
        // วันก่อนที่ NAS เริ่มครอบคลุม ยังใช้ของเดิม
        expect(merged['2026-03-25']).toBe(0);
        // วันระหว่างงวดต้องหายไป ไม่ค้างค่าเก่า
        expect(merged['2026-03-27']).toBeUndefined();
        expect(merged['2026-03-28']).toBeUndefined();
        expect(merged['2026-03-26']).toBe(9);
        expect(merged['2026-03-31']).toBe(10);
    });

    it('นับงวดปรับได้ตรงกับที่แหล่งหลักส่งมา', () => {
        const nas = { '2026-03-25': 0, '2026-03-26': 7, '2026-03-31': 8.8 };
        const rounds = buildOilRounds(mergeOilBands(bundled, nas), '2026-04-01');
        expect(rounds.length).toBe(3);
    });

    it('ข้ามแหล่งที่ไม่มีข้อมูล', () => {
        expect(mergeOilBands(bundled, null, undefined, {})).toEqual(bundled);
    });

    it('เรียงลำดับความน่าเชื่อ: แหล่งท้ายสุดชนะ', () => {
        const rtdb = { '2026-03-26': 5 };
        const nas = { '2026-03-26': 9 };
        expect(mergeOilBands(bundled, rtdb, nas)['2026-03-26']).toBe(9);
    });

    it('คืนชุดว่างเมื่อไม่มีแหล่งใดมีข้อมูล', () => {
        expect(mergeOilBands(null, undefined)).toEqual({});
    });
});

describe('NAS: ราคากับประวัติไม่ตรงกัน', () => {
    // ปตท. ประกาศราคาใหม่ แต่ NAS ยังไม่ทันบันทึกลงประวัติ (ดึงทุก 3 ชม.)
    const buildBands = (history: NasOilBand[], latest: { effectiveDate: string; pct: number }) => {
        const parsed: Record<string, number> = {};
        for (const b of history) parsed[b.from] = Math.round((b.diesel - OIL_BASE) * 100) / 100;
        if (parsed[latest.effectiveDate] === undefined) parsed[latest.effectiveDate] = latest.pct;
        return parsed;
    };

    it('เติมงวดใหม่จากราคาล่าสุดเมื่อประวัติยังตามไม่ทัน', () => {
        const history: NasOilBand[] = [
            { from: '2026-08-12', diesel: 37.54 },
        ];
        const latest = { effectiveDate: '2026-08-19', pct: 6.45 };
        const bands = buildBands(history, latest);
        expect(bands['2026-08-19']).toBe(6.45);
        expect(Object.keys(bands).length).toBe(2);
    });

    it('ไม่ทับงวดที่ประวัติมีอยู่แล้ว', () => {
        const history: NasOilBand[] = [
            { from: '2026-08-12', diesel: 37.54 },
            { from: '2026-08-19', diesel: 38.39 },
        ];
        const bands = buildBands(history, { effectiveDate: '2026-08-19', pct: 99 });
        expect(bands['2026-08-19']).toBe(6.45);
    });

    it('งวดที่เติมทำให้ราคาในตารางตรงกับการ์ด', () => {
        const bands = buildBands([{ from: '2026-08-12', diesel: 37.54 }], {
            effectiveDate: '2026-08-19', pct: 6.45,
        });
        const rounds = buildOilRounds(bands, '2026-08-20');
        expect(rounds[rounds.length - 1].diesel).toBe(38.39);
    });
});
