import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { buildExcelReport, thaiFileDate, type ReportSheet } from './excelReport';

interface Job {
    date: string;
    route: string;
    cost: number;
    profit: number;
    note: string | null;
}

const JOBS: Job[] = [
    { date: '2569-08-01', route: 'บางปะกง → แม่สอด', cost: 12500, profit: 1875.5, note: 'ปกติ' },
    { date: '2569-08-02', route: 'บางปะกง → เมืองนครสวรรค์', cost: 8200, profit: -430.25, note: null },
    { date: '2569-08-03', route: 'นครปฐม → ภูเก็ต', cost: 24440, profit: 3120, note: 'งานด่วน' },
];

const SHEET: ReportSheet<Job> = {
    name: 'รายงานงานขนส่ง',
    title: 'รายงานงานขนส่ง',
    subtitle: 'ช่วง 1–3 ส.ค. 2569',
    columns: [
        { header: 'วันที่', value: r => r.date, type: 'text' },
        { header: 'เส้นทาง', value: r => r.route, type: 'text' },
        { header: 'ต้นทุน (บาท)', value: r => r.cost, type: 'money', total: true },
        { header: 'กำไร (บาท)', value: r => r.profit, type: 'money', total: true },
        { header: 'หมายเหตุ', value: r => r.note, type: 'text' },
    ],
    rows: JOBS,
    footnotes: ['ตัวเลขทั้งหมดมาจากงานที่ตรวจสอบแล้ว'],
};

const AT = new Date('2026-08-21T10:30:00');

/** เปิดไฟล์ที่สร้างขึ้นกลับมาตรวจ เหมือนคนรับไฟล์เปิดด้วย Excel */
const reopen = async (sheets: ReportSheet<any>[], by = 'ทดสอบ') => {
    const buf = await buildExcelReport(sheets, { by, at: AT });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    return wb;
};

describe('buildExcelReport — โครงไฟล์รายงาน', () => {
    it('มีแถบชื่อรายงาน พร้อมเวลาและผู้ออกรายงาน', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        expect(String(ws.getCell('A1').value)).toBe('รายงานงานขนส่ง');
        const sub = String(ws.getCell('A2').value);
        expect(sub).toContain('ช่วง 1–3 ส.ค. 2569');
        expect(sub).toContain('โดย ทดสอบ');
    });

    it('ทาสีแถบหัวและหัวตารางจริง ไม่ใช่ตารางขาวเปล่า', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        const titleFill = ws.getCell('A1').fill as { fgColor?: { argb?: string } };
        const headerFill = ws.getCell('A4').fill as { fgColor?: { argb?: string } };
        expect(titleFill.fgColor?.argb).toBe('FF0F172A');
        expect(headerFill.fgColor?.argb).toBe('FF1E293B');
        expect(ws.getCell('A4').font?.bold).toBe(true);
    });

    it('ใช้ฟอนต์ Cordia New ทุกเซลล์ พร้อมขนาดที่ชดเชยว่าฟอนต์ไทยตัวเล็ก', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        // ถ้าเปลี่ยนฟอนต์ต้องปรับขนาดตามด้วย — Cordia New 14 ≈ Tahoma 10
        expect(ws.getCell('A1').font).toMatchObject({ name: 'Cordia New', size: 20 });
        expect(ws.getCell('A4').font).toMatchObject({ name: 'Cordia New', size: 14 });
        expect(ws.getCell('C5').font).toMatchObject({ name: 'Cordia New', size: 14 });
    });

    it('ตรึงหัวตารางและเปิดตัวกรองไว้ให้', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 4 });
        // ExcelJS คืนช่วงตัวกรองเป็นข้อความเมื่ออ่านไฟล์กลับมา
        expect(ws.autoFilter).toBe('A4:E4');
    });

    it('หัวตารางซ้ำทุกหน้าเวลาพิมพ์ และตั้งค่าเป็น A4 แนวนอน', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        expect(ws.pageSetup.printTitlesRow).toBe('4:4');
        expect(ws.pageSetup.orientation).toBe('landscape');
        expect(ws.pageSetup.fitToWidth).toBe(1);
    });

    it('ตัดชื่อชีตที่ยาวเกินและอักขระที่ Excel ไม่ยอมรับ', async () => {
        const wb = await reopen([{ ...SHEET, name: 'รายงาน/สรุป: ยาวมากจนเกินสามสิบเอ็ดตัวอักษรแน่นอนเลยจริง ๆ' }]);
        const name = wb.getWorksheet(1)!.name;
        expect(name.length).toBeLessThanOrEqual(31);
        expect(name).not.toMatch(/[[\]:*?/\\]/);
    });
});

