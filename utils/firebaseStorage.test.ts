import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
  คุมพฤติกรรมการอัปโหลดรูป POD เป็นชุด

  บั๊กจริงที่เจอ: หน้ายืนยันจบงานแนบรูปได้ถึง 20 รูป แล้วโค้ดเดิมใช้ Promise.all
  ยิงทุกไฟล์พร้อมกันหมด · ถ้าไฟล์เดียวล้ม Promise.all ทำให้ล้มทั้งชุด
  ทั้งที่อีก 19 ไฟล์ขึ้นไปเรียบร้อยแล้ว · และหน้าจอไม่บอกอะไรเลย
  คนกดจึงเห็นแค่ "กดปุ่มแล้วไม่มีอะไรเกิดขึ้น"
*/

const uploadMock = vi.fn();
vi.mock('./nasUpload', () => ({
    uploadToNAS: (...args: unknown[]) => uploadMock(...args),
}));
vi.mock('./imageCompression', () => ({
    // ไม่บีบอัดจริงในเทสต์ — คืนไฟล์เดิมไป เพื่อวัดเฉพาะตรรกะการแบ่งชุด
    compressImageFile: async (f: unknown) => f,
}));

const { uploadFilesToStorage } = await import('./firebaseStorage');

/** ไฟล์จำลอง — ไม่ต้องมีเนื้อจริง เพราะการบีบอัดถูก mock ไว้ */
const mkFile = (name: string): File =>
    ({ name, type: 'image/jpeg' } as unknown as File);

describe('uploadFilesToStorage — อัปโหลดรูป POD', () => {
    beforeEach(() => {
        uploadMock.mockReset();
        uploadMock.mockImplementation(async (_blob: unknown, path: string) => `https://nas/${path}`);
    });

    afterEach(() => vi.restoreAllMocks());

    it('อัปโหลดครบทุกไฟล์ และคืน URL เรียงตามลำดับเดิม', async () => {
        const files = ['a.jpg', 'b.jpg', 'c.jpg'].map(mkFile);

        const urls = await uploadFilesToStorage(files, 'pod-images/JOB-1');

        expect(urls).toHaveLength(3);
        expect(uploadMock).toHaveBeenCalledTimes(3);
        // ลำดับต้องตรงกับไฟล์ที่ส่งเข้ามา ไม่ใช่ลำดับที่อัปเสร็จก่อน
        expect(urls[0]).toContain('_0_a.jpg');
        expect(urls[1]).toContain('_1_b.jpg');
        expect(urls[2]).toContain('_2_c.jpg');
    });

    /*
      ข้อสำคัญที่สุด: ห้ามยิงพร้อมกันทั้งหมด

      20 ไฟล์ = เปิด 20 การเชื่อมต่อไป NAS พร้อมกัน และเบราว์เซอร์ต้องถอดรหัส
      กับบีบอัดทุกรูปพร้อมกันด้วย · บนมือถือหรือเน็ตช้าจะ timeout
    */
    it('ไม่ยิงพร้อมกันเกิน 4 ไฟล์ แม้จะแนบมา 20 รูป', async () => {
        let running = 0;
        let peak = 0;
        uploadMock.mockImplementation(async (_b: unknown, path: string) => {
            running++;
            if (running > peak) peak = running;
            await new Promise(r => setTimeout(r, 1));
            running--;
            return `https://nas/${path}`;
        });

        const files = Array.from({ length: 20 }, (_, i) => mkFile(`f${i}.jpg`));
        const urls = await uploadFilesToStorage(files, 'pod-images/JOB-2');

        expect(urls).toHaveLength(20);
        expect(peak).toBeLessThanOrEqual(4);
        expect(peak).toBeGreaterThan(1);   // ต้องยังขนานกันบ้าง ไม่ใช่ทีละไฟล์
    });

    it('ไฟล์เดียวล้ม ต้องโยน error ออกมา ไม่กลืนเงียบ', async () => {
        uploadMock.mockImplementation(async (_b: unknown, path: string) => {
            if (path.includes('bad.jpg')) throw new Error('NAS upload failed: 500');
            return `https://nas/${path}`;
        });

        const files = ['ok1.jpg', 'bad.jpg', 'ok2.jpg'].map(mkFile);

        // หน้ายืนยันจบงานต้องได้ error ไปแสดง ไม่ใช่ได้ URL ที่ขาดไฟล์ไปเงียบ ๆ
        await expect(uploadFilesToStorage(files, 'pod-images/JOB-3'))
            .rejects.toThrow('NAS upload failed');
    });

    it('ชื่อไฟล์ที่มีอักขระพิเศษถูกแปลงให้ปลอดภัย', async () => {
        // ชื่อไฟล์จากกล้องมือถือมีช่องว่างและภาษาไทยได้ ต้องไม่ทำให้ path เพี้ยน
        const urls = await uploadFilesToStorage([mkFile('รูป POD (1).jpg')], 'pod-images/JOB-4');

        expect(urls[0]).not.toContain(' ');
        expect(urls[0]).toMatch(/_0_.*\.jpg$/);
    });

    it('ไม่มีไฟล์เลย ต้องคืนรายการว่าง ไม่พัง', async () => {
        const urls = await uploadFilesToStorage([], 'pod-images/JOB-5');

        expect(urls).toEqual([]);
        expect(uploadMock).not.toHaveBeenCalled();
    });
});
