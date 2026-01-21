
/**
 * Utility for Standard Thai Revenue Rounding (Round Half Up to 2 decimal places)
 */
export const roundHalfUp = (num: number, decimals: number = 2): number => {
    const factor = Math.pow(10, decimals);
    // Add a tiny epsilon to handle floating point precision issues
    // then round and shift back
    return Math.round((num + Number.EPSILON) * factor) / factor;
};

/**
 * Formats a number for Thai Currency display with 2 decimal places and commas
 */
export const formatThaiCurrency = (num: number): string => {
    const rounded = roundHalfUp(num, 2);
    return rounded.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

/**
 * Formats a date string to DD/MM/YYYY (e.g., 15/01/2026)
 * Uses en-GB locale to ensure result is Day/Month/Year
 */
export const formatDate = (dateInput: string | Date | number | undefined | null): string => {
    if (!dateInput) return '-';
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return '-';

    // 'en-GB' -> dd/mm/yyyy
    return date.toLocaleDateString('en-GB');
};

/**
 * Generates a UUID v4 with cross-browser compatibility.
 * Uses crypto.randomUUID() if available, otherwise falls back to a manual implementation.
 */
export const generateUUID = (): string => {
    // Check if crypto.randomUUID is available (modern browsers)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    // Fallback for older browsers or environments without crypto.randomUUID
    // Uses crypto.getRandomValues for security if available
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);

        // Set version (4) and variant bits
        bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
        bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10xx

        const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

    // Last resort fallback using Math.random (less secure but works everywhere)
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
};
