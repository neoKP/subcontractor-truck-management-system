import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { buildFuelRateExport, buildFuelRateTemplate, checkAgainstMaster, collectBands, TEMPLATE_SHEET, type RateMaster } from './fuelRateTemplate';
import { parseFuelRateWorkbook, findRateAt, TEMPLATE_MARKER, type FuelRateRow, type ParseResult } from './fuelRateParser';
import { MASTER_DATA as REAL_MASTER } from '../constants';

const MASTER: RateMaster = {
    subcontractors: ['KNN', 'YSK', 'รถร่วมคุณหนึ่ง'],
    truckTypes: ['4w', '6w', '10w'],
    locations: ['บางปะกง', 'เมืองนครสวรรค์', 'แม่สอด'],
};

/** แบบฟอร์มเปล่าใช้ซ้ำได้ทุกเทสต์ สร้างครั้งเดียวพอ */
let TEMPLATE: ArrayBuffer;
beforeAll(async () => { TEMPLATE = await buildFuelRateTemplate(MASTER); });

/** จำลองคนกรอกแบบฟอร์ม: เปิดไฟล์ที่ระบบสร้าง แล้วเติมข้อมูลต่อจากหัวตาราง */
const fillTemplate = (template: ArrayBuffer, dataRows: (string | number | null)[][]): ArrayBuffer => {
    const wb = XLSX.read(template, { type: 'array' });
    const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[TEMPLATE_SHEET], {
        header: 1, raw: true, defval: null,
    });
    const head = grid.slice(0, 7);   // แถว 1-7 = บรรทัดกำกับ + ขอบช่วง + หัวตาราง
    wb.Sheets[TEMPLATE_SHEET] = XLSX.utils.aoa_to_sheet([...head, ...dataRows]);
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
};

const parseFilled = (dataRows: (string | number | null)[][]): ParseResult =>
    parseFuelRateWorkbook(fillTemplate(TEMPLATE, dataRows));

/** จำนวนช่วงราคาน้ำมันตั้งต้นของแบบฟอร์ม — ตรงกับตารางหลักของไฟล์ "รถร่วม วสรรณ์" */
const BAND_COUNT = 17;
const FIRST_BAND = { from: 28.99, to: 30.98 };
const LAST_BAND = { from: 60.99, to: 62.98 };

/** ค่าขนส่งครบทุกช่อง เริ่มที่ first แล้วเพิ่มทีละ step — เลียนตารางจริงที่ราคาไต่ขึ้นตามน้ำมัน */
const prices = (first: number, step: number) =>
    Array.from({ length: BAND_COUNT }, (_, i) => first + step * i);

/** เปิดแบบฟอร์มด้วย ExcelJS เพื่อตรวจสิ่งที่ xlsx อ่านไม่ได้ (รายการเลือก การล็อก) */
const openWithExcelJS = async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(TEMPLATE);
    return wb;
};

describe('buildFuelRateTemplate — โครงของแบบฟอร์ม', () => {
    it('ชีตที่ใช้กรอกต้องอยู่หน้าสุด เพราะตัวอ่านอ่านชีตแรกเสมอ', () => {
        expect(XLSX.read(TEMPLATE, { type: 'array' }).SheetNames[0]).toBe(TEMPLATE_SHEET);
    });

    it('มีชีตประกอบครบ: ตัวอย่าง ทะเบียนชื่อ และวิธีใช้', () => {
        expect(XLSX.read(TEMPLATE, { type: 'array' }).SheetNames)
            .toEqual([TEMPLATE_SHEET, 'ตัวอย่างการกรอก', 'รายการที่เลือกได้', 'วิธีใช้']);
    });

    it('แนบทะเบียนชื่อของระบบมาให้เลือก', () => {
        const wb = XLSX.read(TEMPLATE, { type: 'array' });
        const text = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['รายการที่เลือกได้'], { header: 1 })
            .flat().map(v => String(v ?? ''));
        for (const name of [...MASTER.subcontractors, ...MASTER.truckTypes, ...MASTER.locations]) {
            expect(text, name).toContain(name);
        }
    });

    it('ช่องช่วงราคาในแถวหัวตารางต้องว่าง ไม่งั้นตัวอ่านจะนับเป็นขอบช่วง', () => {
        const wb = XLSX.read(TEMPLATE, { type: 'array' });
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[TEMPLATE_SHEET], {
            header: 1, raw: true, defval: null,
        });
        expect(grid[6].slice(6).every(v => v === null)).toBe(true);
        expect(grid[4].slice(6)[0]).toBe(FIRST_BAND.from);   // แถว "ตั้งแต่"
        expect(grid[5].slice(6)[0]).toBe(FIRST_BAND.to);     // แถว "ถึง"
    });

    it('ตัวอย่างการกรอกใช้ชื่อจากทะเบียนจริง ไม่ใช่ชื่อสมมติ', () => {
        const wb = XLSX.read(TEMPLATE, { type: 'array' });
        const grid = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['ตัวอย่างการกรอก'], { header: 1 });
        const row = grid[7].map(v => String(v ?? ''));
        expect(MASTER.subcontractors).toContain(row[1]);
        expect(MASTER.locations).toContain(row[2]);
        expect(MASTER.truckTypes).toContain(row[4]);
    });
});

