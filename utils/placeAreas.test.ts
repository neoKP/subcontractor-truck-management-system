import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
  หน้า "จับคู่สถานที่" — ทีมบอกระบบว่าสถานที่ในใบงานอยู่พื้นที่ไหนในตารางเรท

  จำลอง firebaseConfig ไว้ — เทสต์ต้องไม่แตะฐานข้อมูลจริง และไฟล์จริงโหลดไลบรารีจาก URL
*/
const calls = vi.hoisted(() => ({ set: [] as [string, unknown][], remove: [] as string[], stored: null as unknown }));
vi.mock('../firebaseConfig', () => ({
    db: {},
    authReady: Promise.resolve(),
    ref: (_db: unknown, path: string) => path,
    set: async (path: string, value: unknown) => { calls.set.push([path, value]); },
    remove: async (path: string) => { calls.remove.push(path); },
    get: async () => ({ val: () => calls.stored }),
    onValue: () => () => {},
}));

import { parsePlaceAreas, savePlaceArea } from './placeAreaStore';
import { setRuntimePlaceAreas, inZone, matchRoute, areasOf } from './placeZones';
import { buildPlaceStats, rateAreaNames, rankAreaNames, areaOwners, placeClues } from './placeAreaSuggest';
import type { FuelRateRow } from './fuelRateParser';
import type { Job, PriceMatrix } from '../types';

const row = (over: Partial<FuelRateRow> = {}): FuelRateRow => ({
    seq: 1, company: 'YSK TRANSPORT', origin: 'กทม ปริมณฑล', destination: 'นครสวรรค์', truckType: '10W', note: '',
    bands: [{ fuelFrom: 29.01, fuelTo: 30.00, price: 7000 }, { fuelFrom: 30.01, fuelTo: 31.00, price: 7100 }],
    ...over,
});

afterEach(() => { setRuntimePlaceAreas([]); });

describe('parsePlaceAreas — ข้อมูลจาก RTDB', () => {
    it('อ่านรายการปกติ', () => {
        const out = parsePlaceAreas({ a1: { place: ' ร้านใหม่ ', areas: ['นครสวรรค์'], by: 'แอดมิน', at: '2026-10-03T00:00:00Z' } });
        expect(out).toEqual([{ id: 'a1', place: 'ร้านใหม่', areas: ['นครสวรรค์'], by: 'แอดมิน', at: '2026-10-03T00:00:00Z' }]);
    });

    it('areas ที่ RTDB คืนมาเป็น object ก็อ่านได้', () => {
        // ลบช่องกลางอาร์เรย์แล้ว RTDB จะคืนเป็น { "0": ..., "2": ... }
        const out = parsePlaceAreas({ a1: { place: 'ร้าน', areas: { 0: 'นครสวรรค์', 2: 'พิจิตร / บึงสามพัน' } } });
        expect(out[0].areas).toEqual(['นครสวรรค์', 'พิจิตร / บึงสามพัน']);
    });

    it('ทิ้งรายการเสีย: ไม่มีชื่อ, ไม่มีพื้นที่, ไม่ใช่ object', () => {
        expect(parsePlaceAreas({ a: { place: '', areas: ['x'] }, b: { place: 'ร้าน', areas: [] }, c: 'ขยะ', d: null })).toEqual([]);
        expect(parsePlaceAreas(null)).toEqual([]);
    });
});

