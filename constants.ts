
import { MasterData, PriceMatrix } from './types';

export const MASTER_DATA: MasterData = {
  locations: [
    'ซีโน่ คลองส่งน้ำ', 'เมืองกำแพงเพชร', 'เมืองเชียงราย', 'เมืองเชียงใหม่', 'เมืองนครสวรรค์',
    'เมืองพิจิตร', 'เมืองพิษณุโลก', 'เมืองลำปาง', 'นิคมสมุทรสาคร', 'แม่สอด', 'แม่สาย เชียงราย',
    'รามอินทรา', 'ศาลายา', 'โบทาเร่ ลาดกระบัง', 'DC1 โพธาราม', 'DC2 ฉะเชิงเทรา', 'DC3 บางวัว',
    'DC4 ขอนแก่น', 'เมืองขอนแก่น', 'โคราช', 'ด่านคลองใหญ่', 'ด่านอรัญประเทศ', 'นครนายก',
    'นครปฐม', 'บางปะกง', 'ปราณบุรี', 'ฝั่งกรุง', 'ฝั่งธนบุรี', 'ปทุมธานี', 'พระนครศรีอยุธยา',
    'พัทยา', 'เพชรบุรี', 'เมืองจันทบุรี', 'เมืองฉะเชิงเทรา', 'เมืองชลบุรี', 'เมืองตราด',
    'เมืองปราจีนบุรี', 'เมืองระยอง', 'เมืองสระแก้ว', 'ราชบุรี', 'เมืองลพบุรี', 'ศรีราชา',
    'สมุทรปราการ', 'สมุทรสงคราม', 'สมุทรสาคร', 'เมืองสระบุรี', 'สัตหีบ', 'เมืองสิงห์บุรี',
    'สุพรรณบุรี', 'หนองคาย', 'หัวหิน', 'เมืองอ่างทอง', 'เมืองอุดรธานี',
    'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', 'ศูนย์กระจายสินค้า แม็คโคร มหาชัย',
    'สตาร์แคนเนอรี่', 'นีโอคอร์ปอเรท คลอง13 / ไทยเทพรส', 'คลอง13', 'น้ำมันพืชไทย',
    'เพนส์', 'สหพัฒน์ศรีราชา', 'ยำยำ', 'ปทุมธานี (เอสบีอินเตอร์ หรือ นีโอคอร์ปอเรท)',
    'โอสถสภา หัวหมาก', 'โอสถสภา อยุธยา', 'น้ำตาลนครเพชร กำแพงเพชร', 'อำพลฟู้ดส์ / เทพผดุงพร'
  ],
  truckTypes: ['4w', '6w', '6w พ่วง', '10w', '10w พ่วง', '12w', '18w'],
  subcontractors: [
    'KNN', 'PTK', 'YSK', 'คอมม่าพลัส', 'จิระศักดิ์', 'ธนโชค (คุณตุ่น)', 'บ้านขาวโลจิสติกส์',
    'เบญจวรรณ ขนส่ง', 'ประกายเพชรขนส่ง', 'พยัคฆ์ขนส่ง', 'รถร่วม deliveree',
    'รถร่วม อดุลย์ ลำปาง', 'รถร่วมคุณบุ๋ม', 'ลานนาไทย', 'วิวัฒน์ทราน', 'ศรีทรัพย์ขนส่ง', 'โอเคนะ'
  ],
  reasons: [
    'รถเสีย / อุบัติเหตุ',
    'Subcontractor ทิ้งงาน / ไม่เข้างาน',
    'ลูกค้าแจ้งเปลี่ยนประเภทรถ',
    'เปลี่ยนทะเบียน (คนขับคนเดิม)',
    'ปรับแก้ราคา (Price Negotiation)',
    'อื่นๆ (ระบุเอง)'
  ]
};

