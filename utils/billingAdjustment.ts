import { monthlyAverageDiesel, type MonthlyAverage } from './oilMonthlyAverage';
import { findRateAt, type FuelRateRow } from './fuelRateParser';
import { oilPriceAtDate } from './oilPriceAtDate';
import { canonicalSubcontractor } from './subcontractorAliases';
import { canonicalTruckType } from './truckTypeAliases';
import { matchRoute } from './placeZones';
import type { OilBands } from './oilRounds';
import type { Job } from '../types';

/**
 * ยอดที่ควรจ่ายเมื่อคิดจากค่าเฉลี่ยราคาน้ำมันรายเดือน
 *
 * ข้อตกลงกับหน่วยงานอัตราจ้าง (2 ต.ค. 2569)
 *   เปิดใบงาน  — ใช้ราคาน้ำมัน ณ วันที่ต้องการรถ (เหมือนเดิม ไม่เปลี่ยน)
 *   วางบิล     — ใช้ค่าเฉลี่ยทั้งเดือนของ "เดือนที่วิ่งงาน"
 *   วางบิลก่อนสิ้นเดือนไม่ได้ ต้องรอให้เดือนจบก่อน
 *
 * ทำไมไฟล์นี้ไม่ไปแก้ยอดในใบงานโดยตรง: ทีมทำบิลนอกระบบ (Excel)
 * แล้วค่อยบันทึกย้อนหลัง · ถ้าไปแก้ job.cost เงียบ ๆ ตัวเลขจะไม่ตรงกับ
 * เอกสารที่ส่งไปแล้ว และไม่มีใครรู้ว่าถูกแก้ตอนไหน
 * ไฟล์นี้จึง "คำนวณให้ดู" อย่างเดียว เอาไป export เป็น Excel ให้คนทำบิลใช้
 *
 * หมายเหตุ: เดือนที่วิ่งงานมาจาก dateOfService ไม่ใช่เดือนที่ออกบิล —
 * งานวันที่ 28 ส.ค. ที่วางบิลเดือน ต.ค. ต้องใช้ค่าเฉลี่ยเดือนสิงหาคม
 *
 * ส่วนต่าง = ราคาตามตารางที่ค่าเฉลี่ย − ราคาตามตารางที่ราคาน้ำมันวันที่วิ่ง
 * ไม่ใช่ลบด้วยยอดในใบงานตรง ๆ · รุ่นแรกลบด้วย job.cost แล้วได้ส่วนต่างเดือน ก.ย.
 * ใบละราว 2,000 บาท ทั้งที่ผลของค่าเฉลี่ยจริงอยู่หลักสิบ เพราะใบงานพวกนั้น
 * ไม่ได้เปิดด้วยตารางเรท (ราคาตกลงเอง 23,500 ไม่ตรงช่องไหนในตาราง)
 * ส่วนต่างจึงปนเรื่อง "เปลี่ยนวิธีตั้งราคา" เข้ามา ซึ่งข้อตกลงไม่ได้พูดถึง
 *
 * ใบงานที่ยอดไม่ตรงกับราคาตามตารางวันที่วิ่ง จะถูกแยกออกเป็น cost-mismatch
 * และไม่นับรวมยอด เพราะไม่รู้ว่าตกลงราคากันไว้แบบไหน — ให้คนตัดสินเอง
 */

export type AdjustStatus =
    /** คำนวณได้ ยอดเปลี่ยนจากเดิม */
    | 'adjusted'
    /** คำนวณได้ แต่ยอดเท่าเดิม (ราคาวันนั้นอยู่ช่วงเดียวกับค่าเฉลี่ย) */
    | 'unchanged'
    /** เดือนนั้นยังไม่จบ — ตามข้อตกลงต้องรอ */
    | 'month-not-over'
    /** ไม่มีข้อมูลราคาน้ำมันพอจะเฉลี่ยทั้งเดือน */
    | 'no-average'
    /** หาเรทของเส้นทางนี้ไม่เจอที่ค่าเฉลี่ยนั้น */
    | 'no-rate'
    /** ไม่รู้ราคาน้ำมันของวันที่วิ่ง หรือตารางไม่มีราคาที่ระดับนั้น — เทียบไม่ได้ */
    | 'no-daily-rate'
    /** ยอดในใบงานไม่ตรงกับราคาตามตารางวันที่วิ่ง — ใบงานไม่ได้เปิดด้วยตารางเรท */
    | 'cost-mismatch'
    /** ใบงานไม่มีข้อมูลพอ (ไม่มีวันที่ ต้นทาง ปลายทาง หรือประเภทรถ) */
    | 'incomplete';

