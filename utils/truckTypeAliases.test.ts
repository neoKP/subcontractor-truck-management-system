import { describe, it, expect } from 'vitest';
import { canonicalTruckType, truckTypeSpec, isSameTruckType } from './truckTypeAliases';

describe('canonicalTruckType', () => {
    it('ตัดพิกัดน้ำหนักที่หน่วยงานเขียนต่อท้าย', () => {
        expect(canonicalTruckType('4w (บรรทุกไม่เกิน 3000 กก.)')).toBe('4w');
        expect(canonicalTruckType('4wj (บรรทุก 3001 - 3500 กก.)')).toBe('4wj');
    });

    it('4wj ต้องไม่ถูกยุบเป็น 4w — คนละพิกัดน้ำหนัก คนละราคา', () => {
        expect(canonicalTruckType('4wj (บรรทุก 3001 - 3500 กก.)')).not.toBe('4w');
        expect(isSameTruckType('4w (บรรทุกไม่เกิน 3000 กก.)', '4wj (บรรทุก 3001 - 3500 กก.)')).toBe(false);
    });

    it('ชื่อที่ระบบใช้อยู่แล้วไม่ถูกเปลี่ยน', () => {
        for (const t of ['4w', '4wj', '6w', '6w พ่วง', '10w', '10w พ่วง', '12w', '18w']) {
            expect(canonicalTruckType(t)).toBe(t);
        }
    });

    it('จับคู่ชื่อยาวกับชื่อที่ระบบใช้ได้', () => {
        expect(isSameTruckType('4w (บรรทุกไม่เกิน 3000 กก.)', '4w')).toBe(true);
        expect(isSameTruckType('4wj (บรรทุก 3001 - 3500 กก.)', '4wj')).toBe(true);
    });

    it('ไม่ยุบรถคนละแบบเข้าหากัน', () => {
        expect(isSameTruckType('6w', '10w')).toBe(false);
        expect(isSameTruckType('10w', '10w พ่วง')).toBe(false);
    });

    it('ช่องว่างส่วนเกินถูกยุบ', () => {
        expect(canonicalTruckType('  10w   พ่วง  ')).toBe('10w พ่วง');
    });

    it('ค่าว่างไม่ทำให้พัง', () => {
        expect(canonicalTruckType('')).toBe('');
        expect(canonicalTruckType(undefined as unknown as string)).toBe('');
    });
});

describe('truckTypeSpec', () => {
    it('เก็บพิกัดน้ำหนักไว้แสดงเป็นหมายเหตุ ไม่ทิ้ง', () => {
        expect(truckTypeSpec('4w (บรรทุกไม่เกิน 3000 กก.)')).toBe('บรรทุกไม่เกิน 3000 กก.');
        expect(truckTypeSpec('4wj (บรรทุก 3001 - 3500 กก.)')).toBe('บรรทุก 3001 - 3500 กก.');
    });

    it('ไม่มีวงเล็บได้สตริงว่าง', () => {
        expect(truckTypeSpec('4w')).toBe('');
        expect(truckTypeSpec('')).toBe('');
    });
});
