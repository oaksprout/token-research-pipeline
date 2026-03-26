import { describe, it, expect } from 'vitest';
import { computeSma, computeRsi } from './indicators.js';

describe('computeSma', () => {
  it('computes simple moving average', () => {
    const prices = [10, 20, 30, 40, 50];
    expect(computeSma(prices, 3)).toBe(40); // (30+40+50)/3
    expect(computeSma(prices, 5)).toBe(30); // (10+20+30+40+50)/5
  });

  it('returns null when insufficient data', () => {
    expect(computeSma([10, 20], 5)).toBeNull();
  });
});

describe('computeRsi', () => {
  it('returns ~50 for alternating equal moves', () => {
    // alternating +1, -1 over 28 periods
    const prices: number[] = [];
    let p = 100;
    for (let i = 0; i < 30; i++) {
      prices.push(p);
      p += i % 2 === 0 ? 1 : -1;
    }
    const rsi = computeRsi(prices, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(40);
    expect(rsi!).toBeLessThan(60);
  });

  it('returns high RSI for consistent gains', () => {
    const prices = Array.from({ length: 20 }, (_, i) => 100 + i * 2);
    const rsi = computeRsi(prices, 14);
    expect(rsi).not.toBeNull();
    expect(rsi!).toBeGreaterThan(90);
  });

  it('returns null when insufficient data', () => {
    expect(computeRsi([100, 101, 102], 14)).toBeNull();
  });
});
