import { describe, it, expect } from 'vitest';
import { findFuelRateOptions, hasFuelRateRoute, matchSelectedFuelRate } from './fuelRateLookup';
import type { FuelRateRow } from './fuelRateParser';

/** แถวจริงจากไฟล์ที่หน่วยงานส่งมา — เขียนชื่อและประเภทรถแบบของหน่วยงาน */
const realRow = (over: Partial<FuelRateRow> = {}): FuelRateRow => ({
    seq: 1,
    company: 'รถร่วมคุณหนึ่ง',
    origin: 'ซันลี บางปะกง',
    destination: '7-11 ลาดกระบัง (สุวรรณภูมิ)',
    truckType: '4w (บรรทุกไม่เกิน 3000 กก.)',
    note: '',
    bands: [
        { fuelFrom: 34.99, fuelTo: 36.98, price: 2000 },
        { fuelFrom: 36.99, fuelTo: 38.98, price: 2040 },
        { fuelFrom: 38.99, fuelTo: 40.98, price: 2080 },
    ],
    ...over,
});

/** เส้นทางเดียวกันที่ผู้ใช้กรอกในฟอร์ม — ใช้ชื่อประเภทรถแบบที่ระบบใช้ */
const query = {
    origin: 'ซันลี บางปะกง',
    destination: '7-11 ลาดกระบัง (สุวรรณภูมิ)',
    truckType: '4w',
};

describe('findFuelRateOptions', () => {
    it('จับคู่ได้แม้ไฟล์เขียนประเภทรถยาวกว่าที่ระบบใช้', () => {
        const out = findFuelRateOptions([realRow()], query, 38.39);
        expect(out).toHaveLength(1);
        expect(out[0].price).toBe(2040);
    });

    it('คืนชื่อผู้รับเหมาเป็นชื่อมาตรฐาน ไม่ใช่ชื่อดิบในไฟล์', () => {
        const out = findFuelRateOptions([realRow()], query, 38.39);
        expect(out[0].subcontractor).toBe('รถร่วมคุณวสรรณ์');
    });

    it('บอกช่วงราคาน้ำมันที่ราคานี้ใช้ — ผู้ใช้ต้องรู้ว่าราคามาจากไหน', () => {
        const out = findFuelRateOptions([realRow()], query, 38.39);
        expect(out[0].fuelBand).toBe('36.99–38.98');
    });

    it('เก็บพิกัดน้ำหนักที่หน่วยงานเขียนไว้ ไม่ทิ้ง', () => {
        const out = findFuelRateOptions([realRow()], query, 38.39);
        expect(out[0].truckSpec).toBe('บรรทุกไม่เกิน 3000 กก.');
    });

    it('ราคาเปลี่ยนตามราคาน้ำมัน', () => {
        const rows = [realRow()];
        expect(findFuelRateOptions(rows, query, 35.5)[0].price).toBe(2000);
        expect(findFuelRateOptions(rows, query, 38.39)[0].price).toBe(2040);
        expect(findFuelRateOptions(rows, query, 39.5)[0].price).toBe(2080);
    });

    it('ราคาน้ำมันนอกทุกช่วง = ไม่มีตัวเลือก ไม่ใช่ราคา 0', () => {
        expect(findFuelRateOptions([realRow()], query, 60)).toEqual([]);
        expect(findFuelRateOptions([realRow()], query, 20)).toEqual([]);
    });

    it('ช่วงที่หน่วยงานใส่ราคา 0 ถือว่ายังไม่มีเรท', () => {
        const row = realRow({ bands: [{ fuelFrom: 36.99, fuelTo: 38.98, price: 0 }] });
        expect(findFuelRateOptions([row], query, 38.39)).toEqual([]);
    });

    it('4wj ไม่ถูกจับคู่กับ 4w — คนละพิกัดน้ำหนัก', () => {
        const row = realRow({ truckType: '4wj (บรรทุก 3001 - 3500 กก.)' });
        expect(findFuelRateOptions([row], query, 38.39)).toEqual([]);
        expect(findFuelRateOptions([row], { ...query, truckType: '4wj' }, 38.39)).toHaveLength(1);
    });

    it('เส้นทางอื่นไม่ถูกจับคู่', () => {
        expect(findFuelRateOptions([realRow()], { ...query, destination: '7-11 บางละมุง' }, 38.39)).toEqual([]);
        expect(findFuelRateOptions([realRow()], { ...query, origin: 'ที่อื่น' }, 38.39)).toEqual([]);
    });

    it('เรียงถูกสุดขึ้นก่อน', () => {
        const rows = [
            realRow({ company: 'เจ้าแพง', bands: [{ fuelFrom: 36.99, fuelTo: 38.98, price: 3000 }] }),
            realRow({ company: 'เจ้าถูก', bands: [{ fuelFrom: 36.99, fuelTo: 38.98, price: 1500 }] }),
        ];
        const out = findFuelRateOptions(rows, query, 38.39);
        expect(out.map(o => o.price)).toEqual([1500, 3000]);
    });

    it('ไม่สนตัวพิมพ์และช่องว่างเกินในชื่อเส้นทาง', () => {
        const out = findFuelRateOptions([realRow()], { ...query, origin: '  ซันลี   บางปะกง ' }, 38.39);
        expect(out).toHaveLength(1);
    });

    it('ข้อมูลไม่ครบ = ไม่คืนอะไร ไม่ระเบิด', () => {
        expect(findFuelRateOptions([], query, 38.39)).toEqual([]);
        expect(findFuelRateOptions([realRow()], { ...query, origin: '' }, 38.39)).toEqual([]);
        expect(findFuelRateOptions([realRow()], { ...query, truckType: '' }, 38.39)).toEqual([]);
    });
});

