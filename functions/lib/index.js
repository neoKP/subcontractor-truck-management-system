"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyJobReminder = void 0;
const admin = require("firebase-admin");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const node_fetch_1 = require("node-fetch");
// ── Firebase Admin ────────────────────────────────────────────────────────────
admin.initializeApp();
const db = admin.database();
// ── Telegram sender ───────────────────────────────────────────────────────────
async function sendTelegramMessage(token, chatId, text) {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await (0, node_fetch_1.default)(url, {
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
function buildSummaryMessages(pendingJobs) {
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
    const messages = [];
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
exports.dailyJobReminder = (0, scheduler_1.onSchedule)({
    schedule: "30 18 * * *", // 18:30 ICT (UTC+7)
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1",
}, async () => {
    var _a, _b;
    const token = (_a = process.env.TELEGRAM_BOT_TOKEN) !== null && _a !== void 0 ? _a : "";
    const chatId = (_b = process.env.TELEGRAM_CHAT_ID) !== null && _b !== void 0 ? _b : "";
    // Read all jobs from RTDB
    const snapshot = await db.ref("jobs").once("value");
    const allJobs = [];
    snapshot.forEach((child) => {
        const job = child.val();
        job.id = child.key;
        allJobs.push(job);
    });
    // Filter: status = ASSIGNED (ดำเนินการ) → ยังไม่จบงาน
    // คือรถได้รับมอบหมายแล้ว แต่ Field Officer ยังไม่กด "ยืนยันจบงาน"
    const pendingJobs = allJobs.filter((j) => j.status === "Assigned");
    // Sort by dateOfService ascending
    pendingJobs.sort((a, b) => (a.dateOfService || "").localeCompare(b.dateOfService || ""));
    const messages = buildSummaryMessages(pendingJobs);
    for (const msg of messages) {
        await sendTelegramMessage(token, chatId, msg);
    }
    console.log(`[dailyJobReminder] Sent. Pending jobs: ${pendingJobs.length}`);
});
//# sourceMappingURL=index.js.map