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
    /**
     * ชื่อตารางย่อยที่แถวนี้มาจาก (เช่น "นีโอสยาม วางบิล sunlee")
     * ไม่มีค่า = มาจากตารางหลักของชีต
     */
    section?: string;
    bands: RateBand[];
}

export type IssueKind =
    | 'zero-price'        // ค่าขนส่งเป็น 0 บาท — ใช้คิดเงินไม่ได้
    | 'price-decreases'   // น้ำมันแพงขึ้นแต่ค่าขนส่งถูกลง
    | 'missing-band'      // ช่องว่างกลางตาราง
    | 'duplicate-route'   // เส้นทาง+ประเภทรถซ้ำ แต่ราคาต่างกัน
    | 'no-bands'         // แถวไม่มีราคาเลยสักช่อง
    | 'side-table-unreadable'    // เจอตารางย่อยแต่อ่านช่วงราคาน้ำมันไม่ได้
    // สามอย่างนี้ไม่ได้มาจากตัวอ่านไฟล์ แต่มาจาก `fuelRateTemplate.checkAgainstMaster()`
    // ซึ่งเทียบชื่อในไฟล์กับทะเบียนของระบบ — ใช้ชนิดเดียวกันเพื่อให้แสดงผลรวมกันได้
    | 'unknown-subcontractor'    // ชื่อผู้รับจ้างไม่ตรงทะเบียน
    | 'unknown-truck-type'       // ชื่อประเภทรถไม่ตรงทะเบียน
    | 'unknown-location';        // ชื่อต้นทาง/ปลายทางไม่ตรงทะเบียน

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
    /** true = ไฟล์นี้มาจากแบบฟอร์มที่ระบบสร้างให้ (มีบรรทัดกำกับอยู่หัวชีต) */
    isTemplate: boolean;
}

/**
 * ข้อความกำกับหัวแบบฟอร์มที่ระบบสร้างให้ — ต้องตรงกับที่ `fuelRateTemplate.ts` เขียนลงไฟล์
 * ใช้แยกว่า "ไฟล์นี้กรอกจากแบบฟอร์มของเรา" (ตรวจชื่อกับทะเบียนได้)
 * หรือ "ไฟล์ต้นฉบับของหน่วยงาน" (ชื่อยังเป็นภาษาของเขา ตรวจแล้วจะเตือนพร่ำเพรื่อ)
 */
export const TEMPLATE_MARKER = 'แบบฟอร์มตารางเรทค่าขนส่งตามราคาน้ำมัน';

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
    return -1;   // ไม่มีแถวข้อมูลเลย เช่น แบบฟอร์มเปล่าที่ยังไม่ได้กรอก
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
 * ค่าขนส่งที่ต่ำกว่านี้ถือว่าไม่ใช่ราคา — ในไฟล์จริงราคาต่ำสุดคือ 101 บาท
 * ส่วนตัวเลขที่ต่ำกว่านั้นเป็นตัวคูณหรือขอบช่วงราคาน้ำมันที่หลุดมา
 */
const MIN_FREIGHT_PRICE = 100;

/**
 * แถวหมายเหตุที่หน่วยงานแทรกไว้ท้ายตาราง — ไม่ใช่เส้นทางจริง
 *
 * เจอในไฟล์ "รถร่วม วสรรณ์" แถว 42:
 *   "* ส่ง สินค้า อ.เมือง / ศูนย์กระจาย 1 จุด" พร้อมตัวเลข 0.94, 0.96, 1.02
 * ตัวเลขเหล่านั้นเป็น "ตัวคูณ" ไม่ใช่ค่าขนส่ง ถ้านับเข้ามาจะได้แถวราคา 1.02 บาท
 *
 * ใช้สองเกณฑ์ประกอบกัน กันตัดเส้นทางจริงทิ้ง:
 *   1. ขึ้นต้นด้วย * หรือมีคำว่า "หมายเหตุ" — เครื่องหมายที่หน่วยงานใช้กำกับหมายเหตุ
 *   2. ไม่มีคอลัมน์ปลายทาง หรือค่าทุกช่องต่ำกว่าราคาขนส่งขั้นต่ำ
 */