describe('buildFuelRateTemplate — กันกรอกผิดตั้งแต่ในไฟล์', () => {
    it('ช่องชื่อทั้งสี่คอลัมน์มีรายการให้เลือก ชี้ไปที่ชีตทะเบียน', async () => {
        const ws = (await openWithExcelJS()).getWorksheet(TEMPLATE_SHEET)!;
        for (const [cell, sourceCol] of [['B8', 'A'], ['C8', 'C'], ['D8', 'C'], ['E8', 'B']]) {
            const dv = ws.getCell(cell).dataValidation;
            expect(dv?.type, cell).toBe('list');
            expect((dv as { formulae?: string[] })?.formulae?.[0], cell)
                .toContain(`'รายการที่เลือกได้'!$${sourceCol}$4`);
        }
    });

    it('รายการเลือกครอบทุกแถวที่เตรียมไว้ให้กรอก ไม่ใช่แค่แถวแรก', async () => {
        const ws = (await openWithExcelJS()).getWorksheet(TEMPLATE_SHEET)!;
        expect(ws.getCell('B107').dataValidation?.type).toBe('list');
    });

    it('เตือนแต่ไม่บล็อก เผื่อหน่วยงานมีชื่อใหม่จริง ๆ', async () => {
        const ws = (await openWithExcelJS()).getWorksheet(TEMPLATE_SHEET)!;
        const dv = ws.getCell('B8').dataValidation as { errorStyle?: string; error?: string };
        expect(dv.errorStyle).toBe('warning');
        expect(dv.error).toContain('แจ้งนีโอสยาม');
    });


    it('ตรึงหัวตารางและคอลัมน์ชื่อไว้ เลื่อนดูช่วงราคาไกล ๆ แล้วยังรู้ว่าแถวไหน', async () => {
        const ws = (await openWithExcelJS()).getWorksheet(TEMPLATE_SHEET)!;
        expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 6, ySplit: 7 });
    });
});

describe('แบบฟอร์ม → กรอก → อ่านกลับ (round trip)', () => {
    let result: ParseResult;
    beforeAll(() => {
        result = parseFilled([
            [1, 'KNN', 'บางปะกง', 'เมืองนครสวรรค์', '6w', 'บรรทุกไม่เกิน 5 ตัน', ...prices(5000, 100)],
            [2, null, 'บางปะกง', 'แม่สอด', '10w', '', ...prices(9000, 250)],
            [3, 'YSK', 'บางปะกง', 'แม่สอด', '4w', 'ยังไม่ตกลง 2 ช่วงแรก', null, null, ...prices(4000, 80).slice(2)],
        ]);
    });

    it('รู้ว่าไฟล์นี้มาจากแบบฟอร์มของระบบ', () => {
        expect(result.isTemplate).toBe(true);
    });

    it('อ่านครบทุกแถวที่กรอก', () => {
        expect(result.rows.length).toBe(3);
    });

    it('อ่านคอลัมน์ข้อความได้ตรง รวมถึงหมายเหตุ', () => {
        const r = result.rows[0];
        expect(r.company).toBe('KNN');
        expect(r.origin).toBe('บางปะกง');
        expect(r.destination).toBe('เมืองนครสวรรค์');
        expect(r.truckType).toBe('6w');
        expect(r.note).toBe('บรรทุกไม่เกิน 5 ตัน');
    });

    it('เว้นชื่อผู้รับจ้างในแถวถัดมา = ใช้ชื่อเดิม (merge cell ใน Excel)', () => {
        expect(result.rows[1].company).toBe('KNN');
    });

    it('ค่าขนส่งตรงกับที่กรอกทุกช่อง', () => {
        expect(result.rows[0].bands.map(b => b.price)).toEqual(prices(5000, 100));
        expect(result.rows[1].bands.map(b => b.price)).toEqual(prices(9000, 250));
    });

    it('ช่วงราคาน้ำมันตรงกับแถวที่ 5 และ 6 ของแบบฟอร์ม', () => {
        const b = result.rows[0].bands;
        expect(b.length).toBe(BAND_COUNT);
        expect(b[0]).toMatchObject({ fuelFrom: FIRST_BAND.from, fuelTo: FIRST_BAND.to });
        expect(b[BAND_COUNT - 1]).toMatchObject({ fuelFrom: LAST_BAND.from, fuelTo: LAST_BAND.to });
    });

    it('ช่องที่เว้นว่างเป็น "ยังไม่มีเรท" ไม่ใช่ 0 บาท', () => {
        const r = result.rows[2];
        expect(r.bands[0].price).toBeNull();
        expect(findRateAt(r, 30.5)).toBeNull();          // ช่วงที่เว้นว่าง — ไม่เดาราคาให้
        expect(findRateAt(r, 34.5)!.price).toBe(4160);   // ช่วงที่ 3 (34–35.99) ที่กรอกไว้จริง
    });

    it('ไม่ตั้งชื่อบริษัทจากชื่อชีตของแบบฟอร์ม', () => {
        // ชีตชื่อ "กรอกเรท" ไม่ใช่ชื่อคู่สัญญา แถวที่ 2 จึงต้องรับชื่อจากแถวก่อนหน้าเท่านั้น
        expect(result.rows.every(r => r.company !== TEMPLATE_SHEET)).toBe(true);
    });
});