export const PRICE_MATRIX: PriceMatrix[] = [
  // KNN
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองกำแพงเพชร', subcontractor: 'KNN', truckType: '6w', basePrice: 9600 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองกำแพงเพชร', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 12960 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองเชียงราย', subcontractor: 'KNN', truckType: '6w', basePrice: 18860 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองเชียงราย', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 24046.50 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองเชียงใหม่', subcontractor: 'KNN', truckType: '6w', basePrice: 16560 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองเชียงใหม่', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 22356 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองนครสวรรค์', subcontractor: 'KNN', truckType: '6w', basePrice: 6480 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองนครสวรรค์', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 8748 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองพิจิตร', subcontractor: 'KNN', truckType: '6w', basePrice: 8880 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองพิจิตร', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 11947.50 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองพิษณุโลก', subcontractor: 'KNN', truckType: '6w', basePrice: 9600 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองพิษณุโลก', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 12960 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองลำปาง', subcontractor: 'KNN', truckType: '6w', basePrice: 15800 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองลำปาง', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 20592 },
  { origin: 'นิคมสมุทรสาคร', destination: 'แม่สอด', subcontractor: 'KNN', truckType: '6w', basePrice: 13500 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'แม่สอด', subcontractor: 'KNN', truckType: '6w', basePrice: 13500 },
  { origin: 'นิคมสมุทรสาคร', destination: 'แม่สอด', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 18500 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'แม่สอด', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 18500 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'แม่สอด', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 21000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'แม่สาย เชียงราย', subcontractor: 'KNN', truckType: '6w', basePrice: 20355 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'แม่สาย เชียงราย', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 25952.63 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'รามอินทรา', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 5500 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'ศาลายา', subcontractor: 'KNN', truckType: '6w พ่วง', basePrice: 6500 },

  // PTK
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC1 โพธาราม', subcontractor: 'PTK', truckType: '4w', basePrice: 2070 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC2 ฉะเชิงเทรา', subcontractor: 'PTK', truckType: '4w', basePrice: 1440 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC3 บางวัว', subcontractor: 'PTK', truckType: '4w', basePrice: 1440 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC4 ขอนแก่น', subcontractor: 'PTK', truckType: '4w', basePrice: 4770 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองขอนแก่น', subcontractor: 'PTK', truckType: '4w', basePrice: 4950 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'โคราช', subcontractor: 'PTK', truckType: '4w', basePrice: 3150 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ด่านคลองใหญ่', subcontractor: 'PTK', truckType: '4w', basePrice: 4050 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ด่านอรัญประเทศ', subcontractor: 'PTK', truckType: '4w', basePrice: 2790 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'นครนายก', subcontractor: 'PTK', truckType: '4w', basePrice: 1710 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'นครปฐม', subcontractor: 'PTK', truckType: '4w', basePrice: 1890 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'บางปะกง', subcontractor: 'PTK', truckType: '4w', basePrice: 1440 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ปราณบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 3060 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ฝั่งกรุง', subcontractor: 'PTK', truckType: '4w', basePrice: 15300 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ฝั่งธนบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 1620 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ปทุมธานี', subcontractor: 'PTK', truckType: '4w', basePrice: 1620 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'พระนครศรีอยุธยา', subcontractor: 'PTK', truckType: '4w', basePrice: 1890 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'พัทยา', subcontractor: 'PTK', truckType: '4w', basePrice: 2160 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เพชรบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 2430 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองจันทบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 2880 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองฉะเชิงเทรา', subcontractor: 'PTK', truckType: '4w', basePrice: 1530 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองชลบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 1620 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองตราด', subcontractor: 'PTK', truckType: '4w', basePrice: 3420 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองปราจีนบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 1980 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองระยอง', subcontractor: 'PTK', truckType: '4w', basePrice: 2430 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองสระแก้ว', subcontractor: 'PTK', truckType: '4w', basePrice: 2520 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ราชบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 2250 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองลพบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 2430 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'ศรีราชา', subcontractor: 'PTK', truckType: '4w', basePrice: 1890 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'สมุทรปราการ', subcontractor: 'PTK', truckType: '4w', basePrice: 1350 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'สมุทรสงคราม', subcontractor: 'PTK', truckType: '4w', basePrice: 2070 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'สมุทรสาคร', subcontractor: 'PTK', truckType: '4w', basePrice: 1710 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองสระบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 1890 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'สัตหีบ', subcontractor: 'PTK', truckType: '4w', basePrice: 2250 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองสิงห์บุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 2430 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'สุพรรณบุรี', subcontractor: 'PTK', truckType: '4w', basePrice: 2070 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'หนองคาย', subcontractor: 'PTK', truckType: '4w', basePrice: 5850 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'หัวหิน', subcontractor: 'PTK', truckType: '4w', basePrice: 2880 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองอ่างทอง', subcontractor: 'PTK', truckType: '4w', basePrice: 2070 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'เมืองอุดรธานี', subcontractor: 'PTK', truckType: '4w', basePrice: 5490 },

  // Makro Wang Noi (PTK 4w)
  { origin: 'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', destination: 'Makro ST.1 ลาดพร้าว', subcontractor: 'PTK', truckType: '4w', basePrice: 1336.21 },
  { origin: 'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', destination: 'Makro ST.2 แจ้งวัฒนะ', subcontractor: 'PTK', truckType: '4w', basePrice: 1179.36 },
  { origin: 'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', destination: 'Makro ST.6 เชียงใหม่ 1', subcontractor: 'PTK', truckType: '4w', basePrice: 6636.71 },
  { origin: 'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', destination: 'Makro ST.7 นครราชสีมา', subcontractor: 'PTK', truckType: '4w', basePrice: 2518.86 },
  { origin: 'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', destination: 'Makro ST.8 รังสิต', subcontractor: 'PTK', truckType: '4w', basePrice: 1102.20 },
  { origin: 'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', destination: 'Makro ST.10 อุดรธานี', subcontractor: 'PTK', truckType: '4w', basePrice: 5166.79 },
  { origin: 'ศูนย์กระจายสินค้า แม็คโคร วังน้อย (CDC)', destination: 'Makro ST.11 พิษณุโลก', subcontractor: 'PTK', truckType: '4w', basePrice: 3667.66 },

  // YSK
  { origin: 'สตาร์แคนเนอรี่', destination: 'CJ ราชบุรี', subcontractor: 'YSK', truckType: '10w', basePrice: 5500 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC1 โพธาราม', subcontractor: 'YSK', truckType: '6w', basePrice: 5525 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC2 ฉะเชิงเทรา', subcontractor: 'YSK', truckType: '6w', basePrice: 4250 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC3 บางวัว', subcontractor: 'YSK', truckType: '6w', basePrice: 4250 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'DC4 ขอนแก่น', subcontractor: 'YSK', truckType: '6w', basePrice: 11475 },
  { origin: 'โบทาเร่ ลาดกระบัง', destination: 'กำแพงเพชร', subcontractor: 'YSK', truckType: '6w', basePrice: 9350 },
  { origin: 'นีโอคอร์ปอเรท คลอง13 / ไทยเทพรส', destination: 'นีโอสยามพิษณุโลก', subcontractor: 'YSK', truckType: '10w', basePrice: 8500 },
  { origin: 'นีโอคอร์ปอเรท คลอง13 / ไทยเทพรส', destination: 'นีโอสยามพิษณุโลก', subcontractor: 'YSK', truckType: '18w', basePrice: 12500 },
  { origin: 'นีโอคอร์ปอเรท คลอง13 / ไทยเทพรส', destination: 'นีโอสยามพิษณุโลก', subcontractor: 'YSK', truckType: '6w', basePrice: 7500 },

  // Benjawan Transport
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'ekp ลำปาง', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '6w', basePrice: 15300 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'ekp ลำปาง', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '6w พ่วง', basePrice: 21000, dropOffFee: 1000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'นีโอสยาม พิษณุโลก', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '10w พ่วง', basePrice: 16500, dropOffFee: 1000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'นีโอสยาม พิษณุโลก', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '6w', basePrice: 10000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'นีโอสยาม พิษณุโลก', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '6w พ่วง', basePrice: 13800, dropOffFee: 1000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'นีโอสยามกำแพงเพชร', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '10w พ่วง', basePrice: 16500, dropOffFee: 1000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'นีโอสยามกำแพงเพชร', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '6w', basePrice: 7500 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'นีโอสยามกำแพงเพชร', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '6w พ่วง', basePrice: 13500, dropOffFee: 1000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองขอนแก่น', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '6w พ่วง', basePrice: 15000, dropOffFee: 1000 },
  { origin: 'ซีโน่ คลองส่งน้ำ', destination: 'เมืองเชียงราย', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '10w', basePrice: 24500 },
  { origin: 'นีโอ คลอง13', destination: 'เมืองเชียงราย', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '10w พ่วง', basePrice: 27000, dropOffFee: 1000 },
  { origin: 'สหพัฒน์ ศรีราชา', destination: 'เมืองเชียงราย', subcontractor: 'เบญจวรรณ ขนส่ง', truckType: '10w พ่วง', basePrice: 36000, dropOffFee: 1000 },

  // Comma Plus
  { origin: 'ยำยำ', destination: 'แม็คโคร กำแพงเพชร', subcontractor: 'คอมม่าพลัส', truckType: '18w', basePrice: 10000 },
  { origin: 'สมุทรปราการ', destination: 'เมืองนครสวรรค์', subcontractor: 'คอมม่าพลัส', truckType: '10w', basePrice: 7000 },
  { origin: 'ปทุมธานี (เอสบีอินเตอร์ หรือ นีโอคอร์ปอเรท)', destination: 'แม่สอด', subcontractor: 'คอมม่าพลัส', truckType: '10w', basePrice: 11500 },

  // Jirasak
  { origin: 'สหพัฒน์ศรีราชา', destination: 'นีโอสยามกำแพงเพชร', subcontractor: 'จิระศักดิ์', truckType: '18w', basePrice: 12000 },
  { origin: 'น้ำตาลนครเพชร กำแพงเพชร', destination: 'โอสถสภา หัวหมาก', subcontractor: 'จิระศักดิ์', truckType: '18w', basePrice: 9450 },

  // Others
  { origin: 'น้ำตาลนครเพชร กำแพงเพชร', destination: 'โอสถสภา อยุธยา', subcontractor: 'บ้านขาวโลจิสติกส์', truckType: '18w', basePrice: 9500 },
  { origin: 'อำพลฟู้ดส์ / เทพผดุงพร', destination: 'นีโอสยาม สาย3', subcontractor: 'รถร่วม deliveree', truckType: '10w', basePrice: 3500 },
  { origin: 'อำพลฟู้ดส์ / เทพผดุงพร', destination: 'นีโอสยาม สาย3', subcontractor: 'รถร่วม deliveree', truckType: '6w', basePrice: 2500 },
  { origin: 'คลอง13', destination: 'เมืองเชียงใหม่', subcontractor: 'รถร่วม อดุลย์ ลำปาง', truckType: '10w', basePrice: 11500 },
  { origin: 'คลอง13', destination: 'เมืองเชียงใหม่', subcontractor: 'รถร่วม อดุลย์ ลำปาง', truckType: '18w', basePrice: 17000 },
];

export const calculatePrice = (origin: string, destination: string, truckType: string, sub: string): number => {
  const match = PRICE_MATRIX.find(
    p => p.origin.includes(origin) && p.destination.includes(destination) && p.truckType === truckType && p.subcontractor === sub
  );
  if (match) return match.basePrice;

  // Generic fallback logic
  const baseRates: Record<string, number> = {
    '4w': 2000,
    '6w': 6000,
    '6w พ่วง': 9000,
    '10w': 12000,
    '10w พ่วง': 15000,
    '18w': 18000
  };
  return (baseRates[truckType] || 5000);
};
