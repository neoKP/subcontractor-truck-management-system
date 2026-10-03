import { TEMPLATE_MARKER, hasBandPrice, type FuelRateRow, type ParseIssue } from './fuelRateParser';
import { COLOR, FONT, SIZE } from './excelReport';

/**
 * แบบฟอร์มตารางเรทค่าขนส่งตามราคาน้ำมัน — ไฟล์ที่ให้หน่วยงานอัตราจ้างดาวน์โหลดไปกรอก
 *
 * ทำไมต้องมีแบบฟอร์ม: ไฟล์ที่หน่วยงานส่งมาเองเขียนชื่อคนละภาษากับระบบ
 * ("YSK TRANSPORT" กับ "YSK", "4wj (บรรทุก 3001 - 3500 กก.)" กับ "4w") ระบบจึงจับคู่
 * กับงานจริงไม่ได้ ถ้าเริ่มจากแบบฟอร์มที่มีทะเบียนชื่อในตัว ปัญหานี้หายไปตั้งแต่ต้นทาง
 *
 * กันชื่อผิดสองชั้น
 *   1. ในไฟล์ — ช่องชื่อเป็นรายการให้เลือก (dropdown)
 *   2. ตอนอัปโหลด — `checkAgainstMaster()` ตรวจซ้ำ เพราะรายการเลือกใน Excel ถูก paste ทับได้
 *      แต่ dropdown ถูกข้ามได้ด้วยการวาง (paste) ชั้นที่สองจึงเป็นชั้นที่เชื่อถือได้จริง
 *
 * โครงของชีต "กรอกเรท" ต้องเข้ากับ `parseFuelRateWorkbook()` โดยไม่ต้องมีตัวอ่านแยก
 * ห้ามสลับแถวเหล่านี้:
 *   แถว 1  ข้อความกำกับแบบฟอร์ม (ใช้ตรวจว่าไฟล์นี้มาจากแบบฟอร์มของเรา)
 *   แถว 2-3 วิธีกรอกโดยย่อ
 *   แถว 5  ช่วงราคาน้ำมัน — ตั้งแต่
 *   แถว 6  ช่วงราคาน้ำมัน — ถึง
 *   แถว 7  หัวตาราง (ช่องช่วงราคาเว้นว่างไว้ ไม่งั้นตัวอ่านจะนับแถวนี้เป็นขอบช่วง)
 *   แถว 8+ ข้อมูลเส้นทาง
 */

/** ชื่อชีตที่ใช้กรอก — `parseFuelRateWorkbook` อ่านชีตแรกเสมอ ชีตนี้จึงต้องอยู่หน้าสุด */
export const TEMPLATE_SHEET = 'กรอกเรท';
export const TEMPLATE_VERSION = 'v3';
const LIST_SHEET = 'รายการที่เลือกได้';
const EXAMPLE_SHEET = 'ตัวอย่างการกรอก';

/** แถวแรกของข้อมูลในชีตกรอกเรท (นับแบบ Excel) — ตัวอ่านไฟล์ผูกกับโครงนี้ */
const FIRST_DATA_ROW = 8;
/** แถวแรกของรายชื่อในชีตทะเบียน (นับแบบ Excel) */
const LIST_FIRST_ROW = 4;

/** ทะเบียนชื่อของระบบที่แบบฟอร์มแนบไปให้เลือก */
export interface RateMaster {
    subcontractors: string[];
    truckTypes: string[];
    locations: string[];
}

export interface TemplateOptions {
    /** ชุดช่วงราคาน้ำมันที่จะใช้ — ไม่ระบุ = ตารางหลัก */
    bandSet?: BandSetId;
    /** ช่วงราคาน้ำมันเอง (ทับ bandSet) — หน่วยงานแก้ในไฟล์เองได้เช่นกัน */
    bands?: { from: number; to: number }[];
    /** จำนวนแถวเปล่าที่เตรียมไว้ให้กรอก (รายการเลือกครอบเท่านี้) */
    blankRows?: number;
}