describe('checkAgainstMaster — ตรวจชื่อกับทะเบียนของระบบ', () => {
    it('ชื่อตรงทะเบียนทั้งหมด ไม่มีอะไรต้องเตือน', () => {
        const { rows } = parseFilled([[1, 'KNN', 'บางปะกง', 'แม่สอด', '6w', '', ...prices(5000, 100)]]);
        expect(checkAgainstMaster(rows, MASTER)).toEqual([]);
    });

    it('เว้นวรรคต่างกันถือว่าชื่อเดียวกัน ไม่เตือน', () => {
        const { rows } = parseFilled([[1, ' KNN ', 'บางปะกง', 'แม่ สอด', '6w', '', ...prices(5000, 100)]]);
        expect(checkAgainstMaster(rows, MASTER)).toEqual([]);
    });

    it('เตือนพร้อมบอกชื่อที่ใกล้เคียงเมื่อผู้รับจ้างไม่ตรงทะเบียน', () => {
        const { rows } = parseFilled([[1, 'KNN DYNAMIC', 'บางปะกง', 'แม่สอด', '6w', '', ...prices(5000, 100)]]);
        const hit = checkAgainstMaster(rows, MASTER).find(i => i.kind === 'unknown-subcontractor');
        expect(hit).toBeDefined();
        expect(hit!.message).toContain('KNN DYNAMIC');
        expect(hit!.message).toContain('ใกล้เคียงกับ "KNN"');
        expect(hit!.rows).toEqual([0]);
    });

    it('เตือนเมื่อประเภทรถและสถานที่ไม่ตรงทะเบียน', () => {
        const { rows } = parseFilled([[1, 'KNN', 'บางปะกง', 'หาดใหญ่', '4wj (บรรทุก 3001 - 3500 กก.)', '', ...prices(5000, 100)]]);
        const kinds = checkAgainstMaster(rows, MASTER).map(i => i.kind);
        expect(kinds).toContain('unknown-truck-type');
        expect(kinds).toContain('unknown-location');
    });

    it('รวมชื่อซ้ำเป็นรายการเดียว แต่บอกจำนวนแถวที่ได้รับผลกระทบ', () => {
        const { rows } = parseFilled([
            [1, 'ขนส่งเจ้าใหม่', 'บางปะกง', 'แม่สอด', '6w', '', ...prices(5000, 100)],
            [2, 'ขนส่งเจ้าใหม่', 'บางปะกง', 'เมืองนครสวรรค์', '6w', '', ...prices(6000, 100)],
        ]);
        const hit = checkAgainstMaster(rows, MASTER).find(i => i.kind === 'unknown-subcontractor')!;
        expect(hit.message).toContain('2 แถว');
        expect(hit.rows).toEqual([0, 1]);
    });
});

describe('อัปโหลดแบบฟอร์มเปล่า', () => {
    it('บอกให้ไปกรอกก่อน ไม่ใช่ขึ้น error ที่คนอ่านไม่เข้าใจ', () => {
        expect(() => parseFuelRateWorkbook(TEMPLATE)).toThrow(/ยังไม่ได้กรอกข้อมูลเส้นทาง/);
    });
});