export interface AdjustedJob {
    jobId: string;
    /** วันที่ต้องการรถ — ตัวที่ใช้ตัดสินว่าอยู่เดือนไหน */
    dateOfService: string;
    /** เดือนที่ใช้ค่าเฉลี่ย รูปแบบ YYYY-MM */
    month: string;
    subcontractor: string;
    origin: string;
    destination: string;
    truckType: string;
    /** ยอดเดิมในใบงาน (บาท) */
    originalCost: number;
    /** ราคาดีเซลของวันที่วิ่ง — 0 เมื่อไม่รู้ */
    dailyDiesel: number;
    /** ราคาตามตารางที่ราคาน้ำมันวันที่วิ่ง — ตัวตั้งของส่วนต่าง · null เมื่อหาไม่ได้ */
    dailyCost: number | null;
    /** ช่วงราคาน้ำมันของราคาวันที่วิ่ง เช่น "39.01–40" */
    dailyBand: string;
    /** ยอดที่ควรเป็นเมื่อคิดจากค่าเฉลี่ย — null เมื่อคำนวณไม่ได้ */
    adjustedCost: number | null;
    /**
     * ผลของค่าเฉลี่ย = adjustedCost − dailyCost (บวก = ต้องจ่ายเพิ่ม)
     * null เมื่อคำนวณไม่ได้ · มีค่าใน cost-mismatch ด้วยแต่ไม่นับรวมยอด
     */
    difference: number | null;
    /** ค่าเฉลี่ยที่ใช้ — 0 เมื่อคำนวณไม่ได้ */
    avgDiesel: number;
    /** ช่วงราคาน้ำมันที่ยอดใหม่ตกอยู่ เช่น "40.01–41" — ว่างเมื่อคำนวณไม่ได้ */
    band: string;
    /** เส้นทางตามที่เขียนในตารางเรท เช่น "กทม ปริมณฑล → นครสวรรค์" — ว่างเมื่อหาไม่เจอ */
    rateRoute: string;
    /** จับคู่ได้แบบไหน — inferred = ตามเขต หรือแก้ต้นทางที่ตารางเขียนผิด (ดู placeZones) */
    matchedBy: 'exact' | 'inferred' | '';
    status: AdjustStatus;
}

export interface AdjustmentSummary {
    month: string;
    average: MonthlyAverage;
    jobs: AdjustedJob[];
    /** จำนวนงานที่ยอดเปลี่ยน */
    adjustedCount: number;
    /** จำนวนงานที่ยอดเท่าเดิม */
    unchangedCount: number;
    /** จำนวนงานที่คำนวณไม่ได้ (ต้องดูเอง) — รวม mismatchCount ด้วย */
    problemCount: number;
    /** จำนวนงานที่ยอดในใบงานไม่ได้มาจากตารางเรท */
    mismatchCount: number;
    /** ผลรวมราคาตามตารางวันที่วิ่ง ของงานที่นับรวมยอด */
    totalOriginal: number;
    /** ผลรวมยอดใหม่ของงานที่คำนวณได้ */
    totalAdjusted: number;
    /** ผลรวมส่วนต่าง (บวก = จ่ายเพิ่ม) */
    totalDifference: number;
}

const eq = (a: string, b: string): boolean =>
    (a || '').trim().toLowerCase().replace(/\s+/g, ' ') ===
    (b || '').trim().toLowerCase().replace(/\s+/g, ' ');

