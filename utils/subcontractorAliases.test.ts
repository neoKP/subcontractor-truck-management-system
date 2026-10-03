import { describe, it, expect } from 'vitest';
import { canonicalSubcontractor, isSameSubcontractor, aliasesOf } from './subcontractorAliases';

describe('canonicalSubcontractor', () => {
    it('แปลงชื่อที่หน่วยงานใช้ในไฟล์เรทเป็นชื่อในระบบ', () => {
        expect(canonicalSubcontractor('รถร่วมคุณหนึ่ง')).toBe('รถร่วมวสรรณ์');
    });

    it('รวมชื่อที่สะกดต่างกันของเจ้าเดียวกัน', () => {
        expect(canonicalSubcontractor('รถร่วมวสรรณ์')).toBe('รถร่วมวสรรณ์');
        expect(canonicalSubcontractor('รถร่วมนายวสรรณ์')).toBe('รถร่วมวสรรณ์');
        expect(canonicalSubcontractor('วิวัฒน์ทราน')).toBe('วิวัฒน์ทรานส์');
    });

    it('ชื่อมาตรฐานไม่ถูกเปลี่ยน', () => {
        expect(canonicalSubcontractor('รถร่วมคุณวสรรณ์')).toBe('รถร่วมวสรรณ์');
        expect(canonicalSubcontractor('วิวัฒน์ทรานส์')).toBe('วิวัฒน์ทรานส์');
    });

    it('ตัดช่องว่างหัวท้ายและยุบช่องว่างซ้ำ', () => {
        expect(canonicalSubcontractor('  รถร่วมคุณหนึ่ง  ')).toBe('รถร่วมวสรรณ์');
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
        expect(aliasesOf('รถร่วมวสรรณ์').sort()).toEqual(
            ['รถร่วมคุณหนึ่ง', 'รถร่วมนายวสรรณ์', 'รถร่วมคุณวสรรณ์',
                'รถร่วม วสรรณ์', 'รถร่วม คุณวสรรณ์', 'วสรรณ์'].sort()
        );
    });

    it('ถามด้วยชื่อพ้องก็ได้คำตอบเดียวกัน', () => {
        expect(aliasesOf('รถร่วมคุณหนึ่ง').sort()).toEqual(aliasesOf('รถร่วมวสรรณ์').sort());
    });

    it('ชื่อที่ไม่มีชื่อพ้องได้อาร์เรย์ว่าง', () => {
        expect(aliasesOf('PTK')).toEqual([]);
    });
});

describe('รถร่วมวสรรณ์ — ทุกสะกดต้องเป็นเจ้าเดียวกัน', () => {
    // ผู้ใช้ยืนยัน 26 ส.ค. 2569: สามชื่อนี้คือเจ้าเดียวกัน
    // "รถร่วม วสรรณ์" มาจากไฟล์เรท v3 ซึ่งเขียนแบบเว้นวรรคและไม่มี "คุณ"
    it.each([
        'รถร่วมคุณวสรรณ์',
        'รถร่วมคุณหนึ่ง',
        'รถร่วม วสรรณ์',
        'รถร่วมวสรรณ์',
        'รถร่วมนายวสรรณ์',
        'รถร่วม คุณวสรรณ์',
    ])('%s -> รถร่วมวสรรณ์', (name) => {
        expect(canonicalSubcontractor(name)).toBe('รถร่วมวสรรณ์');
    });

    it('เว้นวรรคเกินหรือช่องว่างหัวท้ายก็ยังจับคู่ได้', () => {
        expect(canonicalSubcontractor('  รถร่วม  วสรรณ์  ')).toBe('รถร่วมวสรรณ์');
    });
});

describe('ชื่อย่อจากไฟล์อัตราผันน้ำมัน', () => {
    it('"วสรรณ์" คือ รถร่วมวสรรณ์ เจ้าเดียวกับ 46 เส้นทางเดิม', () => {
        expect(canonicalSubcontractor('วสรรณ์')).toBe('รถร่วมวสรรณ์');
    });
});

describe('เบญจวรรณ ขนส่ง — ตารางเรทเขียนติดกัน ใบงานเขียนเว้นวรรค', () => {
    it('ชื่อในตารางเรทต้องเป็นเจ้าเดียวกับในใบงาน', () => {
        // ถ้าไม่ตรงกัน ใบงาน 406 ใบจะหาเรทไม่เจอเลย
        expect(isSameSubcontractor('เบญจวรรณขนส่ง', 'เบญจวรรณ ขนส่ง')).toBe(true);
    });

    it('ชื่อในใบงานต้องคงเดิม ไม่ให้รายงานเปลี่ยนชื่อ', () => {
        expect(canonicalSubcontractor('เบญจวรรณ ขนส่ง')).toBe('เบญจวรรณ ขนส่ง');
    });
});

describe('ชื่อในตารางเรทที่ผู้ใช้ยืนยันว่าเป็นเจ้าเดียวกับในใบงาน (3 ต.ค. 2569)', () => {
    const PAIRS: [string, string][] = [
        ['SHIPPER', 'บจก.ชิปเปอร์ เทคโนโลยี'],
        ['KNN DYNAMIC', 'KNN'],
        ['โอเคนะ แม่สอด', 'โอเคนะ'],
        ['YSK TRANSPORT', 'YSK'],
        ['พรแม่ย่า', 'รถร่วมพรแม่ย่า'],
        ['พรมณี 24h', 'พรมณี 24เอช ทรานสปอร์ต'],
    ];

    it.each(PAIRS)('"%s" ในตารางเรท = "%s" ในใบงาน', (rate, job) => {
        expect(isSameSubcontractor(rate, job)).toBe(true);
    });

    it.each(PAIRS)('ชื่อในใบงาน "%s" -> "%s" ต้องคงเดิม ไม่ให้รายงานเปลี่ยนชื่อ', (_rate, job) => {
        expect(canonicalSubcontractor(job)).toBe(job);
    });

    it('ไม่ทำให้เจ้าอื่นกลายเป็นเจ้าเดียวกันไปด้วย', () => {
        // KNN กับ YSK เป็นคนละเจ้า — การแปลงชื่อต้องไม่ลามข้ามคู่
        expect(isSameSubcontractor('KNN DYNAMIC', 'YSK')).toBe(false);
        expect(isSameSubcontractor('SHIPPER', 'โอเคนะ')).toBe(false);
    });
});

describe('aliasesOf — หลังยืนยันชื่อจากตารางเรท', () => {
    it('ค้นใบงานเก่าของ KNN ต้องเจอชื่อที่ตารางเรทใช้ด้วย', () => {
        expect(aliasesOf('KNN')).toEqual(['KNN DYNAMIC']);
    });
});
