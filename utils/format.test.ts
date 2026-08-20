import { describe, it, expect } from 'vitest';
import { roundHalfUp, formatThaiCurrency } from './format';

describe('roundHalfUp', () => {
    // These are the amounts that used to round DOWN because the binary
    // representation of the value sits just below the .xx5 boundary.
    it.each([
        [10.075, 10.08],
        [8.165, 8.17],
        [5.015, 5.02],
        [4.185, 4.19],
    ])('rounds %s up to %s (was rounding down)', (input, expected) => {
        expect(roundHalfUp(input)).toBe(expected);
    });

    it.each([
        [1.005, 1.01],
        [2.675, 2.68],
        [0.615, 0.62],
        [1.055, 1.06],
        [0.005, 0.01],
    ])('rounds %s up to %s', (input, expected) => {
        expect(roundHalfUp(input)).toBe(expected);
    });

    it('leaves values that already have 2 decimals untouched', () => {
        for (const v of [0, 1.5, 99.99, 1234.56, 1007.5]) {
            expect(roundHalfUp(v)).toBe(v);
        }
    });

    it('rounds negatives away from zero', () => {
        expect(roundHalfUp(-10.075)).toBe(-10.08);
        expect(roundHalfUp(-1.005)).toBe(-1.01);
    });

    it('returns 0 for non-finite input so NaN never reaches a total', () => {
        expect(roundHalfUp(NaN)).toBe(0);
        expect(roundHalfUp(Infinity)).toBe(0);
        expect(roundHalfUp(-Infinity)).toBe(0);
        expect(roundHalfUp(Number(undefined))).toBe(0);
    });

    it.each([1e21, 1e20, 1e19, 5e19, -1e20, Number.MAX_VALUE])(
        'leaves %s beyond 2-decimal precision unchanged instead of returning NaN',
        (input) => {
            expect(roundHalfUp(input)).toBe(input);
        }
    );

    it('honours a custom decimals argument', () => {
        expect(roundHalfUp(10.0749, 3)).toBe(10.075);
        expect(roundHalfUp(1.5, 0)).toBe(2);
    });
});

describe('VAT / WHT invoice arithmetic', () => {
    // Mirrors InvoicePreviewModal: VAT and WHT are both charged on the subtotal,
    // never on a VAT-inclusive amount.
    const compute = (subtotal: number, applyVat: boolean, applyWht: boolean) => {
        const vatAmount = applyVat ? roundHalfUp((subtotal * 7) / 100) : 0;
        const whtAmount = applyWht ? roundHalfUp((subtotal * 1) / 100) : 0;
        return { vatAmount, whtAmount, netTotal: roundHalfUp(subtotal + vatAmount - whtAmount) };
    };

    it('withholds 10.08 on a 1,007.50 subtotal (previously 10.07)', () => {
        expect(compute(1007.5, false, true).whtAmount).toBe(10.08);
    });

    it('adds VAT and subtracts WHT from the same base', () => {
        const { vatAmount, whtAmount, netTotal } = compute(1000, true, true);
        expect(vatAmount).toBe(70);
        expect(whtAmount).toBe(10);
        expect(netTotal).toBe(1060);
    });

    it('charges nothing when neither tax applies', () => {
        expect(compute(1234.56, false, false)).toEqual({ vatAmount: 0, whtAmount: 0, netTotal: 1234.56 });
    });

    it('rounds a VAT amount that lands exactly on .005 up', () => {
        // 1500.50 * 7% = 105.035 -> 105.04
        expect(compute(1500.5, true, false).vatAmount).toBe(105.04);
    });

    it('applies VAT alone without touching WHT', () => {
        const { vatAmount, whtAmount, netTotal } = compute(1007.5, true, false);
        expect(vatAmount).toBe(70.53);
        expect(whtAmount).toBe(0);
        expect(netTotal).toBe(1078.03);
    });

    it('applies WHT alone without adding VAT', () => {
        const { vatAmount, whtAmount, netTotal } = compute(1007.5, false, true);
        expect(vatAmount).toBe(0);
        expect(whtAmount).toBe(10.08);
        expect(netTotal).toBe(997.42);
    });
});

describe('subtotal rounding before tax', () => {
    // Mirrors InvoicePreviewModal: the subtotal is rounded to 2 decimals FIRST,
    // then both taxes are charged on that rounded figure.
    const subtotalOf = (costs: Array<number | undefined | null | string>) =>
        roundHalfUp(costs.reduce<number>((sum, c) => sum + (Number(c) || 0), 0));

    it('rounds a subtotal carrying more than 2 decimals', () => {
        expect(subtotalOf([100.005, 200.004])).toBe(300.01);
    });

    it('treats missing and non-numeric costs as zero', () => {
        expect(subtotalOf([1000, undefined, null, '', 'abc'])).toBe(1000);
    });

    it('keeps the invoice row total equal to the sum of its rows', () => {
        const costs = [333.33, 333.33, 333.34];
        expect(subtotalOf(costs)).toBe(1000);
    });
});

describe('formatThaiCurrency', () => {
    it('always shows exactly two decimals', () => {
        expect(formatThaiCurrency(1000)).toBe('1,000.00');
        expect(formatThaiCurrency(10.075)).toBe('10.08');
    });

    it('renders 0.00 instead of NaN when a cost is missing', () => {
        expect(formatThaiCurrency(Number(undefined))).toBe('0.00');
        expect(formatThaiCurrency(Number('abc'))).toBe('0.00');
    });
});
