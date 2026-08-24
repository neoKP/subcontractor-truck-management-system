import { describe, it, expect } from 'vitest';
import { oilPriceAtDate } from './oilPriceAtDate';
import { OIL_BASE } from './oilRounds';

/** งวดจริงจาก NAS (แปลงเป็น %สะสมเหมือนที่ useOilPrice เก็บ) */
const pct = (diesel: number) => diesel - OIL_BASE;
const HISTORY = {
    '2026-03-25': pct(31.94),
    '2026-06-13': pct(39.80),
    '2026-07-08': pct(34.94),
    '2026-07-23': pct(36.69),
    '2026-08-12': pct(37.54),
    '2026-08-19': pct(38.39),
};
const TODAY = '2026-08-22';

describe('oilPriceAtDate', () => {
    it('ใช้ราคาของงวดที่ครอบคลุมวันนั้น ไม่ใช่ราคาวันนี้', () => {
        // เคสจริง: งานวันที่ 10 ก.ค. ดีเซล 34.94 — ถ้าใช้ราคาวันนี้ (38.39) ค่าขนส่งเกินไป 80 บาท
        const r = oilPriceAtDate(HISTORY, '2026-07-10', TODAY);
        expect(r.diesel).toBeCloseTo(34.94, 2);
        expect(r.effectiveDate).toBe('2026-07-08');
        expect(r.status).toBe('exact');
        expect(r.usable).toBe(true);
    });

    it('วันแรกของงวดใช้ราคางวดนั้น', () => {
        expect(oilPriceAtDate(HISTORY, '2026-08-19', TODAY).diesel).toBeCloseTo(38.39, 2);
    });

    it('วันสุดท้ายก่อนงวดใหม่ยังใช้ราคางวดเก่า', () => {
        expect(oilPriceAtDate(HISTORY, '2026-08-18', TODAY).diesel).toBeCloseTo(37.54, 2);
    });

    it('วันนี้ใช้งวดล่าสุด', () => {
        const r = oilPriceAtDate(HISTORY, TODAY, TODAY);
        expect(r.diesel).toBeCloseTo(38.39, 2);
        expect(r.status).toBe('exact');
    });

    it('ราคาน้ำมันลดลงก็ตามได้ ไม่ใช่เอาค่าสูงสุด', () => {
        // 13 มิ.ย. ดีเซล 39.80 แล้วลดเหลือ 34.94 ในวันที่ 8 ก.ค.
        expect(oilPriceAtDate(HISTORY, '2026-06-15', TODAY).diesel).toBeCloseTo(39.80, 2);
        expect(oilPriceAtDate(HISTORY, '2026-07-09', TODAY).diesel).toBeCloseTo(34.94, 2);
    });

    it('รับ ISO ที่มีเวลาติดมาได้', () => {
        expect(oilPriceAtDate(HISTORY, '2026-07-10T08:30:00.000Z', TODAY).diesel).toBeCloseTo(34.94, 2);
    });

    describe('วันที่อยู่ในอนาคต', () => {
        it('ใช้งวดล่าสุดไปก่อน และบอกว่าเป็นอนาคต', () => {
            const r = oilPriceAtDate(HISTORY, '2026-08-24', TODAY);
            expect(r.diesel).toBeCloseTo(38.39, 2);
            expect(r.status).toBe('future');
            expect(r.usable).toBe(true);
            expect(r.daysAhead).toBe(2);
        });

        it('นับจำนวนวันล่วงหน้าถูกต้อง', () => {
            expect(oilPriceAtDate(HISTORY, '2026-09-22', TODAY).daysAhead).toBe(31);
        });

        it('ไม่เดาราคาอนาคต — ใช้งวดล่าสุดตรง ๆ', () => {
            const r = oilPriceAtDate(HISTORY, '2026-12-31', TODAY);
            expect(r.diesel).toBeCloseTo(38.39, 2);
            expect(r.effectiveDate).toBe('2026-08-19');
        });
    });

    describe('วันที่เก่ากว่าข้อมูลที่มี', () => {
        it('ไม่ใช้งวดแรกแทน — ราคาจริงอาจต่างมาก', () => {
            const r = oilPriceAtDate(HISTORY, '2026-01-01', TODAY);
            expect(r.status).toBe('before-history');
            expect(r.usable).toBe(false);
            expect(r.diesel).toBe(0);
        });

        it('บอกว่าข้อมูลเริ่มวันไหน เพื่อให้ผู้ใช้รู้ว่าทำไมใช้ไม่ได้', () => {
            expect(oilPriceAtDate(HISTORY, '2026-01-01', TODAY).effectiveDate).toBe('2026-03-25');
        });
    });

    describe('ข้อมูลไม่ครบ', () => {
        it('ไม่มีประวัติเลย', () => {
            const r = oilPriceAtDate({}, '2026-07-10', TODAY);
            expect(r.status).toBe('no-data');
            expect(r.usable).toBe(false);
        });

        it('ไม่ระบุวันที่', () => {
            expect(oilPriceAtDate(HISTORY, '', TODAY).usable).toBe(false);
            expect(oilPriceAtDate(HISTORY, undefined as unknown as string, TODAY).usable).toBe(false);
        });

        it('byDate เป็น null ไม่ระเบิด', () => {
            expect(oilPriceAtDate(null, '2026-07-10', TODAY).status).toBe('no-data');
        });
    });
});

