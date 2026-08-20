import { useEffect, useMemo, useState } from 'react';
import { db, ref, onValue, authReady } from '../firebaseConfig';
import SAHA_OIL from '../data/sahaOilAdjust.json';
import { OIL_BASE, mergeOilBands, type OilBands } from './oilRounds';
import { getNasOilPrice, getNasOilHistory } from './nasOilApi';

/**
 * ราคาดีเซลที่ระบบใช้เปิดตารางเรทค่าขนส่ง
 *
 * แหล่งข้อมูลเรียงตามความน่าเชื่อ:
 *   1. NAS ของบริษัท (`/api/oil/*`) — ดึงจาก ปตท. ทุก 3 ชม. เก็บประวัติครบทุกงวด
 *   2. RTDB `oilPrice/*` — Cloud Function `fetchOilPrice` (ยังไม่ได้ deploy: ต้องใช้ Blaze plan)
 *   3. ไฟล์ data/sahaOilAdjust.json — ค่าที่ bundle มากับเว็บ ใช้เมื่อสองทางแรกไม่ตอบ
 *
 * เก็บผลของแต่ละแหล่งแยก state กัน แล้วเลือกตอนคืนค่า — ถ้าปล่อยให้ callback เขียนทับ
 * state เดียวกัน ผลลัพธ์จะขึ้นกับว่าใครตอบก่อน ไม่ใช่ว่าแหล่งไหนน่าเชื่อกว่า
 *
 * ไม่ยิงหา ปตท. จากเบราว์เซอร์ตรง ๆ เพราะหน้านั้นไม่ส่ง CORS header
 */

export interface OilPriceState {
    /** ราคาดีเซล บาท/ลิตร */
    diesel: number;
    /** %สะสม = diesel − 31.94 · ใช้ภายในสำหรับแปลงข้อมูล ไม่ได้ใช้คิดค่าขนส่ง */
    pct: number;
    /** วันที่ราคานี้มีผล (ISO ค.ศ.) */
    effectiveDate: string;
    /** แหล่งที่ราคานี้มาจริง — แถบสถานะบนหน้าจอต้องบอกให้ตรง ไม่งั้นจะเข้าใจผิดว่า NAS ทำงานอยู่ */
    source: 'nas' | 'rtdb' | 'bundled';
    /** เวลาที่ดึงข้อมูลมาได้ (ISO) — ว่างเมื่อมาจาก NAS หรือ bundled */
    fetchedAt: string;
    /** จำนวนวันนับจากวันที่ราคามีผล ใช้เตือนเมื่อข้อมูลค้างนาน */
    ageDays: number;
    /**
     * %สะสมรายวันสำหรับสร้างตารางประวัติ — รวมทุกแหล่งเข้าด้วยกัน
     * ถ้าไม่รวม ตารางจะค้างที่งวดสุดท้ายในไฟล์ ทั้งที่ NAS มีงวดใหม่แล้ว
     */
    byDate: OilBands;
}

interface RtdbOilPrice {
    diesel?: number;
    pct?: number;
    effectiveDate?: string;
    fetchedAt?: string;
}

interface RtdbOilBand {
    pct?: number;
    diesel?: number;
}

/** ราคาที่แต่ละแหล่งให้มา (ยังไม่รวม byDate ซึ่งประกอบตอนคืนค่า) */
type SourcePrice = Omit<OilPriceState, 'byDate'>;

const daysSince = (iso: string): number => {
    if (!iso) return 0;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return 0;
    const then = Date.UTC(y, m - 1, d);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((today - then) / 86400000));
};

const pctFromDiesel = (diesel: number): number =>
    Math.round((diesel - OIL_BASE) * 100) / 100;

const BUNDLED_BY_DATE = (SAHA_OIL as { byDate: OilBands }).byDate;

