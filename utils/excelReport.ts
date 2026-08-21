/**
 * มาตรฐานไฟล์ Excel ของระบบ — ทุกปุ่ม Export ควรผ่านที่นี่ที่เดียว
 *
 * ทำไมต้องมี: ก่อนหน้านี้แต่ละหน้าสร้างไฟล์กันเอง หน้าตาไม่เหมือนกันสักหน้า
 * และไลบรารี `xlsx` ที่ใช้อยู่เขียนได้แค่ฟอนต์เดียว สีเดียว เส้นขอบเดียว (ตายตัวในตัวมันเอง)
 * จึงทำหัวตาราง ตรึงแถว หรือสีตัวเลขติดลบไม่ได้เลย ที่นี่จึงใช้ ExcelJS แทน
 *
 * หลักที่ยึด
 *   - ตัวเลขต้องเป็น "ตัวเลขจริง" พร้อมรูปแบบ ไม่ใช่ข้อความ — คนรับไฟล์ต้องเอาไปบวกต่อได้
 *   - หัวตารางตรึงไว้เสมอ เพราะรายงานจริงยาวหลักร้อยแถว
 *   - ฟอนต์ Cordia New ตามมาตรฐานเอกสารไทย (มากับ Windows/Office ที่ติดตั้งภาษาไทย)
 *     Cordia New ตัวเล็กกว่าฟอนต์ฝรั่งมาก ขนาดจึงต้องใหญ่กว่าปกติ — 14 pt ของ Cordia
 *     เท่ากับราว 10 pt ของ Tahoma ถ้าเปลี่ยนฟอนต์ต้องปรับ SIZE ตามด้วย ไม่งั้นเล็กจนอ่านไม่ออก
 *   - โหลด ExcelJS ตอนกดปุ่มเท่านั้น (dynamic import) หน้าเว็บจะได้ไม่หนักขึ้นตอนเปิดครั้งแรก
 */

/** สีที่ใช้ทั้งระบบ — ชุดเดียวกับหน้าเว็บ (Tailwind slate) */
const COLOR = {
    titleBg: 'FF0F172A',      // slate-900 — แถบชื่อรายงาน
    headerBg: 'FF1E293B',     // slate-800 — หัวตาราง
    headerText: 'FFFFFFFF',
    subtitleText: 'FFCBD5E1',  // slate-300
    zebra: 'FFF8FAFC',        // slate-50 — แถวสลับ
    border: 'FFE2E8F0',       // slate-200
    totalBg: 'FFF1F5F9',      // slate-100 — แถวรวม
    text: 'FF0F172A',
    muted: 'FF64748B',        // slate-500
} as const;

/**
 * ฟอนต์และขนาดของทั้งระบบ — เปลี่ยนที่นี่ที่เดียวแล้วเปลี่ยนทุกรายงาน
 *
 * ตารางเทียบขนาดคร่าว ๆ: Cordia New 14 ≈ Tahoma 10 ≈ Angsana New 14
 * ถ้าคนรับไฟล์เปิดด้วย Google Sheets หรือ Mac ที่ไม่มี Cordia New โปรแกรมจะแทนด้วย
 * ฟอนต์ฝรั่งซึ่งตัวใหญ่กว่า ทำให้ดูตัวโตผิดสัดส่วน — กรณีนั้นให้สลับกลับไปใช้ Tahoma
 * (FONT = 'Tahoma' แล้วปรับ SIZE เป็น title 14 / header 10 / body 10 / note 9)
 */
const FONT = 'Cordia New';
const SIZE = { title: 20, subtitle: 14, header: 14, body: 14, note: 13 } as const;

/** รูปแบบตัวเลขตามชนิดข้อมูล — ติดลบเป็นสีแดงอัตโนมัติในช่องเงิน */
const NUM_FMT = {
    money: '#,##0.00;[Red]-#,##0.00',
    number: '#,##0;[Red]-#,##0',
    percent: '0.0%',
    date: 'dd/mm/yyyy',
    text: '@',
} as const;

export type ColumnType = keyof typeof NUM_FMT;

export interface ReportColumn<T> {
    header: string;
    /** ค่าที่จะลงเซลล์ — คืน null เมื่อไม่มีข้อมูล จะได้ปล่อยช่องว่างไว้ ไม่ใช่เลข 0 */
    value: (row: T) => string | number | Date | null;
    /** ความกว้างคอลัมน์ (ตัวอักษร) ไม่ใส่จะคำนวณจากเนื้อหาให้ */
    width?: number;
    type?: ColumnType;
    /** true = ทำผลรวมไว้ท้ายตาราง */
    total?: boolean;
}

