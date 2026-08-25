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

/**
 * ส่งแจ้งเตือน Telegram
 *
 * ตอนนี้เป็นข้อความล้วน (sendMessage) เท่านั้น — proxy บน NAS ยังไม่รองรับรูป
 * รูป POD จะกลับมาในรอบถัดไป พร้อมกับการอัปไฟล์ขึ้น Telegram ตรง ๆ
 * (ไม่ใช่ส่ง URL ของ serve.php ให้ Telegram ไปดึงเอง เพราะวิธีนั้นได้ผลก็ต่อเมื่อ
 *  serve.php ไม่มีการยืนยันตัวตน ซึ่งเป็นช่องโหว่ที่กำลังจะปิด)
 *
 * imageUrls ยังรับไว้เพื่อไม่ให้จุดเรียกทั้งสามที่ต้องแก้ตาม — จำนวนรูปถูกต่อท้าย
 * ข้อความแทน จะได้ไม่เงียบหายไปเฉย ๆ
 */
export async function sendJobNotification(
  job: Job,
  event: string,
  imageUrls: string[] = [],
): Promise<void> {
  let message = buildJobMessage(job, event);
  if (imageUrls.length > 0) {
    message += `

📷 แนบรูป ${imageUrls.length} รูป (ดูในระบบ)`;
  }
  await notifyTelegram(message, { html: true });
}
