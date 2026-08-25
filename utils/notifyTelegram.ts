// ส่งข้อความแจ้งเตือนเข้า Telegram ผ่าน NAS
//
// เดิม: เบราว์เซอร์ --bot token--> api.telegram.org   (token ฝังใน bundle = หลุด)
// ใหม่: เบราว์เซอร์ --ข้อความ--> NAS --bot token--> api.telegram.org
//
// VITE_ ทำให้ Vite ฝังค่าลงไฟล์ JS ตอน build ดังนั้น VITE_TELEGRAM_BOT_TOKEN
// จึงหลุดทุกครั้งที่ deploy ไม่ว่าจะเปลี่ยน token กี่รอบ ทางแก้เดียวคือ token
// ต้องไม่เคยอยู่ในเว็บเลย ให้ NAS ถือแทน (อ่านจาก /volume1/nas-secrets/)
//
// คีย์ NAS ยังฝังอยู่ใน bundle เหมือนเดิม แต่ความเสียหายต่างกันมาก:
//   ก่อนย้าย = ได้ bot token เต็ม → อ่านข้อความทุกกลุ่ม, ส่งไปกลุ่มไหนก็ได้,
//              ตั้ง webhook ดักข้อความ, ลบบอท
//   หลังย้าย = สแปมเข้ากลุ่มเดียวที่ NAS กำหนด สูงสุด 30 ข้อความ/นาที
//              (chat_id อ่านจากไฟล์บนเซิร์ฟเวอร์ client เลือกปลายทางเองไม่ได้)

import { resolveBaseUrl } from './nasUpload';

const NAS_API_KEY = import.meta.env.VITE_NAS_API_KEY ?? '';

export type NotifyOptions = {
    /** ส่งแบบ HTML (<b>, <i>, <code>, <a href>) แทนข้อความธรรมดา */
    html?: boolean;
    /** ส่งเงียบ ไม่เด้งเสียงแจ้งเตือน */
    silent?: boolean;
    /** เลิกรอถ้าเกินกี่ ms (ค่าเริ่มต้น 8000) */
    timeoutMs?: number;
};

export type NotifyResult = { ok: true } | { ok: false; error: string };

/**
 * ส่งข้อความเข้ากลุ่ม Telegram ผ่าน NAS
 *
 * ไม่ throw — การแจ้งเตือนล้มเหลวต้องไม่ทำให้การสร้าง/จบใบงานพัง
 * ถ้าอยากรู้ผล ให้ดูค่าที่คืนกลับมา
 */
export async function notifyTelegram(
    text: string,
    opts: NotifyOptions = {},
): Promise<NotifyResult> {
    if (!NAS_API_KEY) {
        console.warn('[notifyTelegram] ยังไม่ได้ตั้ง VITE_NAS_API_KEY — ข้ามการแจ้งเตือน');
        return { ok: false, error: 'not_configured' };
    }

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);

    try {
        // ใช้ตัวเดียวกับการอัปโหลดรูป — resolveBaseUrl คืนค่าที่มี /api ติดมาแล้ว
        // (เช่น https://neosiam.dscloud.biz/api) จึงต่อท้ายด้วยชื่อไฟล์ตรง ๆ
        // ถ้าเติม /api/ เข้าไปอีกจะกลายเป็น /api/api/... แล้วได้ 404
        const base = await resolveBaseUrl();
        const res = await fetch(`${base}/telegram-notify.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': NAS_API_KEY,
            },
            body: JSON.stringify({
                text,
                parse_mode: opts.html ? 'HTML' : undefined,
                silent: opts.silent ?? false,
            }),
            signal: ctrl.signal,
        });

        // NAS ตัวนี้ตอบ HTTP 200 เสมอ แม้ตอนล้มเหลว เพราะ Nginx ของ Synology จะแทน
        // response ที่ไม่ใช่ 200 ด้วยหน้า error ของตัวเอง แล้ว CORS header หายหมด
        // ผลจริงจึงอยู่ใน body ไม่ใช่ res.ok  (ดู NAS-UPLOAD-GUIDE ข้อ 2)
        const body = (await res.json().catch(() => null)) as
            | { ok?: boolean; error?: string; status?: number }
            | null;

        if (!body || body.ok !== true) {
            const err = body?.error ?? `http_${res.status}`;
            console.warn('[notifyTelegram] ล้มเหลว', body?.status ?? res.status, err);
            return { ok: false, error: err };
        }
        return { ok: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn('[notifyTelegram] ยิงไม่ถึง NAS', msg);
        return { ok: false, error: msg };
    } finally {
        clearTimeout(timer);
    }
}

/** escape ข้อความก่อนใส่ใน HTML mode ของ Telegram */
export function tgEscape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