/** ปัดเป็นสตางค์ — ยอดเงินไม่ควรมีเศษละเอียดกว่านี้ */
const money = (n: number): number => Math.round(n * 100) / 100;

/**
 * หาแถวเรทที่ตรงกับงานใบนี้
 *
 * เทียบชื่อผ่านทะเบียนมาตรฐานก่อน เพราะไฟล์จากหน่วยงานเขียนชื่อคนละแบบ
 * กับที่ระบบเก็บ ("รถร่วมคุณหนึ่ง" กับ "รถร่วมวสรรณ์" เป็นเจ้าเดียวกัน)
 */
function matchRow(rows: FuelRateRow[], job: Job): { row: FuelRateRow; how: 'exact' | 'inferred' } | null {
    const wantTruck = canonicalTruckType(job.truckType || '');
    const wantSub = canonicalSubcontractor(job.subcontractor || '');
    if (!wantTruck) return null;

    // แถวชื่อตรงชนะแถวตามเขตเสมอ — ราคาเฉพาะร้านคือสิ่งที่หน่วยงานตั้งใจกำหนดไว้
    const inferred: FuelRateRow[] = [];
    for (const row of rows) {
        if (!eq(canonicalTruckType(row.truckType), wantTruck)) continue;
        // ถ้าใบงานระบุผู้รับเหมาไว้ ต้องตรงด้วย — เส้นทางเดียวกันคนละเจ้าคนละราคา
        if (wantSub && !eq(canonicalSubcontractor(row.company), wantSub)) continue;
        // ชื่อสถานที่ในใบงานกับในตารางเขียนคนละแบบ และบางตารางคิดตามเขต
        // — ดู utils/placeAliases.ts และ utils/placeZones.ts
        const how = matchRoute(row, job.origin || '', job.destination || '');
        if (how === 'exact') return { row, how };
        if (how === 'inferred') inferred.push(row);
    }
    // ตามเขตแล้วเจอหลายแถว = ไม่รู้ว่าแถวไหนถูก · ไม่เลือกให้ ปล่อยเป็น "ไม่พบเรท"
    return inferred.length === 1 ? { row: inferred[0], how: 'inferred' } : null;
}

/**
 * คำนวณยอดที่ควรจ่ายของงานใบเดียว
 *
 * @param job   ใบงาน
 * @param rows  แถวเรททั้งหมดของรุ่นที่ใช้งาน
 * @param byDate ประวัติราคาน้ำมัน (%สะสมรายวัน)
 * @param today วันนี้ (ISO) — ใช้ตัดสินว่าเดือนของงานจบหรือยัง
 */
