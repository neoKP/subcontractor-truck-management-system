import { Job } from '../types';
import { notifyTelegram } from './notifyTelegram';

// bot token กับ chat id ไม่อยู่ที่นี่แล้ว — ย้ายไปอยู่บน NAS (/volume1/nas-secrets/)
// ไฟล์นี้เหลือหน้าที่เดียวคือ "ประกอบข้อความ" ส่วนการยิงจริงเป็นของ notifyTelegram
// เหตุผล: VITE_ ทำให้ค่าถูกฝังลง bundle สาธารณะ เปลี่ยน token กี่รอบก็หลุดอีก

const STATUS_EMOJI: Record<string, string> = {
  'New Request':     '🆕',
  'Pending Pricing': '⏳',
  'Assigned':        '🚛',
  'Completed':       '✅',
  'Billed':          '🧾',
  'Cancelled':       '❌',
};

function buildJobMessage(job: Job, event: string): string {
  const lines: string[] = [
    `${STATUS_EMOJI[job.status] ?? '📋'} <b>${event}</b>`,
    '',
    `📋 Job ID: <b>${job.id}</b>`,
  ];

  if (job.requestedByName) lines.push(`👤 Requested By: ${job.requestedByName}`);
  if (job.createdAt)       lines.push(`🗓 Created: ${job.createdAt.slice(0, 10)}`);
  if (job.dateOfService)   lines.push(`📅 Date of Service: ${job.dateOfService}`);

  lines.push(`🗺 Route: ${job.origin} → ${job.destination}`);

  if (job.truckType) {
    const plate = job.licensePlate ? ` (${job.licensePlate})` : '';
    lines.push(`🚛 Vehicle: ${job.truckType}${plate}`);
  }

  if (job.subcontractor)     lines.push(`🏢 Subcontractor: ${job.subcontractor}`);
  if (job.driverName)        lines.push(`👷 คนขับ: ${job.driverName}`);
  if (job.driverPhone)       lines.push(`📞 เบอร์: ${job.driverPhone}`);
  if (job.actualArrivalTime) lines.push(`🕐 เวลาถึง: ${job.actualArrivalTime}`);
  if (job.mileage)           lines.push(`📏 ระยะทาง: ${job.mileage} กม.`);

  return lines.join('\n');
}

/** Telegram ส่งอัลบั้มได้สูงสุด 10 รูปต่อข้อความ */
const TG_ALBUM_LIMIT = 10;

/**
 * ส่งแจ้งเตือน Telegram พร้อมรูป POD
 *
 * ส่งเป็นสองข้อความ: รายละเอียดงานก่อน แล้วตามด้วยอัลบั้มรูป
 * ไม่ใช้รูปแรกเป็น caption เพราะ caption จำกัด 1024 ตัวอักษร ข้อความจะถูกย่อ
 * และถ้าส่งรูปพลาด ข้อความแจ้งเตือนยังไปถึงอยู่ดี ซึ่งสำคัญกว่ารูป
 *
 * NAS เป็นคนอ่านไฟล์จากดิสก์แล้วอัปขึ้น Telegram เอง เราส่งไปแค่ URL
 * ที่ระบบเก็บไว้ — ให้ Telegram มาโหลดจาก URL ไม่ได้แล้ว เพราะ serve.php
 * บังคับ Referer ซึ่งเซิร์ฟเวอร์ของ Telegram ไม่ส่งมา
 */
export async function sendJobNotification(
  job: Job,
  event: string,
  imageUrls: string[] = [],
): Promise<void> {
  let message = buildJobMessage(job, event);

  // บอกให้รู้เมื่อรูปเกินที่ Telegram ส่งได้ จะได้ไม่เข้าใจว่ารูปหาย
  if (imageUrls.length > TG_ALBUM_LIMIT) {
    const rest = imageUrls.length - TG_ALBUM_LIMIT;
    message += `

📷 แนบรูป ${imageUrls.length} รูป (แสดง ${TG_ALBUM_LIMIT} รูปแรก อีก ${rest} รูปดูในระบบ)`;
  }

  await notifyTelegram(message, {
    html: true,
    photos: imageUrls.slice(0, TG_ALBUM_LIMIT),
  });
}
