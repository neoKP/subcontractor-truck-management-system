/**
 * ดาวน์โหลดไฟล์จาก Blob ให้ผู้ใช้
 *
 * ทำไมต้องมีไฟล์นี้ — เดิมโค้ดดาวน์โหลดกระจายอยู่ 7 ที่ แล้วเขียนไม่เหมือนกัน
 * บางที่แทรก <a> ลงหน้าเว็บ บางที่ไม่แทรก บางที่คืน URL ทันที บางที่ไม่คืนเลย
 * ผลคือปุ่มบางปุ่มกดแล้วเงียบ และบางปุ่มทำหน่วยความจำรั่ว
 *
 * รวมไว้ที่เดียวเพื่อให้แก้ครั้งเดียวแล้วถูกทุกที่
 */

/**
 * ระยะเวลาก่อนคืน object URL (มิลลิวินาที)
 *
 * ห้ามคืนทันทีหลัง click() — เบราว์เซอร์เริ่มดาวน์โหลดแบบไม่ประสานเวลา
 * ถ้าคืน URL ก่อนที่มันจะอ่านข้อมูลเสร็จ ไฟล์จะไม่ถูกดาวน์โหลด
 * และไม่มี error ให้เห็นเลย — อาการคือ "กดปุ่มแล้วไม่มีอะไรเกิดขึ้น"
 *
 * ยิ่งไฟล์ใหญ่ยิ่งเจอบ่อย เช่นตารางเรทหลายร้อยแถว หรือ PDF ที่ฝังฟอนต์ไทย
 * 1 นาทีเผื่อไว้มากเกินพอ หลังจากนั้นหน่วยความจำถูกคืนตามปกติ
 */
const REVOKE_DELAY_MS = 60_000;

/**
 * สั่งเบราว์เซอร์ดาวน์โหลด blob เป็นไฟล์ชื่อที่กำหนด
 *
 * @param blob     ข้อมูลไฟล์
 * @param fileName ชื่อไฟล์พร้อมนามสกุล เช่น 'รายงาน.xlsx'
 */
export function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    try {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;

        /*
          ต้องแทรก <a> ลงหน้าเว็บก่อนคลิก

          Chrome ยอมให้คลิกลิงก์ที่ยังไม่อยู่ในหน้าเว็บ แต่ Firefox ไม่ยอม —
          a.click() จะไม่เกิดอะไรขึ้นเลย และไม่โยน error ด้วย
        */
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } finally {
        // คืน URL เสมอ แม้ตอนคลิกจะพัง ไม่อย่างนั้นหน่วยความจำรั่ว
        setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
    }
}

/** ดาวน์โหลดข้อความเป็นไฟล์ เช่น CSV — ใส่ BOM ให้ Excel อ่านภาษาไทยออก */
export function downloadTextFile(
    text: string,
    fileName: string,
    mimeType = 'text/csv;charset=utf-8;',
): void {
    // \uFEFF (BOM) จำเป็นสำหรับ CSV ภาษาไทย ไม่งั้น Excel เปิดมาเป็นตัวยึกยือ
    const needsBom = mimeType.startsWith('text/csv') && !text.startsWith('\uFEFF');
    downloadBlob(new Blob([needsBom ? `\uFEFF${text}` : text], { type: mimeType }), fileName);
}