describe('buildExcelReport — ตัวเลขต้องเป็นตัวเลข', () => {
    it('เก็บค่าเงินเป็นตัวเลขจริง เอาไปบวกต่อใน Excel ได้', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        const cell = ws.getCell('C5');
        expect(typeof cell.value).toBe('number');
        expect(cell.value).toBe(12500);
    });

    it('ใส่รูปแบบตัวเลขที่ทำให้ค่าติดลบเป็นสีแดง', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        expect(ws.getCell('D5').numFmt).toBe('#,##0.00;[Red]-#,##0.00');
        expect(ws.getCell('D6').value).toBe(-430.25);
    });

    it('ค่าที่ไม่มีข้อมูลเป็นช่องว่าง ไม่ใช่เลข 0', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        const cell = ws.getCell('E6');
        expect(cell.value === null || cell.value === undefined || cell.value === '').toBe(true);
    });

    it('ข้อมูลครบทุกแถวและยอดรวมตรงกับต้นทาง', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        const costs = [5, 6, 7].map(r => ws.getCell(`C${r}`).value as number);
        expect(costs).toEqual(JOBS.map(j => j.cost));

        const totalRow = 8;
        expect(String(ws.getCell(`A${totalRow}`).value)).toBe('รวมทั้งสิ้น');
        expect(ws.getCell(`C${totalRow}`).value).toBe(JOBS.reduce((s, j) => s + j.cost, 0));
        expect(ws.getCell(`D${totalRow}`).value).toBeCloseTo(JOBS.reduce((s, j) => s + j.profit, 0), 2);
    });

    it('ไม่รวมยอดในคอลัมน์ที่ไม่ได้สั่งให้รวม', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        const cell = ws.getCell('B8').value;
        expect(cell === null || cell === undefined || cell === '').toBe(true);
    });

    it('ไม่มีแถวรวมเมื่อไม่มีข้อมูลสักแถว', async () => {
        const ws = (await reopen([{ ...SHEET, rows: [] }])).getWorksheet(1)!;
        expect(ws.getCell('A5').value).toBeFalsy();
    });
});

describe('buildExcelReport — ความกว้างคอลัมน์และหมายเหตุ', () => {
    it('คอลัมน์ที่มีข้อความไทยยาวต้องกว้างกว่าคอลัมน์สั้น', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        expect(ws.getColumn(2).width!).toBeGreaterThan(ws.getColumn(1).width!);
    });

    it('ไม่กว้างเกิน 42 ตัวอักษร เพื่อให้ยังพิมพ์ลงกระดาษได้', async () => {
        const long = 'ปลายทางที่ชื่อยาวมากจนพิมพ์ไม่ลงกระดาษถ้าไม่จำกัดความกว้างเอาไว้ให้ดี ๆ';
        const ws = (await reopen([{
            ...SHEET,
            rows: [{ ...JOBS[0], route: long }],
        }])).getWorksheet(1)!;
        expect(ws.getColumn(2).width!).toBeLessThanOrEqual(42);
    });

    it('เขียนหมายเหตุไว้ท้ายชีต', async () => {
        const ws = (await reopen([SHEET])).getWorksheet(1)!;
        const texts = [10, 11].map(r => String(ws.getCell(`A${r}`).value ?? ''));
        expect(texts.join(' ')).toContain('ตัวเลขทั้งหมดมาจากงานที่ตรวจสอบแล้ว');
    });
});

describe('thaiFileDate', () => {
    it('ให้วันที่แบบ พ.ศ. สำหรับตั้งชื่อไฟล์', () => {
        expect(thaiFileDate(new Date('2026-08-21T00:00:00'))).toBe('2569-08-21');
    });
});
