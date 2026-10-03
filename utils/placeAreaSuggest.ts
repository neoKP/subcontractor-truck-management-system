import { samePlace } from './placeAliases';
import { areasOf, rowOrigin, inZone } from './placeZones';
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
    /** ผู้รับเหมาที่วิ่ง/มีราคากลางของสถานที่นี้ (ชื่อมาตรฐาน) เรียงจากมากไปน้อย */
    subs: { name: string; count: number }[];
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
        if (!stats.has(place)) stats.set(place, { place, trips: 0, priceRows: 0, status: 'none', areas: [], suggestions: [], hasRateSub: false, subs: [] });
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
            if (sub) {
                const e = s.subs.find(x => x.name === sub);
                if (e) e.count++; else s.subs.push({ name: sub, count: 1 });
            }
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
        s.subs.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'th'));
        s.areas = areasOf(s.place);
        if (rateNames.some(n => samePlace(n, s.place))) s.status = 'exact';
        else if (s.areas.length) s.status = 'area';
        s.suggestions = [...(votes.get(s.place)?.values() ?? [])]
            .filter(v => !s.areas.some(a => samePlace(a.area, v.area)))
            .sort((a, b) => (b.fromPrice + b.fromJobs) - (a.fromPrice + a.fromJobs));
    }
    return [...stats.values()].sort((a, b) => b.trips - a.trips || b.priceRows - a.priceRows || a.place.localeCompare(b.place, 'th'));
}

// ---------- เบาะแสประกอบการตัดสินใจ (คำนวณเฉพาะการ์ดที่แสดงอยู่) ----------

export interface PlaceClues {
    /** ผู้รับเหมาที่วิ่ง + มีตารางเรทไหม — ไม่มีตาราง = จับคู่ไปก็ไม่มีผลกับเจ้านั้น */
    subs: { name: string; count: number; hasTable: boolean }[];
    /** เส้นทางที่วิ่งบ่อย (จากใบงาน) */
    routes: { side: 'origin' | 'destination'; other: string; truck: string; sub: string; count: number; costs: number[] }[];
    /**
     * พื้นที่ที่เป็นไปได้: แถวในตารางของผู้รับเหมา+รถเดียวกัน ที่ "ปลายอีกด้าน" ตรงกับใบงาน
     * exactPrice = จำนวนใบงานที่ค่าขนส่งเท่ากับราคาช่องใดช่องหนึ่งของแถวนั้นพอดี
     * nearestDiff = ค่าขนส่งต่างจากราคาที่ใกล้ที่สุดในแถวนั้นกี่บาท
     */
    candidates: { area: string; sub: string; support: number; exactPrice: number; nearestDiff: number | null; nameMatch: boolean }[];
    /** ชื่อที่มีคำซ้ำกัน ทั้งในตารางเรทและสถานที่ที่จับคู่ไว้แล้ว */
    similar: { name: string; areas: string[]; inTable: boolean }[];
}

const STOP = new Set(['ร้าน', 'ศูนย์กระจายสินค้า', 'ศูนย์กระจาย', 'เมือง', 'จังหวัด', 'อำเภอ', 'สาขา', 'บจก', 'บริษัท', 'จำกัด', 'นีโอสยาม']);
const tokens = (s: string): string[] =>
    (s || '').toLowerCase().split(/[\s/\-()+.,]+/).map(t => t.replace(/^อ\./, '')).filter(t => t.length >= 3 && !STOP.has(t));

/**
 * เบาะแสของสถานที่หนึ่ง — ใช้ตอนระบบแนะนำจากราคาไม่ได้ (เช่นไม่มีราคาที่ตรงเส้นเดียว)
 *
 * @param mapped สถานที่ที่จับคู่ไว้แล้ว (จาก buildPlaceStats) — ใช้หา "ชื่อคล้ายกัน"
 */
