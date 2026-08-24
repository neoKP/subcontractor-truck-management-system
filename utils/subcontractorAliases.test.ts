import { describe, it, expect } from 'vitest';
import { canonicalSubcontractor, isSameSubcontractor, aliasesOf } from './subcontractorAliases';

describe('canonicalSubcontractor', () => {
    it('แปลงชื่อที่หน่วยงานใช้ในไฟล์เรทเป็นชื่อในระบบ', () => {
        expect(canonicalSubcontractor('รถร่วมคุณหนึ่ง')).toBe('รถร่วมคุณวสรรณ์');
    });

    it('รวมชื่อที่สะกดต่างกันของเจ้าเดียวกัน', () => {
        expect(canonicalSubcontractor('รถร่วมวสรรณ์')).toBe('รถร่วมคุณวสรรณ์');
        expect(canonicalSubcontractor('รถร่วมนายวสรรณ์')).toBe('รถร่วมคุณวสรรณ์');
        expect(canonicalSubcontractor('วิวัฒน์ทราน')).toBe('วิวัฒน์ทรานส์');
    });

    it('ชื่อมาตรฐานไม่ถูกเปลี่ยน', () => {
        expect(canonicalSubcontractor('รถร่วมคุณวสรรณ์')).toBe('รถร่วมคุณวสรรณ์');
        expect(canonicalSubcontractor('วิวัฒน์ทรานส์')).toBe('วิวัฒน์ทรานส์');
    });

    it('ตัดช่องว่างหัวท้ายและยุบช่องว่างซ้ำ', () => {
        expect(canonicalSubcontractor('  รถร่วมคุณหนึ่ง  ')).toBe('รถร่วมคุณวสรรณ์');
        expect(canonicalSubcontractor('เบญจวรรณ   ขนส่ง')).toBe('เบญจวรรณ ขนส่ง');
    });

    it('ชื่อที่ไม่อยู่ในรายการคืนกลับตามเดิม ไม่เดา', () => {
        expect(canonicalSubcontractor('KNN')).toBe('KNN');
        expect(canonicalSubcontractor('เบญจวรรณ ขนส่ง')).toBe('เบญจวรรณ ขนส่ง');
    });

    it('ชื่อคล้ายกันแต่คนละเจ้า ต้องไม่ถูกรวม', () => {
        // PTK กับ พีทีเคทรานสปอร์ต เส้นทางไม่ทับกันเลย — คนละเจ้าจริง
        expect(canonicalSubcontractor('PTK')).toBe('PTK');
        expect(canonicalSubcontractor('พีทีเคทรานสปอร์ต(พี่อ้อย)')).toBe('พีทีเคทรานสปอร์ต(พี่อ้อย)');
        expect(isSameSubcontractor('PTK', 'พีทีเคทรานสปอร์ต(พี่อ้อย)')).toBe(false);

        // นิวทำดี กับ นิวทำดี KTD ราคาต่างกัน 420 บาท — ยังไม่รวมจนกว่าจะมีเรทน้ำมันรองรับ
        expect(canonicalSubcontractor('นิวทำดี KTD')).toBe('นิวทำดี KTD');
        expect(isSameSubcontractor('นิวทำดี', 'นิวทำดี KTD')).toBe(false);
    });

    it('ค่าว่างไม่ทำให้พัง', () => {
        expect(canonicalSubcontractor('')).toBe('');
        expect(canonicalSubcontractor(undefined as unknown as string)).toBe('');
    });
});

describe('isSameSubcontractor', () => {
    it('ชื่อพ้องถือว่าเป็นเจ้าเดียวกัน', () => {
        expect(isSameSubcontractor('รถร่วมคุณหนึ่ง', 'รถร่วมคุณวสรรณ์')).toBe(true);
        expect(isSameSubcontractor('รถร่วมวสรรณ์', 'รถร่วมนายวสรรณ์')).toBe(true);
    });

    it('คนละเจ้าคือคนละเจ้า', () => {
        expect(isSameSubcontractor('KNN', 'YSK')).toBe(false);
    });
});

describe('aliasesOf', () => {
    it('คืนชื่อพ้องทั้งหมดของชื่อมาตรฐาน', () => {
        expect(aliasesOf('รถร่วมคุณวสรรณ์').sort()).toEqual(
            ['รถร่วมคุณหนึ่ง', 'รถร่วมนายวสรรณ์', 'รถร่วมวสรรณ์'].sort()
        );
    });

    it('ถามด้วยชื่อพ้องก็ได้คำตอบเดียวกัน', () => {
        expect(aliasesOf('รถร่วมคุณหนึ่ง').sort()).toEqual(aliasesOf('รถร่วมคุณวสรรณ์').sort());
    });

    it('ชื่อที่ไม่มีชื่อพ้องได้อาร์เรย์ว่าง', () => {
        expect(aliasesOf('KNN')).toEqual([]);
    });
});
