import { samePlace } from './placeAliases';
import { areasOf, rowOrigin } from './placeZones';
import { canonicalSubcontractor } from './subcontractorAliases';
import { canonicalTruckType } from './truckTypeAliases';
import type { FuelRateRow } from './fuelRateParser';
import type { Job, PriceMatrix } from '../types';

/**
 * ข้อมูลสำหรับหน้า "จับคู่สถานที่" — สถานที่แต่ละที่จับคู่กับตารางเรทได้หรือยัง
 * และระบบแนะนำพื้นที่ไหน
 *
 * คำแนะนำมาจากราคา: ถ้าราคากลางหรือค่าขนส่งในใบงานไปตรงกับราคาของ "เส้นทางเดียว"
 * ในตารางของผู้รับเหมาและรถเดียวกัน ชื่อที่ปลายเดียวกันของเส้นนั้นคือคำแนะนำ
 * ราคาที่ตรงหลายเส้นไม่นับ — ตารางบางเจ้ามีราคาไม่กี่ระดับ จะตรงกันเพราะบังเอิญ
 *
 * เป็นแค่คำแนะนำ คนต้องกดยืนยันเอง (ดู placeAreaStore.savePlaceArea)
 */

export type PlaceStatus = 'exact' | 'area' | 'none';

export interface AreaSuggestion {
    area: string;
    /** จำนวนเส้นในราคากลางที่ชี้มาที่พื้นที่นี้ */
    fromPrice: number;
    /** จำนวนใบงานที่ชี้มาที่พื้นที่นี้ */
    fromJobs: number;
}

export interface PlaceStat {
    place: string;
    /** จำนวนครั้งที่เป็นต้นทาง/ปลายทางในใบงาน */
    trips: number;
    /** จำนวนเส้นในราคากลางที่มีสถานที่นี้ */
    priceRows: number;
    status: PlaceStatus;
    /** พื้นที่ที่จับคู่ไว้แล้ว */
    areas: { area: string; source: 'code' | 'team' }[];
    suggestions: AreaSuggestion[];
    /** มีงานหรือราคากลางของผู้รับเหมาที่มีตารางเรทไหม — ไม่มี = จับคู่ไปก็ไม่มีผล */
    hasRateSub: boolean;
}

const tt = (s: string) => canonicalTruckType(s || '').toLowerCase().replace(/\s+/g, '');
const cents = (n: number) => Math.round(n * 100);
const clean = (s?: string) => (s || '').trim();
const ANY = 'งานย่อย';

/**
 * @param extraPlaces สถานที่ที่ต้องมีแถวเสมอ — รายการที่ทีมบันทึกไว้ แม้ไม่มีในใบงาน/ราคากลางแล้ว
 *   ไม่งั้นการจับคู่ที่ยังมีผลกับการคิดเงิน จะมองไม่เห็นและลบผ่านหน้าเว็บไม่ได้
 */
