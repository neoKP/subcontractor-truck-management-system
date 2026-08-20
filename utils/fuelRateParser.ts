import * as XLSX from 'xlsx';

/**
 * อ่านตารางเรทค่าขนส่งตามราคาน้ำมันจากไฟล์ Excel ที่หน่วยงานอัตราจ้างส่งมา
 *
 * หลักการสำคัญ: เก็บตัวเลข "ตามที่หน่วยงานส่งมา" ทุกช่อง ไม่คำนวณ ไม่เติม ไม่ปัดเอง
 * เพราะเราไม่ใช่คนคิดเรท ถ้าเดาสูตรผิดค่าขนส่งจะผิดโดยไม่มีใครรู้ตัว
 * จุดที่ดูผิดปกติจะรายงานเป็น issue ให้คนตัดสินใจ ไม่ใช่แก้ให้เงียบ ๆ
 */

/** ช่วงราคาน้ำมันหนึ่งช่วง พร้อมค่าขนส่งของช่วงนั้น */
export interface RateBand {
    /** ราคาน้ำมันต่ำสุดของช่วง (บาท/ลิตร) */
    fuelFrom: number;
    /** ราคาน้ำมันสูงสุดของช่วง (บาท/ลิตร) */
    fuelTo: number;
    /** ค่าขนส่งในช่วงนี้ (บาท) — null = หน่วยงานไม่ได้ระบุราคาไว้ */
    price: number | null;
}

export interface FuelRateRow {
    seq: number;
    company: string;
    origin: string;
    destination: string;
    truckType: string;
    /** หมายเหตุแยกแถวที่เส้นทางซ้ำกัน (เช่น พิกัดน้ำหนัก) — ว่างได้ */
    note: string;
    bands: RateBand[];
}

export type IssueKind =
    | 'zero-price'        // ค่าขนส่งเป็น 0 บาท — ใช้คิดเงินไม่ได้
    | 'price-decreases'   // น้ำมันแพงขึ้นแต่ค่าขนส่งถูกลง
    | 'missing-band'      // ช่องว่างกลางตาราง
    | 'duplicate-route'   // เส้นทาง+ประเภทรถซ้ำ แต่ราคาต่างกัน
    | 'no-bands';         // แถวไม่มีราคาเลยสักช่อง

export interface ParseIssue {
    kind: IssueKind;
    /** ข้อความภาษาไทยสำหรับแสดงให้ผู้ใช้และส่งถามหน่วยงาน */
    message: string;
    rows: number[];
}

export interface ParseResult {
    rows: FuelRateRow[];
    issues: ParseIssue[];
    /** รูปแบบไฟล์ที่ตรวจพบ */
    layout: 'wide-1baht' | 'wide-2baht';
    sheetName: string;
}

const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
};

const toStr = (v: unknown): string =>
    v === null || v === undefined ? '' : String(v).trim();

/** ปัดเงินให้เหลือ 2 ตำแหน่ง — ไฟล์ Excel มีค่าอย่าง 6674.400000000001 จาก floating point */
const cleanPrice = (n: number): number => Math.round(n * 100) / 100;

/**
 * หาแถวหัวตาราง: แถวที่มีคำว่า "ต้นทาง" และ "ปลายทาง"
 * ไม่ fix ไว้ที่แถว 1 เพราะสองไฟล์ที่ได้มาวางหัวตารางคนละแถว
 */
function findHeaderRow(grid: unknown[][]): number {
    for (let i = 0; i < Math.min(grid.length, 12); i++) {
        const joined = grid[i].map(toStr).join('|');
        if (joined.includes('ต้นทาง') && joined.includes('ปลายทาง')) return i;
    }
    return -1;
}

/**
 * หาแถวแรกที่เป็นข้อมูลจริง — แถวที่คอลัมน์ต้นทาง/ปลายทางมีข้อความ
 * ไฟล์แบบที่สองวางหัวตารางคร่อม 3 แถว (ชื่อคอลัมน์ / พื้นช่วง / เพดานช่วง + "ประเภทรถ")
 * จึงเดาแถวข้อมูลจาก headerIdx + 1 ตรง ๆ ไม่ได้
 */