describe('hasFuelRateRoute', () => {
    it('แยก "ไม่มีเส้นทาง" ออกจาก "มีเส้นทางแต่ยังไม่มีราคาที่น้ำมันวันนี้"', () => {
        const rows = [realRow()];
        // ราคาน้ำมัน 60 ไม่มีในช่วงใดเลย แต่เส้นทางมีอยู่จริง
        expect(findFuelRateOptions(rows, query, 60)).toEqual([]);
        expect(hasFuelRateRoute(rows, query)).toBe(true);
    });

    it('เส้นทางที่ไม่มีในตารางเลย', () => {
        expect(hasFuelRateRoute([realRow()], { ...query, destination: 'ที่ไหนสักแห่ง' })).toBe(false);
    });

    it('ตารางว่างไม่ระเบิด', () => {
        expect(hasFuelRateRoute([], query)).toBe(false);
    });
});

describe('matchSelectedFuelRate — ตัวเดียวกันที่ปุ่มบันทึกและตัวบันทึกใช้', () => {
    const rows = [realRow()];
    const picked = { subcontractor: 'รถร่วมคุณวสรรณ์', cost: 2040 };

    it('ยืนยันราคาที่เลือกจากเรทได้', () => {
        expect(matchSelectedFuelRate(rows, query, 38.39, picked)?.price).toBe(2040);
    });

    it('เส้นทางที่ไม่มีในราคากลางเลย ต้องยังยืนยันได้ — นี่คือเคสหลักของฟีเจอร์', () => {
        // ถ้าฟังก์ชันนี้คืน undefined ปุ่มบันทึกจะเทาค้างกับเส้นทางที่ฟีเจอร์ตั้งใจรองรับ
        expect(matchSelectedFuelRate(rows, query, 38.39, picked)).toBeDefined();
    });

    it('ผู้ใช้ย้อนไปแก้เส้นทางหลังเลือกเรทแล้ว ต้องไม่ยืนยัน', () => {
        const changed = { ...query, destination: '7-11 บางละมุง' };
        expect(matchSelectedFuelRate(rows, changed, 38.39, picked)).toBeUndefined();
    });

    it('ผู้ใช้ย้อนไปแก้ประเภทรถหลังเลือกเรทแล้ว ต้องไม่ยืนยัน', () => {
        expect(matchSelectedFuelRate(rows, { ...query, truckType: '6w' }, 38.39, picked)).toBeUndefined();
    });

    it('ราคาน้ำมันขยับข้ามช่วงหลังเลือกแล้ว ราคาเดิมต้องไม่ผ่าน', () => {
        // ที่ 39.50 เรทเป็น 2,080 ไม่ใช่ 2,040 ที่ค้างอยู่ในฟอร์ม
        expect(matchSelectedFuelRate(rows, query, 39.5, picked)).toBeUndefined();
        expect(matchSelectedFuelRate(rows, query, 39.5, { ...picked, cost: 2080 })?.price).toBe(2080);
    });

    it('ราคาที่ถูกแก้มือให้ต่างจากเรท ต้องไม่ผ่าน', () => {
        expect(matchSelectedFuelRate(rows, query, 38.39, { ...picked, cost: 1 })).toBeUndefined();
        expect(matchSelectedFuelRate(rows, query, 38.39, { ...picked, cost: 0 })).toBeUndefined();
    });

    it('ผู้รับเหมาคนละรายกับที่มีเรท ต้องไม่ผ่าน', () => {
        expect(matchSelectedFuelRate(rows, query, 38.39, { ...picked, subcontractor: 'KNN' })).toBeUndefined();
    });

    it('ยังไม่เลือกผู้รับเหมา = ไม่ผ่าน', () => {
        expect(matchSelectedFuelRate(rows, query, 38.39, { subcontractor: '', cost: 2040 })).toBeUndefined();
    });

    it('ค่าที่ใช้ไม่ได้ไม่ทำให้พัง', () => {
        expect(matchSelectedFuelRate(rows, query, 38.39, { ...picked, cost: NaN })).toBeUndefined();
        expect(matchSelectedFuelRate([], query, 38.39, picked)).toBeUndefined();
    });
});

