import { useEffect, useMemo, useState } from 'react';
import { db, ref, onValue, authReady } from '../firebaseConfig';
import SAHA_OIL from '../data/sahaOilAdjust.json';
import { OIL_BASE } from './oilRounds';

/**
 * ราคาดีเซลที่ระบบใช้เปิดตารางเรทค่าขนส่ง
 *
 * แหล่งข้อมูลเรียงตามลำดับความสด:
 *   1. RTDB `oilPrice/latest` — Cloud Function `fetchOilPrice` ดึงจาก ปตท. วันละ 2 ครั้ง
 *   2. ไฟล์ data/sahaOilAdjust.json — ค่าที่ bundle มากับเว็บ ใช้เมื่อ RTDB ยังไม่มีข้อมูล
 *
 * ไม่ยิงหา ปตท. จากเบราว์เซอร์ตรง ๆ เพราะหน้านั้นไม่ส่ง CORS header
 */

/** งวดปรับที่ Cloud Function บันทึกไว้ — key = วันที่มีผล (ISO), value = %สะสม */
export type OilBands = Record<string, number>;

export interface OilPriceState {
    /** ราคาดีเซล บาท/ลิตร */
    diesel: number;
    /** %สะสมสหพัฒน์ = diesel − 31.94 */
    pct: number;
    /** วันที่ราคานี้มีผล (ISO ค.ศ.) */
    effectiveDate: string;
    /** มาจาก ปตท. ผ่าน Cloud Function หรือจากไฟล์ที่ bundle มา */
    source: 'live' | 'bundled';
    /** เวลาที่ Cloud Function ดึงมาได้ (ISO) — ว่างเมื่อ source เป็น bundled */
    fetchedAt: string;
    /** จำนวนวันนับจากวันที่ราคามีผล ใช้เตือนเมื่อข้อมูลค้างนาน */
    ageDays: number;
    /**
     * %สะสมรายวันสำหรับสร้างตารางประวัติ — รวมข้อมูลที่ bundle มากับงวดใหม่จาก ปตท.
     * ถ้าไม่รวม ตารางจะค้างอยู่ที่งวดสุดท้ายในไฟล์ ทั้งที่ Cloud Function เก็บงวดใหม่ไว้แล้ว
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

const daysSince = (iso: string): number => {
    if (!iso) return 0;
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return 0;
    const then = Date.UTC(y, m - 1, d);
    const now = new Date();
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((today - then) / 86400000));
};

const BUNDLED_BY_DATE = (SAHA_OIL as { byDate: OilBands }).byDate;

/** ค่าสำรองจากไฟล์ที่ bundle มา — ใช้ระหว่างรอ RTDB หรือเมื่อยังไม่ได้ deploy Function */
const bundledPrice = (): OilPriceState => {
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
        byDate: BUNDLED_BY_DATE,
    };
};

export function useOilPrice(): OilPriceState {
    const [price, setPrice] = useState<OilPriceState>(bundledPrice);
    const [liveBands, setLiveBands] = useState<OilBands | null>(null);

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
                    // ต้องมีทั้งราคาและวันที่มีผล ไม่งั้นถือว่าใช้ไม่ได้ — คงค่า bundled ไว้
                    if (!v || typeof v.diesel !== 'number' || !v.effectiveDate) return;
                    const diesel = v.diesel;
                    const effectiveDate = v.effectiveDate;
                    setPrice(prev => ({
                        ...prev,
                        diesel,
                        pct: typeof v.pct === 'number'
                            ? v.pct
                            : Math.round((diesel - OIL_BASE) * 100) / 100,
                        effectiveDate,
                        source: 'live',
                        fetchedAt: v.fetchedAt || '',
                        ageDays: daysSince(effectiveDate),
                    }));
                },
                () => {
                    // อ่านไม่ได้ (เช่น rules ปิด หรือ sign-in ล้มเหลว) — ใช้ค่า bundled ต่อไป
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
                                ? Math.round((band.diesel - OIL_BASE) * 100) / 100
                                : null;
                        if (pct !== null) parsed[iso] = pct;
                    }
                    if (Object.keys(parsed).length) setLiveBands(parsed);
                },
                () => { /* เงียบ — ใช้ค่า bundled ต่อไป */ }
            );
        };

        // authReady rejects ไม่ได้ (firebaseConfig จับไว้แล้ว) — ผูก listener เสมอ
        // ถ้า sign-in ล้มเหลว การอ่านจะโดนปฏิเสธและ hook คงค่า bundled ไว้ตามเดิม
        void authReady.then(subscribe);

        return () => {
            cancelled = true;
            stopLatest?.();
            stopBands?.();
        };
    }, []);

    // งวดจาก ปตท. ทับงวดที่ bundle มาเมื่อวันที่ตรงกัน — ปตท. เป็นแหล่งที่สดกว่า
    const byDate = useMemo(
        () => (liveBands ? { ...BUNDLED_BY_DATE, ...liveBands } : BUNDLED_BY_DATE),
        [liveBands]
    );

    return { ...price, byDate };
}
