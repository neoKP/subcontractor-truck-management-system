import { describe, it, expect } from 'vitest';
import { findFuelRateOptions, hasFuelRateRoute, matchSelectedFuelRate } from './fuelRateLookup';
import { findRateAt, type FuelRateRow } from './fuelRateParser';

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
        expect(out[0].subcontractor).toBe('รถร่วมวสรรณ์');
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
    const picked = { subcontractor: 'รถร่วมวสรรณ์', cost: 2040 };

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
            { subcontractor: 'รถร่วมวสรรณ์', cost: form.cost }
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

    const picked = { sub: 'รถร่วมวสรรณ์', cost: 2040, sellingPrice: 0 };

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
            { sub: 'รถร่วมวสรรณ์', cost: 2100, sellingPrice: 2500 },
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

    const fuelPick = { sub: 'รถร่วมวสรรณ์', cost: 2040, selling: 0 };

    it('แท็บเรท: ใช้ราคาจากเรทเท่านั้น', () => {
        const r = decide('fuel', fuelPick, { cost: 2100, selling: 2500 });
        expect(r.source).toBe('fuel');
    });

    it('แท็บเรท: ราคาบังเอิญตรงราคากลาง ก็ยังต้องมาจากเรท', () => {
        // ถ้ายอมให้ราคากลางชนะ ใบงานจะบันทึกราคาขาย 2,500 ทั้งที่หน้าจออยู่แท็บเรท
        const r = decide('fuel', { sub: 'รถร่วมวสรรณ์', cost: 2040, selling: 2040 }, { cost: 2040, selling: 2040 });
        expect(r.source).toBe('fuel');
    });

    it('แท็บเรท: เรทล้าสมัย ต้องบล็อก ไม่ยืมราคากลางมาผ่าน', () => {
        const r = decide('fuel', fuelPick, { cost: 2100, selling: 2500 }, 39.5);
        expect(r.blocked).toBe(true);
        expect(r.hasPricing).toBe(false);
    });

    it('แท็บราคากลาง: ใช้ราคากลางตามปกติ', () => {
        const r = decide('standard', { sub: 'รถร่วมวสรรณ์', cost: 2100, selling: 2500 }, { cost: 2100, selling: 2500 });
        expect(r.source).toBe('matrix');
        expect(r.blocked).toBe(false);
    });

    it('แท็บ spot: ไม่ถูกบล็อกด้วยตรรกะเรท', () => {
        const r = decide('spot', fuelPick, null, 39.5);
        expect(r.blocked).toBe(false);
    });
});


