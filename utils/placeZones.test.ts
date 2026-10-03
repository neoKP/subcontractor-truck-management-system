import { describe, it, expect } from 'vitest';
import { inZone, matchRoute, rowOrigin } from './placeZones';
import { findFuelRateOptions, hasFuelRateRoute } from './fuelRateLookup';
import type { FuelRateRow } from './fuelRateParser';

/*
  เขตราคา — ตาราง YSK คิดตามเขต ("กทม ปริมณฑล → นครสวรรค์") แต่ใบงานเขียนชื่อร้าน

  หลักสำคัญ
    1. ชื่อตรงชนะเขตเสมอ — ราคาเฉพาะร้านคือสิ่งที่หน่วยงานตั้งใจกำหนด
    2. เขตเป็น "อยู่ใน" ไม่ใช่ "คือ" — ต้องไม่ทำให้ตารางอื่นที่เขียนชื่อร้านตรง ๆ หาไม่เจอ
    3. ไม่อยู่ในรายชื่อ = ไม่จับคู่ ไม่เดาจากชื่อจังหวัด
*/

const row = (over: Partial<FuelRateRow> = {}): FuelRateRow => ({
    seq: 1,
    company: 'YSK TRANSPORT',
    origin: 'กทม ปริมณฑล',
    destination: 'นครสวรรค์',
    truckType: '10W',
    note: '',
    bands: [{ fuelFrom: 38.01, fuelTo: 39.00, price: 15000 }],
    ...over,
});

describe('inZone', () => {
    it('ร้านที่อยู่ในรายชื่อของเขต', () => {
        expect(inZone('กทม ปริมณฑล', 'นีโอคอร์ปอเรท คลอง13')).toBe(true);
        expect(inZone('นครสวรรค์', 'ร้านลอนดอนโฮลเซลล์ ตาคลี นครสวรรค์')).toBe(true);
    });

    it('ไม่อยู่ในรายชื่อ = ไม่ใช่ แม้ชื่อจะมีชื่อจังหวัด', () => {
        // ห้ามเดาจากคำว่า "นครสวรรค์" ในชื่อ — ต้องผ่านการยืนยันก่อน
        expect(inZone('นครสวรรค์', 'ร้านใหม่ที่ไม่เคยมี นครสวรรค์')).toBe(false);
    });

    it('ร้านที่ยังรอหน่วยงานยืนยัน ต้องยังไม่อยู่ในเขต', () => {
        // สุพรรณบุรีไม่ใช่ปริมณฑล แม้ราคาจะตรง — ส่งถามหน่วยงานแล้ว
        expect(inZone('กทม ปริมณฑล', 'ฟ้าอรุณ-อู่ทอง สุพรรณบุรี')).toBe(false);
        expect(inZone('กทม ปริมณฑล', 'สหพัฒน์ศรีราชา')).toBe(false);
    });

    it('ชื่อว่างไม่อยู่ในเขตไหน', () => {
        expect(inZone('กทม ปริมณฑล', '')).toBe(false);
    });
});

describe('matchRoute', () => {
    it('ชื่อตรงทั้งสองฝั่ง = exact', () => {
        expect(matchRoute(row({ origin: 'ซีโน่ คลองส่งน้ำ', destination: 'แม่สอด' }), 'ซีโน่ คลองส่งน้ำ', 'แม่สอด')).toBe('exact');
    });

    it('อยู่ในเขตทั้งสองฝั่ง = inferred', () => {
        expect(matchRoute(row(), 'นีโอคอร์ปอเรท คลอง13', 'ร้านสล.โฮลเซลล์ นครสวรรค์')).toBe('inferred');
    });

    it('ฝั่งใดฝั่งหนึ่งไม่ตรงและไม่อยู่ในเขต = ไม่จับคู่', () => {
        expect(matchRoute(row(), 'นีโอคอร์ปอเรท คลอง13', 'เมืองสุโขทัย')).toBeNull();
        expect(matchRoute(row(), 'ร้านที่ไม่รู้จัก', 'เมืองนครสวรรค์')).toBeNull();
    });

    it('ใบงานที่ไม่มีต้นทางหรือปลายทาง ไม่จับคู่', () => {
        expect(matchRoute(row({ origin: 'งานย่อย', destination: 'แม่สอด' }), '', 'แม่สอด')).toBeNull();
    });

    it('"งานย่อย" = ต้นทางไหนก็ได้ แต่ปลายทางยังต้องตรง', () => {
        const r = row({ company: 'โอเคนะ แม่สอด', origin: 'งานย่อย', destination: 'แม่สอด' });
        expect(matchRoute(r, 'เพนส์', 'แม่สอด')).toBe('inferred');
        expect(matchRoute(r, 'เพนส์', 'เชียงใหม่')).toBeNull();
    });
});

