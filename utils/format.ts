
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
