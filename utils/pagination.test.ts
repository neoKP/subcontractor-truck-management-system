import { describe, it, expect } from 'vitest';
import { pageCount, pageNumbers, pageSlice, PAGE_SIZE } from './pagination';

describe('pageCount', () => {
    it('คืนอย่างน้อย 1 หน้าแม้ไม่มีข้อมูล', () => {
        expect(pageCount(0, 20)).toBe(1);
    });

    it('ปัดขึ้นเมื่อแบ่งไม่ลงตัว', () => {
        expect(pageCount(164, 20)).toBe(9);
        expect(pageCount(20, 20)).toBe(1);
        expect(pageCount(21, 20)).toBe(2);
    });
});

describe('pageSlice', () => {
    const items = Array.from({ length: 164 }, (_, i) => i + 1);

    it('หน้าแรกได้ 20 แถวแรก', () => {
        expect(pageSlice(items, 1, 20)).toEqual(items.slice(0, 20));
    });

    it('หน้าสุดท้ายได้เศษที่เหลือ', () => {
        expect(pageSlice(items, 9, 20)).toEqual(items.slice(160));
        expect(pageSlice(items, 9, 20).length).toBe(4);
    });

    it('ทุกหน้ารวมกันได้ข้อมูลครบ ไม่ซ้ำไม่ขาด', () => {
        const all: number[] = [];
        for (let p = 1; p <= pageCount(items.length, 20); p++) all.push(...pageSlice(items, p, 20));
        expect(all).toEqual(items);
    });

    it('หน้าที่เกินขอบเขตถูกดึงกลับมาหน้าสุดท้าย ไม่คืนตารางว่าง', () => {
        expect(pageSlice(items, 99, 20)).toEqual(items.slice(160));
    });

    it('หน้าติดลบหรือศูนย์ถือเป็นหน้าแรก', () => {
        expect(pageSlice(items, 0, 20)).toEqual(items.slice(0, 20));
        expect(pageSlice(items, -3, 20)).toEqual(items.slice(0, 20));
    });

    it('ข้อมูลว่างคืนอาร์เรย์ว่าง', () => {
        expect(pageSlice([], 1, 20)).toEqual([]);
    });
});

describe('pageNumbers', () => {
    it('แสดงครบทุกหน้าเมื่อมีไม่เกิน 7 หน้า', () => {
        expect(pageNumbers(5, 3)).toEqual([1, 2, 3, 4, 5]);
        expect(pageNumbers(7, 1)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('ย่อด้วยจุดไข่ปลาเมื่ออยู่กลาง ๆ', () => {
        expect(pageNumbers(20, 10)).toEqual([1, null, 9, 10, 11, null, 20]);
    });

    it('มีหน้าแรกและหน้าสุดท้ายเสมอ', () => {
        for (const cur of [1, 5, 10, 20]) {
            const out = pageNumbers(20, cur);
            expect(out[0]).toBe(1);
            expect(out[out.length - 1]).toBe(20);
        }
    });

    it('ไม่มีเลขหน้าซ้ำ', () => {
        for (const cur of [1, 2, 10, 19, 20]) {
            const nums = pageNumbers(20, cur).filter((n): n is number => n !== null);
            expect(new Set(nums).size).toBe(nums.length);
        }
    });

    it('มีหน้าปัจจุบันอยู่ในรายการเสมอ', () => {
        for (const cur of [1, 3, 12, 20]) {
            expect(pageNumbers(20, cur)).toContain(cur);
        }
    });
});

describe('PAGE_SIZE', () => {
    it('ตั้งไว้ที่ 20 แถวต่อหน้า', () => {
        expect(PAGE_SIZE).toBe(20);
    });
});