export function buildPlaceStats(jobs: Job[], priceMatrix: PriceMatrix[], rows: FuelRateRow[], extraPlaces: string[] = []): PlaceStat[] {
    const rateNames = [...new Set(rows.flatMap(r => [clean(r.origin), clean(r.destination)]).filter(Boolean))];
    const rateSubs = new Set(rows.map(r => canonicalSubcontractor(r.company)));

    // แถวเรทแยกตาม ผู้รับเหมา|รถ — ให้หาเร็ว
    const index = new Map<string, FuelRateRow[]>();
    for (const r of rows) {
        const k = `${canonicalSubcontractor(r.company)}|${tt(r.truckType)}`;
        if (!index.has(k)) index.set(k, []);
        index.get(k)!.push(r);
    }

    const stats = new Map<string, PlaceStat>();
    const votes = new Map<string, Map<string, AreaSuggestion>>();
    const stat = (place: string): PlaceStat => {
        if (!stats.has(place)) stats.set(place, { place, trips: 0, priceRows: 0, status: 'none', areas: [], suggestions: [], hasRateSub: false });
        return stats.get(place)!;
    };
    const vote = (place: string, area: string, kind: 'fromPrice' | 'fromJobs') => {
        if (!area || area === ANY || samePlace(place, area)) return;
        if (!votes.has(place)) votes.set(place, new Map());
        const m = votes.get(place)!;
        if (!m.has(area)) m.set(area, { area, fromPrice: 0, fromJobs: 0 });
        m.get(area)![kind]++;
    };

    /** ราคานี้ชี้ไปเส้นเดียวในตารางไหม — คืนแถวนั้น หรือ null */
    const uniqueRow = (sub: string, truck: string, price: number): FuelRateRow | null => {
        if (!(price > 0)) return null;
        const cand = (index.get(`${sub}|${tt(truck)}`) || []).filter(r =>
            r.bands.some(b => typeof b.price === 'number' && b.price > 0 && cents(b.price) === cents(price)));
        const routes = new Map(cand.map(r => [`${clean(rowOrigin(r).origin)}→${clean(r.destination)}`, r]));
        return routes.size === 1 ? [...routes.values()][0] : null;
    };

    const collect = (origin: string, destination: string, sub: string, truck: string, price: number, kind: 'fromPrice' | 'fromJobs') => {
        const o = clean(origin), d = clean(destination);
        const hasRate = rateSubs.has(sub);
        for (const p of [o, d]) {
            if (!p) continue;
            const s = stat(p);
            if (kind === 'fromJobs') s.trips++; else s.priceRows++;
            if (hasRate) s.hasRateSub = true;
        }
        if (!hasRate) return;
        const row = uniqueRow(sub, truck, price);
        if (!row) return;
        if (o) vote(o, clean(rowOrigin(row).origin), kind);
        if (d) vote(d, clean(row.destination), kind);
    };

    for (const j of jobs || []) {
        collect(j.origin || '', j.destination || '', canonicalSubcontractor(j.subcontractor || ''), j.truckType || '', Number(j.cost) || 0, 'fromJobs');
    }
    for (const m of priceMatrix || []) {
        collect(m.origin || '', m.destination || '', canonicalSubcontractor(m.subcontractor || ''), m.truckType || '', Number(m.basePrice) || 0, 'fromPrice');
    }

    for (const p of extraPlaces) {
        const name = clean(p);
        if (name && ![...stats.keys()].some(k => samePlace(k, name))) stat(name);
    }

    for (const s of stats.values()) {
        s.areas = areasOf(s.place);
        if (rateNames.some(n => samePlace(n, s.place))) s.status = 'exact';
        else if (s.areas.length) s.status = 'area';
        s.suggestions = [...(votes.get(s.place)?.values() ?? [])]
            .filter(v => !s.areas.some(a => samePlace(a.area, v.area)))
            .sort((a, b) => (b.fromPrice + b.fromJobs) - (a.fromPrice + a.fromJobs));
    }
    return [...stats.values()].sort((a, b) => b.trips - a.trips || b.priceRows - a.priceRows || a.place.localeCompare(b.place, 'th'));
}

/** ตัดช่องว่างและตัวพิมพ์ — "เชียง ใหม่" กับ "เชียงใหม่" ค้นเจอเหมือนกัน */
const fold = (s: string) => (s || '').toLowerCase().replace(/\s+/g, '');

/**
 * กรองและเรียงชื่อพื้นที่ตามคำที่พิมพ์
 *
 * ลำดับ: ตรงทั้งคำ → ขึ้นต้นด้วยคำที่พิมพ์ → มีคำที่พิมพ์อยู่ข้างใน · กลุ่มเดียวกันเรียงตามตัวอักษร
 * ไม่พิมพ์อะไร = คืนทั้งหมดเรียงตามตัวอักษร
 */
export function rankAreaNames(names: string[], query: string): string[] {
    const q = fold(query);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'th'));
    if (!q) return sorted;
    const rank = (n: string): number => {
        const f = fold(n);
        if (f === q) return 0;
        if (f.startsWith(q)) return 1;
        if (f.includes(q)) return 2;
        return -1;
    };
    return sorted
        .map(n => ({ n, r: rank(n) }))
        .filter(x => x.r >= 0)
        .sort((a, b) => a.r - b.r || a.n.localeCompare(b.n, 'th'))
        .map(x => x.n);
}

/** ชื่อต้นทาง/ปลายทางทั้งหมดในตารางเรท — ตัวเลือกของช่อง "พื้นที่ในตารางเรท" */
export function rateAreaNames(rows: FuelRateRow[]): string[] {
    return [...new Set(rows.flatMap(r => [clean(r.origin), clean(r.destination)]).filter(n => n && n !== ANY))]
        .sort((a, b) => a.localeCompare(b, 'th'));
}