/**
 * ชุดช่วงราคาน้ำมันที่หน่วยงานใช้อยู่จริง
 *
 * ไฟล์ "รถร่วม วสรรณ์" มีสองตารางที่ใช้ช่วงคนละชุด ต่างกันที่จุดเริ่ม 1.01 บาท
 * ถ้าให้แบบฟอร์มเดียวครอบทั้งคู่ คนกรอกต้องพิมพ์หัวตารางใหม่ทุกครั้งที่ใช้ผิดชุด
 * และถ้าลืมแก้ ราคาจะถูกผูกกับช่วงผิด — ค่าขนส่งเพี้ยนตั้งแต่ต้นทาง
 * จึงแยกเป็นสองแบบฟอร์มให้เลือกดาวน์โหลดแทน
 */
export type BandSetId = 'main' | 'sunlee';

export interface BandSet {
    id: BandSetId;
    /** ชื่อที่แสดงบนปุ่มดาวน์โหลด */
    label: string;
    /** อธิบายว่าใช้กับตารางไหน */
    description: string;
    bands: { from: number; to: number }[];
}

/** สร้างช่วงกว้าง 2 บาทต่อเนื่องกัน จากจุดเริ่มที่กำหนด */
const makeBands = (start: number, count: number): { from: number; to: number }[] =>
    Array.from({ length: count }, (_, i) => ({
        from: Math.round((start + i * 2) * 100) / 100,
        to: Math.round((start + i * 2 + 1.99) * 100) / 100,
    }));

export const BAND_SETS: Record<BandSetId, BandSet> = {
    // ตารางหลักของไฟล์ "รถร่วม วสรรณ์" — เรทที่ใช้จ่ายจริง
    main: {
        id: 'main',
        label: 'เริ่ม 28.99 บาท',
        description: 'ตารางหลัก · 17 ช่วง (28.99–62.98)',
        bands: makeBands(28.99, 17),
    },
    // ตารางย่อยที่วางไว้ทางขวาในไฟล์เดียวกัน
    sunlee: {
        id: 'sunlee',
        label: 'เริ่ม 30.00 บาท',
        description: 'ตารางนีโอสยาม วางบิล sunlee · 16 ช่วง (30.00–61.99)',
        bands: makeBands(30, 16),
    },
};

/** ใช้ตารางหลักเป็นค่าตั้งต้น เพราะเป็นเรทที่ใช้จ่ายจริง */
const defaultBands = (): { from: number; to: number }[] => BAND_SETS.main.bands;

const LABELS = ['ลำดับ', 'บริษัท', 'ต้นทาง', 'ปลายทาง', 'ประเภทรถ', 'หมายเหตุ'];
const LABEL_WIDTH = [7, 22, 26, 26, 14, 22];

type Cell = string | number | null;

/** อ้างช่วงในชีตอื่นสำหรับสูตร Excel — ชื่อชีตภาษาไทยต้องอยู่ในเครื่องหมายคำพูดเดี่ยว */
const listRange = (col: string, count: number): string =>
    `'${LIST_SHEET}'!$${col}$${LIST_FIRST_ROW}:$${col}$${LIST_FIRST_ROW + Math.max(count, 1) - 1}`;

/**
 * รวมช่วงราคาน้ำมันที่ "มีอยู่จริงในข้อมูล" ออกมาเป็นชุดเดียว เรียงจากถูกไปแพง
 *
 * ทำไมไม่ใช้ BAND_SETS ตรง ๆ: ข้อมูลจริงมาจากหลายหน่วยงานที่ใช้ช่วงคนละชุด
 * (ตารางหลักเริ่ม 28.99 · sunlee เริ่ม 30.00) ถ้าเลือกชุดใดชุดหนึ่งมาตายตัว
 * อีกชุดจะกลายเป็นช่องว่างทั้งแถบ ทั้งที่จริง ๆ มีราคาอยู่
 *
 * จึงไล่จากข้อมูลจริงแทน ได้กี่ช่วงก็เท่านั้น ไม่เดาแทนหน่วยงาน
 */
export function collectBands(rows: FuelRateRow[]): { from: number; to: number }[] {
    const seen = new Map<string, { from: number; to: number }>();
    for (const r of rows) {
        for (const b of r.bands) {
            // ปัดทศนิยม 2 ตำแหน่งก่อนทำกุญแจ กัน 28.990000001 กลายเป็นคนละช่วง
            const from = Math.round(b.fuelFrom * 100) / 100;
            const to = Math.round(b.fuelTo * 100) / 100;
            const key = `${from}-${to}`;
            if (!seen.has(key)) seen.set(key, { from, to });
        }
    }
    return [...seen.values()].sort((a, b) => a.from - b.from || a.to - b.to);
}