// เคสที่ Codex ทักไว้: ปลายทางที่ชื่อมีคำว่า "ปลายทาง" และราคายังเป็น 0 หรือว่าง
describe('ช่องที่ยังไม่ได้กรอก และหมายเหตุที่ใช้แยกเงื่อนไข', () => {
    it('เตือนเมื่อเว้นช่องผู้รับจ้างหรือประเภทรถไว้ ไม่ใช่ปล่อยผ่าน', () => {
        const { rows } = parseFilled([[1, '', 'บางปะกง', 'แม่สอด', '', '', ...prices(5000, 100)]]);
        const issues = checkAgainstMaster(rows, MASTER);
        expect(issues.find(i => i.kind === 'unknown-subcontractor')!.message).toContain('ยังไม่ได้กรอก');
        expect(issues.find(i => i.kind === 'unknown-truck-type')!.message).toContain('ยังไม่ได้กรอก');
    });

    it('เส้นทางเดียวกันแต่หมายเหตุต่างกัน ไม่ถือว่าซ้ำ (แบบฟอร์มบอกให้แยกแบบนี้)', () => {
        const { issues } = parseFilled([
            [1, 'KNN', 'บางปะกง', 'แม่สอด', '6w', 'บรรทุกไม่เกิน 3 ตัน', ...prices(5000, 100)],
            [2, 'KNN', 'บางปะกง', 'แม่สอด', '6w', 'บรรทุก 3-5 ตัน', ...prices(6000, 100)],
        ]);
        expect(issues.find(i => i.kind === 'duplicate-route')).toBeUndefined();
    });

    it('เส้นทางและหมายเหตุเหมือนกันทุกอย่าง ยังเตือนซ้ำเหมือนเดิม', () => {
        const { issues } = parseFilled([
            [1, 'KNN', 'บางปะกง', 'แม่สอด', '6w', '', ...prices(5000, 100)],
            [2, 'KNN', 'บางปะกง', 'แม่สอด', '6w', '', ...prices(6000, 100)],
        ]);
        expect(issues.find(i => i.kind === 'duplicate-route')!.rows.length).toBe(2);
    });
});

// เคสที่ Codex ทักไว้: แถวแรกที่กรอกเว้นช่วงต้นว่าง ช่วงนั้นต้องไม่หายไปจากทั้งไฟล์
describe('แถวแรกเว้นช่วงต้นว่างไว้', () => {
    let result: ParseResult;
    beforeAll(() => {
        result = parseFilled([
            [1, 'KNN', 'บางปะกง', 'แม่สอด', '6w', 'ยังไม่ตกลง 2 ช่วงแรก', null, null, ...prices(7000, 100).slice(2)],
            [2, 'KNN', 'บางปะกง', 'เมืองนครสวรรค์', '6w', '', ...prices(5000, 100)],
        ]);
    });

    it('ยังได้ช่วงราคาน้ำมันครบทุกช่วง', () => {
        expect(result.rows[0].bands.length).toBe(BAND_COUNT);
        expect(result.rows[0].bands[0]).toMatchObject({ fuelFrom: FIRST_BAND.from, fuelTo: FIRST_BAND.to });
    });

    it('แถวที่กรอกช่วงแรกไว้ ต้องยังมีราคาช่วงนั้น', () => {
        expect(result.rows[1].bands[0].price).toBe(5000);
        expect(result.rows[1].bands.map(b => b.price)).toEqual(prices(5000, 100));
    });

    it('แถวที่เว้นว่างจริง ๆ ยังเป็นช่องว่าง ไม่ถูกเติมค่า', () => {
        expect(result.rows[0].bands[0].price).toBeNull();
        expect(result.rows[0].bands[1].price).toBeNull();
        expect(result.rows[0].bands[2].price).toBe(7200);
    });
});