describe('การจับคู่ที่ทีมบันทึก มีผลกับการหาเรท', () => {
    const zone = row();

    it('ก่อนบันทึก ร้านใหม่หาเรทไม่เจอ', () => {
        expect(matchRoute(zone, 'นีโอคอร์ปอเรท คลอง13', 'ร้านใหม่ นครสวรรค์')).toBeNull();
    });

    it('หลังบันทึก หาเจอแบบ "ตามเขต" (ไม่ใช่ชื่อตรง)', () => {
        setRuntimePlaceAreas([{ place: 'ร้านใหม่ นครสวรรค์', areas: ['นครสวรรค์'] }]);
        expect(inZone('นครสวรรค์', 'ร้านใหม่ นครสวรรค์')).toBe(true);
        expect(matchRoute(zone, 'นีโอคอร์ปอเรท คลอง13', 'ร้านใหม่ นครสวรรค์')).toBe('inferred');
    });

    it('จับคู่ไว้กับพื้นที่หนึ่ง ต้องไม่ลามไปพื้นที่อื่น', () => {
        setRuntimePlaceAreas([{ place: 'ร้านใหม่ นครสวรรค์', areas: ['นครสวรรค์'] }]);
        expect(inZone('พิจิตร / บึงสามพัน', 'ร้านใหม่ นครสวรรค์')).toBe(false);
    });

    it('รายการของทีม "เพิ่ม" อย่างเดียว — ของที่ยืนยันในโค้ดยังอยู่', () => {
        setRuntimePlaceAreas([{ place: 'ร้านใหม่', areas: ['นครสวรรค์'] }]);
        expect(inZone('กทม ปริมณฑล', 'นีโอคอร์ปอเรท คลอง13')).toBe(true);
    });

    it('areasOf บอกที่มาของแต่ละพื้นที่', () => {
        setRuntimePlaceAreas([{ place: 'เมืองนครสวรรค์', areas: ['นครสวรรค์', 'อุทัยธานี / ชัยนาท'] }]);
        expect(areasOf('เมืองนครสวรรค์')).toEqual([
            { area: 'นครสวรรค์', source: 'code' },
            { area: 'อุทัยธานี / ชัยนาท', source: 'team' },
        ]);
    });

    it('รายการเสียที่หลุดเข้ามาไม่ทำให้พัง', () => {
        setRuntimePlaceAreas([null as never, { place: '', areas: ['x'] }, { place: 'ร้าน', areas: 'x' as never }]);
        expect(inZone('x', 'ร้าน')).toBe(false);
    });
});

describe('savePlaceArea', () => {
    beforeEach(() => { calls.set.length = 0; calls.remove.length = 0; calls.stored = null; });

    it('บันทึกรายการใหม่ ตัดช่องว่างและชื่อซ้ำ', async () => {
        await savePlaceArea(' ร้านใหม่ ', ['นครสวรรค์', ' นครสวรรค์ ', ''], 'แอดมิน');
        expect(calls.set).toHaveLength(1);
        const [path, value] = calls.set[0];
        expect(path.startsWith('fuelRates/placeAreas/')).toBe(true);
        expect(value).toMatchObject({ place: 'ร้านใหม่', areas: ['นครสวรรค์'], by: 'แอดมิน' });
    });

    it('สถานที่ที่มีรายการอยู่แล้ว ต้องเขียนทับ id เดิม ไม่สร้างซ้ำ', async () => {
        // ในฐานข้อมูลมีรายการของสถานที่นี้อยู่แล้ว (อาจมาจากคนอื่นที่เพิ่งบันทึก)
        calls.stored = { old1: { place: 'ร้านใหม่', areas: ['นครสวรรค์'] } };
        await savePlaceArea('ร้านใหม่', ['พิจิตร / บึงสามพัน'], 'แอดมิน');
        expect(calls.set[0][0]).toBe('fuelRates/placeAreas/old1');
    });

    it('ส่งพื้นที่ว่าง = ลบรายการเดิม', async () => {
        calls.stored = { old1: { place: 'ร้านใหม่', areas: ['นครสวรรค์'] } };
        await savePlaceArea('ร้านใหม่', [], 'แอดมิน');
        expect(calls.remove).toEqual(['fuelRates/placeAreas/old1']);
        expect(calls.set).toHaveLength(0);
    });

    it('ไม่มีชื่อสถานที่ ต้องไม่บันทึก', async () => {
        await expect(savePlaceArea('  ', ['นครสวรรค์'], 'แอดมิน')).rejects.toThrow();
        expect(calls.set).toHaveLength(0);
    });
});