function isNoteRow(
    row: unknown[],
    origin: string,
    dest: string,
    bandCols: { col: number }[]
): boolean {
    const marked = /^\s*\*/.test(origin) || /^\s*\*/.test(dest)
        || origin.includes('หมายเหตุ') || dest.includes('หมายเหตุ');
    if (!marked) return false;

    // แถวหมายเหตุมักไม่มีปลายทาง — ถ้ามีครบทั้งคู่ อาจเป็นเส้นทางจริงที่ติดดอกจัน
    if (!dest) return true;

    const values = bandCols
        .map(bc => toNum(row[bc.col]))
        .filter((v): v is number => v !== null);
    return values.length > 0 && values.every(v => v < MIN_FREIGHT_PRICE);
}

/**
 * อ่าน "ตารางย่อย" ที่หน่วยงานวางไว้ทางขวาของตารางหลักในชีตเดียวกัน
 *
 * ไฟล์ "รถร่วม วสรรณ์" มีตารางที่สองเริ่มที่คอลัมน์ W หัวเรื่อง "นีโอสยาม วางบิล sunlee"
 * แบ่งเป็นบล็อกตามประเภทรถ (4w / 6w / 10w) บล็อกละ 11 ปลายทาง ช่วงน้ำมัน 30–61.99 บาท
 * โครงหนึ่งบล็อก (ตัวเลขคือระยะจากแถว "ปลายทาง"):
 *   -3  แถวตัวคูณ           |            | 0.94 | 0.97 | ...   ← ไม่ใช่ค่าขนส่ง ไม่เก็บ
 *   -2  ชื่อตาราง + พื้นช่วง  | นีโอสยาม... | 30   | 32   | ...
 *   -1  เพดานช่วง           |            | 31.99| 33.99| ...
 *    0  หัวตาราง            | ปลายทาง    | 4w   | 4w   | ...
 *   +1  ข้อมูล              | 7-11 บางบัวทอง | 2350 | 2425 | ...
 *
 * ตารางหลักอ่านไม่ถึงโซนนี้ เพราะ bandCols หยุดเมื่อขอบช่วงถอยหลัง (30 < 60.98)
 * จึงต้องอ่านแยก — และเก็บตามไฟล์เหมือนเดิม ไม่เดาต้นทาง ไม่เติมราคา
 *
 * บล็อกหนึ่งอาจมีแถวว่างคั่นกลาง (บล็อก 6w ในไฟล์จริงเว้น 14 แถว แล้วต่อปลายทางที่เหลือ)
 * จึงไม่หยุดที่แถวว่าง แต่หยุดเมื่อถึงหัวบล็อกถัดไป
 */