describe('แบบฟอร์มต้องกรอกได้ทุกช่อง ไม่ล็อกชีต', () => {
    let wb: ExcelJS.Workbook;

    beforeAll(async () => {
        const buf = await buildFuelRateTemplate(MASTER);
        wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
    });

    it('ไม่มีชีตไหนถูกล็อก', () => {
        // หน่วยงานเป็นคนภายนอก ถ้าเจอกล่อง "แผ่นงานมีการป้องกัน" มีแนวโน้มจะเลิกใช้แบบฟอร์ม
        // ExcelJS ไม่ได้ประกาศ sheetProtection ไว้ในชนิดข้อมูล แต่มีจริงตอนรัน
        for (const ws of wb.worksheets) {
            const state = (ws as unknown as { sheetProtection?: unknown }).sheetProtection;
            expect(state ?? null).toBeNull();
        }
    });

    it('ไม่มีช่องไหนถูกตั้งเป็นล็อกไว้', () => {
        const ws = wb.getWorksheet(TEMPLATE_SHEET)!;
        for (const row of [5, 6, 8, 100, 200]) {
            for (const col of [1, 2, 5, 7, 10]) {
                expect(ws.getRow(row).getCell(col).protection?.locked).not.toBe(true);
            }
        }
    });

    it('มีแถวให้กรอกมากพอสำหรับไฟล์จริง (164 เส้นทาง)', () => {
        const ws = wb.getWorksheet(TEMPLATE_SHEET)!;
        // แถว 1-7 เป็นหัวตาราง ที่เหลือคือแถวข้อมูล
        expect(ws.rowCount - 7).toBeGreaterThanOrEqual(200);
    });

    it('ยังมี dropdown ให้เลือกชื่อเหมือนเดิม', () => {
        const ws = wb.getWorksheet(TEMPLATE_SHEET)!;
        expect(ws.getRow(8).getCell(2).dataValidation).toBeDefined();
    });

    it('คู่มือในไฟล์ไม่พูดถึงการล็อกที่ไม่มีอยู่จริง', () => {
        const howto = wb.getWorksheet('วิธีใช้')!;
        let text = '';
        howto.eachRow(r => r.eachCell(c => { text += String(c.value ?? ''); }));
        expect(text).not.toContain('ล็อกไว้ให้แล้ว');
    });
});

describe('ทะเบียนของระบบครอบคลุมไฟล์เรทจริง', () => {
    // ถ้าชื่อในไฟล์ไม่มีในทะเบียน dropdown จะเลือกไม่ได้ และระบบจะเตือนทุกแถวตอนอัปโหลด
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const has = (list: string[], v: string) => list.some(x => norm(x) === norm(v));

    it('มีชื่อผู้รับจ้างจากไฟล์ครบ', () => {
        for (const name of ['KNN DYNAMIC', 'YSK TRANSPORT', 'รถร่วมคุณหนึ่ง',
            'พรแม่ย่า', 'วิวัฒน์ทรานส์', 'โอเคนะ แม่สอด', 'นีโอสยาม วางบิล sunlee']) {
            expect(has(REAL_MASTER.subcontractors, name), name).toBe(true);
        }
    });

    it('มีสถานที่จากไฟล์ครบ', () => {
        for (const name of ['ซันลี บางปะกง', 'อาหารสากล (นครปฐม)', '7-11 ลาดกระบัง (สุวรรณภูมิ)',
            'ศูนย์กระจาย บางบัวทอง', 'แม่สอด พาเลทกลับ', 'ลำปาง / แพร่']) {
            expect(has(REAL_MASTER.locations, name), name).toBe(true);
        }
    });

    it('มีประเภทรถ 4wj ที่ไฟล์ใช้', () => {
        expect(has(REAL_MASTER.truckTypes, '4wj')).toBe(true);
        expect(has(REAL_MASTER.truckTypes, '4w')).toBe(true);
    });

    it('ไม่มีชื่อซ้ำในทะเบียน', () => {
        for (const list of [REAL_MASTER.locations, REAL_MASTER.subcontractors, REAL_MASTER.truckTypes]) {
            expect(new Set(list.map(norm)).size).toBe(list.length);
        }
    });
});

