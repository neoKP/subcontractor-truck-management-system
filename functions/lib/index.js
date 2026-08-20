"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchOilPrice = exports.dailyJobReminder = void 0;
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
// ── ราคาดีเซล ปตท. ───────────────────────────────────────────────────────────
// ดึงจากหน้า oil_price_board ของ ปตท. ฝั่งเซิร์ฟเวอร์ เพราะหน้านั้นไม่ส่ง CORS header
// เบราว์เซอร์จึงเรียกตรงไม่ได้ · เก็บลง RTDB ให้หน้าเว็บอ่านต่อ
//
// %สะสมสหพัฒน์ = ราคาดีเซล − 31.94 (ฐานตามข้อตกลง ไม่ใช่ค่าที่คำนวณได้)
const SAHA_DIESEL_BASE = 31.94;
const THAI_MONTH_ABBR = {
    "ม.ค.": 1, "ก.พ.": 2, "มี.ค.": 3, "เม.ย.": 4, "พ.ค.": 5, "มิ.ย.": 6,
    "ก.ค.": 7, "ส.ค.": 8, "ก.ย.": 9, "ต.ค.": 10, "พ.ย.": 11, "ธ.ค.": 12,
};
/** ดึงและแกะราคาดีเซลจากหน้า ปตท. — throw เมื่ออ่านไม่ได้ ให้ผู้เรียกตัดสินใจ */
async function fetchPttDiesel() {
    const res = await (0, node_fetch_1.default)("https://www.pttor.com/th/oil_price_board?lang=th", {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/120 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml",
            "Accept-Language": "th,en;q=0.9",
        },
    });
    if (!res.ok)
        throw new Error(`ปตท. ตอบ HTTP ${res.status}`);
    const html = await res.text();
    // แต่ละบล็อกราคา: alt="ชนิดน้ำมัน" ... <div class="oil-price">ราคา</div>
    const re = /alt="([^"]+)"[\s\S]{0,600}?<div class="oil-price">\s*([\d.]+)\s*<\/div>/g;
    const rows = [];
    let m;
    while ((m = re.exec(html)) !== null) {
        rows.push({ type: m[1].trim(), price: parseFloat(m[2]) });
    }
    // ต้องเป็น "Diesel" เป๊ะ — หน้านี้มี Diesel B20 และ Premium Diesel ปนอยู่ด้วย
    const diesel = rows.find((x) => x.type === "Diesel");
    if (!diesel || !Number.isFinite(diesel.price)) {
        throw new Error("อ่านราคาดีเซลไม่ได้ — โครงสร้างหน้า ปตท. อาจเปลี่ยน");
    }
    // "ปรับราคาเมื่อ 19 ส.ค. 2569" → 2026-08-19 (พ.ศ. → ค.ศ.)
    let effectiveDate = "";
    const dm = html.match(/ปรับราคาเมื่อ\s*(\d{1,2})\s*(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s*(\d{4})/);
    if (dm) {
        const day = Number(dm[1]);
        const mon = THAI_MONTH_ABBR[dm[2]];
        const year = Number(dm[3]) - 543;
        if (mon) {
            effectiveDate =
                `${year}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        }
    }
    if (!effectiveDate)
        throw new Error("อ่านวันที่มีผลจากหน้า ปตท. ไม่ได้");
    return {
        diesel: diesel.price,
        base: SAHA_DIESEL_BASE,
        pct: Math.round((diesel.price - SAHA_DIESEL_BASE) * 100) / 100,
        effectiveDate,
        source: "pttor.com",
        fetchedAt: new Date().toISOString(),
    };
}
/**
 * บันทึกราคาลง RTDB
 *
 * เขียนงวดใหม่เฉพาะเมื่อ %สะสมเปลี่ยนจริง — ปตท. ประกาศราคาเดิมซ้ำได้หลายวัน
 * และการเขียนทับทุกครั้งจะทำให้ประวัติงวดปรับนับผิด
 */
async function saveOilPrice(price) {
    // เทียบกับ "งวดล่าสุดที่บันทึกไว้" ไม่ใช่แค่งวดวันเดียวกัน — ปตท. ประกาศวันใหม่
    // ด้วยราคาเดิมได้ ถ้าเช็คเฉพาะวันเดียวกันจะได้งวดปลอมเพิ่มทุกครั้ง ทำให้จำนวน
    // งวดปรับที่หน้าเว็บนับได้สูงเกินจริง
    const bandsRef = db.ref("oilPrice/bands");
    const lastSnap = await bandsRef.orderByKey().limitToLast(1).once("value");
    let lastDate = "";
    let lastPct = null;
    lastSnap.forEach((child) => {
        lastDate = child.key;
        const v = child.val();
        lastPct = typeof (v === null || v === void 0 ? void 0 : v.pct) === "number" ? v.pct : null;
    });
    // CDN ของ ปตท. เสิร์ฟหน้าเก่าคืนมาได้ ถ้าเขียนทับ latest ด้วยงวดที่เก่ากว่าที่มีอยู่
    // ราคาบนหน้าเว็บจะถอยหลัง และค่าขนส่งที่คิดจากราคานั้นจะผิดตามไปด้วย
    if (lastDate && price.effectiveDate < lastDate)
        return "stale";
    await db.ref("oilPrice/latest").set(price);
    // ราคายังเท่าเดิม → ไม่ต้องเพิ่มงวดใหม่ (latest อัปเดต fetchedAt ไปแล้ว)
    if (lastPct !== null && lastPct === price.pct)
        return "unchanged";
    await bandsRef.child(price.effectiveDate).set({
        diesel: price.diesel,
        pct: price.pct,
        source: price.source,
        recordedAt: price.fetchedAt,
    });
    return "created";
}
// ปตท. ประกาศราคาใหม่ประมาณ 05:00 น. — ดึงตอน 06:00 และเผื่อรอบบ่ายไว้กันพลาด
exports.fetchOilPrice = (0, scheduler_1.onSchedule)({
    schedule: "0 6,14 * * *",
    timeZone: "Asia/Bangkok",
    region: "asia-southeast1",
}, async () => {
    try {
        const price = await fetchPttDiesel();
        const result = await saveOilPrice(price);
        if (result === "stale") {
            console.warn(`[fetchOilPrice] ข้ามการบันทึก — ปตท. ส่งงวด ${price.effectiveDate} ` +
                "ซึ่งเก่ากว่างวดล่าสุดที่มีอยู่ (น่าจะเป็น cache ของ CDN)");
        }
        else {
            console.log(`[fetchOilPrice] ${result} — ดีเซล ${price.diesel} บาท ` +
                `(%สะสม ${price.pct}) มีผล ${price.effectiveDate}`);
        }
    }
    catch (e) {
        // ไม่ throw ต่อ — ราคาเดิมใน RTDB ยังใช้ได้ ไม่ควรทำให้ job ล้มทั้งรอบ
        console.error("[fetchOilPrice] ดึงราคาไม่สำเร็จ:", e.message);
    }
});
//# sourceMappingURL=index.js.map