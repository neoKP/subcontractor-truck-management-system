import { useSyncExternalStore } from 'react';
import { db, ref, set, get, remove, onValue, authReady } from '../firebaseConfig';
import { setRuntimePlaceAreas } from './placeZones';
import { samePlace } from './placeAliases';

/**
 * ที่เก็บ "สถานที่นี้อยู่พื้นที่ไหนในตารางเรท" ที่ทีมบันทึกจากหน้าเว็บ
 *
 * ทำไมเก็บใต้ fuelRates/ ไม่ใช่ path ใหม่: กฎ RTDB (database.rules.json) ปิดทุก path
 * ที่ไม่ได้ระบุ และกฎถูก publish ผ่าน Firebase console ด้วยมือ (firebase.json ไม่มี
 * key database) · path ใหม่จะเขียนไม่ได้จนกว่าจะมีคนไปแก้กฎ — fuelRates เปิดไว้แล้ว
 * และเป็นข้อมูลเรื่องเดียวกัน
 *
 * ทุกหน้าที่จับคู่เรท (หน้าเปิดใบงาน, ตรวจทาน, ยอดปรับรายเดือน) ต้องเรียก
 * usePlaceAreas() และใส่ version ใน deps ของ useMemo — ข้อมูลมาถึงทีหลังการคำนวณ
 * ครั้งแรก ถ้าไม่ใส่ หน้าจอจะค้างผลที่คิดก่อนข้อมูลมา
 */

const PATH = 'fuelRates/placeAreas';

export interface StoredPlaceArea {
    id: string;
    place: string;
    areas: string[];
    /** ชื่อผู้บันทึก */
    by: string;
    /** เวลาบันทึก ISO */
    at: string;
}

/** แปลงค่าจาก RTDB — อาร์เรย์ที่ถูกลบบางช่องจะกลับมาเป็น object และค่าว่างจะหายไป */
export function parsePlaceAreas(raw: unknown): StoredPlaceArea[] {
    if (!raw || typeof raw !== 'object') return [];
    const out: StoredPlaceArea[] = [];
    for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
        if (!v || typeof v !== 'object') continue;
        const e = v as Record<string, unknown>;
        const place = typeof e.place === 'string' ? e.place.trim() : '';
        const rawAreas = Array.isArray(e.areas) ? e.areas : (e.areas && typeof e.areas === 'object' ? Object.values(e.areas) : []);
        const areas = rawAreas.filter((a): a is string => typeof a === 'string' && a.trim() !== '').map(a => a.trim());
        if (!place || !areas.length) continue;
        out.push({ id, place, areas, by: typeof e.by === 'string' ? e.by : '', at: typeof e.at === 'string' ? e.at : '' });
    }
    return out.sort((a, b) => a.place.localeCompare(b.place, 'th'));
}

// ---------- สถานะร่วมทั้งแอป (เฝ้า RTDB ตัวเดียว) ----------
let entries: StoredPlaceArea[] = [];
let version = 0;
let started = false;
const listeners = new Set<() => void>();

function start(): void {
    if (started) return;
    started = true;
    void authReady.then(() => {
        onValue(
            ref(db, PATH),
            (snap: { val: () => unknown }) => {
                entries = parsePlaceAreas(snap.val());
                setRuntimePlaceAreas(entries);
                version++;
                listeners.forEach(l => l());
            },
            (err: unknown) => {
                // อ่านไม่ได้ ใช้แค่รายการในโค้ดต่อไป — ไม่ทำให้หน้าเปิดใบงานพัง
                console.warn('[placeAreas] อ่านไม่ได้:', err);
            }
        );
    });
}

const subscribe = (l: () => void) => { start(); listeners.add(l); return () => { listeners.delete(l); }; };
const getVersion = () => version;

/**
 * รายการที่ทีมบันทึก + เลขรุ่น (เพิ่มทุกครั้งที่ข้อมูลเปลี่ยน)
 * ใส่ version ใน deps ของ useMemo ที่เรียก matchRoute / findFuelRateOptions / summarizeMonth
 */
export function usePlaceAreas(): { entries: StoredPlaceArea[]; version: number } {
    const v = useSyncExternalStore(subscribe, getVersion, getVersion);
    return { entries, version: v };
}

/**
 * บันทึกพื้นที่ของสถานที่หนึ่ง — ถ้ามีรายการของสถานที่นี้อยู่แล้ว เขียนทับรายการเดิม
 * ส่ง areas ว่าง = ลบรายการ
 */
export async function savePlaceArea(place: string, areas: string[], by: string): Promise<void> {
    await authReady;
    const p = (place || '').trim();
    if (!p) throw new Error('ไม่มีชื่อสถานที่');
    const clean = [...new Set((areas || []).map(a => (a || '').trim()).filter(Boolean))];
    // อ่านล่าสุดจาก RTDB ก่อน ไม่ใช้ค่าที่จำไว้ — ถ้ายังไม่มีหน้าไหนเฝ้าดู หรือมีคนอื่น
    // บันทึกไประหว่างนั้น จะสร้างรายการซ้ำของสถานที่เดียวกัน
    const current = parsePlaceAreas((await get(ref(db, PATH))).val());
    const existing = current.find(e => samePlace(e.place, p));
    if (!clean.length) {
        if (existing) await remove(ref(db, `${PATH}/${existing.id}`));
        return;
    }
    const id = existing?.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await set(ref(db, `${PATH}/${id}`), { place: p, areas: clean, by: by || '', at: new Date().toISOString() });
}