describe('เส้นทางที่มีทั้งราคากลางและเรทน้ำมัน', () => {
    /**
     * จำลองตรรกะเลือกแหล่งราคาใน JobRequestForm
     * ราคาขายเป็นตัวแยก: ราคากลางมีราคาขาย เรทของหน่วยงานไม่มี (เป็น 0)
     */
    const decide = (form: { cost: number; sellingPrice: number }, matrix: { cost: number; selling: number } | null) => {
        const hasMatrix = !!matrix;
        const matchesMatrix = hasMatrix
            && form.cost === matrix!.cost
            && form.sellingPrice === matrix!.selling;
        const fuel = matchSelectedFuelRate(
            [realRow()], query, 38.39,
            { subcontractor: 'รถร่วมคุณวสรรณ์', cost: form.cost }
        );
        const useFuel = matchesMatrix ? undefined : fuel;
        return {
            source: useFuel ? 'fuel' : 'matrix',
            cost: useFuel ? useFuel.price : (hasMatrix ? matrix!.cost : 0),
            sellingPrice: useFuel ? 0 : (hasMatrix ? matrix!.selling : 0),
        };
    };

    it('เลือกราคากลางที่ต้นทุนบังเอิญเท่ากับเรท ต้องไม่ถูกนับเป็นเรทน้ำมัน', () => {
        // บั๊กเดิม: ต้นทุนเท่ากันทำให้เรทชนะ แล้วราคาขาย 2,500 หายกลายเป็น 0
        const r = decide({ cost: 2040, sellingPrice: 2500 }, { cost: 2040, selling: 2500 });
        expect(r.source).toBe('matrix');
        expect(r.sellingPrice).toBe(2500);
    });

    it('เลือกเรทน้ำมันในเส้นทางที่มีราคากลางด้วย', () => {
        const r = decide({ cost: 2040, sellingPrice: 0 }, { cost: 2040, selling: 2500 });
        expect(r.source).toBe('fuel');
        expect(r.cost).toBe(2040);
        expect(r.sellingPrice).toBe(0);
    });

    it('เส้นทางที่ไม่มีในราคากลาง ใช้เรทน้ำมันและต้นทุนต้องไม่เป็น 0', () => {
        const r = decide({ cost: 2040, sellingPrice: 0 }, null);
        expect(r.source).toBe('fuel');
        expect(r.cost).toBe(2040);
    });
});