function findFirstDataRow(grid: unknown[][], headerIdx: number, cOrigin: number, cDest: number): number {
    for (let i = headerIdx + 1; i < grid.length; i++) {
        const r = grid[i];
        if (!r) continue;
        const o = toStr(cOrigin >= 0 ? r[cOrigin] : '');
        const d = toStr(cDest >= 0 ? r[cDest] : '');
        // ต้องเป็นข้อความ ไม่ใช่ตัวเลขขอบช่วง
        if ((o && toNum(r[cOrigin]) === null) || (d && toNum(r[cDest]) === null)) return i;
    }
    return headerIdx + 1;
}

/**
 * คอลัมน์แรกที่เป็นช่วงราคาน้ำมัน — ดูจากแถวข้อมูลจริง ไม่ใช่แถวหัว
 *
 * ไฟล์แบบที่สองมีคอลัมน์ตัวเลขชุดที่สองอยู่ทางขวา (โซนสรุปของหน่วยงาน) ถ้าไล่หาจาก
 * แถวหัวอย่างเดียวจะไปเจอชุดนั้นก่อน แล้วอ่านราคามาผิดคอลัมน์ทั้งไฟล์
 */
function findFirstBandCol(grid: unknown[][], headerIdx: number, dataIdx: number, labelCols: number): number {
    const dataRow = grid[dataIdx] || [];
    for (let c = labelCols; c < Math.max(dataRow.length, grid[headerIdx].length); c++) {
        // ต้องเป็นตัวเลขทั้งในแถวข้อมูล (ค่าขนส่ง) และในแถวหัวหรือแถวรอบ ๆ (ขอบช่วง)
        if (toNum(dataRow[c]) === null) continue;
        const nearby = [
            grid[headerIdx]?.[c],
            grid[headerIdx - 1]?.[c],
            grid[headerIdx + 1]?.[c],
            grid[dataIdx - 1]?.[c],
            grid[dataIdx - 2]?.[c],
        ];
        if (nearby.some(v => toNum(v) !== null)) return c;
    }
    return -1;
}

/**
 * อ่านไฟล์รูปแบบ "ตารางกว้าง" — หนึ่งคอลัมน์ = หนึ่งช่วงราคาน้ำมัน
 *
 * รองรับทั้งสองแบบที่หน่วยงานส่งมา:
 *   แบบ 1 (อัตราผันน้ำมัน ทุกค่าย) — ช่วงละ 1 บาท, หัวตาราง 2 แถว (บน = เพดาน, ล่าง = พื้น)
 *   แบบ 2 (รถร่วม วสรรณ์)        — ช่วงละ 2 บาท, หัวตารางมีแถวพื้นและเพดานแยกกัน
 */
