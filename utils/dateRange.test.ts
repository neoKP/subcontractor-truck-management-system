import { describe, it, expect } from 'vitest';
import { dayOf, isWithinPeriod } from './dateRange';

describe('dayOf', () => {
    it('ตัดเวลาออกจาก ISO', () => {
        expect(dayOf('2026-08-31T08:30:00.000Z')).toBe('2026-08-31');
    });
    it('วันล้วนคงเดิม', () => {
        expect(dayOf('2026-08-31')).toBe('2026-08-31');
    });
    it('ค่าว่างได้สตริงว่าง ไม่ระเบิด', () => {
        expect(dayOf(undefined)).toBe('');
        expect(dayOf(null)).toBe('');
        expect(dayOf('')).toBe('');
    });
});

describe('isWithinPeriod', () => {
    const START = '2026-08-01';
    const END = '2026-08-31';

    it('งานวันสุดท้ายของงวดที่มีเวลาติดมา ต้องอยู่ในงวด', () => {
        // เคสจริงที่ทำให้งานหายจากใบแจ้งหนี้: เทียบสตริงตรง ๆ จะได้ false
        expect('2026-08-31T08:30:00.000Z' <= END).toBe(false);   // พฤติกรรมเดิม
        expect(isWithinPeriod('2026-08-31T08:30:00.000Z', START, END)).toBe(true);
    });

    it('งานวันแรกของงวดที่มีเวลาติดมา ต้องอยู่ในงวด', () => {
        expect(isWithinPeriod('2026-08-01T23:59:00.000Z', START, END)).toBe(true);
    });

    it('นับวันต้นงวดและปลายงวดด้วย', () => {
        expect(isWithinPeriod('2026-08-01', START, END)).toBe(true);
        expect(isWithinPeriod('2026-08-31', START, END)).toBe(true);
    });

    it('นอกงวดต้องไม่ถูกนับ', () => {
        expect(isWithinPeriod('2026-07-31', START, END)).toBe(false);
        expect(isWithinPeriod('2026-09-01', START, END)).toBe(false);
        expect(isWithinPeriod('2026-09-01T00:00:00.000Z', START, END)).toBe(false);
    });

    it('ไม่ระบุขอบเขต = ไม่จำกัดด้านนั้น', () => {
        expect(isWithinPeriod('2020-01-01', '', END)).toBe(true);
        expect(isWithinPeriod('2099-01-01', START, '')).toBe(true);
        expect(isWithinPeriod('2099-01-01', undefined, undefined)).toBe(true);
    });

    it('ไม่มีวันที่ = ไม่อยู่ในงวด', () => {
        expect(isWithinPeriod(undefined, START, END)).toBe(false);
        expect(isWithinPeriod('', START, END)).toBe(false);
    });

    it('ขอบเขตที่เป็น ISO ก็ใช้ได้', () => {
        expect(isWithinPeriod('2026-08-31', START, '2026-08-31T00:00:00.000Z')).toBe(true);
    });
});