export function adjustJob(
    job: Job,
    rows: FuelRateRow[],
    byDate: OilBands | null | undefined,
    today: string
): AdjustedJob {
    const day = (job.dateOfService || '').split('T')[0];
    const month = day.slice(0, 7);
    const base: AdjustedJob = {
        jobId: job.id,
        dateOfService: day,
        month,
        subcontractor: canonicalSubcontractor(job.subcontractor || ''),
        origin: job.origin || '',
        destination: job.destination || '',
        truckType: job.truckType || '',
        originalCost: job.cost || 0,
        dailyDiesel: 0,
        dailyCost: null,
        dailyBand: '',
        adjustedCost: null,
        difference: null,
        avgDiesel: 0,
        band: '',
        rateRoute: '',
        matchedBy: '',
        status: 'incomplete',
    };

    if (!day || !job.origin || !job.destination || !job.truckType) return base;

    const avg = monthlyAverageDiesel(byDate, month, today);
    if (!avg.usable) {
        return { ...base, status: avg.status === 'month-not-over' ? 'month-not-over' : 'no-average' };
    }

    const found = matchRow(rows, job);
    const row = found?.row ?? null;
    const hit = row ? findRateAt(row, avg.diesel) : null;
    if (!hit || hit.price === null) {
        return { ...base, avgDiesel: avg.diesel, status: 'no-rate' };
    }

    const adjusted = money(hit.price);
    const withAvg: AdjustedJob = {
        ...base,
        adjustedCost: adjusted,
        avgDiesel: avg.diesel,
        band: `${hit.fuelFrom}–${hit.fuelTo}`,
        rateRoute: `${(row as FuelRateRow).origin} → ${(row as FuelRateRow).destination}`,
        matchedBy: (found as { how: 'exact' | 'inferred' }).how,
    };

    /*
      ราคาตามตารางที่ราคาน้ำมันวันที่วิ่ง — ใช้ oilPriceAtDate ตัวเดียวกับหน้าเปิดใบงาน
      ถ้าคิดราคารายวันคนละวิธีกับตอนเปิดงาน ใบงานที่เปิดถูกจะโดนตีว่าไม่ตรงตาราง
    */
    const daily = oilPriceAtDate(byDate, day, today);
    const dailyHit = daily.usable && row ? findRateAt(row, daily.diesel) : null;
    if (!dailyHit || dailyHit.price === null) {
        return { ...withAvg, dailyDiesel: daily.usable ? daily.diesel : 0, status: 'no-daily-rate' };
    }

    const dailyCost = money(dailyHit.price);
    const diff = money(adjusted - dailyCost);
    const withDaily: AdjustedJob = {
        ...withAvg,
        dailyDiesel: daily.diesel,
        dailyCost,
        dailyBand: `${dailyHit.fuelFrom}–${dailyHit.fuelTo}`,
        difference: diff,
    };

    // ราคาตามเรทน้ำมันคือราคาช่องตรง ๆ ไม่มีค่าจุดส่งบวก (ดู matchSelectedFuelRate)
    // ยอดไม่ตรง = ใบงานนี้ไม่ได้เปิดด้วยตารางเรท
    if (money(job.cost || 0) !== dailyCost) {
        return { ...withDaily, status: 'cost-mismatch' };
    }

    return { ...withDaily, status: diff === 0 ? 'unchanged' : 'adjusted' };
}

/** งานที่นำมารวมยอดได้ — ยอดในใบงานมาจากตารางเรทและคำนวณครบ */
const countable = (j: AdjustedJob): boolean =>
    j.status === 'adjusted' || j.status === 'unchanged';

/**
 * สรุปยอดปรับของงานทั้งเดือน สำหรับเอาไปวางบิล
 *
 * รับงานทั้งหมดเข้ามาแล้วกรองเอง เพื่อให้ผู้เรียกไม่ต้องรู้ว่ากรองด้วยอะไร
 * (เดือนมาจาก dateOfService ไม่ใช่วันที่สร้างใบงาน)
 */
export function summarizeMonth(
    allJobs: Job[],
    month: string,
    rows: FuelRateRow[],
    byDate: OilBands | null | undefined,
    today: string
): AdjustmentSummary {
    const inMonth = (allJobs || []).filter(j => (j.dateOfService || '').startsWith(month));
    const jobs = inMonth.map(j => adjustJob(j, rows, byDate, today));

    let totalOriginal = 0;
    let totalAdjusted = 0;
    for (const j of jobs) {
        if (!countable(j)) continue;
        totalOriginal += j.dailyCost as number;
        totalAdjusted += j.adjustedCost as number;
    }

    return {
        month,
        average: monthlyAverageDiesel(byDate, month, today),
        jobs,
        adjustedCount: jobs.filter(j => j.status === 'adjusted').length,
        unchangedCount: jobs.filter(j => j.status === 'unchanged').length,
        problemCount: jobs.filter(j => !countable(j)).length,
        mismatchCount: jobs.filter(j => j.status === 'cost-mismatch').length,
        totalOriginal: money(totalOriginal),
        totalAdjusted: money(totalAdjusted),
        totalDifference: money(totalAdjusted - totalOriginal),
    };
}

/** เดือนทั้งหมดที่มีงานอยู่ เรียงจากใหม่ไปเก่า — ใช้ทำรายการให้เลือก */
export function monthsWithJobs(allJobs: Job[]): string[] {
    const set = new Set<string>();
    for (const j of allJobs || []) {
        const m = (j.dateOfService || '').split('T')[0].slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(m)) set.add(m);
    }
    return [...set].sort().reverse();
}
