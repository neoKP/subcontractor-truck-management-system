import { describe, it, expect } from 'vitest';
import SAHA_OIL from '../data/sahaOilAdjust.json';
import { roundHalfUp } from './format';
import { buildOilRounds, daysBetween, todayIsoLocal, OIL_BASE } from './oilRounds';

// Exercises the same buildOilRounds() the page renders, so a change to the arithmetic
// fails here instead of silently shifting invoice-facing percentages.
const BASE = OIL_BASE;

const byDate = (SAHA_OIL as { byDate: Record<string, number> }).byDate;
// Fixed date so the last round's day count stays stable as the calendar moves on.
const rounds = buildOilRounds(byDate, '2026-08-20');
const latest = rounds[rounds.length - 1];

describe('buildOilRounds — matches the published figures', () => {
    it('reports 30 adjustment rounds', () => {
        expect(rounds.length).toBe(30);
    });

    it('carries the latest cumulative percentage from the data file', () => {
        expect(latest.pctCum).toBe((SAHA_OIL as { latest: number }).latest);
        expect(latest.pctCum).toBe(6.45);
    });

    it('derives the latest diesel price from the 31.94 base', () => {
        expect(latest.diesel).toBe(38.39);
    });

    it('spans 31.94 to 50.54 baht', () => {
        const vals = rounds.map(r => r.diesel);
        expect(Math.min(...vals)).toBe(31.94);
        expect(Math.max(...vals)).toBe(50.54);
    });

    it.each([
        [29, '2026-08-19', 38.39, 0.85, 6.45, 2],
        [28, '2026-08-12', 37.54, 0.85, 5.60, 7],
        [27, '2026-07-23', 36.69, 0.90, 4.75, 20],
    ])('round %i matches diesel/delta/pct/days', (seq, iso, diesel, delta, pct, days) => {
        const r = rounds.find(x => x.seq === seq)!;
        expect(r.startIso).toBe(iso);
        expect(r.diesel).toBe(diesel);
        expect(r.delta).toBe(delta);
        expect(r.pctCum).toBe(pct);
        expect(r.days).toBe(days);
    });
});

describe('buildOilRounds — structural guarantees', () => {
    it('starts from a base round at 0%', () => {
        expect(rounds[0].seq).toBe(0);
        expect(rounds[0].pctCum).toBe(0);
        expect(rounds[0].diesel).toBe(BASE);
    });

    it('numbers rounds consecutively after the base', () => {
        rounds.slice(1).forEach((r, i) => expect(r.seq).toBe(i + 1));
    });

    it('keeps start dates strictly ascending', () => {
        for (let i = 1; i < rounds.length; i++) {
            expect(rounds[i].startIso > rounds[i - 1].startIso).toBe(true);
        }
    });

    it('never produces NaN or a non-positive day count', () => {
        for (const r of rounds) {
            expect(Number.isFinite(r.diesel)).toBe(true);
            expect(Number.isFinite(r.pctCum)).toBe(true);
            expect(r.days).toBeGreaterThan(0);
        }
    });

    it('keeps each delta equal to the gap between consecutive rounds', () => {
        for (let i = 1; i < rounds.length; i++) {
            expect(rounds[i].delta).toBe(roundHalfUp(rounds[i].pctCum - rounds[i - 1].pctCum));
        }
    });

    it('returns an empty list for empty input', () => {
        expect(buildOilRounds({}, '2026-08-20')).toEqual([]);
    });

    it('counts the final round up to today, not to the last recorded date', () => {
        const later = buildOilRounds(byDate, '2026-08-25');
        expect(later[later.length - 1].days).toBe(latest.days + 5);
    });
});

describe('daysBetween', () => {
    it('counts whole days between two ISO dates', () => {
        expect(daysBetween('2026-08-12', '2026-08-19')).toBe(7);
        expect(daysBetween('2026-08-19', '2026-08-19')).toBe(0);
    });

    it('crosses month and year boundaries', () => {
        expect(daysBetween('2026-01-31', '2026-02-01')).toBe(1);
        expect(daysBetween('2025-12-31', '2026-01-01')).toBe(1);
    });

    it('returns a negative count when the range is reversed', () => {
        expect(daysBetween('2026-08-19', '2026-08-12')).toBe(-7);
    });
});

describe('todayIsoLocal', () => {
    it('pads month and day to two digits', () => {
        expect(todayIsoLocal(new Date(2026, 0, 5))).toBe('2026-01-05');
        expect(todayIsoLocal(new Date(2026, 11, 25))).toBe('2026-12-25');
    });
});