export interface ReportSheet<T> {
    /** ชื่อชีต — Excel จำกัด 31 ตัวอักษรและห้ามอักขระ []:*?/\ ระบบตัดให้เอง */
    name: string;
    title: string;
    subtitle?: string;
    columns: ReportColumn<T>[];
    rows: T[];
    /** บรรทัดหมายเหตุท้ายชีต */
    footnotes?: string[];
}

export interface ReportMeta {
    /** ชื่อผู้กดออกรายงาน — เขียนไว้ใต้ชื่อรายงานเพื่อให้ตามกลับได้ว่าใครออกไฟล์นี้ */
    by?: string;
    /** เวลาที่ออกรายงาน — ส่งเข้ามาได้เพื่อให้เทสต์ผลลัพธ์คงที่ */
    at?: Date;
}

/** ชื่อชีตที่ Excel ยอมรับ */
const safeSheetName = (name: string): string =>
    (name.replace(/[[\]:*?/\\]/g, ' ').trim() || 'Sheet').slice(0, 31);

/**
 * ความกว้างโดยประมาณของข้อความ นับเป็น "จำนวนตัวอักษรมาตรฐาน" ที่ Excel ใช้วัดคอลัมน์
 * ตัวไทยกินที่กว้างกว่าตัวอังกฤษ แต่ Cordia New เป็นฟอนต์แคบ จึงคูณ 1.15 ไม่ใช่ 1.4
 */
const displayWidth = (s: string): number => {
    let w = 0;
    for (const ch of s) w += /[฀-๿]/.test(ch) ? 1.15 : 1;
    return w;
};

const cellText = (v: string | number | Date | null): string => {
    if (v === null || v === undefined) return '';
    if (v instanceof Date) return '00/00/0000';
    return typeof v === 'number' ? v.toLocaleString('en-US', { minimumFractionDigits: 2 }) : v;
};

/** ความกว้างที่พอดีเนื้อหา แต่ไม่แคบจนหัวตารางตก และไม่กว้างจนพิมพ์ไม่ลง */
const autoWidth = <T,>(col: ReportColumn<T>, rows: T[]): number => {
    if (col.width) return col.width;
    const widest = rows.reduce(
        (max, r) => Math.max(max, displayWidth(cellText(col.value(r)))),
        displayWidth(col.header),
    );
    return Math.min(Math.max(Math.ceil(widest) + 3, 10), 42);
};

const thin = { style: 'thin' as const, color: { argb: COLOR.border } };

/**
 * สร้างไฟล์รายงานตามมาตรฐาน แล้วคืนเป็น ArrayBuffer
 * แยกจากฟังก์ชันดาวน์โหลดเพื่อให้เทสต์เปิดไฟล์ตรวจได้โดยไม่ต้องมีเบราว์เซอร์
 */