/** ดึงราคาจาก NAS ซ้ำทุกชั่วโมง — ราคาเปลี่ยนวันละครั้ง ถี่กว่านี้ไม่มีประโยชน์ */
const NAS_REFRESH_MS = 60 * 60 * 1000;

/** ค่าสำรองจากไฟล์ที่ bundle มา — ใช้เมื่อทั้ง NAS และ RTDB ไม่ตอบ */
const bundledPrice = (): SourcePrice => {
    const dates = Object.keys(BUNDLED_BY_DATE).sort();
    const lastIso = dates[dates.length - 1] || '';
    const pct = lastIso ? BUNDLED_BY_DATE[lastIso] : 0;
    return {
        diesel: Math.round((OIL_BASE + pct) * 100) / 100,
        pct,
        effectiveDate: lastIso,
        source: 'bundled',
        fetchedAt: '',
        ageDays: daysSince(lastIso),
    };
};

export function useOilPrice(): OilPriceState {
    // แยก state ต่อแหล่งและต่อชนิดข้อมูล — callback ของ RTDB สองตัวมาถึงคนละเวลา
    // ถ้าเก็บรวมก้อนเดียว ตัวที่มาก่อนจะถูกตัวที่มาทีหลังลบทิ้ง
    const [nasPrice, setNasPrice] = useState<SourcePrice | null>(null);
    const [nasBands, setNasBands] = useState<OilBands | null>(null);
    const [rtdbPrice, setRtdbPrice] = useState<SourcePrice | null>(null);
    const [rtdbBands, setRtdbBands] = useState<OilBands | null>(null);

    // NAS — ดึงตอนเปิดหน้า แล้วซ้ำทุกชั่วโมง
    // ผู้ใช้เปิดหน้าค้างทั้งวันเป็นเรื่องปกติ ถ้าดึงครั้งเดียวจะเห็นราคาเก่าข้ามวัน
    // (ปตท. ประกาศราคาใหม่ราว 05:00 · NAS ดึงต่อทุก 3 ชม.)
    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const [latest, history] = await Promise.all([getNasOilPrice(), getNasOilHistory()]);
            if (cancelled) return;

            // ต้องได้ครบทั้งราคาและประวัติจึงจะใช้ NAS ได้
            // ถ้าได้แค่ราคา การ์ดจะโชว์ราคาใหม่แต่ตารางยังเป็นของเก่า = เล่าคนละเรื่อง
            const parsed: OilBands = {};
            if (history) {
                for (const b of history) parsed[b.from] = pctFromDiesel(b.diesel);
            }
            if (!latest || !Object.keys(parsed).length) {
                // ดึงไม่สำเร็จ → ทิ้งของเก่า ไม่งั้นหน้าจะยังบอกว่า "จาก NAS" ทั้งที่ NAS ล่ม
                setNasPrice(null);
                setNasBands(null);
                return;
            }

            // ปตท. ประกาศราคาใหม่ก่อนที่ NAS จะบันทึกลงประวัติได้ (NAS ดึงทุก 3 ชม.)
            // เติมงวดจากราคาล่าสุดเองเพื่อให้การ์ดกับตารางตรงกัน — ทั้งคู่มาจาก NAS อยู่แล้ว
            if (parsed[latest.effectiveDate] === undefined) {
                parsed[latest.effectiveDate] = latest.pct;
            }

            setNasBands(parsed);
            setNasPrice({
                diesel: latest.diesel,
                pct: latest.pct,
                effectiveDate: latest.effectiveDate,
                source: 'nas',
                fetchedAt: new Date().toISOString(),
                ageDays: daysSince(latest.effectiveDate),
            });
        };

        void load();
        const timer = setInterval(() => { void load(); }, NAS_REFRESH_MS);
        return () => { cancelled = true; clearInterval(timer); };
    }, []);

    // RTDB — ใช้เมื่อ NAS ไม่ตอบ (เช่น อยู่นอกวง หรือโดเมนไม่อยู่ใน allowlist ของ NAS)
    useEffect(() => {
        // ผูก listener หลัง sign-in เสร็จ — rules ของ oilPrice ต้องการ auth != null
        // ถ้าอ่านก่อน token พร้อม เซิร์ฟเวอร์จะปฏิเสธ แล้วหน้าจะค้างที่ข้อมูล bundled เงียบ ๆ
        let cancelled = false;
        let stopLatest: (() => void) | undefined;
        let stopBands: (() => void) | undefined;

        const subscribe = () => {
            if (cancelled) return;

            stopLatest = onValue(
                ref(db, 'oilPrice/latest'),
                (snap: { val: () => RtdbOilPrice | null }) => {
                    const v = snap.val();
                    // ต้องมีทั้งราคาและวันที่มีผล ไม่งั้นถือว่าใช้ไม่ได้
                    if (!v || typeof v.diesel !== 'number' || !v.effectiveDate) return;
                    // รับทุก snapshot รวมถึงการแก้ไขงวดเดิม — การจัดลำดับแหล่งทำตอนคืนค่า
                    setRtdbPrice({
                        diesel: v.diesel,
                        pct: typeof v.pct === 'number' ? v.pct : pctFromDiesel(v.diesel),
                        effectiveDate: v.effectiveDate,
                        source: 'rtdb',
                        fetchedAt: v.fetchedAt || '',
                        ageDays: daysSince(v.effectiveDate),
                    });
                },
                () => {
                    // อ่านไม่ได้ (เช่น rules ปิด หรือ sign-in ล้มเหลว) — ใช้แหล่งอื่นต่อไป
                }
            );

            stopBands = onValue(
                ref(db, 'oilPrice/bands'),
                (snap: { val: () => Record<string, RtdbOilBand> | null }) => {
                    const v = snap.val();
                    if (!v) return;
                    const parsed: OilBands = {};
                    for (const [iso, band] of Object.entries(v)) {
                        const pct = typeof band?.pct === 'number'
                            ? band.pct
                            : typeof band?.diesel === 'number'
                                ? pctFromDiesel(band.diesel)
                                : null;
                        if (pct !== null) parsed[iso] = pct;
                    }
                    // แทนที่ทั้งชุด — snapshot ล่าสุดคือความจริงของ RTDB (รวมการลบ/แก้งวด)
                    if (Object.keys(parsed).length) setRtdbBands(parsed);
                },
                () => { /* เงียบ — ใช้แหล่งอื่นต่อไป */ }
            );
        };

        // authReady rejects ไม่ได้ (firebaseConfig จับไว้แล้ว) — ผูก listener เสมอ
        void authReady.then(subscribe);

        return () => {
            cancelled = true;
            stopLatest?.();
            stopBands?.();
        };
    }, []);

    // แหล่งจะใช้ได้ต่อเมื่อมีครบทั้งราคาและประวัติ — การ์ดกับตารางต้องมาจากที่เดียวกัน
    const chosen = useMemo(() => {
        const usable = [
            nasPrice && nasBands ? { price: nasPrice, bands: nasBands } : null,
            rtdbPrice && rtdbBands ? { price: rtdbPrice, bands: rtdbBands } : null,
        ].filter((x): x is { price: SourcePrice; bands: OilBands } => x !== null);

        if (!usable.length) return null;
        // สดที่สุดชนะ · เท่ากันเลือก NAS (อยู่ก่อนในรายการ) เพราะดึงจาก ปตท. ถี่กว่า
        return usable.reduce((best, c) =>
            c.price.effectiveDate > best.price.effectiveDate ? c : best
        );
    }, [nasPrice, nasBands, rtdbPrice, rtdbBands]);

    const byDate = useMemo(
        () => mergeOilBands(BUNDLED_BY_DATE, chosen?.bands),
        [chosen]
    );

    return { ...(chosen?.price ?? bundledPrice()), byDate };
}
