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
import { buildPlaceStats, rateAreaNames, rankAreaNames } from './placeAreaSuggest';
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