// ชีตในไฟล์เดียวกันมีชนิดข้อมูลคนละแบบได้ จึงรับเป็น any ตรงนี้จุดเดียว
// ความปลอดภัยของชนิดข้อมูลอยู่ที่ ReportSheet<T> ตอนฝั่งเรียกใช้ประกาศคอลัมน์
export async function buildExcelReport(
    sheets: ReportSheet<any>[],
    meta: ReportMeta = {},
): Promise<ArrayBuffer> {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ระบบจัดการรถร่วม';
    wb.created = meta.at ?? new Date();

    for (const sheet of sheets) {
        const ws = wb.addWorksheet(safeSheetName(sheet.name), {
            views: [{ state: 'frozen', ySplit: 0 }],
            pageSetup: {
                paperSize: 9,               // A4
                orientation: 'landscape',
                fitToPage: true,
                fitToWidth: 1,
                fitToHeight: 0,
                margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
            },
        });
        const lastCol = Math.max(sheet.columns.length, 1);

        // ── แถบหัวรายงาน ──
        const titleRow = ws.addRow([sheet.title]);
        ws.mergeCells(titleRow.number, 1, titleRow.number, lastCol);
        titleRow.height = 30;
        titleRow.getCell(1).font = { name: FONT, size: SIZE.title, bold: true, color: { argb: COLOR.headerText } };
        titleRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
        titleRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        const stamp = (meta.at ?? new Date()).toLocaleString('th-TH', { dateStyle: 'long', timeStyle: 'short' });
        const subtitleParts = [sheet.subtitle, `ออกรายงาน ${stamp}`, meta.by ? `โดย ${meta.by}` : '']
            .filter(Boolean);
        const subRow = ws.addRow([subtitleParts.join(' · ')]);
        ws.mergeCells(subRow.number, 1, subRow.number, lastCol);
        subRow.height = 20;
        subRow.getCell(1).font = { name: FONT, size: SIZE.subtitle, color: { argb: COLOR.subtitleText } };
        subRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.titleBg } };
        subRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

        ws.addRow([]);

        // ── หัวตาราง ──
        const headerRow = ws.addRow(sheet.columns.map(c => c.header));
        headerRow.height = 28;
        headerRow.eachCell((cell, i) => {
            if (i > lastCol) return;
            cell.font = { name: FONT, size: SIZE.header, bold: true, color: { argb: COLOR.headerText } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.headerBg } };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = { top: thin, bottom: thin, left: thin, right: thin };
        });

        // ── ข้อมูล ──
        sheet.rows.forEach((row, idx) => {
            const values = sheet.columns.map(c => c.value(row));
            const line = ws.addRow(values);
            line.eachCell({ includeEmpty: true }, (cell, i) => {
                const col = sheet.columns[i - 1];
                if (!col) return;
                const type = col.type ?? 'text';
                cell.font = { name: FONT, size: SIZE.body, color: { argb: COLOR.text } };
                cell.numFmt = NUM_FMT[type];
                cell.alignment = {
                    vertical: 'middle',
                    horizontal: type === 'text' ? 'left' : type === 'date' ? 'center' : 'right',
                };
                cell.border = { top: thin, bottom: thin, left: thin, right: thin };
                // แถวสลับสีอ่อน ช่วยให้สายตาไม่หลุดบรรทัดในรายงานยาว ๆ
                if (idx % 2 === 1) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.zebra } };
                }
            });
        });

        // ── แถวรวม (เฉพาะคอลัมน์ที่สั่งให้รวม) ──
        if (sheet.columns.some(c => c.total) && sheet.rows.length) {
            const totals = sheet.columns.map((c, i) => {
                if (i === 0) return 'รวมทั้งสิ้น';
                if (!c.total) return null;
                return sheet.rows.reduce((sum, r) => {
                    const v = c.value(r);
                    return sum + (typeof v === 'number' ? v : 0);
                }, 0);
            });
            const totalRow = ws.addRow(totals);
            totalRow.height = 24;
            totalRow.eachCell({ includeEmpty: true }, (cell, i) => {
                const col = sheet.columns[i - 1];
                if (!col) return;
                cell.font = { name: FONT, size: SIZE.body, bold: true, color: { argb: COLOR.text } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR.totalBg } };
                cell.numFmt = col.total ? NUM_FMT[col.type ?? 'number'] : NUM_FMT.text;
                cell.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'right' };
                cell.border = { top: { style: 'medium', color: { argb: COLOR.headerBg } }, bottom: thin, left: thin, right: thin };
            });
        }

        // ── หมายเหตุท้ายชีต ──
        if (sheet.footnotes?.length) {
            ws.addRow([]);
            for (const text of sheet.footnotes) {
                const r = ws.addRow([text]);
                ws.mergeCells(r.number, 1, r.number, lastCol);
                r.getCell(1).font = { name: FONT, size: SIZE.note, italic: true, color: { argb: COLOR.muted } };
                r.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            }
        }

        ws.columns.forEach((col, i) => {
            const spec = sheet.columns[i];
            if (spec) col.width = autoWidth(spec, sheet.rows);
        });

        // ตรึงหัวตาราง + ตัวกรอง + ให้หัวตารางซ้ำทุกหน้าเวลาพิมพ์
        ws.views = [{ state: 'frozen', ySplit: headerRow.number }];
        ws.autoFilter = {
            from: { row: headerRow.number, column: 1 },
            to: { row: headerRow.number, column: lastCol },
        };
        ws.pageSetup.printTitlesRow = `${headerRow.number}:${headerRow.number}`;
    }

    return await wb.xlsx.writeBuffer() as ArrayBuffer;
}

/** สร้างไฟล์แล้วสั่งดาวน์โหลดในเบราว์เซอร์ */
export async function exportExcelReport(
    sheets: ReportSheet<any>[],
    fileName: string,
    meta: ReportMeta = {},
): Promise<void> {
    const buffer = await buildExcelReport(sheets, meta);
    downloadWorkbook(buffer, fileName);
}

/** ดาวน์โหลด ArrayBuffer เป็นไฟล์ .xlsx — ใช้ร่วมกับแบบฟอร์มหน่วยงานได้ด้วย */
export function downloadWorkbook(buffer: ArrayBuffer, fileName: string): void {
    const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
}

/** วันที่แบบไทยสำหรับตั้งชื่อไฟล์ เช่น 2569-08-21 */
export const thaiFileDate = (d: Date = new Date()): string =>
    `${d.getFullYear() + 543}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