describe('แบบฟอร์มสองชุดช่วงราคาน้ำมัน', () => {
    // ไฟล์ "รถร่วม วสรรณ์" มีสองตารางที่ใช้ช่วงคนละชุด ต่างกันที่จุดเริ่ม 1.01 บาท
    // ถ้าคนกรอกหยิบผิดชุด ราคาจะถูกผูกกับช่วงผิดตั้งแต่ต้น
    const readBands = async (bandSet: 'main' | 'sunlee') => {
        const buf = await buildFuelRateTemplate(MASTER, { bandSet });
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.getWorksheet(TEMPLATE_SHEET)!;
        const out: { from: number; to: number }[] = [];
        for (let c = 7; c <= 50; c++) {
            const f = ws.getRow(5).getCell(c).value;
            const t = ws.getRow(6).getCell(c).value;
            if (typeof f === 'number' && typeof t === 'number') out.push({ from: f, to: t });
        }
        return { bands: out, header: String(ws.getRow(1).getCell(1).value ?? '') };
    };

    it('ชุดตารางหลักมี 17 ช่วง เริ่ม 28.99 จบ 62.98', async () => {
        const { bands } = await readBands('main');
        expect(bands.length).toBe(17);
        expect(bands[0]).toEqual({ from: 28.99, to: 30.98 });
        expect(bands[16]).toEqual({ from: 60.99, to: 62.98 });
    });

    it('ชุด sunlee มี 16 ช่วง เริ่ม 30.00 จบ 61.99', async () => {
        const { bands } = await readBands('sunlee');
        expect(bands.length).toBe(16);
        expect(bands[0]).toEqual({ from: 30, to: 31.99 });
        expect(bands[15]).toEqual({ from: 60, to: 61.99 });
    });

    it('ทุกช่วงกว้าง 2 บาทและต่อเนื่องกันไม่มีรอยต่อ', async () => {
        for (const set of ['main', 'sunlee'] as const) {
            const { bands } = await readBands(set);
            for (let i = 0; i < bands.length; i++) {
                expect(Math.round((bands[i].to - bands[i].from) * 100) / 100).toBe(1.99);
                if (i > 0) {
                    // ช่วงถัดไปต้องเริ่มถัดจากช่วงก่อนหน้าพอดี ไม่ทับและไม่เว้น
                    expect(Math.round((bands[i].from - bands[i - 1].to) * 100) / 100).toBe(0.01);
                }
            }
        }
    });

    it('หัวไฟล์บอกว่าเป็นชุดไหน ให้คนกรอกรู้ว่าหยิบถูกไฟล์', async () => {
        expect((await readBands('main')).header).toContain('ตารางหลัก');
        expect((await readBands('sunlee')).header).toContain('sunlee');
    });

    it('ไม่ระบุชุด = ใช้ตารางหลัก (เรทที่จ่ายจริง)', async () => {
        const buf = await buildFuelRateTemplate(MASTER);
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        const ws = wb.getWorksheet(TEMPLATE_SHEET)!;
        expect(ws.getRow(5).getCell(7).value).toBe(28.99);
    });
});