describe('rowOrigin — ตารางพรมณีเขียนต้นทางซ้ำกับปลายทาง', () => {
    const pm = row({ company: 'พรมณี 24h', origin: 'แม็คโครศาลายา', destination: 'แม็คโครศาลายา', truckType: '10W' });

    it('ต้นทางที่ใช้จับคู่คือสหพัฒน์ศรีราชา', () => {
        expect(rowOrigin(pm)).toEqual({ origin: 'สหพัฒน์ศรีราชา', fixed: true });
    });

    it('ใบงานจากสหพัฒน์ศรีราชาจับคู่ได้ แต่ต้องบอกว่าเป็นการตีความ', () => {
        expect(matchRoute(pm, 'สหพัฒน์ศรีราชา', 'แม็คโคร ศาลายา')).toBe('inferred');
    });

    it('ต้นทางอื่นต้องไม่จับคู่', () => {
        expect(matchRoute(pm, 'น้ำมันพืชไทย', 'แม็คโคร ศาลายา')).toBeNull();
    });

    it('เจ้าอื่นที่ต้นทางเท่ากับปลายทาง ต้องไม่ถูกแก้', () => {
        const other = row({ company: 'YSK TRANSPORT', origin: 'แม่สอด', destination: 'แม่สอด' });
        expect(rowOrigin(other).fixed).toBe(false);
    });

    it('ถ้าหน่วยงานแก้ไฟล์แล้ว (ต้นทางไม่ซ้ำปลายทาง) ต้องใช้ตามไฟล์', () => {
        const fixedFile = row({ company: 'พรมณี 24h', origin: 'สหพัฒน์ ศรีราชา', destination: 'แม็คโครศาลายา' });
        expect(rowOrigin(fixedFile)).toEqual({ origin: 'สหพัฒน์ ศรีราชา', fixed: false });
    });
});

describe('หน้าเปิดใบงาน — ชื่อตรงชนะเขต', () => {
    const zoneRow = row({ seq: 1, bands: [{ fuelFrom: 38.01, fuelTo: 39.00, price: 15000 }] });
    const shopRow = row({
        seq: 2, origin: 'นีโอคอร์ปอเรท คลอง13', destination: 'ร้านสล.โฮลเซลล์ นครสวรรค์',
        bands: [{ fuelFrom: 38.01, fuelTo: 39.00, price: 14200 }],
    });
    const q = { origin: 'นีโอคอร์ปอเรท คลอง13', destination: 'ร้านสล.โฮลเซลล์ นครสวรรค์', truckType: '10w' };

    it('มีแถวชื่อตรงของเจ้าเดียวกัน ต้องไม่โชว์ราคาเขตซ้ำ', () => {
        const out = findFuelRateOptions([zoneRow, shopRow], q, 38.5);
        expect(out.map(o => o.price)).toEqual([14200]);
    });

    it('ไม่มีแถวชื่อตรง ใช้ราคาเขต', () => {
        const out = findFuelRateOptions([zoneRow], q, 38.5);
        expect(out.map(o => o.price)).toEqual([15000]);
    });

    it('แถวชื่อตรงของเจ้าอื่น ไม่ทำให้ราคาเขตของ YSK หายไป', () => {
        const knn = row({ ...shopRow, company: 'KNN DYNAMIC' });
        const out = findFuelRateOptions([zoneRow, knn], q, 38.5);
        expect(out.map(o => o.subcontractor).sort()).toEqual(['KNN', 'YSK']);
    });

    it('hasFuelRateRoute นับเส้นทางตามเขตด้วย', () => {
        expect(hasFuelRateRoute([zoneRow], q)).toBe(true);
    });
});

describe('ชื่อรวมหลายที่ในช่องเดียว — ตาราง KNN "ล่ำสูง บางปู / ไฮคิว สมุทรปราการ"', () => {
    const knn = row({
        company: 'KNN DYNAMIC', origin: 'ล่ำสูง บางปู / ไฮคิว สมุทรปราการ',
        destination: 'นีโอสยาม สาย3', truckType: '10W พ่วง',
    });

    it('ใบงานจากล่ำสูง(บางปู) ใช้แถวนี้ได้ และนับเป็นชื่อตรง', () => {
        expect(matchRoute(knn, 'ล่ำสูง(บางปู)', 'นีโอสยาม สาย3')).toBe('exact');
    });

    it('ใบงานจากไฮคิวผลิตภัณฑ์อาหาร ใช้แถวนี้ได้ และนับเป็นชื่อตรง', () => {
        expect(matchRoute(knn, 'ไฮคิวผลิตภัณฑ์อาหาร', 'นีโอสยาม สาย3')).toBe('exact');
    });

    it('ต้นทางอื่นใช้แถวนี้ไม่ได้', () => {
        expect(matchRoute(knn, 'น้ำมันพืชไทย', 'นีโอสยาม สาย3')).toBeNull();
    });

    it('ชื่อรวมไม่ลามไปแถวอื่น — แถวที่เขียนแค่ "ไฮคิว สมุทรปราการ" ไม่ได้อยู่ในรายการ', () => {
        const other = row({ origin: 'ไฮคิว สมุทรปราการ', destination: 'นีโอสยาม สาย3' });
        expect(matchRoute(other, 'ล่ำสูง(บางปู)', 'นีโอสยาม สาย3')).toBeNull();
    });
});
