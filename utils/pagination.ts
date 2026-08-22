/**
 * ตรรกะแบ่งหน้าที่ตารางเรทใช้ — แยกออกมาเพื่อทดสอบได้
 *
 * ตารางเรทมีหลักร้อยแถว ถ้าวาดทีเดียวหมด หน้าจะหนักทั้งตอนโหลดและตอนพิมพ์ค้นหา
 * เพราะ React ต้องเทียบ DOM ทุกแถวทุกครั้งที่ผู้ใช้กดคีย์
 */

/** จำนวนแถวต่อหน้าของตารางเรท */
export const PAGE_SIZE = 20;

/** จำนวนหน้าทั้งหมด — อย่างน้อย 1 เสมอ แม้ไม่มีข้อมูล */
export const pageCount = (total: number, pageSize: number): number =>
    Math.max(1, Math.ceil(total / pageSize));

/**
 * เลขหน้าที่จะแสดงบนปุ่ม — ย่อตรงกลางด้วย null (จุดไข่ปลา) เมื่อหน้าเยอะ
 * แสดงหน้าแรก หน้าสุดท้าย และหน้ารอบ ๆ หน้าปัจจุบันเสมอ
 */
export function pageNumbers(totalPages: number, current: number): (number | null)[] {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const around = [current - 1, current, current + 1].filter(n => n > 1 && n < totalPages);
    const shown = [1, ...around, totalPages];
    const out: (number | null)[] = [];
    let prev = 0;
    for (const n of shown) {
        if (n - prev > 1) out.push(null);
        out.push(n);
        prev = n;
    }
    return out;
}

/** ตัดข้อมูลเฉพาะหน้าที่ต้องการ — หน้าที่เกินขอบเขตถูกดึงกลับมาที่หน้าสุดท้าย */
export function pageSlice<T>(items: T[], page: number, pageSize: number): T[] {
    const safe = Math.min(Math.max(1, page), pageCount(items.length, pageSize));
    return items.slice((safe - 1) * pageSize, safe * pageSize);
}
