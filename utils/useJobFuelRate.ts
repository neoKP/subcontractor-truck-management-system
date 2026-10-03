import { useEffect, useMemo, useState } from 'react';
import { watchActiveFuelRates, type FuelRateVersion } from './fuelRateStore';
import { findFuelRateOptions, type FuelRateOption } from './fuelRateLookup';
import { oilPriceAtDate, type OilAtDate } from './oilPriceAtDate';
import { useOilPrice } from './useOilPrice';
import { todayIsoLocal } from './oilRounds';
import { usePlaceAreas } from './placeAreaStore';

/**
 * เรทตามราคาน้ำมันของใบงานหนึ่ง ณ วันที่ต้องการรถ
 *
 * ใช้ร่วมกันทุกหน้าที่ต้องรู้ว่า "ราคาที่ถูกต้องของงานนี้คือเท่าไร" — หน้าสร้างงาน
 * และหน้าตรวจทานก่อนล็อกราคา ถ้าแต่ละหน้าคำนวณเอง จะเพี้ยนจากกันเมื่อแก้ที่เดียว
 *
 * ราคาน้ำมันยึด "วันที่ต้องการรถ" เสมอ ไม่ใช่วันที่เปิดหน้าจอ เพราะเรทของหน่วยงาน
 * ผูกกับช่วงราคาน้ำมัน งานย้อนหลังจึงต้องคิดด้วยราคาของวันนั้น
 */
export interface JobFuelRate {
    /** ตัวเลือกเรทที่ใช้ได้กับเส้นทางนี้ ณ วันที่ต้องการรถ */
    options: FuelRateOption[];
    /** ราคาดีเซลที่ใช้คิด — 0 เมื่อไม่รู้ราคาของวันนั้น */
    diesel: number;
    /** รายละเอียดว่าราคามาจากงวดไหน และใช้ได้ไหม */
    oil: OilAtDate;
    /** รุ่นเรทที่ใช้งานอยู่ — null เมื่อยังไม่เคยอัปโหลด */
    version: FuelRateVersion | null;
}

export function useJobFuelRate(
    route: { origin?: string; destination?: string; truckType?: string },
    dateOfService?: string
): JobFuelRate {
    const [version, setVersion] = useState<FuelRateVersion | null>(null);
    const live = useOilPrice();
    // การจับคู่สถานที่ที่ทีมบันทึก (มาถึงทีหลัง) — เปลี่ยนเมื่อไรต้องหาเรทใหม่
    const placeAreas = usePlaceAreas();

    // เฝ้าดูรุ่นที่ใช้งานแทนโหลดครั้งเดียว — หน้าจอถูกเปิดค้างได้นาน
    // ถ้ามีคนอัปเรทรอบใหม่ระหว่างนั้น ต้องเห็นราคาใหม่ ไม่ใช่ตัดสินใจจากเรทเก่า
    useEffect(() => watchActiveFuelRates(v => setVersion(v), () => setVersion(null)), []);

    const oil = useMemo(
        () => oilPriceAtDate(live.byDate, dateOfService || '', todayIsoLocal()),
        [live.byDate, dateOfService]
    );

    // ราคาที่ใช้ไม่ได้ส่ง 0 เพื่อให้หาเรทไม่เจอ — ดีกว่าคิดด้วยราคาที่เดาเอา
    const diesel = oil.usable ? oil.diesel : 0;

    const options = useMemo(
        () => findFuelRateOptions(
            version?.rows ?? [],
            { origin: route.origin || '', destination: route.destination || '', truckType: route.truckType || '' },
            diesel
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [version, route.origin, route.destination, route.truckType, diesel, placeAreas.version]
    );

    return { options, diesel, oil, version };
}