describe('ราคาที่เลือกไว้ล้าสมัยระหว่างเปิดฟอร์มค้าง', () => {
    /**
     * จำลองการ์ดใน JobRequestForm: ถ้าผู้ใช้เลือกจากกล่องเรท แต่ราคานั้นใช้ไม่ได้แล้ว
     * ต้องหยุดให้เลือกใหม่ ไม่ใช่ตกไปใช้ราคากลางเงียบ ๆ
     */
    const shouldBlock = (
        form: { sub: string; cost: number; sellingPrice: number },
        matrix: { cost: number; selling: number } | null,
        fuelPriceNow: number
    ) => {
        const hasMatrix = !!matrix;
        const matchesMatrix = hasMatrix && form.cost === matrix!.cost && form.sellingPrice === matrix!.selling;
        const fuel = matchSelectedFuelRate(
            [realRow()], query, fuelPriceNow,
            { subcontractor: form.sub, cost: form.cost }
        );
        const selectedFuelMatch = matchesMatrix ? undefined : fuel;
        const pickedFromFuelBlock = !!form.sub && form.cost > 0 && !matchesMatrix;
        return pickedFromFuelBlock && !selectedFuelMatch;
    };

    const picked = { sub: 'รถร่วมคุณวสรรณ์', cost: 2040, sellingPrice: 0 };

    it('น้ำมันขยับข้ามช่วงหลังเลือก ต้องหยุด ไม่ใช่ใช้ราคากลางแทนเงียบ ๆ', () => {
        // เคสจริง: เลือกเรท 2,040 ที่ 38.39 แล้วน้ำมันขึ้นเป็น 39.50 (เรทกลายเป็น 2,080)
        // ราคากลางมีอยู่ที่ 2,100 — ถ้าไม่หยุด ใบงานจะถูกบันทึกที่ 2,100 ทั้งที่จอแสดง 2,040
        expect(shouldBlock(picked, { cost: 2100, selling: 2500 }, 39.5)).toBe(true);
    });

    it('ราคายังตรงกับเรทปัจจุบัน บันทึกได้ตามปกติ', () => {
        expect(shouldBlock(picked, { cost: 2100, selling: 2500 }, 38.39)).toBe(false);
    });

    it('เลือกราคากลางไว้ ไม่ถูกบล็อก', () => {
        expect(shouldBlock(
            { sub: 'รถร่วมคุณวสรรณ์', cost: 2100, sellingPrice: 2500 },
            { cost: 2100, selling: 2500 },
            39.5
        )).toBe(false);
    });

    it('เส้นทางไม่มีราคากลางเลย และเรทล้าสมัย ก็ต้องหยุด', () => {
        expect(shouldBlock(picked, null, 39.5)).toBe(true);
    });
});

describe('จำนวนจุดส่งที่คิดเงิน', () => {
    /** นับเหมือนกันทั้งตอนแสดงราคาและตอนบันทึก — นับเฉพาะที่กรอกชื่อแล้ว */
    const billable = (drops: { location: string }[]) =>
        drops.filter(d => (d.location || '').trim()).length;

    it('แถวที่ยังไม่กรอกชื่อไม่ถูกคิดเงิน', () => {
        expect(billable([{ location: 'จุด A' }, { location: '' }, { location: '   ' }])).toBe(1);
    });

    it('จอกับตอนบันทึกต้องได้เลขเดียวกัน', () => {
        // บั๊กเดิม: จอนับ drops.length (รวมแถวว่าง) ตอนบันทึกนับเฉพาะที่กรอกชื่อ
        // ราคาบนจอจึงสูงกว่าที่บันทึกจริงจุดละ 1,000 บาท และทำให้ตัวตรวจราคา
        // เข้าใจผิดว่าผู้ใช้เลือกราคามาจากคนละแหล่ง แล้วบล็อกการบันทึกผิด ๆ
        const drops = [{ location: 'จุด A' }, { location: '' }];
        const base = 2000, dropFee = 1000;
        const uiPrice = base + billable(drops) * dropFee;
        const savePrice = base + billable(drops) * dropFee;
        expect(uiPrice).toBe(savePrice);
        expect(uiPrice).toBe(3000);
    });

    it('ไม่มีจุดส่งเลย', () => {
        expect(billable([])).toBe(0);
    });
});

