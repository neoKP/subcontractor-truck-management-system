import { describe, it, expect, beforeAll } from 'vitest';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { buildFuelRateTemplate, checkAgainstMaster, TEMPLATE_SHEET, type RateMaster } from './fuelRateTemplate';
import { parseFuelRateWorkbook, findRateAt, type ParseResult } from './fuelRateParser';
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

/** ค่าขนส่ง 16 ช่อง เริ่มที่ first แล้วเพิ่มทีละ step — เลียนตารางจริงที่ราคาไต่ขึ้นตามน้ำมัน */
const prices = (first: number, step: number) => Array.from({ length: 16 }, (_, i) => first + step * i);

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
        expect(grid[4].slice(6)[0]).toBe(30);      // แถว "ตั้งแต่"
        expect(grid[5].slice(6)[0]).toBe(31.99);   // แถว "ถึง"
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
        expect(b.length).toBe(16);
        expect(b[0]).toMatchObject({ fuelFrom: 30, fuelTo: 31.99 });
        expect(b[15]).toMatchObject({ fuelFrom: 60, fuelTo: 61.99 });
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

    it('ยังได้ช่วงราคาน้ำมันครบ 16 ช่วง เริ่มที่ 30 บาท', () => {
        expect(result.rows[0].bands.length).toBe(16);
        expect(result.rows[0].bands[0]).toMatchObject({ fuelFrom: 30, fuelTo: 31.99 });
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
