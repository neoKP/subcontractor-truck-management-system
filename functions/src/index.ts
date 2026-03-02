import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import fetch from "node-fetch";

// ── Firebase Admin ────────────────────────────────────────────────────────────
admin.initializeApp();
const db = admin.database();

// ── Types (minimal mirror of frontend types) ──────────────────────────────────
interface DropDetail {
  location: string;
  status: "PENDING" | "COMPLETED";
}

interface Job {
  id: string;
  status: string;
  accountingStatus?: string;
  dateOfService?: string;
  origin?: string;
  destination?: string;
  truckType?: string;
  licensePlate?: string;
  subcontractor?: string;
  driverName?: string;
  requestedByName?: string;
  drops?: DropDetail[];
  createdAt?: string;
}

// ── Telegram sender ───────────────────────────────────────────────────────────
async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
  if (!res.ok) {
    const err = await res.text();
    console.error("[Telegram] sendMessage failed:", err);
  }
}

const TELEGRAM_MAX_CHARS = 3500;

// ── Build summary messages (chunked to stay under Telegram 4096 limit) ────────
function buildSummaryMessages(pendingJobs: Job[]): string[] {
  const dateStr = new Date().toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (pendingJobs.length === 0) {
    return [[
      `✅ <b>รายงานสรุปประจำวัน</b>`,
      `🗓 ${dateStr}  |  เวลา 18:30 น.`,
      ``,
      `🎉 ไม่มีงานค้างยืนยันการจบงาน`,
      `ทุกงานเสร็จสมบูรณ์แล้ว!`,
    ].join("\n")];
  }

  const footer = `\n📌 กรุณายืนยันการจบงานในระบบ`;
  const messages: string[] = [];
  let current = [
    `⚠️ <b>รายงานงานค้างยืนยันจบงาน</b>`,
    `🗓 ${dateStr}  |  เวลา 18:30 น.`,
    ``,
    `พบงานที่ยังไม่ได้ยืนยันจบงาน <b>${pendingJobs.length} รายการ</b>`,
  ].join("\n");

  pendingJobs.forEach((job, i) => {
    const route = job.origin && job.destination
      ? `${job.origin} → ${job.destination}`
      : "-";
    const plate = job.licensePlate ? ` (${job.licensePlate})` : "";
    const truck = job.truckType ? `${job.truckType}${plate}` : "-";
    const jobLine = [
      ``,
      `${i + 1}. 📋 <b>${job.id}</b>`,
      `   📅 ${job.dateOfService || "-"}`,
      `   🗺 ${route}`,
      `   🚛 ${truck}`,
      `   👷 ${job.driverName || "-"}`,
    ].join("\n");

    if ((current + jobLine + footer).length > TELEGRAM_MAX_CHARS) {
      messages.push(current + footer);
      current = `⚠️ <b>รายงานงานค้าง (ต่อ ${messages.length + 1})</b>\n`;
    }
    current += jobLine;
  });

  messages.push(current + footer);
  return messages;
}

// ── Scheduled Cloud Function ─────────────────────────────────────────────────
// Runs every day at 18:30 Bangkok time (UTC+7 = 11:30 UTC)
export const dailyJobReminder = onSchedule(
  {
    schedule: "30 18 * * *", // 18:30 ICT (UTC+7)
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1",
  },
  async () => {
    const token  = process.env.TELEGRAM_BOT_TOKEN ?? "";
    const chatId = process.env.TELEGRAM_CHAT_ID   ?? "";

    // Read all jobs from RTDB
    const snapshot = await db.ref("jobs").once("value");
    const allJobs: Job[] = [];

    snapshot.forEach((child) => {
      const job = child.val() as Job;
      job.id = child.key as string;
      allJobs.push(job);
    });

    // Filter: status = ASSIGNED (ดำเนินการ) → ยังไม่จบงาน
    // คือรถได้รับมอบหมายแล้ว แต่ Field Officer ยังไม่กด "ยืนยันจบงาน"
    const pendingJobs = allJobs.filter(
      (j) => j.status === "Assigned"
    );

    // Sort by dateOfService ascending
    pendingJobs.sort((a, b) =>
      (a.dateOfService || "").localeCompare(b.dateOfService || "")
    );

    const messages = buildSummaryMessages(pendingJobs);
    for (const msg of messages) {
      await sendTelegramMessage(token, chatId, msg);
    }

    console.log(
      `[dailyJobReminder] Sent. Pending jobs: ${pendingJobs.length}`
    );
  }
);