describe('buildPlaceStats — สถานะและคำแนะนำ', () => {
    const rows = [
        row({ seq: 1, destination: 'นครสวรรค์', bands: [{ fuelFrom: 29.01, fuelTo: 30, price: 7000 }] }),
        row({ seq: 2, destination: 'พิจิตร / บึงสามพัน', bands: [{ fuelFrom: 29.01, fuelTo: 30, price: 8000 }] }),
        row({ seq: 3, destination: 'สุโขทัย / ตาก', bands: [{ fuelFrom: 29.01, fuelTo: 30, price: 8000 }] }),
    ];
    const pm = (destination: string, basePrice: number, subcontractor = 'YSK'): PriceMatrix =>
        ({ origin: 'นีโอคอร์ปอเรท คลอง13', destination, subcontractor, truckType: '10w', basePrice, sellingBasePrice: 0 } as PriceMatrix);
    const job = (destination: string, cost: number): Job =>
        ({ id: 'J', origin: 'นีโอคอร์ปอเรท คลอง13', destination, subcontractor: 'YSK', truckType: '10w', cost } as Job);

    it('ราคาชี้เส้นเดียว = แนะนำพื้นที่นั้น', () => {
        const s = buildPlaceStats([job('ร้านใหม่ ตาคลี', 7000)], [pm('ร้านใหม่ ตาคลี', 7000)], rows);
        const x = s.find(v => v.place === 'ร้านใหม่ ตาคลี')!;
        expect(x.status).toBe('none');
        expect(x.suggestions).toEqual([{ area: 'นครสวรรค์', fromPrice: 1, fromJobs: 1 }]);
    });

    it('ราคาตรงหลายเส้น = ไม่แนะนำ (กันบังเอิญ)', () => {
        // 8,000 มีทั้งพิจิตรและสุโขทัย
        const s = buildPlaceStats([], [pm('ร้านกำกวม', 8000)], rows);
        expect(s.find(v => v.place === 'ร้านกำกวม')!.suggestions).toEqual([]);
    });

    it('สถานะ: ชื่อตรงตาราง / จับคู่พื้นที่แล้ว / ยังไม่จับคู่', () => {
        setRuntimePlaceAreas([{ place: 'ร้านทีมจับแล้ว', areas: ['นครสวรรค์'] }]);
        const s = buildPlaceStats([job('นครสวรรค์', 1), job('ร้านทีมจับแล้ว', 1), job('ร้านไม่รู้จัก', 1)], [], rows);
        const st = (p: string) => s.find(v => v.place === p)!.status;
        expect(st('นครสวรรค์')).toBe('exact');
        expect(st('ร้านทีมจับแล้ว')).toBe('area');
        expect(st('ร้านไม่รู้จัก')).toBe('none');
    });

    it('ผู้รับเหมาที่ไม่มีตารางเรท = hasRateSub เป็น false และไม่แนะนำ', () => {
        const s = buildPlaceStats([], [pm('ร้านของ PTK', 7000, 'PTK')], rows);
        const x = s.find(v => v.place === 'ร้านของ PTK')!;
        expect(x.hasRateSub).toBe(false);
        expect(x.suggestions).toEqual([]);
    });

    it('รายการที่ทีมบันทึก ต้องมีแถวเสมอ แม้ไม่มีในใบงานหรือราคากลางแล้ว', () => {
        // ไม่งั้นการจับคู่ที่ยังมีผลกับการคิดเงินจะลบผ่านหน้าเว็บไม่ได้
        setRuntimePlaceAreas([{ place: 'ร้านที่เลิกวิ่งแล้ว', areas: ['นครสวรรค์'] }]);
        const s = buildPlaceStats([], [], rows, ['ร้านที่เลิกวิ่งแล้ว']);
        const x = s.find(v => v.place === 'ร้านที่เลิกวิ่งแล้ว')!;
        expect(x.status).toBe('area');
        expect(x.areas).toEqual([{ area: 'นครสวรรค์', source: 'team' }]);
    });

    it('รายการที่ทีมบันทึกซึ่งมีในใบงานอยู่แล้ว ต้องไม่ซ้ำ', () => {
        const s = buildPlaceStats([job('ร้านใหม่ ตาคลี', 1)], [], rows, ['ร้านใหม่ ตาคลี']);
        expect(s.filter(v => v.place === 'ร้านใหม่ ตาคลี')).toHaveLength(1);
    });

    it('rateAreaNames ไม่มี "งานย่อย" และไม่ซ้ำ', () => {
        const names = rateAreaNames([...rows, row({ origin: 'งานย่อย', destination: 'นครสวรรค์' })]);
        expect(names).not.toContain('งานย่อย');
        expect(names.filter(n => n === 'นครสวรรค์')).toHaveLength(1);
    });
});

