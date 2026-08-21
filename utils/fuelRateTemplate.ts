import * as XLSX from 'xlsx';
import { TEMPLATE_MARKER, type FuelRateRow, type ParseIssue } from './fuelRateParser';

/**
 * แบบฟอร์มตารางเรทค่าขนส่งตามราคาน้ำมัน — ไฟล์ที่ให้หน่วยงานอัตราจ้างดาวน์โหลดไปกรอก
 *
 * ทำไมต้องมีแบบฟอร์ม: ไฟล์ที่หน่วยงานส่งมาเองเขียนชื่อคนละภาษากับระบบ
 * ("YSK TRANSPORT" กับ "YSK", "4wj (บรรทุก 3001 - 3500 กก.)" กับ "4w") ระบบจึงจับคู่
 * กับงานจริงไม่ได้ ถ้าเริ่มจากแบบฟอร์มที่มีทะเบียนชื่อแนบมาด้วย ปัญหานี้หายไปตั้งแต่ต้นทาง
 *
 * ข้อจำกัดที่ต้องรู้: ไลบรารี xlsx รุ่นที่ใช้อยู่ "เขียน dropdown ในเซลล์ไม่ได้"
 * แบบฟอร์มจึงแนบทะเบียนชื่อมาเป็นชีตให้คัดลอก แล้วไปบังคับจริงตอนอัปโหลดด้วย
 * `checkAgainstMaster()` ซึ่งกันได้แน่นอนกว่า เพราะ dropdown ใน Excel ถูก paste ทับได้อยู่ดี
 *
 * โครงของชีต "กรอกเรท" ต้องเข้ากับ `parseFuelRateWorkbook()` ได้โดยไม่ต้องมีตัวอ่านแยก:
 *   แถว 1  ข้อความกำกับแบบฟอร์ม (ใช้ตรวจว่าไฟล์นี้มาจากแบบฟอร์มของเรา)
 *   แถว 2-3 วิธีกรอกโดยย่อ
 *   แถว 5  ช่วงราคาน้ำมัน — ตั้งแต่
 *   แถว 6  ช่วงราคาน้ำมัน — ถึง
 *   แถว 7  หัวตาราง (ช่องช่วงราคาเว้นว่างไว้ ไม่งั้นตัวอ่านจะนับแถวนี้เป็นขอบช่วง)
 *   แถว 8+ ข้อมูลเส้นทาง
 */

/** ชื่อชีตที่ใช้กรอก — `parseFuelRateWorkbook` อ่านชีตแรกเสมอ ชีตนี้จึงต้องอยู่หน้าสุด */
export const TEMPLATE_SHEET = 'กรอกเรท';
export const TEMPLATE_VERSION = 'v1';

/** ทะเบียนชื่อของระบบที่แบบฟอร์มแนบไปให้เลือก */
export interface RateMaster {
    subcontractors: string[];
    truckTypes: string[];
    locations: string[];
}

export interface TemplateOptions {
    /** ช่วงราคาน้ำมันตั้งต้น — หน่วยงานแก้เองได้ ถ้าใช้ช่วงอื่น */
    bands?: { from: number; to: number }[];
    /** จำนวนแถวเปล่าที่เตรียมไว้ให้กรอก */
    blankRows?: number;
}

/** ช่วงตั้งต้น 30–61.99 บาท ทีละ 2 บาท — ตามไฟล์ที่หน่วยงานใช้อยู่จริง */
const defaultBands = (): { from: number; to: number }[] =>
    Array.from({ length: 16 }, (_, i) => ({ from: 30 + i * 2, to: 30 + i * 2 + 1.99 }));

const LABELS = ['ลำดับ', 'บริษัท', 'ต้นทาง', 'ปลายทาง', 'ประเภทรถ', 'หมายเหตุ'];
const PAD = LABELS.map(() => null);

type Cell = string | number | null;

/** แถวหัวของโซนกรอก (บรรทัดกำกับ + วิธีใช้ + ขอบช่วง + หัวตาราง) */
const formHead = (bands: { from: number; to: number }[]): Cell[][] => [
    [`${TEMPLATE_MARKER} (นีโอสยาม) ${TEMPLATE_VERSION}`],
    ['กรอกช่วงราคาน้ำมันในแถวที่ 5 และ 6 · กรอกข้อมูลเส้นทางตั้งแต่แถวที่ 8 ลงไป'],
    ['ชื่อผู้รับจ้าง สถานที่ และประเภทรถ ต้องคัดลอกจากชีต "รายการที่เลือกได้" · ช่วงที่ยังไม่ตกลงราคา ให้เว้นว่าง ห้ามใส่ 0'],
    [],
    ['ช่วงราคาน้ำมัน — ตั้งแต่ (บาท/ลิตร)', ...PAD.slice(1), ...bands.map(b => b.from)],
    ['ช่วงราคาน้ำมัน — ถึง (บาท/ลิตร)', ...PAD.slice(1), ...bands.map(b => b.to)],
    // ช่องช่วงราคาในแถวหัวตารางต้องว่าง — ตัวอ่านใช้ข้อนี้แยกว่าขอบช่วงอยู่สองแถวข้างบน
    [...LABELS, ...bands.map(() => null)],
];