describe('การตรวจราคาก่อนล็อกที่หน้าตรวจทาน', () => {
    /**
     * จำลองตรรกะใน ReviewConfirmModal — ราคาถูกต้องเมื่อตรงกับแหล่งใดแหล่งหนึ่ง
     * (ราคากลาง หรือ เรทตามน้ำมันของวันที่ต้องการรถ)
     */
    const check = (
        cost: number,
        sub: string,
        hasMatrixPrice: boolean,
        fuelOptions: { subcontractor: string; price: number }[]
    ) => {
        const fuelMatch = fuelOptions.find(o => o.subcontractor === sub && Math.abs(o.price - cost) < 0.01);
        const fuelExpected = fuelOptions.find(o => o.subcontractor === sub);
        return {
            canConfirm: !!(sub && cost > 0 && (hasMatrixPrice || !!fuelMatch)),
            fuelPriceStale: !fuelMatch && !!fuelExpected,
        };
    };

    const SUB = 'รถร่วมคุณวสรรณ์';

    it('งานที่ใช้เรทน้ำมันต้องยืนยันได้ แม้ไม่มีราคากลาง', () => {
        // บั๊กเดิม: บังคับต้องมีราคากลาง ทำให้ 32 เส้นทางที่หน่วยงานให้เรทมา
        // (ซึ่งไม่มีในราคากลางเลยสักเส้น) ค้างอยู่ขั้นตรวจทานตลอดไป
        const r = check(2040, SUB, false, [{ subcontractor: SUB, price: 2040 }]);
        expect(r.canConfirm).toBe(true);
    });

    it('ราคาเรทเปลี่ยนหลังสร้างใบงาน ต้องเตือนและยังยืนยันไม่ได้', () => {
        // งานจองล่วงหน้า: สร้างตอนเรท 2,040 แล้วน้ำมันปรับ เรทวันงานเป็น 2,080
        const r = check(2040, SUB, false, [{ subcontractor: SUB, price: 2080 }]);
        expect(r.fuelPriceStale).toBe(true);
        expect(r.canConfirm).toBe(false);
    });

    it('งานราคากลางปกติไม่ได้รับผลกระทบ', () => {
        const r = check(5000, SUB, true, []);
        expect(r.canConfirm).toBe(true);
        expect(r.fuelPriceStale).toBe(false);
    });

    it('ไม่มีเรทของรายนี้เลย ไม่ถือว่าราคาล้าสมัย', () => {
        const r = check(5000, SUB, true, [{ subcontractor: 'KNN', price: 2040 }]);
        expect(r.fuelPriceStale).toBe(false);
    });

    it('ยังไม่เลือกผู้รับเหมา หรือราคาเป็น 0 ยืนยันไม่ได้', () => {
        expect(check(2040, '', false, [{ subcontractor: SUB, price: 2040 }]).canConfirm).toBe(false);
        expect(check(0, SUB, true, []).canConfirm).toBe(false);
    });
});

describe('เรทรุ่นใหม่มีผลกับงานที่ยังไม่ล็อกราคา', () => {
    /**
     * ข้อตกลงกับหน่วยงาน: หน่วยงานแก้เรทแล้วเราต้องตาม
     * งานที่ราคายังไม่ถูกล็อกจึงถูกวัดด้วยเรทรุ่นล่าสุดเสมอ ไม่ใช่รุ่นตอนที่สร้างใบงาน
     */
    const matches = (jobCost: number, latestRate: number) => Math.abs(latestRate - jobCost) < 0.01;

    it('เรทรุ่นใหม่ราคาต่างจากเดิม งานเก่าต้องขึ้นเตือนให้แก้', () => {
        // สร้างใบงานตอนเรทรุ่นเก่า 2,040 แล้วหน่วยงานส่งรุ่นใหม่มาเป็น 2,080
        expect(matches(2040, 2080)).toBe(false);
    });

    it('เรทรุ่นใหม่ราคาเท่าเดิม ผ่านตามปกติ', () => {
        expect(matches(2040, 2040)).toBe(true);
    });

    it('แก้ราคาตามเรทใหม่แล้วผ่าน', () => {
        expect(matches(2080, 2080)).toBe(true);
    });
});