export function parseFuelRateWorkbook(data: ArrayBuffer | Uint8Array): ParseResult {
    const wb = XLSX.read(data, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[sheetName], {
        header: 1,
        raw: true,
        defval: null,
    });

    const headerIdx = findHeaderRow(grid);
    if (headerIdx === -1) {
        throw new Error('ไม่พบหัวตาราง — ไฟล์ต้องมีคอลัมน์ "ต้นทาง" และ "ปลายทาง"');
    }

    const header = grid[headerIdx];
    const headerText = header.map(toStr);
    const colOf = (...names: string[]): number =>
        headerText.findIndex(h => names.some(n => h === n || h.includes(n)));

    const cCompany = colOf('บริษัท');
    const cOrigin = colOf('ต้นทาง');
    const cDest = colOf('ปลายทาง');
    const cSeq = colOf('ลำดับ');

    // "ประเภทรถ" อาจอยู่คนละแถวกับ "ต้นทาง" — ไฟล์แบบที่สองวางไว้ใต้ลงมา 2 แถว
    let cTruck = colOf('ประเภทรถ');
    let truckRowOffset = 0;
    if (cTruck === -1) {
        for (let off = 1; off <= 3 && headerIdx + off < grid.length; off++) {
            const idx = grid[headerIdx + off].map(toStr).findIndex(h => h.includes('ประเภทรถ'));
            if (idx !== -1) { cTruck = idx; truckRowOffset = off; break; }
        }
    }

    const labelCols = Math.max(cCompany, cOrigin, cDest, cTruck, cSeq) + 1;
    const dataIdx = findFirstDataRow(grid, headerIdx + truckRowOffset, cOrigin, cDest);
    const firstBand = findFirstBandCol(grid, headerIdx, dataIdx, labelCols);
    if (firstBand === -1) {
        throw new Error('ไม่พบคอลัมน์ช่วงราคาน้ำมันในไฟล์');
    }

    // ขอบช่วงอาจอยู่แถวหัว หรือแถวรอบ ๆ (บางไฟล์แยกพื้น/เพดานคนละแถว)
    // ต้องอยู่ "เหนือแถวข้อมูลแรก" เท่านั้น — ถ้าเผลอรวมแถวข้อมูลเข้ามา ค่าขนส่ง
    // (เช่น 13500) จะถูกอ่านเป็นเพดานช่วง แล้วช่วงนั้นจะครอบคลุมราคาน้ำมันทุกค่า
    const edgeRows = [headerIdx - 1, headerIdx, headerIdx + 1, dataIdx - 2, dataIdx - 1]
        .filter(i => i >= 0 && i < dataIdx)
        .map(i => grid[i])
        .filter(Boolean) as unknown[][];

    const bandCols: { col: number; from: number; to: number }[] = [];
    const width = Math.max(...edgeRows.map(r => r.length), (grid[dataIdx] || []).length);
    for (let c = firstBand; c < width; c++) {
        const edges = edgeRows.map(r => toNum(r[c])).filter((x): x is number => x !== null);
        if (!edges.length) continue;
        // หยุดเมื่อขอบช่วงเริ่มถอยหลัง — แปลว่าเข้าโซนตารางชุดถัดไปในไฟล์เดียวกัน
        const from = Math.min(...edges);
        const prev = bandCols[bandCols.length - 1];
        if (prev && from <= prev.from) break;
        bandCols.push({ col: c, from, to: Math.max(...edges) });
    }
    if (!bandCols.length) throw new Error('ไม่พบช่วงราคาน้ำมันในไฟล์');

    // ระยะห่างระหว่างช่วง บอกว่าเป็นไฟล์แบบ 1 บาท หรือ 2 บาท
    const gaps = bandCols.slice(1).map((b, i) => b.from - bandCols[i].from).filter(g => g > 0);
    const medianGap = gaps.length ? gaps.sort((x, y) => x - y)[Math.floor(gaps.length / 2)] : 1;
    const layout: ParseResult['layout'] = medianGap >= 1.5 ? 'wide-2baht' : 'wide-1baht';

    const rows: FuelRateRow[] = [];
    const issues: ParseIssue[] = [];
    let lastCompany = '';

    for (let i = dataIdx; i < grid.length; i++) {
        const r = grid[i];
        if (!r || r.every(v => v === null || v === '')) continue;

        const origin = toStr(cOrigin >= 0 ? r[cOrigin] : '');
        const dest = toStr(cDest >= 0 ? r[cDest] : '');
        if (!origin && !dest) continue;   // แถวหัวข้อ/แถวว่าง

        // บริษัทเว้นว่างในแถวถัดมา = ใช้ค่าจากแถวก่อนหน้า (merge cell ใน Excel)
        const company = toStr(cCompany >= 0 ? r[cCompany] : '') || lastCompany;
        if (company) lastCompany = company;

        const bands: RateBand[] = bandCols.map(bc => {
            const v = toNum(r[bc.col]);
            return { fuelFrom: bc.from, fuelTo: bc.to, price: v === null ? null : cleanPrice(v) };
        });

        rows.push({
            seq: toNum(cSeq >= 0 ? r[cSeq] : null) ?? rows.length + 1,
            company,
            origin,
            destination: dest,
            truckType: toStr(cTruck >= 0 ? r[cTruck] : ''),
            note: '',
            bands,
        });
    }

    // ── ตรวจคุณภาพข้อมูล — รายงานอย่างเดียว ไม่แก้ให้ ──
    const decreasing: number[] = [];
    const missing: number[] = [];
    const empty: number[] = [];
    const zeroPriced: number[] = [];

    rows.forEach((row, idx) => {
        const filled = row.bands.filter(b => b.price !== null);
        if (!filled.length) { empty.push(idx); return; }

        // 0 บาทแปลว่ายังไม่ได้ตกลงราคาช่วงนั้น — แยกรายงานเพราะคิดเงินไม่ได้จริง
        if (filled.some(b => b.price === 0)) zeroPriced.push(idx);

        // ช่องว่างที่อยู่ "ระหว่าง" ช่องที่มีค่า (ช่องว่างหัวท้ายเป็นเรื่องปกติ)
        const firstIdx = row.bands.findIndex(b => b.price !== null);
        let lastIdx = -1;
        row.bands.forEach((b, i) => { if (b.price !== null) lastIdx = i; });
        for (let i = firstIdx; i <= lastIdx; i++) {
            if (row.bands[i].price === null) { missing.push(idx); break; }
        }

        // ค่าขนส่งต้องไม่ลดลงเมื่อน้ำมันแพงขึ้น — ข้ามช่อง 0 เพราะรายงานแยกไว้แล้ว
        let prev: number | null = null;
        for (const b of row.bands) {
            if (b.price === null || b.price === 0) continue;
            if (prev !== null && b.price < prev) { decreasing.push(idx); break; }
            prev = b.price;
        }
    });

    const routeKey = (r: FuelRateRow) => `${r.company}|${r.origin}|${r.destination}|${r.truckType}`;
    const byRoute = new Map<string, number[]>();
    rows.forEach((r, i) => {
        const k = routeKey(r);
        byRoute.set(k, [...(byRoute.get(k) || []), i]);
    });
    const duplicates = [...byRoute.values()].filter(idxs => idxs.length > 1).flat();

    const describe = (idx: number) => {
        const r = rows[idx];
        return `${r.company} | ${r.origin} → ${r.destination} | ${r.truckType}`;
    };

    if (zeroPriced.length) {
        issues.push({
            kind: 'zero-price',
            message: `${zeroPriced.length} เส้นทางมีค่าขนส่งเป็น 0 บาทในบางช่วงราคาน้ำมัน ใช้คิดเงินไม่ได้ เช่น ${describe(zeroPriced[0])}`,
            rows: zeroPriced,
        });
    }
    if (decreasing.length) {
        issues.push({
            kind: 'price-decreases',
            message: `${decreasing.length} เส้นทางมีค่าขนส่งลดลงทั้งที่ราคาน้ำมันสูงขึ้น เช่น ${describe(decreasing[0])}`,
            rows: decreasing,
        });
    }
    if (missing.length) {
        issues.push({
            kind: 'missing-band',
            message: `${missing.length} เส้นทางมีช่วงราคาน้ำมันที่ไม่ได้ระบุค่าขนส่ง เช่น ${describe(missing[0])}`,
            rows: missing,
        });
    }
    if (duplicates.length) {
        const first = byRoute.get(routeKey(rows[duplicates[0]]))!;
        issues.push({
            kind: 'duplicate-route',
            message: `${duplicates.length} แถวมีเส้นทางและประเภทรถซ้ำกัน แยกไม่ออกว่าใช้ราคาไหน เช่น ${describe(first[0])}`,
            rows: duplicates,
        });
    }
    if (empty.length) {
        issues.push({
            kind: 'no-bands',
            message: `${empty.length} แถวไม่มีค่าขนส่งเลยสักช่วง เช่น ${describe(empty[0])}`,
            rows: empty,
        });
    }

    return { rows, issues, layout, sheetName };
}

/**
 * หาค่าขนส่งของเส้นทางหนึ่ง ณ ราคาน้ำมันที่กำหนด
 *
 * คืน null เมื่อไม่มีช่วงที่ครอบคลุมราคานั้น หรือช่วงนั้นไม่ได้ระบุราคา
 * — ตั้งใจไม่เดาค่าใกล้เคียง เพราะค่าขนส่งที่เดามาผิดจะกลายเป็นเงินจริงที่จ่ายผิด
 */
export function findRateAt(row: FuelRateRow, fuelPrice: number): RateBand | null {
    const hit = row.bands.find(b => fuelPrice >= b.fuelFrom && fuelPrice <= b.fuelTo);
    // 0 บาทถือว่า "ไม่มีเรท" ไม่ใช่ค่าขนส่งฟรี — ไฟล์จริงใส่ 0 ในช่วงที่ยังไม่ได้ตกลงราคา
    // ถ้าคืนค่านี้ไป ระบบจะคิดค่าขนส่งเป็นศูนย์แทนที่จะเตือนว่าหาเรทไม่ได้
    if (hit && hit.price !== null && hit.price > 0) return hit;
    return null;
}