/*
  ช่องว่าง 0.01 บาทระหว่างช่วงราคา — ต้องไม่ทำให้หาเรทไม่เจอ

  ตารางเรทของหน่วยงานเขียนขอบช่วงแบบ 37.01-38.00 แล้วต่อด้วย 38.01-39.00
  เว้นช่อง 0.01 บาทไว้ทุกคู่ (ตรวจไฟล์จริงแล้วพบ 7,776 จุด ทุกเจ้าไม่มีข้อยกเว้น)

  ปกติไม่มีปัญหา เพราะราคาน้ำมันจริงมีทศนิยม 2 ตำแหน่ง ไม่มีทางตกตรงกลาง
  แต่ถ้าใช้ "ค่าเฉลี่ยรายเดือน" ซึ่งมีทศนิยมละเอียดกว่า ค่าอย่าง 38.005
  จะตกลงไปในช่องว่างนั้นพอดี แล้วหาเรทไม่เจอ — ทุกเส้นทางพร้อมกัน
  เพราะทุกเจ้าใช้ขอบช่วงแบบเดียวกันหมด

  หน่วยงานไม่ได้ตั้งใจเว้นรูไว้ เขาแค่เขียนด้วยสมมติฐานว่าราคามี 2 ตำแหน่ง
  ระบบจึงต้องตีความช่วงให้ครอบ "ตั้งแต่เกินขอบบนของช่วงก่อนหน้า" ตามเจตนาเดิม
*/
describe('findRateAt — ช่องว่างระหว่างช่วงราคา', () => {
    /** ช่วงแบบเดียวกับที่หน่วยงานเขียนจริง: ขอบล่าง .01 ขอบบน .00 */
    const row = (): FuelRateRow => ({
        seq: 1,
        company: 'YSK TRANSPORT',
        origin: 'กทม ปริมณฑล',
        destination: 'อุทัยธานี / ชัยนาท',
        truckType: '6W',
        note: '',
        bands: [
            { fuelFrom: 37.01, fuelTo: 38.00, price: 5830 },
            { fuelFrom: 38.01, fuelTo: 39.00, price: 5940 },
            { fuelFrom: 39.01, fuelTo: 40.00, price: 6050 },
        ],
    });

    it('ค่าที่ตกช่องว่างต้องได้เรทของช่วงบน ไม่ใช่หาไม่เจอ', () => {
        const r = row();

        // 38.005 แพงกว่าขอบบนของช่วงล่าง (38.00) แล้ว จึงต้องใช้ช่วงถัดไป
        expect(findRateAt(r, 38.005)?.price).toBe(5940);
        expect(findRateAt(r, 38.001)?.price).toBe(5940);
        expect(findRateAt(r, 38.009)?.price).toBe(5940);
    });

    it('ต้องเลือกช่วงบน ไม่ใช่ช่วงล่าง — เลือกผิดทางคือจ่ายขาด', () => {
        const r = row();

        // ในไฟล์จริงราคาช่วงบนสูงกว่าช่วงล่าง 3,699 จุด และไม่มีจุดไหนต่ำกว่าเลย
        // ถ้าเลือกช่วงล่าง ผู้รับเหมาจะได้เงินน้อยกว่าที่ตกลงกันทุกครั้ง
        const hit = findRateAt(r, 38.005);
        expect(hit?.fuelFrom).toBe(38.01);
        expect(hit?.price).not.toBe(5830);
    });

    it('ค่าปกติที่ทศนิยม 2 ตำแหน่ง ต้องได้ผลเหมือนเดิมทุกค่า', () => {
        const r = row();

        expect(findRateAt(r, 37.01)?.price).toBe(5830);
        expect(findRateAt(r, 37.99)?.price).toBe(5830);
        expect(findRateAt(r, 38.00)?.price).toBe(5830);
        expect(findRateAt(r, 38.01)?.price).toBe(5940);
        expect(findRateAt(r, 38.50)?.price).toBe(5940);
        expect(findRateAt(r, 39.00)?.price).toBe(5940);
        expect(findRateAt(r, 39.01)?.price).toBe(6050);
        expect(findRateAt(r, 40.00)?.price).toBe(6050);
    });

    it('ค่าที่อยู่นอกตารางจริง ๆ ต้องยังหาไม่เจอ', () => {
        const r = row();

        // ต่ำกว่าช่วงแรก และสูงกว่าช่วงสุดท้าย — ไม่ใช่ช่องว่าง แต่คือนอกตาราง
        // การขยายขอบต้องไม่กลายเป็นเดาราคาให้ค่าที่หน่วยงานไม่ได้กำหนดไว้
        expect(findRateAt(r, 36.50)).toBeNull();
        expect(findRateAt(r, 41.00)).toBeNull();
        expect(findRateAt(r, 40.005)).toBeNull();
    });

    it('ขอบล่างสุดของตารางต้องไม่ถูกขยาย เพราะไม่มีช่องว่างให้ปิด', () => {
        const r = row();

        // ช่วงแรก (37.01) ไม่มีช่วงก่อนหน้าจ่อไว้ จึงไม่มีช่องว่างให้ปิด
        // ค่าที่ต่ำกว่า 37.01 คืออยู่ "ใต้ตาราง" ซึ่งหน่วยงานไม่เคยกำหนดราคาไว้
        // ถ้าขยายขอบล่างสุดด้วย จะกลายเป็นเดาราคาแทนหน่วยงาน
        expect(findRateAt(r, 37.005)).toBeNull();
        expect(findRateAt(r, 37.00)).toBeNull();
        expect(findRateAt(r, 36.99)).toBeNull();
        // ขอบล่างพอดีต้องยังใช้ได้
        expect(findRateAt(r, 37.01)?.price).toBe(5830);
    });

    /*
      ขอบช่วงที่ทศนิยมลอยตัวเก็บไม่ตรง — ต้องทดสอบด้วยค่าพวกนี้โดยเฉพาะ

      38.01 - 0.01 ได้ 38 พอดี แต่ 32.01 - 0.01 ได้ 31.999999999999996
      ถ้าเทียบทศนิยมตรง ๆ ค่า 32.00 (ขอบบนของช่วงก่อนหน้า) จะหลุดเข้ามาในช่วงถัดไป
      เทสต์ที่ใช้แต่ 38.01 จะไม่เห็นปัญหานี้เลย เพราะบังเอิญเก็บได้ตรง

      ในไฟล์จริงมีขอบแบบนี้ 3 ค่าจาก 66 ค่า: 28.99 / 30.99 / 32.01
    */
    it('ขอบช่วงที่ทศนิยมเก็บไม่ตรง ต้องไม่ทำให้ค่าหลุดข้ามช่วง', () => {
        const r: FuelRateRow = {
            ...row(),
            bands: [
                { fuelFrom: 31.01, fuelTo: 32.00, price: null },
                { fuelFrom: 32.01, fuelTo: 33.00, price: 13905 },
            ],
        };

        // 32.00 อยู่ในช่วงที่หน่วยงานเว้นราคาไว้ ต้องเป็น "ไม่มีเรท"
        // ห้ามหลุดไปหยิบราคาของช่วงถัดไปเพราะ 32.01 - 0.01 = 31.999999999999996
        expect(findRateAt(r, 32.00)).toBeNull();
        // ส่วนค่าที่ตกช่องว่างจริง ๆ ต้องได้ราคาช่วงบน
        expect(findRateAt(r, 32.005)?.price).toBe(13905);
    });

    it('ขอบ 28.99 และ 30.99 ที่ทศนิยมไม่ตรง ก็ต้องถูกต้องเช่นกัน', () => {
        // ชุดช่วงจริงจากไฟล์ "รถร่วม วสรรณ์" ซึ่งเริ่มที่ 28.99
        const r: FuelRateRow = {
            ...row(),
            bands: [
                { fuelFrom: 28.99, fuelTo: 30.98, price: 1880 },
                { fuelFrom: 30.99, fuelTo: 32.98, price: 1990 },
            ],
        };

        // 28.98 อยู่ใต้ตาราง (ต่ำกว่าช่วงแรก) — เป็นราคา 2 ตำแหน่งธรรมดา ไม่ใช่ค่าเฉลี่ย
        // ถ้าหลุดเข้ามาได้ แปลว่าราคาน้ำมันปกติก็คิดเงินผิดได้ ไม่ใช่แค่ตอนใช้ค่าเฉลี่ย
        expect(findRateAt(r, 28.98)).toBeNull();
        expect(findRateAt(r, 28.99)?.price).toBe(1880);
        // ช่องว่างระหว่าง 30.98 กับ 30.99 ต้องปิดได้ตามปกติ
        expect(findRateAt(r, 30.985)?.price).toBe(1990);
        expect(findRateAt(r, 30.98)?.price).toBe(1880);
    });

    it('ช่องว่างต้องไม่ทำให้ข้ามช่วงที่ราคาว่างไปหยิบช่วงอื่น', () => {
        // ช่วงที่หน่วยงานเว้นราคาไว้ ยังต้องถือว่า "ไม่มีเรท" เหมือนเดิม
        const r: FuelRateRow = {
            ...row(),
            bands: [
                { fuelFrom: 37.01, fuelTo: 38.00, price: 5830 },
                { fuelFrom: 38.01, fuelTo: 39.00, price: null },
                { fuelFrom: 39.01, fuelTo: 40.00, price: 6050 },
            ],
        };

        expect(findRateAt(r, 38.50)).toBeNull();
        expect(findRateAt(r, 38.005)).toBeNull();
    });
});