describe('rankAreaNames — ช่องพิมพ์ค้นหาพื้นที่', () => {
    const names = ['เชียงใหม่ พาเลทกลับ', 'ดอยสะเก็ด เชียงใหม่', 'เชียงใหม่', 'นครสวรรค์', 'เชียงราย', 'เมืองเชียงใหม่'];

    it('ไม่พิมพ์อะไร = ทั้งหมด เรียงตามตัวอักษร', () => {
        expect(rankAreaNames(names, '')).toEqual([...names].sort((a, b) => a.localeCompare(b, 'th')));
    });

    it('ตรงทั้งคำขึ้นก่อน แล้วขึ้นต้น แล้วมีอยู่ข้างใน', () => {
        expect(rankAreaNames(names, 'เชียงใหม่')).toEqual([
            'เชียงใหม่',              // ตรงทั้งคำ
            'เชียงใหม่ พาเลทกลับ',     // ขึ้นต้น
            'ดอยสะเก็ด เชียงใหม่',     // มีอยู่ข้างใน
            'เมืองเชียงใหม่',
        ]);
    });

    it('ชื่อที่ตรงกว่าต้องขึ้นก่อน แม้ตัวอักษรจะมาทีหลัง', () => {
        // เรียงตามตัวอักษรอย่างเดียว "กรุงเทพ…" จะขึ้นก่อน — ผู้ใช้ต้องเลื่อนหาชื่อที่ตรง
        expect(rankAreaNames(['กรุงเทพ เชียงใหม่', 'เชียงใหม่'], 'เชียงใหม่')).toEqual(['เชียงใหม่', 'กรุงเทพ เชียงใหม่']);
    });

    it('ไม่สนช่องว่าง — "เชียง ใหม่" ก็เจอ', () => {
        expect(rankAreaNames(names, 'เชียง ใหม่')[0]).toBe('เชียงใหม่');
    });

    it('ไม่พบ = อาร์เรย์ว่าง', () => {
        expect(rankAreaNames(names, 'ภูเก็ต')).toEqual([]);
    });
});

describe('เตือนเมื่อจับคู่แล้วจะไม่มีผล', () => {
    /*
      เหตุการณ์จริง 3 ต.ค. 2569: จับคู่ "นครปฐมไพศาล → นครปฐม" แต่ "นครปฐม" มีแค่ในตาราง
      คุณบุ๋ม ส่วนร้านนี้พรมณีวิ่ง — ระบบจับคู่เรทของเจ้าเดียวกันเท่านั้น จึงไม่มีผลเลย
    */
    const rows = [
        row({ company: 'คุณบุ๋ม', origin: 'ล่ำสูง บางปู', destination: 'นครปฐม' }),
        row({ company: 'พรมณี 24h', origin: 'แม็คโครเมืองนครปฐม', destination: 'แม็คโครเมืองนครปฐม' }),
        row({ company: 'YSK TRANSPORT', origin: 'กทม ปริมณฑล', destination: 'นครปฐม' }),
    ];

    it('areaOwners บอกว่าพื้นที่อยู่ในตารางของเจ้าไหน (ชื่อมาตรฐาน ไม่ซ้ำ)', () => {
        const owners = areaOwners(rows);
        // เรียงแบบภาษาไทย: ชื่อไทยขึ้นก่อนชื่ออังกฤษ
        expect(owners('นครปฐม')).toEqual(['คุณบุ๋ม', 'YSK']);
        expect(owners('แม็คโครเมืองนครปฐม')).toEqual(['พรมณี 24เอช ทรานสปอร์ต']);
        expect(owners('ไม่มีในตาราง')).toEqual([]);
    });

    it('ต้นทางที่ระบบแก้ (ตารางพรมณีเขียนต้นทางซ้ำปลายทาง) ต้องนับเป็นของพรมณี', () => {
        // ระบบจับคู่แถวพรมณีด้วยต้นทาง "สหพัฒน์ศรีราชา" — ตัวเตือนต้องรู้เหมือนกัน
        // ไม่งั้นจะเตือนว่า "ไม่มีผล" ทั้งที่จับคู่แล้วมีผล (codex P2)
        expect(areaOwners(rows)('สหพัฒน์ศรีราชา')).toEqual(['พรมณี 24เอช ทรานสปอร์ต']);
        expect(rateAreaNames(rows)).toContain('สหพัฒน์ศรีราชา');
    });

    it('buildPlaceStats บอกว่าใครวิ่งสถานที่นี้ เรียงจากมากไปน้อย', () => {
        const j = (sub: string): Job => ({ id: 'J', origin: 'สหพัฒน์ศรีราชา', destination: 'นครปฐมไพศาล', subcontractor: sub, truckType: '10w', cost: 1 } as Job);
        const s = buildPlaceStats([j('พรมณี 24h'), j('พรมณี 24เอช ทรานสปอร์ต'), j('KNN')], [], rows);
        // "พรมณี 24h" กับชื่อเต็มเป็นเจ้าเดียวกัน ต้องนับรวม
        expect(s.find(v => v.place === 'นครปฐมไพศาล')!.subs).toEqual([
            { name: 'พรมณี 24เอช ทรานสปอร์ต', count: 2 },
            { name: 'KNN', count: 1 },
        ]);
    });
});