/**
 * สร้างไฟล์แบบฟอร์มเปล่า พร้อมทะเบียนชื่อและตัวอย่างการกรอก
 * คืนค่าเป็น ArrayBuffer เพื่อให้ฝั่งเว็บเอาไปสร้างลิงก์ดาวน์โหลดได้ทันที
 */
export function buildFuelRateTemplate(master: RateMaster, options: TemplateOptions = {}): ArrayBuffer {
    const bands = options.bands?.length ? options.bands : defaultBands();
    const blankRows = options.blankRows ?? 40;
    const wb = XLSX.utils.book_new();

    const bandWidths = bands.map(() => ({ wch: 13 }));
    const labelWidths = [{ wch: 7 }, { wch: 22 }, { wch: 26 }, { wch: 26 }, { wch: 14 }, { wch: 22 }];

    // ── ชีต 1: กรอกเรท ──
    const blanks: Cell[][] = Array.from({ length: blankRows }, (_, i) =>
        [i + 1, ...PAD.slice(1), ...bands.map(() => null)]);
    const form = XLSX.utils.aoa_to_sheet([...formHead(bands), ...blanks]);
    form['!cols'] = [...labelWidths, ...bandWidths];
    XLSX.utils.book_append_sheet(wb, form, TEMPLATE_SHEET);

    // ── ชีต 2: ตัวอย่างการกรอก ──
    const sample = (seq: number, sub: string, from: string, to: string, truck: string, note: string, first: number, step: number): Cell[] =>
        [seq, sub, from, to, truck, note, ...bands.map((_, i) => first + step * i)];
    const example = XLSX.utils.aoa_to_sheet([
        ...formHead(bands),
        sample(1, master.subcontractors[0] ?? 'KNN', master.locations[0] ?? 'ต้นทาง ก', master.locations[1] ?? 'ปลายทาง ข', master.truckTypes[0] ?? '4w', '', 5000, 100),
        sample(2, master.subcontractors[0] ?? 'KNN', master.locations[0] ?? 'ต้นทาง ก', master.locations[2] ?? 'ปลายทาง ค', master.truckTypes[1] ?? '6w', 'บรรทุกไม่เกิน 5 ตัน', 8000, 150),
        [3, master.subcontractors[0] ?? 'KNN', master.locations[0] ?? 'ต้นทาง ก', master.locations[3] ?? 'ปลายทาง ง', master.truckTypes[1] ?? '6w', 'ยังไม่ตกลงราคา 2 ช่วงแรก',
            null, null, ...bands.slice(2).map((_, i) => 9000 + 150 * i)],
    ]);
    example['!cols'] = [...labelWidths, ...bandWidths];
    XLSX.utils.book_append_sheet(wb, example, 'ตัวอย่างการกรอก');

    // ── ชีต 3: รายการที่เลือกได้ ──
    const depth = Math.max(master.subcontractors.length, master.truckTypes.length, master.locations.length);
    const listRows: Cell[][] = [
        ['คัดลอกชื่อจากชีตนี้ไปวางในชีต "กรอกเรท" เท่านั้น — ชื่อที่ไม่ตรงกับรายการนี้ ระบบจะเตือนตอนอัปโหลด'],
        [],
        ['ผู้รับจ้าง (คอลัมน์ "บริษัท")', 'ประเภทรถ', 'สถานที่ (ใช้ได้ทั้งต้นทางและปลายทาง)'],
        ...Array.from({ length: depth }, (_, i) => [
            master.subcontractors[i] ?? null,
            master.truckTypes[i] ?? null,
            master.locations[i] ?? null,
        ]),
    ];
    const lists = XLSX.utils.aoa_to_sheet(listRows);
    lists['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 44 }];
    XLSX.utils.book_append_sheet(wb, lists, 'รายการที่เลือกได้');

    // ── ชีต 4: วิธีใช้ ──
    const howto = XLSX.utils.aoa_to_sheet([
        ['วิธีกรอกแบบฟอร์มตารางเรทค่าขนส่ง'],
        [],
        ['1.', 'กรอกเฉพาะชีต "กรอกเรท" ชีตอื่นเป็นข้อมูลประกอบ ไม่ต้องแก้'],
        ['2.', 'ห้ามลบหรือสลับแถวที่ 1-7 และห้ามสลับลำดับคอลัมน์ ระบบใช้แถวเหล่านี้อ่านไฟล์'],
        ['3.', 'ถ้าใช้ช่วงราคาน้ำมันแบบอื่น ให้แก้ตัวเลขในแถวที่ 5 และ 6 เพิ่มหรือลดคอลัมน์ได้'],
        ['4.', 'ชื่อในคอลัมน์ บริษัท / ต้นทาง / ปลายทาง / ประเภทรถ ต้องคัดลอกจากชีต "รายการที่เลือกได้"'],
        ['5.', 'ค่าขนส่งกรอกเป็นตัวเลขอย่างเดียว ไม่ต้องใส่เครื่องหมายจุลภาคหรือคำว่าบาท'],
        ['6.', 'ช่วงที่ยังไม่ได้ตกลงราคา ให้เว้นว่างไว้ ห้ามใส่ 0 เพราะระบบจะคิดเป็นค่าขนส่ง 0 บาท'],
        ['7.', 'เส้นทางเดียวกันแต่คนละเงื่อนไข (เช่น พิกัดน้ำหนัก) ให้แยกเป็นคนละแถว และเขียนเงื่อนไขในช่องหมายเหตุ'],
        ['8.', 'ถ้าราคาลดลงเมื่อราคาน้ำมันสูงขึ้น ระบบจะเตือน เพราะปกติต้องเพิ่มขึ้นหรือเท่าเดิม'],
        [],
        ['ดูตัวอย่างที่กรอกแล้วได้ที่ชีต "ตัวอย่างการกรอก"'],
    ]);
    howto['!cols'] = [{ wch: 5 }, { wch: 110 }];
    XLSX.utils.book_append_sheet(wb, howto, 'วิธีใช้');

    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** ตัดช่องว่างและตัวพิมพ์เล็กใหญ่ทิ้ง เพื่อเทียบชื่อแบบไม่จู้จี้เรื่องการเว้นวรรค */
const key = (s: string): string => s.replace(/\s+/g, '').toLowerCase();

/** ชื่อในทะเบียนที่ใกล้เคียงที่สุด — ใช้บอกใบ้ในข้อความเตือน ไม่ได้แก้ให้เอง */
const suggest = (value: string, master: string[]): string => {
    const k = key(value);
    if (!k) return '';
    const hit = master.find(m => key(m) === k)
        || master.find(m => key(m).includes(k) || k.includes(key(m)));
    return hit ?? '';
};

const describeUnknown = (values: Map<string, number[]>, master: string[]): string =>
    [...values.entries()].slice(0, 5).map(([v, rows]) => {
        const near = suggest(v, master);
        return `"${v}" (${rows.length} แถว)${near ? ` — ใกล้เคียงกับ "${near}"` : ''}`;
    }).join(' · ');

/**
 * ตรวจว่าชื่อในไฟล์ตรงกับทะเบียนของระบบหรือไม่ — ใช้กับไฟล์ที่กรอกจากแบบฟอร์มเท่านั้น
 *
 * ไฟล์ต้นฉบับของหน่วยงานใช้ชื่อคนละชุดอยู่แล้ว ถ้าเอามาตรวจด้วยจะเตือนทุกแถวจนอ่านไม่รู้เรื่อง
 * ที่นี่ "รายงานอย่างเดียว ไม่แก้ให้" ตามหลักเดียวกับตัวอ่านไฟล์ เพราะการเดาชื่อผิด
 * แปลว่าจับคู่ราคาผิดคู่สัญญา ซึ่งกลายเป็นเงินจริงที่จ่ายผิด
 */
export function checkAgainstMaster(rows: FuelRateRow[], master: RateMaster): ParseIssue[] {
    const issues: ParseIssue[] = [];

    const check = (
        kind: ParseIssue['kind'],
        pick: (r: FuelRateRow) => string[],
        list: string[],
    ) => {
        const unknown = new Map<string, number[]>();
        const blank: number[] = [];
        rows.forEach((r, i) => {
            for (const value of pick(r)) {
                // ช่องว่างก็ต้องรายงาน — แถวที่ไม่มีชื่อผู้รับจ้างหรือประเภทรถ จับคู่กับงานไม่ได้เลย
                if (!value.trim()) { blank.push(i); continue; }
                if (list.some(m => key(m) === key(value))) continue;
                unknown.set(value, [...(unknown.get(value) ?? []), i]);
            }
        });
        if (!unknown.size && !blank.length) return;

        const parts: string[] = [];
        if (blank.length) parts.push(`ยังไม่ได้กรอก ${new Set(blank).size} แถว`);
        if (unknown.size) parts.push(`ไม่ตรงกับทะเบียนของระบบ ${unknown.size} ชื่อ: ${describeUnknown(unknown, list)}`);
        issues.push({
            kind,
            message: parts.join(' · '),
            rows: [...new Set([...blank, ...[...unknown.values()].flat()])].sort((a, b) => a - b),
        });
    };

    check('unknown-subcontractor', r => [r.company], master.subcontractors);
    check('unknown-truck-type', r => [r.truckType], master.truckTypes);
    check('unknown-location', r => [r.origin, r.destination], master.locations);

    return issues;
}