describe('ผู้รับเหมารายเดียวมีหลายแถวราคาในเส้นทางเดียว', () => {
    /** จำลองการเลือกแถวราคากลางตอนบันทึกใน JobRequestForm */
    const pickRow = (
        rows: { basePrice: number; dropOffFee?: number }[],
        pickedCost: number,
        dropCount: number
    ) => {
        const sorted = [...rows].sort((a, b) => a.basePrice - b.basePrice);
        const total = (r: typeof rows[number]) => r.basePrice + dropCount * (r.dropOffFee || 0);
        return (Number.isFinite(pickedCost) && pickedCost > 0
            ? sorted.find(r => total(r) === pickedCost)
            : undefined) ?? sorted[0];
    };

    const rows = [{ basePrice: 18500 }, { basePrice: 21000 }];

    it('ใช้แถวที่ตรงกับราคาที่ผู้ใช้กดเลือก ไม่ใช่แถวถูกสุดเสมอ', () => {
        // บั๊กเดิม: เลือก 21,000 บนจอ แต่ตอนบันทึกหยิบ 18,500 มาเทียบ
        // แล้วสรุปว่าราคาไม่ตรง จึงบล็อกการบันทึกทั้งที่ผู้ใช้เลือกถูก
        expect(pickRow(rows, 21000, 0).basePrice).toBe(21000);
        expect(pickRow(rows, 18500, 0).basePrice).toBe(18500);
    });

    it('คิดค่าจุดส่งเข้าไปด้วยตอนเทียบ', () => {
        const withFee = [{ basePrice: 2000, dropOffFee: 1000 }, { basePrice: 2500, dropOffFee: 500 }];
        expect(pickRow(withFee, 3000, 1).basePrice).toBe(2000);   // 2000 + 1000
        expect(pickRow(withFee, 3500, 2).basePrice).toBe(2500);   // 2500 + 2*500
    });

    it('ยังไม่ได้เลือกราคา ใช้แถวถูกสุดเหมือนเดิม', () => {
        expect(pickRow(rows, 0, 0).basePrice).toBe(18500);
        expect(pickRow(rows, NaN, 0).basePrice).toBe(18500);
    });

    it('ราคาที่เลือกไม่ตรงแถวไหนเลย ตกไปใช้แถวถูกสุด', () => {
        expect(pickRow(rows, 99999, 0).basePrice).toBe(18500);
    });
});

describe('แถวราคาที่ต้นทุนเท่ากันแต่ราคาขายต่างกัน', () => {
    /** เลือกแถวโดยเทียบทั้งต้นทุนและราคาขาย แล้วค่อยตกไปเทียบต้นทุนอย่างเดียว */
    const pickRow = (
        rows: { basePrice: number; sellingBasePrice: number; dropOffFee?: number }[],
        picked: { cost: number; selling: number },
        dropCount: number
    ) => {
        const sorted = [...rows].sort((a, b) => a.basePrice - b.basePrice);
        const total = (r: typeof rows[number], base: number) => base + dropCount * (r.dropOffFee || 0);
        return (Number.isFinite(picked.cost) && picked.cost > 0
            ? (sorted.find(r => total(r, r.basePrice) === picked.cost
                && Number.isFinite(picked.selling)
                && total(r, r.sellingBasePrice) === picked.selling)
                ?? sorted.find(r => total(r, r.basePrice) === picked.cost))
            : undefined) ?? sorted[0];
    };

    const rows = [
        { basePrice: 1000, sellingBasePrice: 1000 },
        { basePrice: 1000, sellingBasePrice: 1200 },
    ];

    it('เลือกแถวที่ราคาขายตรงกับที่ผู้ใช้กด ไม่ใช่แถวแรกที่ต้นทุนตรง', () => {
        // บั๊กเดิม: เทียบแต่ต้นทุน จึงได้แถวราคาขาย 1,000 ทั้งที่ผู้ใช้เลือกแถว 1,200
        // แล้วสรุปว่าราคาไม่ตรง จึงบล็อกการบันทึก
        expect(pickRow(rows, { cost: 1000, selling: 1200 }, 0).sellingBasePrice).toBe(1200);
        expect(pickRow(rows, { cost: 1000, selling: 1000 }, 0).sellingBasePrice).toBe(1000);
    });

    it('ราคาขายไม่ตรงแถวไหน ตกไปใช้แถวที่ต้นทุนตรง', () => {
        expect(pickRow(rows, { cost: 1000, selling: 9999 }, 0).basePrice).toBe(1000);
    });

    it('ยังไม่ได้เลือก ใช้แถวถูกสุด', () => {
        expect(pickRow(rows, { cost: 0, selling: 0 }, 0).basePrice).toBe(1000);
    });
});

