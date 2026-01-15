
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
