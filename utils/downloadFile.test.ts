import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downloadBlob, downloadTextFile } from './downloadFile';

/*
  เทสต์ชุดนี้คุ้มบั๊กจริงที่เคยทำให้ปุ่มดาวน์โหลดกดแล้วเงียบ

  ตอนที่เจอ ปุ่ม Export กับปุ่มดาวน์โหลดแบบฟอร์มกดแล้วไม่มีอะไรเกิดขึ้นเลย
  ไม่มี error ให้เห็นด้วย สาเหตุมีสองอย่าง
    1. คืน object URL ทันทีหลัง click() — เบราว์เซอร์ยังอ่านไฟล์ไม่ทัน
    2. ไม่ได้แทรก <a> ลงหน้าเว็บ — Firefox ไม่ยอมให้คลิกลิงก์ที่ไม่อยู่ใน DOM

  โปรเจกต์นี้ยังไม่ได้ติดตั้ง jsdom (เทสต์เดิมเป็นตรรกะล้วนทั้งหมด)
  จึงประกอบ DOM จำลองเล็ก ๆ เองแทนการเพิ่ม dependency ใหม่เพื่อไฟล์เดียว
*/

interface FakeAnchor {
    href: string;
    download: string;
    style: Record<string, string>;
    click: () => void;
}

/** สภาพแวดล้อมจำลอง คืนสิ่งที่เกิดขึ้นจริงตอนดาวน์โหลดออกมาให้ตรวจ */
function setupFakeDom() {
    const state = {
        /** ลิงก์อยู่ในหน้าเว็บแล้วหรือยัง ณ วินาทีที่กดคลิก */
        inDomAtClickTime: false,
        clicked: false,
        anchor: null as FakeAnchor | null,
        children: [] as unknown[],
        revoked: [] as string[],
        blobs: [] as Blob[],
    };

    const anchor: FakeAnchor = {
        href: '',
        download: '',
        style: {},
        click() {
            state.clicked = true;
            state.inDomAtClickTime = state.children.includes(anchor);
        },
    };
    state.anchor = anchor;

    vi.stubGlobal('document', {
        createElement: (tag: string) => {
            if (tag !== 'a') throw new Error(`ไม่ได้จำลอง <${tag}>`);
            return anchor;
        },
        body: {
            appendChild: (el: unknown) => { state.children.push(el); return el; },
            removeChild: (el: unknown) => {
                const i = state.children.indexOf(el);
                if (i >= 0) state.children.splice(i, 1);
                return el;
            },
        },
    });

    vi.stubGlobal('URL', {
        createObjectURL: (b: Blob) => { state.blobs.push(b); return 'blob:mock-url'; },
        revokeObjectURL: (u: string) => { state.revoked.push(u); },
    });

    return state;
}

describe('downloadBlob', () => {
    let dom: ReturnType<typeof setupFakeDom>;

    beforeEach(() => {
        vi.useFakeTimers();
        dom = setupFakeDom();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    it('ต้องแทรก <a> ลงหน้าเว็บก่อนคลิก', () => {
        downloadBlob(new Blob(['x']), 'test.xlsx');

        expect(dom.clicked).toBe(true);
        expect(dom.inDomAtClickTime).toBe(true);
    });

    it('เก็บกวาด <a> ออกหลังคลิก ไม่ทิ้งค้างในหน้าเว็บ', () => {
        downloadBlob(new Blob(['x']), 'test.xlsx');

        expect(dom.children).toHaveLength(0);
    });

    it('ต้องไม่คืน object URL ทันทีหลังคลิก — ไม่งั้นดาวน์โหลดล้มเงียบ', () => {
        downloadBlob(new Blob(['x']), 'test.xlsx');

        expect(dom.revoked).toEqual([]);
    });

    it('คืน object URL ทีหลัง เพื่อไม่ให้หน่วยความจำรั่ว', () => {
        downloadBlob(new Blob(['x']), 'test.xlsx');

        vi.advanceTimersByTime(60_000);

        expect(dom.revoked).toEqual(['blob:mock-url']);
    });

    it('ตั้งชื่อไฟล์ตามที่ส่งเข้ามา รองรับภาษาไทย', () => {
        downloadBlob(new Blob(['x']), 'รายงานประจำวัน.xlsx');

        expect(dom.anchor?.download).toBe('รายงานประจำวัน.xlsx');
        expect(dom.anchor?.href).toBe('blob:mock-url');
    });

    it('คืน object URL แม้ตอนคลิกจะพัง จะได้ไม่รั่ว', () => {
        dom.anchor!.click = () => { throw new Error('คลิกพัง'); };

        expect(() => downloadBlob(new Blob(['x']), 'test.xlsx')).toThrow('คลิกพัง');
        vi.advanceTimersByTime(60_000);

        expect(dom.revoked).toEqual(['blob:mock-url']);
    });
});

describe('downloadTextFile', () => {
    let dom: ReturnType<typeof setupFakeDom>;

    beforeEach(() => {
        vi.useFakeTimers();
        dom = setupFakeDom();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    /*
      ต้องอ่านเป็นไบต์ ไม่ใช่ .text()

      Blob.text() ถอดรหัสแบบ UTF-8 แล้ว "กลืน" BOM ทิ้งไปตามสเปก
      ถ้าตรวจด้วย .text() จะมองไม่เห็น BOM ทั้งที่มันอยู่ในไฟล์จริง
      Excel อ่านไบต์ตรง ๆ เราจึงต้องตรวจไบต์ให้ตรงกับที่ Excel เห็น
    */
    const UTF8_BOM = [0xef, 0xbb, 0xbf];

    const firstBytes = async (n: number): Promise<number[]> =>
        [...new Uint8Array(await dom.blobs[0].arrayBuffer()).slice(0, n)];

    /** เนื้อความหลังถอดรหัสแล้ว (ไม่มี BOM) ใช้ตรวจตัวอักษร */
    const captured = () => dom.blobs[0].text();

    it('ใส่ BOM ให้ CSV เพื่อให้ Excel อ่านภาษาไทยออก', async () => {
        downloadTextFile('ชื่อ,ราคา\nกรุงเทพ,1000', 'test.csv');

        expect(await firstBytes(3)).toEqual(UTF8_BOM);
        expect(await captured()).toContain('กรุงเทพ');
    });

    it('ไม่ใส่ BOM ซ้ำถ้าผู้เรียกใส่มาแล้ว', async () => {
        downloadTextFile('﻿ชื่อ,ราคา', 'test.csv');

        // ต้องมี BOM ชุดเดียว ไม่ใช่สองชุดซ้อนกัน
        expect(await firstBytes(6)).toEqual([...UTF8_BOM, 0xe0, 0xb8, 0x8a]);
    });

    it('ไม่ใส่ BOM ให้ไฟล์ที่ไม่ใช่ CSV', async () => {
        downloadTextFile('{"a":1}', 'test.json', 'application/json');

        expect(await firstBytes(3)).not.toEqual(UTF8_BOM);
    });

    it('ส่งชื่อไฟล์ต่อไปให้ downloadBlob ตามเดิม', () => {
        downloadTextFile('a,b', 'รายงาน.csv');

        expect(dom.anchor?.download).toBe('รายงาน.csv');
    });
});