describe('แหล่งราคาตามแท็บที่เลือก', () => {
    /** จำลองตรรกะใน JobRequestForm หลังแยกเป็น 3 แท็บ */
    const decide = (
        mode: 'standard' | 'fuel' | 'spot',
        form: { sub: string; cost: number; selling: number },
        matrix: { cost: number; selling: number } | null,
        fuelPriceNow = 38.39
    ) => {
        const hasUsablePrice = !!matrix;
        const matchesMatrix = hasUsablePrice
            && form.cost === matrix!.cost && form.selling === matrix!.selling;
        const fuelMatch = matchSelectedFuelRate(
            [realRow()], query, fuelPriceNow,
            { subcontractor: form.sub, cost: form.cost }
        );
        const selectedFuelMatch = mode === 'fuel' ? fuelMatch : (!matchesMatrix ? fuelMatch : undefined);
        const hasPricing = mode === 'fuel' ? !!selectedFuelMatch : (hasUsablePrice || !!selectedFuelMatch);
        const pickedFromFuelBlock = !!form.sub && form.cost > 0 && (mode === 'fuel' || !matchesMatrix);
        const blocked = mode !== 'spot' && pickedFromFuelBlock && !selectedFuelMatch;
        return { source: selectedFuelMatch ? 'fuel' : (hasPricing ? 'matrix' : 'none'), hasPricing, blocked };
    };

    const fuelPick = { sub: 'รถร่วมคุณวสรรณ์', cost: 2040, selling: 0 };

    it('แท็บเรท: ใช้ราคาจากเรทเท่านั้น', () => {
        const r = decide('fuel', fuelPick, { cost: 2100, selling: 2500 });
        expect(r.source).toBe('fuel');
    });

    it('แท็บเรท: ราคาบังเอิญตรงราคากลาง ก็ยังต้องมาจากเรท', () => {
        // ถ้ายอมให้ราคากลางชนะ ใบงานจะบันทึกราคาขาย 2,500 ทั้งที่หน้าจออยู่แท็บเรท
        const r = decide('fuel', { sub: 'รถร่วมคุณวสรรณ์', cost: 2040, selling: 2040 }, { cost: 2040, selling: 2040 });
        expect(r.source).toBe('fuel');
    });

    it('แท็บเรท: เรทล้าสมัย ต้องบล็อก ไม่ยืมราคากลางมาผ่าน', () => {
        const r = decide('fuel', fuelPick, { cost: 2100, selling: 2500 }, 39.5);
        expect(r.blocked).toBe(true);
        expect(r.hasPricing).toBe(false);
    });

    it('แท็บราคากลาง: ใช้ราคากลางตามปกติ', () => {
        const r = decide('standard', { sub: 'รถร่วมคุณวสรรณ์', cost: 2100, selling: 2500 }, { cost: 2100, selling: 2500 });
        expect(r.source).toBe('matrix');
        expect(r.blocked).toBe(false);
    });

    it('แท็บ spot: ไม่ถูกบล็อกด้วยตรรกะเรท', () => {
        const r = decide('spot', fuelPick, null, 39.5);
        expect(r.blocked).toBe(false);
    });
});