function parseSideTables(
    grid: unknown[][],
    minCol: number,
    seqStart: number
): { rows: FuelRateRow[]; issues: ParseIssue[] } {
    const rows: FuelRateRow[] = [];
    const issues: ParseIssue[] = [];

    // หาแถว "ปลายทาง" ที่อยู่ขวาของตารางหลัก — หนึ่งแถว = หัวของหนึ่งบล็อก
    //
    // ต้องแยกให้ออกจาก "แถวข้อมูลที่ชื่อปลายทางบังเอิญมีคำว่าปลายทาง" ใช้สองข้อคู่กัน:
    //   1. ช่องขวามือต้องมีข้อความ (ชื่อประเภทรถ เช่น 4w) — แถวข้อมูลมีแต่ตัวเลข
    //   2. ต้องไม่มีตัวเลขที่หน้าตาเป็นค่าขนส่ง คือค่าตั้งแต่ 100 บาทขึ้นไป หรือ 0
    //      (0 = ช่วงที่ยังไม่ตกลงราคา ต้องเก็บไว้รายงาน ไม่ใช่ตัดทิ้งเพราะนึกว่าเป็นหัวตาราง)
    const headers: { row: number; col: number }[] = [];
    grid.forEach((r, i) => {
        if (!r) return;
        for (let c = minCol; c < r.length; c++) {
            if (!toStr(r[c]).includes('ปลายทาง')) continue;
            const right = r.slice(c + 1);
            const hasText = right.some(v => toStr(v) !== '' && toNum(v) === null);
            const looksLikeData = right.some(v => {
                const n = toNum(v);
                return n !== null && (n === 0 || n >= MIN_FREIGHT_PRICE);
            });
            if (hasText && !looksLikeData) headers.push({ row: i, col: c });
            break;
        }
    });

    headers.forEach((h, hi) => {
        const endRow = hi + 1 < headers.length ? headers[hi + 1].row : grid.length;

        // ขอบช่วงราคาน้ำมันอยู่สองแถวเหนือหัวตาราง (แถวพื้น และแถวเพดาน)
        const edgeRows = [h.row - 2, h.row - 1]
            .filter(i => i >= 0)
            .map(i => grid[i])
            .filter(Boolean) as unknown[][];

        const bandCols: { col: number; from: number; to: number }[] = [];
        const width = Math.max(...edgeRows.map(r => r.length), (grid[h.row] || []).length, 0);
        for (let c = h.col + 1; c < width; c++) {
            const edges = edgeRows.map(r => toNum(r[c])).filter((x): x is number => x !== null);
            // ต้องมีทั้งพื้นและเพดาน ถ้ามีค่าเดียวจะไม่รู้ว่าช่วงกว้างแค่ไหน — ข้าม ดีกว่าเดา
            if (edges.length < 2) continue;
            const from = Math.min(...edges);
            const prev = bandCols[bandCols.length - 1];
            if (prev && from <= prev.from) break;   // เข้าโซนตารางถัดไปแล้ว
            bandCols.push({ col: c, from, to: Math.max(...edges) });
        }

        // ชื่อตารางอยู่ในคอลัมน์ปลายทางของแถวพื้นช่วง
        const title = toStr(grid[h.row - 2]?.[h.col]) || toStr(grid[h.row - 1]?.[h.col]);
        const label = title || `ตารางย่อย แถว ${h.row + 1}`;

        if (bandCols.length < 2) {
            issues.push({
                kind: 'side-table-unreadable',
                message: `พบตารางย่อย "${label}" (แถว ${h.row + 1} คอลัมน์ ${h.col + 1}) แต่อ่านช่วงราคาน้ำมันไม่ได้ จึงยังไม่ได้นำเข้า`,
                rows: [],
            });
            return;
        }

        // ประเภทรถเขียนซ้ำทุกคอลัมน์ในแถวหัวตาราง เอาช่องแรกที่มีข้อความ
        const truckType = bandCols.map(bc => toStr(grid[h.row]?.[bc.col])).find(Boolean) ?? '';

        for (let i = h.row + 1; i < endRow; i++) {
            const r = grid[i];
            if (!r) continue;

            const dest = toStr(r[h.col]);
            if (!dest || dest === title) continue;   // แถวว่าง หรือแถวชื่อตารางของบล็อกถัดไป

            const values = bandCols.map(bc => toNum(r[bc.col])).filter((v): v is number => v !== null);
            // แถวตัวคูณ (0.94) และแถวขอบช่วง (30, 31.99) ของบล็อกถัดไปมีแต่เลขเล็ก ๆ ไม่ใช่ค่าขนส่ง
            // ปล่อยแถวที่เป็น 0 ผ่านไป เพราะ 0 = ยังไม่ตกลงราคา ต้องถูกรายงาน ไม่ใช่ถูกทิ้ง
            if (values.length && values.every(v => v > 0 && v < MIN_FREIGHT_PRICE)) continue;

            rows.push({
                seq: seqStart + rows.length,
                // ตารางย่อยไม่มีคอลัมน์บริษัท ใช้ "หัวเรื่องที่เขียนไว้ในไฟล์" แทน
                // จะได้กรอง/จับคู่ได้ และแยกจากตารางหลักที่เป็นคนละคู่สัญญา
                // ถ้าไฟล์ไม่ได้เขียนหัวเรื่องไว้ ปล่อยว่าง — ป้ายที่ parser ตั้งเองใช้ได้แค่ section
                company: title,
                origin: '',         // ไฟล์ไม่ได้ระบุต้นทางไว้
                destination: dest,
                truckType,
                note: '',
                section: label,
                bands: bandCols.map(bc => {
                    const v = toNum(r[bc.col]);
                    return { fuelFrom: bc.from, fuelTo: bc.to, price: v === null ? null : cleanPrice(v) };
                }),
            });
        }
    });

    return { rows, issues };
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

    // บรรทัดกำกับของแบบฟอร์มอยู่เหนือหัวตาราง — ใช้บอกว่าควรตรวจชื่อกับทะเบียนของระบบไหม
    const isTemplate = grid.slice(0, 6)
        .some(r => (r || []).some(v => toStr(v).includes(TEMPLATE_MARKER)));

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
    const cNote = colOf('หมายเหตุ');

    // "ประเภทรถ" อาจอยู่คนละแถวกับ "ต้นทาง" — ไฟล์แบบที่สองวางไว้ใต้ลงมา 2 แถว
    let cTruck = colOf('ประเภทรถ');
    let truckRowOffset = 0;
    if (cTruck === -1) {
        for (let off = 1; off <= 3 && headerIdx + off < grid.length; off++) {
            const idx = grid[headerIdx + off].map(toStr).findIndex(h => h.includes('ประเภทรถ'));
            if (idx !== -1) { cTruck = idx; truckRowOffset = off; break; }
        }
    }

    // ไฟล์ที่ไม่มีคอลัมน์ "บริษัท" (เช่น รถร่วม วสรรณ์) เขียนชื่อคู่สัญญาไว้ที่ชื่อชีตแทน
    // เช่นชีต "รถร่วมคุณหนึ่ง" — ใช้ค่านั้นเป็นชื่อบริษัท ยกเว้นชื่อชีตเริ่มต้นของ Excel
    // ที่ไม่ได้บอกอะไร (Sheet1 / แผ่นงาน1 / ชีต1) กรณีนั้นปล่อยว่างไว้เหมือนเดิม
    const genericSheet = /^(sheet|worksheet|แผ่นงาน|แผ่น|ชีต|ชีท)\s*\d*$/i.test(sheetName);
    const sheetCompany = cCompany === -1 && !genericSheet ? sheetName : '';

    // ไม่นับคอลัมน์หมายเหตุเป็นขอบของโซนป้าย เพราะบางไฟล์วางหมายเหตุไว้ "ท้ายสุด"
    // ถ้านับด้วย จุดเริ่มหาช่วงราคาจะกระโดดข้ามช่วงราคาไปหมด แล้วอ่านไฟล์ไม่ได้เลย
    // ส่วนหมายเหตุที่อยู่กลางตาราง (เช่นในแบบฟอร์ม) ไม่กวน เพราะช่องนั้นเป็นข้อความ
    // และแถวขอบช่วงด้านบนก็ว่าง — findFirstBandCol จึงข้ามไปเอง
    const labelCols = Math.max(cCompany, cOrigin, cDest, cTruck, cSeq) + 1;
    const dataIdx = findFirstDataRow(grid, headerIdx + truckRowOffset, cOrigin, cDest);
    if (dataIdx === -1) {
        // แยกข้อความให้ตรงกับสิ่งที่ผู้ใช้ทำผิด — อัปโหลดแบบฟอร์มเปล่าเป็นเรื่องที่เกิดได้บ่อย
        throw new Error(isTemplate
            ? 'แบบฟอร์มนี้ยังไม่ได้กรอกข้อมูลเส้นทาง — กรอกในชีต "กรอกเรท" ตั้งแต่แถวที่ 8 ก่อนอัปโหลด'
            : 'ไม่พบแถวข้อมูลเส้นทางในไฟล์ — ตรวจสอบว่าเลือกไฟล์ถูกหรือไม่');
    }
    const firstBand = findFirstBandCol(grid, headerIdx, dataIdx, labelCols);
    if (firstBand === -1) {
        throw new Error('ไม่พบคอลัมน์ช่วงราคาน้ำมันในไฟล์');
    }

    // ขอบช่วงอาจอยู่แถวหัว หรือแถวรอบ ๆ (บางไฟล์แยกพื้น/เพดานคนละแถว)
    // ต้องอยู่ "เหนือแถวข้อมูลแรก" เท่านั้น — ถ้าเผลอรวมแถวข้อมูลเข้ามา ค่าขนส่ง
    // (เช่น 13500) จะถูกอ่านเป็นเพดานช่วง แล้วช่วงนั้นจะครอบคลุมราคาน้ำมันทุกค่า
    //
    // แบบฟอร์มที่ระบบสร้างให้วางแถวพื้นและแถวเพดานไว้เหนือหัวตารางทั้งคู่ (คนกรอกอ่านง่ายกว่า)
    // แถวหัวตารางจึงไม่มีตัวเลขในช่องช่วงราคาเลย — กรณีนั้นค่อยนับแถว headerIdx-2 เข้ามาด้วย
    // ไม่นับพร่ำเพรื่อ เพราะไฟล์อื่นอาจมีตัวเลขอย่างปี พ.ศ. ลอยอยู่เหนือหัวตาราง
    const headerHasEdges = (grid[headerIdx] || [])
        .some((v, c) => c >= firstBand && toNum(v) !== null);
    const edgeRowIdx = headerHasEdges
        ? [headerIdx - 1, headerIdx, headerIdx + 1, dataIdx - 2, dataIdx - 1]
        : [headerIdx - 2, headerIdx - 1, headerIdx, headerIdx + 1, dataIdx - 2, dataIdx - 1];
    const edgeRows = edgeRowIdx
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
    // แถวข้อมูลแรกอาจเว้นช่วงต้น ๆ ว่างไว้ (แบบฟอร์มอนุญาตให้เว้นช่วงที่ยังไม่ตกลงราคา)
    // ทำให้ firstBand ที่หาจากแถวนั้นเริ่มช้าไป แล้วช่วงแรกจะหายไปทั้งไฟล์ รวมถึงแถวอื่นที่มีราคา
    // จึงถอยกลับไปเก็บคอลัมน์ซ้ายมือที่ยังมีขอบช่วงครบทั้งพื้นและเพดาน และค่าน้อยกว่าช่วงแรก
    for (let c = firstBand - 1; c >= labelCols; c--) {
        const edges = edgeRows.map(r => toNum(r[c])).filter((x): x is number => x !== null);
        if (edges.length < 2) break;              // ไม่ใช่คอลัมน์ช่วงราคา
        const from = Math.min(...edges);
        if (!bandCols.length || from >= bandCols[0].from) break;
        bandCols.unshift({ col: c, from, to: Math.max(...edges) });
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
        if (isNoteRow(r, origin, dest, bandCols)) continue;

        // บริษัทเว้นว่างในแถวถัดมา = ใช้ค่าจากแถวก่อนหน้า (merge cell ใน Excel)
        const company = toStr(cCompany >= 0 ? r[cCompany] : '') || lastCompany || sheetCompany;
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
            note: toStr(cNote >= 0 ? r[cNote] : ''),
            bands,
        });
    }

    // ── ตารางย่อยที่วางไว้ทางขวาของตารางหลัก (ถ้ามี) ──
    // เริ่มไล่หาจากคอลัมน์ถัดจากช่วงราคาสุดท้ายของตารางหลัก จะได้ไม่อ่านตารางหลักซ้ำ
    const lastMainCol = bandCols[bandCols.length - 1].col;
    const side = parseSideTables(grid, lastMainCol + 1, rows.length + 1);
    rows.push(...side.rows);
    issues.push(...side.issues);

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

    // กุญแจตรวจซ้ำต้องรวมสองอย่างนี้ด้วย ไม่งั้นจะเตือนทั้งที่ไม่ใช่ปัญหา
    //   - ชื่อตารางย่อย: คนละใบวางบิลมีปลายทางซ้ำกันได้ตามปกติ
    //   - หมายเหตุ: แบบฟอร์มบอกให้แยกแถวแล้วเขียนเงื่อนไขที่ต่างกันไว้ในช่องนี้
    //     (เช่น พิกัดน้ำหนัก) หมายเหตุจึงเป็นตัวแยกที่ตั้งใจ ไม่ใช่ข้อมูลซ้ำ
    const routeKey = (r: FuelRateRow) =>
        `${r.section ?? ''}|${r.company}|${r.origin}|${r.destination}|${r.truckType}|${r.note}`;
    const byRoute = new Map<string, number[]>();
    rows.forEach((r, i) => {
        const k = routeKey(r);
        byRoute.set(k, [...(byRoute.get(k) || []), i]);
    });
    const duplicates = [...byRoute.values()].filter(idxs => idxs.length > 1).flat();

    const describe = (idx: number) => {
        const r = rows[idx];
        // แถวจากตารางย่อยไม่มีบริษัทและต้นทาง จึงใช้ชื่อตารางนำ เพื่อให้รู้ว่าปัญหาอยู่ตารางไหน
        const head = r.section || r.company;
        const route = r.origin ? `${r.origin} → ${r.destination}` : r.destination;
        return [head, route, r.truckType].filter(Boolean).join(' | ');
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

    return { rows, issues, layout, sheetName, isTemplate };
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