/**
 * ส่งออกเรทที่ระบบเก็บไว้ ให้หน้าตาเหมือนแบบฟอร์มที่หน่วยงานกรอกมา
 *
 * ทำไมต้องเหมือนแบบฟอร์ม: คนที่เปิดไฟล์นี้คือคนกลุ่มเดียวกับที่กรอกแบบฟอร์ม
 * ถ้าคนละหน้าตา เขาต้องแปลงสายตาเองทุกครั้งว่าคอลัมน์ไหนคือช่วงราคาไหน
 * และเทียบกับไฟล์ที่ส่งมาไม่ได้ทันที · ไฟล์ที่ออกไปจึงกรอกต่อแล้วอัปกลับเข้าระบบได้เลย
 *
 * ต่างจากแบบฟอร์มเปล่าตรงที่ใส่ราคาที่มีอยู่แล้วลงไปให้ และไม่มีรายการเลือก
 * (dropdown) เพราะไฟล์นี้ไว้ "อ่านและตรวจ" เป็นหลัก
 */
export async function buildFuelRateExport(
    rows: FuelRateRow[],
    meta: { dieselPrice: number; effectiveDate?: string; sourceFile?: string; uploadedAt?: string },
): Promise<ArrayBuffer> {
    const ExcelJS = (await import('exceljs')).default;
    const bands = collectBands(rows);
    const lastCol = LABELS.length + bands.length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ระบบจัดการรถร่วม';

    const ws = wb.addWorksheet('เรทค่าขนส่ง');

    // ── หัวไฟล์: โครงเดียวกับแบบฟอร์ม (แถว 1 กำกับ · 2-3 คำอธิบาย · 4 ว่าง · 5-6 ขอบช่วง · 7 หัวตาราง) ──
    /*
      ต้องขึ้นต้นด้วย TEMPLATE_MARKER เหมือนแบบฟอร์มเปล่า

      ตอนอัปโหลด ระบบจะตรวจชื่อบริษัท/ประเภทรถ/สถานที่กับทะเบียน (checkAgainstMaster)
      ก็ต่อเมื่อเจอข้อความกำกับนี้ในหัวไฟล์เท่านั้น · ถ้าไฟล์ที่ export ไปไม่มีคำนี้
      คนแก้ไฟล์แล้วอัปกลับจะข้ามการตรวจชื่อไปเงียบ ๆ ชื่อที่พิมพ์ผิดจะหลุดเข้าระบบ
      แล้วจับคู่กับงานจริงไม่ได้ — ซึ่งเป็นปัญหาเดิมที่แบบฟอร์มตั้งใจแก้ตั้งแต่ต้น
    */
    const marker = ws.addRow([
        `${TEMPLATE_MARKER} (นีโอสยาม) ${TEMPLATE_VERSION} · ส่งออกจากระบบ ${new Date().toLocaleDateString('th-TH')}`,
    ]);
    ws.mergeCells(marker.number, 1, marker.number, lastCol);
    marker.height = 26;
    marker.getCell(1).font = { name: FONT, size: SIZE.title, bold: true, color: { argb: COLOR.headerText } };
    marker.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
    marker.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

    for (const text of [
        `${rows.length} เส้นทาง · ${bands.length} ช่วงราคาน้ำมัน · ไฟล์ต้นฉบับ: ${meta.sourceFile || '-'}`,
        `ราคาดีเซลที่ระบบใช้คิดอยู่ ${meta.dieselPrice.toFixed(2)} บาท/ลิตร`
            + `${meta.effectiveDate ? ` (มีผล ${meta.effectiveDate})` : ''}`
            + ' · ช่องที่เว้นว่าง = ยังไม่ได้ตกลงราคาในช่วงนั้น ไม่ใช่ 0 บาท',
    ]) {
        const row = ws.addRow([text]);
        ws.mergeCells(row.number, 1, row.number, lastCol);
        row.height = 18;
        row.getCell(1).font = { name: FONT, size: SIZE.subtitle, color: { argb: COLOR.subtitleText } };
        row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
        row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    }

    ws.addRow([]);

    const edgeStyle = (row: import('exceljs').Row) => {
        row.height = 20;
        row.eachCell({ includeEmpty: true }, (cell, i) => {
            if (i > lastCol) return;
            cell.font = { name: FONT, size: SIZE.body, bold: i <= LABELS.length, color: { argb: COLOR.text } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.totalBg } };
            cell.alignment = { vertical: 'middle', horizontal: i <= LABELS.length ? 'left' : 'center' };
            if (i > LABELS.length) cell.numFmt = '0.00';
        });
    };
    edgeStyle(ws.addRow(['ช่วงราคาน้ำมัน — ตั้งแต่ (บาท/ลิตร)', ...LABELS.slice(1).map(() => null), ...bands.map(b => b.from)]));
    edgeStyle(ws.addRow(['ช่วงราคาน้ำมัน — ถึง (บาท/ลิตร)', ...LABELS.slice(1).map(() => null), ...bands.map(b => b.to)]));

    const header = ws.addRow([...LABELS, ...bands.map(() => null)]);
    header.height = 26;
    header.eachCell({ includeEmpty: true }, (cell, i) => {
        if (i > lastCol) return;
        cell.font = { name: FONT, size: SIZE.header, bold: true, color: { argb: COLOR.headerText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    // ── ข้อมูลจริง ──
    // ทำดัชนีราคาต่อแถวไว้ก่อน เพื่อไม่ต้องไล่หาในทุกช่อง
    // 288 แถว × 33 ช่วง = 9,504 ช่อง ถ้าไล่เชิงเส้นทุกช่องจะช้าจนคนกดรู้สึกได้
    const cellsOf = (r: FuelRateRow): (number | null)[] => {
        const byKey = new Map<string, number>();
        for (const b of r.bands) {
            /*
              ข้ามช่วงที่ยังไม่มีราคา ทั้ง null และ 0 — ปล่อยเป็นช่องว่าง

              ไฟล์จริงของหน่วยงานใส่ 0 ในช่วงที่ยังไม่ได้ตกลงราคา (ไฟล์ล่าสุดมี 168 ช่อง)
              ซึ่ง findRateAt ก็ถือว่า "ไม่มีเรท" อยู่แล้ว ถ้าเขียน 0 ลงไฟล์ที่ส่งออก
              คนอ่านจะเห็นเป็น "ขนส่งฟรี" ซึ่งขัดกับหมายเหตุในหัวไฟล์เอง
              และขัดกับที่ระบบตีความ · ต้องว่างให้เหมือนกันทั้งสองกรณี
            */
            if (!hasBandPrice(b)) continue;
            const key = `${Math.round(b.fuelFrom * 100) / 100}-${Math.round(b.fuelTo * 100) / 100}`;
            byKey.set(key, b.price);
        }
        return bands.map(b => byKey.get(`${b.from}-${b.to}`) ?? null);
    };

    /*
      แถวข้อมูลแถวแรกต้องมีราคาอย่างน้อยหนึ่งช่อง ไม่งั้นไฟล์อัปกลับไม่ได้

      ตัวอ่านไฟล์หาว่า "คอลัมน์ช่วงราคาเริ่มตรงไหน" โดยดูจากแถวข้อมูลแถวแรก
      ถ้าแถวนั้นว่างทั้งแถว (เป็นเส้นทางที่ยังไม่ตกลงราคาสักช่วง) จะหาไม่เจอ
      แล้วโยน "ไม่พบคอลัมน์ช่วงราคาน้ำมันในไฟล์" ทั้งที่แถวอื่นมีราคาครบ

      จึงยกแถวที่มีราคาขึ้นมาไว้แถวแรก · ลำดับที่เหลือคงเดิม ไม่สลับข้อมูลของใคร
      (คอลัมน์ "ลำดับ" นับใหม่ตามที่แสดง จึงยังเรียง 1, 2, 3 ต่อเนื่องเสมอ)

      ข้อจำกัดที่เหลือ: ถ้าไม่มีราคาเลยสักแถวเดียวทั้งไฟล์ ก็ยังอัปกลับไม่ได้
      กรณีนั้นไม่ใช่ไฟล์ที่ควรอัปกลับอยู่แล้ว (ไม่มีอะไรให้บันทึก) และคนที่อยากได้
      ไฟล์เปล่าไว้กรอกควรกดปุ่ม "ดาวน์โหลดแบบฟอร์ม" ซึ่งมีรายการให้เลือกในตัว
    */
    const hasPrice = (r: FuelRateRow) => r.bands.some(hasBandPrice);
    const firstPriced = rows.findIndex(hasPrice);
    const ordered = firstPriced > 0
        ? [rows[firstPriced], ...rows.filter((_, i) => i !== firstPriced)]
        : rows;

    ordered.forEach((r, i) => {
        const row = ws.addRow([
            i + 1,
            r.company || '',
            r.origin || '',
            r.destination || '',
            r.truckType || '',
            // ตารางย่อยเป็นข้อมูลของระบบที่แบบฟอร์มเปล่าไม่มี — ต่อท้ายหมายเหตุไว้ไม่ให้หาย
            [r.note, r.section].filter(Boolean).join(' · '),
            ...cellsOf(r),
        ]);
        row.eachCell({ includeEmpty: true }, (cell, c) => {
            if (c > lastCol) return;
            cell.font = { name: FONT, size: SIZE.body, color: { argb: COLOR.text } };
            cell.alignment = { vertical: 'middle', horizontal: c <= LABELS.length ? 'left' : 'right' };
            if (c > LABELS.length) cell.numFmt = '#,##0.00';
        });
    });

    ws.columns.forEach((col, i) => {
        col.width = i < LABEL_WIDTH.length ? LABEL_WIDTH[i] : 13;
    });
    // ตรึงหัวตารางและคอลัมน์ชื่อ เหมือนแบบฟอร์ม — เลื่อนไปช่วงราคาไกล ๆ แล้วยังรู้ว่าแถวไหน
    ws.views = [{ state: 'frozen', xSplit: LABELS.length, ySplit: FIRST_DATA_ROW - 1 }];
    ws.autoFilter = {
        from: { row: FIRST_DATA_ROW - 1, column: 1 },
        to: { row: FIRST_DATA_ROW - 1 + rows.length, column: LABELS.length },
    };

    return await wb.xlsx.writeBuffer() as ArrayBuffer;
}

/**
 * สร้างไฟล์แบบฟอร์ม พร้อมทะเบียนชื่อ ตัวอย่างการกรอก และรายการให้เลือกในช่องชื่อ
 * คืนค่าเป็น ArrayBuffer เพื่อให้ฝั่งเว็บเอาไปสร้างลิงก์ดาวน์โหลดได้ทันที
 */
export async function buildFuelRateTemplate(
    master: RateMaster,
    options: TemplateOptions = {},
): Promise<ArrayBuffer> {
    const ExcelJS = (await import('exceljs')).default;
    const bandSet = BAND_SETS[options.bandSet ?? 'main'];
    const bands = options.bands?.length ? options.bands : bandSet.bands;
    // ไฟล์จริงของหน่วยงานมี 164 เส้นทาง — 100 แถวไม่พอ เผื่อไว้ให้เพิ่มเส้นทางได้อีก
    const blankRows = options.blankRows ?? 300;
    const lastRow = FIRST_DATA_ROW + blankRows - 1;
    const lastCol = LABELS.length + bands.length;

    const wb = new ExcelJS.Workbook();
    wb.creator = 'ระบบจัดการรถร่วม';

    /** วางหัวแบบฟอร์ม 7 แถวแรกให้เหมือนกันทั้งชีตกรอกจริงและชีตตัวอย่าง */
    const writeHead = (ws: import('exceljs').Worksheet) => {
        const marker = ws.addRow([
            `${TEMPLATE_MARKER} (นีโอสยาม) ${TEMPLATE_VERSION} · ${bandSet.description}`,
        ]);
        ws.mergeCells(marker.number, 1, marker.number, lastCol);
        marker.height = 26;
        marker.getCell(1).font = { name: FONT, size: SIZE.title, bold: true, color: { argb: COLOR.headerText } };
        marker.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
        marker.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        for (const text of [
            `กรอกช่วงราคาน้ำมันในแถวที่ 5 และ 6 · กรอกข้อมูลเส้นทางตั้งแต่แถวที่ ${FIRST_DATA_ROW} ลงไป`,
            'ช่องชื่อมีรายการให้เลือก (คลิกที่ช่องแล้วกดลูกศร) · ช่วงที่ยังไม่ตกลงราคา ให้เว้นว่าง ห้ามใส่ 0',
        ]) {
            const row = ws.addRow([text]);
            ws.mergeCells(row.number, 1, row.number, lastCol);
            row.height = 18;
            row.getCell(1).font = { name: FONT, size: SIZE.subtitle, color: { argb: COLOR.subtitleText } };
            row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
            row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        }

        ws.addRow([]);

        const edgeStyle = (row: import('exceljs').Row) => {
            row.height = 20;
            row.eachCell({ includeEmpty: true }, (cell, i) => {
                if (i > lastCol) return;
                cell.font = { name: FONT, size: SIZE.body, bold: i <= LABELS.length, color: { argb: COLOR.text } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.totalBg } };
                cell.alignment = { vertical: 'middle', horizontal: i <= LABELS.length ? 'left' : 'center' };
                if (i > LABELS.length) cell.numFmt = '0.00';
            });
        };
        edgeStyle(ws.addRow(['ช่วงราคาน้ำมัน — ตั้งแต่ (บาท/ลิตร)', ...LABELS.slice(1).map(() => null), ...bands.map(b => b.from)]));
        edgeStyle(ws.addRow(['ช่วงราคาน้ำมัน — ถึง (บาท/ลิตร)', ...LABELS.slice(1).map(() => null), ...bands.map(b => b.to)]));

        // ช่องช่วงราคาในแถวหัวตารางต้องว่าง — ตัวอ่านใช้ข้อนี้แยกว่าขอบช่วงอยู่สองแถวข้างบน
        const header = ws.addRow([...LABELS, ...bands.map(() => null)]);
        header.height = 26;
        header.eachCell({ includeEmpty: true }, (cell, i) => {
            if (i > lastCol) return;
            cell.font = { name: FONT, size: SIZE.header, bold: true, color: { argb: COLOR.headerText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        });

        ws.columns.forEach((col, i) => {
            col.width = i < LABEL_WIDTH.length ? LABEL_WIDTH[i] : 13;
        });
        ws.views = [{ state: 'frozen', xSplit: LABELS.length, ySplit: FIRST_DATA_ROW - 1 }];
    };

    // ── ชีต 1: กรอกเรท ──
    const form = wb.addWorksheet(TEMPLATE_SHEET);
    writeHead(form);
    for (let i = 0; i < blankRows; i++) {
        const row = form.addRow([i + 1, ...LABELS.slice(1).map(() => null), ...bands.map(() => null)]);
        row.eachCell({ includeEmpty: true }, (cell, c) => {
            if (c > lastCol) return;
            cell.font = { name: FONT, size: SIZE.body, color: { argb: COLOR.text } };
            cell.alignment = { vertical: 'middle', horizontal: c <= LABELS.length ? 'left' : 'right' };
            if (c > LABELS.length) cell.numFmt = '#,##0.00';
        });
    }

    // ── รายการให้เลือกในช่องชื่อ — เลือกได้เฉพาะที่มีในทะเบียน ──
    const validations: [string, string, number][] = [
        ['B', 'A', master.subcontractors.length],   // บริษัท → ผู้รับจ้าง
        ['C', 'C', master.locations.length],        // ต้นทาง → สถานที่
        ['D', 'C', master.locations.length],        // ปลายทาง → สถานที่
        ['E', 'B', master.truckTypes.length],       // ประเภทรถ → ประเภทรถ
    ];
    // ExcelJS รองรับการใส่รายการเลือกทีละช่วงตอนรันจริง แต่ไฟล์ .d.ts ไม่ได้ประกาศไว้
    // (index.d.ts คอมเมนต์บรรทัด dataValidations ทิ้ง) จึงประกาศชนิดเท่าที่ใช้เอง
    // ใช้แบบช่วงเพราะได้ 4 รายการ แทนที่จะเป็น 400 รายการถ้าไล่ใส่ทีละช่อง
    const rangedValidations = (form as unknown as {
        dataValidations: { add(range: string, validation: unknown): void };
    }).dataValidations;

    for (const [target, source, count] of validations) {
        rangedValidations.add(`${target}${FIRST_DATA_ROW}:${target}${lastRow}`, {
            type: 'list',
            allowBlank: true,
            formulae: [listRange(source, count)],
            showErrorMessage: true,
            // เตือนแต่ยังพิมพ์ต่อได้ ถ้าห้ามเด็ดขาดแล้วหน่วยงานมีชื่อใหม่จริง ๆ งานจะค้าง
            errorStyle: 'warning',
            errorTitle: 'ชื่อนี้ไม่มีในทะเบียนของระบบ',
            error: `กรุณาเลือกจากรายการ หรือดูชื่อที่ใช้ได้ในชีต "${LIST_SHEET}" — ถ้าต้องเพิ่มชื่อใหม่ กรุณาแจ้งนีโอสยามก่อน`,
        });
    }

    // ไม่ล็อกชีต — หน่วยงานอัตราจ้างเป็นคนภายนอก ถ้าเจอกล่องเตือน "แผ่นงานมีการป้องกัน"
    // ระหว่างกรอก เขามีแนวโน้มจะเลิกใช้แบบฟอร์มแล้วส่งไฟล์รูปแบบเดิมมาแทน
    // ซึ่งเสียมากกว่าความเสี่ยงที่หัวตารางจะถูกแก้ — ตัวอ่านตรวจหัวตารางตอนอัปโหลดอยู่แล้ว
    // และแจ้ง error ทันทีถ้าโครงไฟล์ผิด จึงไม่ต้องกันตั้งแต่ในไฟล์

    // ── ชีต 2: ตัวอย่างการกรอก ──
    const example = wb.addWorksheet(EXAMPLE_SHEET);
    writeHead(example);
    const sampleRows: Cell[][] = [
        [1, master.subcontractors[0] ?? 'KNN', master.locations[0] ?? 'ต้นทาง ก', master.locations[1] ?? 'ปลายทาง ข',
            master.truckTypes[0] ?? '4w', '', ...bands.map((_, i) => 5000 + 100 * i)],
        [2, master.subcontractors[0] ?? 'KNN', master.locations[0] ?? 'ต้นทาง ก', master.locations[2] ?? 'ปลายทาง ค',
            master.truckTypes[1] ?? '6w', 'บรรทุกไม่เกิน 5 ตัน', ...bands.map((_, i) => 8000 + 150 * i)],
        [3, master.subcontractors[0] ?? 'KNN', master.locations[0] ?? 'ต้นทาง ก', master.locations[3] ?? 'ปลายทาง ง',
            master.truckTypes[1] ?? '6w', 'ยังไม่ตกลงราคา 2 ช่วงแรก', null, null,
            ...bands.slice(2).map((_, i) => 9000 + 150 * i)],
    ];
    sampleRows.forEach((values, idx) => {
        const row = example.addRow(values);
        row.eachCell({ includeEmpty: true }, (cell, c) => {
            if (c > lastCol) return;
            cell.font = { name: FONT, size: SIZE.body, color: { argb: COLOR.text } };
            cell.alignment = { vertical: 'middle', horizontal: c <= LABELS.length ? 'left' : 'right' };
            if (c > LABELS.length) cell.numFmt = '#,##0.00';
            if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
        });
    });

    // ── ชีต 3: รายการที่เลือกได้ (เป็นแหล่งข้อมูลของรายการเลือกด้วย ห้ามสลับคอลัมน์) ──
    const lists = wb.addWorksheet(LIST_SHEET);
    const listHead = lists.addRow([`ชีตนี้เป็นแหล่งข้อมูลของรายการเลือกในชีต "${TEMPLATE_SHEET}" — กรุณาอย่าแก้ไขหรือสลับคอลัมน์`]);
    lists.mergeCells(listHead.number, 1, listHead.number, 3);
    listHead.getCell(1).font = { name: FONT, size: SIZE.subtitle, bold: true, color: { argb: COLOR.headerText } };
    listHead.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
    listHead.height = 24;
    lists.addRow([]);
    const listCols = lists.addRow(['ผู้รับจ้าง (คอลัมน์ "บริษัท")', 'ประเภทรถ', 'สถานที่ (ใช้ได้ทั้งต้นทางและปลายทาง)']);
    listCols.height = 22;
    listCols.eachCell(cell => {
        cell.font = { name: FONT, size: SIZE.header, bold: true, color: { argb: COLOR.headerText } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
    const depth = Math.max(master.subcontractors.length, master.truckTypes.length, master.locations.length);
    for (let i = 0; i < depth; i++) {
        const row = lists.addRow([
            master.subcontractors[i] ?? null,
            master.truckTypes[i] ?? null,
            master.locations[i] ?? null,
        ]);
        row.eachCell({ includeEmpty: true }, cell => {
            cell.font = { name: FONT, size: SIZE.body, color: { argb: COLOR.text } };
        });
    }
    lists.columns.forEach((col, i) => { col.width = [30, 16, 44][i] ?? 16; });
    lists.views = [{ state: 'frozen', ySplit: LIST_FIRST_ROW - 1 }];

    // ── ชีต 4: วิธีใช้ ──
    const howto = wb.addWorksheet('วิธีใช้');
    const howtoTitle = howto.addRow(['วิธีกรอกแบบฟอร์มตารางเรทค่าขนส่ง']);
    howto.mergeCells(howtoTitle.number, 1, howtoTitle.number, 2);
    howtoTitle.height = 26;
    howtoTitle.getCell(1).font = { name: FONT, size: SIZE.title, bold: true, color: { argb: COLOR.headerText } };
    howtoTitle.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
    howto.addRow([]);
    const steps = [
        `กรอกเฉพาะชีต "${TEMPLATE_SHEET}" ชีตอื่นเป็นข้อมูลประกอบ ไม่ต้องแก้`,
        'ห้ามลบหรือสลับแถวที่ 1-7 และห้ามสลับลำดับคอลัมน์ ระบบใช้แถวเหล่านี้อ่านไฟล์',
        'ถ้าใช้ช่วงราคาน้ำมันแบบอื่น ให้แก้ตัวเลขในแถวที่ 5 และ 6 เพิ่มหรือลดคอลัมน์ได้',
        'ช่อง บริษัท / ต้นทาง / ปลายทาง / ประเภทรถ ให้คลิกที่ช่องแล้วเลือกจากรายการที่ขึ้นมา',
        'ค่าขนส่งกรอกเป็นตัวเลขอย่างเดียว ไม่ต้องใส่เครื่องหมายจุลภาคหรือคำว่าบาท',
        'ช่วงที่ยังไม่ได้ตกลงราคา ให้เว้นว่างไว้ ห้ามใส่ 0 เพราะระบบจะคิดเป็นค่าขนส่ง 0 บาท',
        'เส้นทางเดียวกันแต่คนละเงื่อนไข (เช่น พิกัดน้ำหนัก) ให้แยกเป็นคนละแถว และเขียนเงื่อนไขในช่องหมายเหตุ',
        'ถ้าราคาลดลงเมื่อราคาน้ำมันสูงขึ้น ระบบจะเตือน เพราะปกติต้องเพิ่มขึ้นหรือเท่าเดิม',
        `ถ้าต้องใช้ชื่อที่ไม่มีในชีต "${LIST_SHEET}" กรุณาแจ้งนีโอสยามเพื่อเพิ่มชื่อก่อน อย่าพิมพ์ชื่อใหม่เอง`,
    ];
    steps.forEach((text, i) => {
        const row = howto.addRow([`${i + 1}.`, text]);
        row.height = 20;
        row.eachCell(cell => {
            cell.font = { name: FONT, size: SIZE.body, color: { argb: COLOR.text } };
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
        });
    });
    howto.addRow([]);
    const tail = howto.addRow(['', `ดูตัวอย่างที่กรอกแล้วได้ที่ชีต "${EXAMPLE_SHEET}"`]);
    tail.getCell(2).font = { name: FONT, size: SIZE.note, italic: true, color: { argb: COLOR.muted } };
    howto.columns.forEach((col, i) => { col.width = i === 0 ? 5 : 110; });

    return await wb.xlsx.writeBuffer() as ArrayBuffer;
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