describe('placeClues — เบาะแสประกอบการตัดสินใจ', () => {
    // ตารางพรแม่ย่าตั้งราคาเชียงใหม่กับลำพูนเท่ากัน (เหตุการณ์จริงของ "แจ่มฟ้า ลำพูน")
    const rows = [
        row({ company: 'พรแม่ย่า', origin: 'คลอง13 / กทม', destination: 'เชียงใหม่', truckType: '10W', bands: [{ fuelFrom: 29.01, fuelTo: 30, price: 13100 }] }),
        row({ company: 'พรแม่ย่า', origin: 'คลอง13 / กทม', destination: 'ลำพูน', truckType: '10W', bands: [{ fuelFrom: 29.01, fuelTo: 30, price: 13100 }] }),
        row({ company: 'พรแม่ย่า', origin: 'บางปะอิน (นมไทย)', destination: 'ลำปาง', truckType: '10W', bands: [{ fuelFrom: 29.01, fuelTo: 30, price: 9000 }] }),
    ];
    const j = (over: Partial<Job>): Job => ({ id: 'J', origin: 'นีโอคอร์ปอเรท คลอง13', destination: 'แจ่มฟ้า ลำพูน', subcontractor: 'รถร่วมพรแม่ย่า', truckType: '10w', cost: 13100, ...over } as Job);

    it('พื้นที่ที่เป็นไปได้: ปลายอีกด้านต้องตรง และชื่อสอดคล้องขึ้นก่อนเมื่อราคาเท่ากัน', () => {
        const c = placeClues('แจ่มฟ้า ลำพูน', [j({}), j({})], rows);
        expect(c.candidates.map(x => x.area)).toEqual(['ลำพูน', 'เชียงใหม่']);
        expect(c.candidates[0]).toMatchObject({ sub: 'รถร่วมพรแม่ย่า', support: 2, exactPrice: 2, nameMatch: true });
        // ลำปางมีต้นทางบางปะอิน ไม่ตรงกับคลอง13 — ต้องไม่โผล่
        expect(c.candidates.some(x => x.area === 'ลำปาง')).toBe(false);
    });

    it('ราคาไม่ตรงพอดี บอกว่าใกล้สุดต่างกี่บาท', () => {
        const c = placeClues('แจ่มฟ้า ลำพูน', [j({ cost: 13000 })], rows);
        expect(c.candidates[0]).toMatchObject({ exactPrice: 0, nearestDiff: 100 });
    });

    it('ผู้รับเหมาที่ไม่มีตารางเรท ติดป้ายไว้ และไม่มีพื้นที่ที่เป็นไปได้', () => {
        const c = placeClues('อำพลฟู้ดส์ / เทพผดุงพร', [j({ origin: 'อำพลฟู้ดส์ / เทพผดุงพร', destination: 'นีโอสยาม สาย3', subcontractor: 'รถร่วม deliveree' })], rows);
        expect(c.subs).toEqual([{ name: 'รถร่วม deliveree', count: 1, hasTable: false }]);
        expect(c.candidates).toEqual([]);
    });

    it('เส้นทางที่วิ่งบ่อย รวมค่าขนส่งที่จ่ายจริงไม่ซ้ำ', () => {
        const c = placeClues('แจ่มฟ้า ลำพูน', [j({ cost: 13300 }), j({ cost: 13100 }), j({ cost: 13100 })], rows);
        expect(c.routes[0]).toMatchObject({ side: 'destination', other: 'นีโอคอร์ปอเรท คลอง13', count: 3, costs: [13100, 13300] });
    });

    it('ชื่อคล้ายกัน: เจอชื่อในตารางและสถานที่ที่จับคู่ไว้แล้ว', () => {
        const c = placeClues('อำพลฟู้ดส์ / เทพผดุงพร', [], rows, [{ place: 'อำพลฟู้ดส์', areas: [{ area: 'กทม ปริมณฑล' }] }]);
        expect(c.similar[0]).toEqual({ name: 'อำพลฟู้ดส์', areas: ['กทม ปริมณฑล'], inTable: false });
    });
});