export function placeClues(
    place: string,
    jobs: Job[],
    rows: FuelRateRow[],
    mapped: { place: string; areas: { area: string }[] }[] = []
): PlaceClues {
    const p = clean(place);
    const rateSubs = new Set(rows.map(r => canonicalSubcontractor(r.company)));
    const subCount = new Map<string, number>();
    const routeMap = new Map<string, PlaceClues['routes'][number]>();
    const candMap = new Map<string, PlaceClues['candidates'][number]>();
    // ชื่อพื้นที่มีคำซ้ำกับชื่อสถานที่ไหม — ใช้แยกกรณีที่ราคาเท่ากันหลายพื้นที่
    // (ตารางพรแม่ย่าตั้งราคาเชียงใหม่กับลำพูนเท่ากัน "แจ่มฟ้า ลำพูน" ต้องได้ลำพูนก่อน)
    const mineTokens = tokens(p);
    const shares = (name: string) => mineTokens.some(t => tokens(name).some(u => u.includes(t) || t.includes(u)));
    const sameOrIn = (ratePlace: string, other: string) =>
        clean(ratePlace) === ANY || samePlace(ratePlace, other) || inZone(ratePlace, other);

    for (const j of jobs || []) {
        const o = clean(j.origin), d = clean(j.destination);
        const side: 'origin' | 'destination' | null = samePlace(o, p) ? 'origin' : samePlace(d, p) ? 'destination' : null;
        if (!side) continue;
        const sub = canonicalSubcontractor(j.subcontractor || '');
        const other = side === 'origin' ? d : o;
        const cost = Number(j.cost) || 0;
        if (sub) subCount.set(sub, (subCount.get(sub) || 0) + 1);

        const rk = `${side}|${other}|${tt(j.truckType || '')}|${sub}`;
        if (!routeMap.has(rk)) routeMap.set(rk, { side, other, truck: j.truckType || '', sub, count: 0, costs: [] });
        const rt = routeMap.get(rk)!;
        rt.count++;
        if (cost > 0 && !rt.costs.includes(cost)) rt.costs.push(cost);

        // แถวของเจ้าเดียวกัน รถเดียวกัน ที่ปลายอีกด้านตรง — ปลายฝั่งนี้คือพื้นที่ที่เป็นไปได้
        for (const r of rows) {
            if (canonicalSubcontractor(r.company) !== sub || tt(r.truckType) !== tt(j.truckType || '')) continue;
            const rOrigin = clean(rowOrigin(r).origin), rDest = clean(r.destination);
            const otherOk = side === 'origin' ? sameOrIn(rDest, other) : sameOrIn(rOrigin, other);
            if (!otherOk) continue;
            const area = side === 'origin' ? rOrigin : rDest;
            if (!area || area === ANY || samePlace(area, p)) continue;
            const ck = `${area}|${sub}`;
            if (!candMap.has(ck)) candMap.set(ck, { area, sub, support: 0, exactPrice: 0, nearestDiff: null, nameMatch: shares(area) });
            const c = candMap.get(ck)!;
            c.support++;
            const prices = r.bands.filter(b => typeof b.price === 'number' && b.price > 0).map(b => b.price as number);
            if (cost > 0 && prices.length) {
                if (prices.some(x => cents(x) === cents(cost))) c.exactPrice++;
                const diff = Math.min(...prices.map(x => Math.abs(x - cost)));
                c.nearestDiff = c.nearestDiff === null ? diff : Math.min(c.nearestDiff, diff);
            }
        }
    }

    // ชื่อคล้ายกัน: นับคำที่ซ้ำกัน
    const mine = mineTokens;
    const pool = new Map<string, { name: string; areas: string[]; inTable: boolean }>();
    for (const n of rateAreaNames(rows)) pool.set(n, { name: n, areas: [], inTable: true });
    for (const m of mapped) {
        if (!m.areas.length) continue;
        const cur = pool.get(m.place);
        pool.set(m.place, { name: m.place, areas: m.areas.map(a => a.area), inTable: cur?.inTable ?? false });
    }
    const similar = [...pool.values()]
        .filter(x => !samePlace(x.name, p))
        .map(x => ({ x, score: mine.filter(t => tokens(x.name).some(u => u.includes(t) || t.includes(u))).length }))
        .filter(v => v.score > 0)
        .sort((a, b) => b.score - a.score || a.x.name.localeCompare(b.x.name, 'th'))
        .slice(0, 4)
        .map(v => v.x);

    return {
        subs: [...subCount].map(([name, count]) => ({ name, count, hasTable: rateSubs.has(name) }))
            .sort((a, b) => b.count - a.count),
        routes: [...routeMap.values()].sort((a, b) => b.count - a.count).slice(0, 5)
            .map(r => ({ ...r, costs: r.costs.sort((a, b) => a - b).slice(0, 3) })),
        candidates: [...candMap.values()]
            .sort((a, b) => b.exactPrice - a.exactPrice || Number(b.nameMatch) - Number(a.nameMatch)
                || b.support - a.support || (a.nearestDiff ?? Infinity) - (b.nearestDiff ?? Infinity))
            .slice(0, 4),
        similar,
    };
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

/**
 * พื้นที่แต่ละชื่ออยู่ในตารางของผู้รับเหมาเจ้าไหน (ชื่อมาตรฐาน)
 *
 * ใช้เตือนตอนจับคู่: พื้นที่ "นครปฐม" มีแค่ในตารางคุณบุ๋ม ถ้าจับคู่ร้านที่พรมณีวิ่ง
 * เข้ากับพื้นที่นี้ จะไม่มีผลเลย เพราะระบบจับคู่เรทของผู้รับเหมาเจ้าเดียวกันเท่านั้น
 */
export function areaOwners(rows: FuelRateRow[]): (area: string) => string[] {
    const map = new Map<string, Set<string>>();
    for (const r of rows) {
        // ใช้ต้นทางแบบเดียวกับตอนจับคู่ (rowOrigin) — ตารางพรมณีเขียนต้นทางซ้ำปลายทาง
        // แต่ระบบจับคู่ด้วย "สหพัฒน์ศรีราชา" ถ้าใช้ต้นทางดิบ จะเตือนว่าไม่มีผลทั้งที่มีผล
        for (const n of [clean(rowOrigin(r).origin), clean(r.destination)]) {
            if (!n || n === ANY) continue;
            if (!map.has(n)) map.set(n, new Set());
            map.get(n)!.add(canonicalSubcontractor(r.company));
        }
    }
    return (area: string) => {
        const out = new Set<string>();
        for (const [n, subs] of map) if (samePlace(n, area)) subs.forEach(s => out.add(s));
        return [...out].sort((a, b) => a.localeCompare(b, 'th'));
    };
}

/** ชื่อต้นทาง/ปลายทางทั้งหมดในตารางเรท — ตัวเลือกของช่อง "พื้นที่ในตารางเรท" */
export function rateAreaNames(rows: FuelRateRow[]): string[] {
    // ต้นทางที่ใช้จับคู่จริง (rowOrigin) — ให้เลือกได้เฉพาะชื่อที่มีผลกับการจับคู่
    return [...new Set(rows.flatMap(r => [clean(rowOrigin(r).origin), clean(r.destination)]).filter(n => n && n !== ANY))]
        .sort((a, b) => a.localeCompare(b, 'th'));
}