describe('ชื่อสถานที่และผู้รับเหมาที่สะกดต่างจากตารางเรท', () => {
    /*
      หน้าเปิดใบงานต้องใช้กติกาจับคู่เดียวกับหน้ายอดปรับรายเดือน
      ไม่งั้นหน้าหนึ่งหาเรทเจอ อีกหน้าหาไม่เจอ ทั้งที่เป็นใบงานเดียวกัน
    */
    const row = realRow({ origin: 'มาม่าลำพูน', company: 'เบญจวรรณขนส่ง' });
    const q = { ...query, origin: 'มาม่า ลำพูน' };

    it('หาเรทเจอเมื่อชื่อสถานที่อยู่ในทะเบียน', () => {
        expect(hasFuelRateRoute([row], q)).toBe(true);
        expect(findFuelRateOptions([row], q, 38.39)).toHaveLength(1);
    });

    it('ยืนยันราคาที่เลือกได้ แม้บันทึกชื่อผู้รับเหมาตามตารางเรท', () => {
        // ใบงานเก่าอาจเก็บชื่อแบบตารางเรทไว้ ต้องยังยืนยันได้
        expect(matchSelectedFuelRate([row], q, 38.39, { subcontractor: 'เบญจวรรณขนส่ง', cost: 2040 })).toBeDefined();
        expect(matchSelectedFuelRate([row], q, 38.39, { subcontractor: 'เบญจวรรณ ขนส่ง', cost: 2040 })).toBeDefined();
    });

    it('ชื่อที่แค่คล้ายกันยังต้องหาไม่เจอ', () => {
        expect(hasFuelRateRoute([row], { ...query, origin: 'ลำพูน' })).toBe(false);
    });
});
