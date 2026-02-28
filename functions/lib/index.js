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
// ── Build summary message ─────────────────────────────────────────────────────
function buildSummaryMessage(pendingJobs) {
    const dateStr = new Date().toLocaleDateString("th-TH", {
        timeZone: "Asia/Bangkok",
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    if (pendingJobs.length === 0) {
        return [
            `✅ <b>รายงานสรุปประจำวัน</b>`,
            `🗓 ${dateStr}  |  เวลา 18:30 น.`,
            ``,
            `🎉 ไม่มีงานค้างยืนยันการจบงาน`,
            `ทุกงานเสร็จสมบูรณ์แล้ว!`,
        ].join("\n");
    }
    const jobLines = pendingJobs.map((job, i) => {
        const route = job.origin && job.destination
            ? `${job.origin} → ${job.destination}`
            : "-";
        const plate = job.licensePlate ? ` (${job.licensePlate})` : "";
        const truck = job.truckType ? `${job.truckType}${plate}` : "-";
        return [
            ``,
            `${i + 1}. 📋 <b>${job.id}</b>`,
            `   📅 วันที่บริการ: ${job.dateOfService || "-"}`,
            `   🗺 เส้นทาง: ${route}`,
            `   🚛 รถ: ${truck}`,
            `   🏢 Subcontractor: ${job.subcontractor || "-"}`,
            `   👷 คนขับ: ${job.driverName || "-"}`,
        ].join("\n");
    });
    return [
        `⚠️ <b>รายงานงานค้างยืนยันจบงาน</b>`,
        `🗓 ${dateStr}  |  เวลา 18:30 น.`,
        ``,
        `พบงานที่ยังไม่ได้ยืนยันจบงาน <b>${pendingJobs.length} รายการ</b>`,
        ...jobLines,
        ``,
        `📌 กรุณายืนยันการจบงานในระบบ`,
    ].join("\n");
}
// ── Scheduled Cloud Function ─────────────────────────────────────────────────
// Runs every day at 18:30 Bangkok time (UTC+7 = 11:30 UTC)
exports.dailyJobReminder = (0, scheduler_1.onSchedule)({
    schedule: "30 11 * * *", // 11:30 UTC = 18:30 ICT (UTC+7)
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
    const message = buildSummaryMessage(pendingJobs);
    await sendTelegramMessage(token, chatId, message);
    console.log(`[dailyJobReminder] Sent. Pending jobs: ${pendingJobs.length}`);
});
//# sourceMappingURL=index.js.map