/*
  ไฟล์ที่ปุ่ม Export สร้าง ต้องหน้าตาเหมือนแบบฟอร์มที่หน่วยงานกรอกมา

  เดิม export เป็นราคาเดียว (ราคา ณ ราคาน้ำมันวันนี้) ซึ่งเทียบกับไฟล์ต้นฉบับ
  ของหน่วยงานไม่ได้เลยเพราะคนละโครง และเห็นราคาแค่ 1 ช่วงจาก 33 ช่วงที่มีอยู่
*/
describe('buildFuelRateExport — ส่งออกให้เหมือนแบบฟอร์ม', () => {
    /** เส้นทางตัวอย่างที่ใช้ช่วงราคาชุดหลัก */
    const mkRow = (over: Partial<FuelRateRow> = {}): FuelRateRow => ({
        seq: 1,
        company: 'YSK TRANSPORT',
        origin: 'คลอง13',
        destination: 'ลำปาง',
        truckType: '10W',
        note: '',
        bands: [
            { fuelFrom: 28.99, fuelTo: 30.98, price: 1000 },
            { fuelFrom: 30.99, fuelTo: 32.98, price: 1100 },
        ],
        ...over,
    });

    const openExport = async (rows: FuelRateRow[]) => {
        const buf = await buildFuelRateExport(rows, { dieselPrice: 38.39 });
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);
        return wb.worksheets[0];
    };

    it('วางหัวไฟล์ตำแหน่งเดียวกับแบบฟอร์ม — ขอบช่วงแถว 5-6 หัวตารางแถว 7 ข้อมูลแถว 8', async () => {
        const ws = await openExport([mkRow()]);

        expect(String(ws.getRow(5).getCell(1).value)).toContain('ตั้งแต่');
        expect(String(ws.getRow(6).getCell(1).value)).toContain('ถึง');
        expect(ws.getRow(5).getCell(7).value).toBe(28.99);
        expect(ws.getRow(6).getCell(7).value).toBe(30.98);
        // หัวตารางต้องเรียงเหมือนแบบฟอร์ม
        expect([1, 2, 3, 4, 5, 6].map(c => ws.getRow(7).getCell(c).value))
            .toEqual(['ลำดับ', 'บริษัท', 'ต้นทาง', 'ปลายทาง', 'ประเภทรถ', 'หมายเหตุ']);
        expect(ws.getRow(8).getCell(2).value).toBe('YSK TRANSPORT');
    });

    it('ช่องช่วงราคาในแถวหัวตารางต้องว่าง เหมือนแบบฟอร์ม', async () => {
        const ws = await openExport([mkRow()]);

        // ถ้าใส่ข้อความตรงนี้ ตัวอ่านจะนับแถวนี้เป็นขอบช่วงแล้วอ่านไฟล์เพี้ยน
        expect(ws.getRow(7).getCell(7).value).toBeNull();
        expect(ws.getRow(7).getCell(8).value).toBeNull();
    });

    it('หนึ่งคอลัมน์ต่อหนึ่งช่วงราคา และวางราคาตรงช่วง', async () => {
        const ws = await openExport([mkRow()]);

        expect(ws.getRow(8).getCell(7).value).toBe(1000);
        expect(ws.getRow(8).getCell(8).value).toBe(1100);
    });

    it('ช่วงที่ยังไม่ตกลงราคาต้องเว้นว่าง ห้ามกลายเป็น 0', async () => {
        const ws = await openExport([mkRow({
            bands: [
                { fuelFrom: 28.99, fuelTo: 30.98, price: null },
                { fuelFrom: 30.99, fuelTo: 32.98, price: 1100 },
            ],
        })]);

        // 0 แปลว่า "ขนส่งฟรี" ซึ่งผิดความหมายและกระทบการคิดเงิน
        expect(ws.getRow(8).getCell(7).value).toBeNull();
        expect(ws.getRow(8).getCell(8).value).toBe(1100);
    });

    it('ราคา 0 ในไฟล์ต้นฉบับต้องออกมาเป็นช่องว่าง ไม่ใช่ 0.00', async () => {
        // หน่วยงานใส่ 0 แทน "ยังไม่ตกลงราคา" (ไฟล์จริงมี 168 ช่อง) — ระบบก็ตีความแบบนั้น
        // ถ้าเขียน 0 ลงไฟล์ที่ส่งออก คนอ่านจะเข้าใจว่าขนส่งฟรี
        const ws = await openExport([mkRow({
            bands: [
                { fuelFrom: 28.99, fuelTo: 30.98, price: 0 },
                { fuelFrom: 30.99, fuelTo: 32.98, price: 1100 },
            ],
        })]);

        expect(ws.getRow(8).getCell(7).value).toBeNull();
        expect(ws.getRow(8).getCell(8).value).toBe(1100);
    });

    it('รวมช่วงจากทุกหน่วยงานที่ใช้ชุดต่างกัน ไม่ทิ้งชุดใดชุดหนึ่ง', async () => {
        // ตารางหลักเริ่ม 28.99 · sunlee เริ่ม 30.00 — ถ้าเลือกชุดเดียวตายตัว อีกชุดจะหายทั้งแถบ
        const rows = [
            mkRow(),
            mkRow({
                company: 'พรแม่ย่า',
                bands: [{ fuelFrom: 30.00, fuelTo: 31.99, price: 2000 }],
            }),
        ];
        const bands = collectBands(rows);

        expect(bands.map(b => b.from)).toEqual([28.99, 30.00, 30.99]);

        const ws = await openExport(rows);
        // แถวของ sunlee ต้องมีราคาอยู่ในคอลัมน์ของช่วง 30.00 เท่านั้น
        expect(ws.getRow(9).getCell(8).value).toBe(2000);
        expect(ws.getRow(9).getCell(7).value).toBeNull();
        expect(ws.getRow(9).getCell(9).value).toBeNull();
    });

    it('เรียงช่วงจากถูกไปแพงเสมอ ไม่ว่าข้อมูลจะมาเรียงยังไง', () => {
        const bands = collectBands([mkRow({
            bands: [
                { fuelFrom: 40.99, fuelTo: 42.98, price: 1 },
                { fuelFrom: 28.99, fuelTo: 30.98, price: 2 },
                { fuelFrom: 34.99, fuelTo: 36.98, price: 3 },
            ],
        })]);

        expect(bands.map(b => b.from)).toEqual([28.99, 34.99, 40.99]);
    });

    it('เก็บชื่อตารางย่อยไว้ในหมายเหตุ ไม่ให้ข้อมูลหาย', async () => {
        const ws = await openExport([mkRow({ note: 'พิกัด 3 ตัน', section: 'วางบิล sunlee' })]);

        expect(String(ws.getRow(8).getCell(6).value)).toBe('พิกัด 3 ตัน · วางบิล sunlee');
    });

    it('ไฟล์ที่ออกไป ต้องอัปกลับเข้าระบบได้ ไม่ใช่เหมือนแค่หน้าตา', async () => {
        const rows = [mkRow(), mkRow({ company: 'KNN DYNAMIC', truckType: '6W' })];
        const buf = await buildFuelRateExport(rows, { dieselPrice: 38.39 });

        const back = await parseFuelRateWorkbook(buf);

        expect(back.rows).toHaveLength(2);
        expect(back.rows[0].company).toBe('YSK TRANSPORT');
        expect(back.rows[1].truckType).toBe('6W');
        // ราคาต้องกลับมาเท่าเดิม ไม่ใช่แค่จำนวนแถวเท่ากัน
        expect(findRateAt(back.rows[0], 29.5)?.price).toBe(1000);
        expect(findRateAt(back.rows[0], 31.5)?.price).toBe(1100);
    });

    it('อัปกลับได้แม้เส้นทางแรกยังไม่มีราคาสักช่วง', async () => {
        // ตัวอ่านหาคอลัมน์ช่วงราคาจากแถวข้อมูลแถวแรก ถ้าแถวนั้นว่างทั้งแถวจะหาไม่เจอ
        // แล้วไฟล์ทั้งไฟล์อัปกลับไม่ได้ ทั้งที่แถวอื่นมีราคาครบ
        const rows = [
            mkRow({ company: 'พรแม่ย่า', truckType: '12W', bands: [
                { fuelFrom: 28.99, fuelTo: 30.98, price: null },
                { fuelFrom: 30.99, fuelTo: 32.98, price: 0 },
            ] }),
            mkRow(),
        ];

        const buf = await buildFuelRateExport(rows, { dieselPrice: 30 });
        const back = await parseFuelRateWorkbook(buf);

        expect(back.rows).toHaveLength(2);
        // แถวที่มีราคาถูกยกขึ้นมาไว้แถวแรก ข้อมูลต้องไม่หายไปไหน
        expect(back.rows.map(r => r.company).sort()).toEqual(['YSK TRANSPORT', 'พรแม่ย่า']);
        expect(findRateAt(back.rows[0], 30)?.price).toBe(1000);
    });

    it('ตรึงหัวตารางและคอลัมน์ชื่อ เหมือนแบบฟอร์ม', async () => {
        const ws = await openExport([mkRow()]);

        expect(ws.views[0]).toMatchObject({ state: 'frozen', xSplit: 6, ySplit: 7 });
    });

    it('มีข้อความกำกับแบบฟอร์ม ไม่งั้นอัปกลับแล้วระบบข้ามการตรวจชื่อ', async () => {
        const buf = await buildFuelRateExport([mkRow()], { dieselPrice: 38.39 });
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buf);

        // checkAgainstMaster ทำงานก็ต่อเมื่อเจอคำนี้ — ถ้าไม่มี ชื่อที่พิมพ์ผิดจะหลุดเข้าระบบ
        expect(String(wb.worksheets[0].getRow(1).getCell(1).value)).toContain(TEMPLATE_MARKER);
    });

    /*
      กันบั๊กที่ทำให้เรทหายทั้งที่มีราคาอยู่ (กระทบการคิดเงินโดยตรง)

      เมื่อข้อมูลมาจากหลายหน่วยงานที่ใช้ชุดช่วงต่างกัน ไฟล์ที่ export จะมีคอลัมน์ช่วง
      ที่คาบเกี่ยวกัน พออ่านกลับเข้ามา แถวหนึ่ง ๆ จะมีทั้งช่วงว่างและช่วงที่มีราคา
      ครอบราคาน้ำมันเดียวกัน · ถ้า findRateAt หยุดที่ช่วงแรกที่ครอบ จะได้ "ไม่มีเรท"
      ทั้งที่ราคาจริงอยู่ในช่วงถัดไป
    */
    it('เรทไม่หายหลังอัปกลับ แม้ข้อมูลจะมีชุดช่วงคาบเกี่ยวกัน', async () => {
        const rows = [
            mkRow(),  // ชุดหลัก 28.99–30.98 / 30.99–32.98
            mkRow({
                company: 'พรแม่ย่า',
                truckType: '12W',
                bands: [
                    { fuelFrom: 30.00, fuelTo: 31.99, price: 2000 },
                    { fuelFrom: 32.00, fuelTo: 33.99, price: 2100 },
                ],
            }),
        ];

        const buf = await buildFuelRateExport(rows, { dieselPrice: 30.50 });
        const back = await parseFuelRateWorkbook(buf);

        // ที่ 30.50 มีสองช่วงครอบ: 28.99–30.98 (ว่างสำหรับแถวนี้) กับ 30.00–31.99 (2000 บาท)
        expect(findRateAt(back.rows[1], 30.50)?.price).toBe(2000);
        expect(findRateAt(back.rows[0], 30.50)?.price).toBe(1000);
        expect(findRateAt(back.rows[1], 32.50)?.price).toBe(2100);
        expect(findRateAt(back.rows[0], 31.50)?.price).toBe(1100);
    });
});
