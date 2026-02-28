import { Job } from '../types';

const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN as string | undefined;
const CHAT_ID   = import.meta.env.VITE_TELEGRAM_CHAT_ID   as string | undefined;

const BASE_URL = () => `https://api.telegram.org/bot${BOT_TOKEN}`;

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

async function postJSON(endpoint: string, body: object): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] BOT_TOKEN or CHAT_ID not set — skipping notification.');
    return;
  }
  try {
    const res = await fetch(`${BASE_URL()}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn(`[Telegram] ${endpoint} failed:`, err);
    }
  } catch (e) {
    console.warn('[Telegram] Network error:', e);
  }
}

/**
 * ส่งแจ้งเตือน Telegram พร้อมรูปภาพ (ถ้ามี)
 * - 0 รูป  → sendMessage
 * - 1 รูป  → sendPhoto  (caption = ข้อความ)
 * - 2+ รูป → sendMediaGroup (caption บนรูปแรก, max 10)
 */
export async function sendJobNotification(
  job: Job,
  event: string,
  imageUrls: string[] = [],
): Promise<void> {
  const message = buildJobMessage(job, event);

  if (imageUrls.length === 0) {
    await postJSON('sendMessage', {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'HTML',
    });
  } else if (imageUrls.length === 1) {
    await postJSON('sendPhoto', {
      chat_id: CHAT_ID,
      photo: imageUrls[0],
      caption: message,
      parse_mode: 'HTML',
    });
  } else {
    const media = imageUrls.slice(0, 10).map((url, i) => ({
      type: 'photo',
      media: url,
      ...(i === 0 ? { caption: message, parse_mode: 'HTML' } : {}),
    }));
    await postJSON('sendMediaGroup', {
      chat_id: CHAT_ID,
      media,
    });
  }
}
