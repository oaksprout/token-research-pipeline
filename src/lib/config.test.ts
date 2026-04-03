import { describe, it, expect } from 'vitest';
import { loadPortfolio, loadSectors, loadTokens } from './config.js';

describe('loadPortfolio', () => {
  it('loads holdings with required fields', () => {
    const portfolio = loadPortfolio();
    expect(portfolio.holdings.length).toBeGreaterThan(0);

    const btc = portfolio.holdings.find((h) => h.symbol === 'BTC');
    expect(btc).toBeDefined();
    expect(btc!.bucket).toBe('core');
    expect(btc!.thesis_status).toBe('intact');
    expect(btc!.execution_exempt).toBe(false);
  });

  it('loads targets', () => {
    const portfolio = loadPortfolio();
    expect(portfolio.targets.pilot_default_pct).toBe(0.05);
    expect(portfolio.targets.scale_default_pct).toBe(0.15);
    expect(portfolio.targets.max_sectors).toBe(3);
    expect(portfolio.targets.cash_reserve_pct).toBe(0.10);
  });

  it('identifies constrained holdings', () => {
    const portfolio = loadPortfolio();
    const olas = portfolio.holdings.find((h) => h.symbol === 'OLAS');
    expect(olas).toBeDefined();
    expect(olas!.bucket).toBe('constrained');
    expect(olas!.execution_exempt).toBe(true);
  });
});

describe('loadSectors', () => {
  it('loads all sectors', () => {
    const sectors = loadSectors();
    expect(Object.keys(sectors.sectors).length).toBeGreaterThanOrEqual(8);
    expect(sectors.sectors.rwa).toBeDefined();
    expect(sectors.sectors.rwa.token_universe).toContain('ONDO');
  });

  it('includes structural filters', () => {
    const sectors = loadSectors();
    const rwa = sectors.sectors.rwa;
    expect(rwa.structural_filters.novel_capability).toBe(true);
    expect(rwa.structural_filters.capital_pathway).toBe(true);
    expect(rwa.structural_filters.distribution_vector).toBe(true);
  });
});

describe('loadTokens', () => {
  it('loads all tokens', () => {
    const tokens = loadTokens();
    expect(Object.keys(tokens.tokens).length).toBeGreaterThanOrEqual(20);
    expect(tokens.tokens.BTC.coingecko_id).toBe('bitcoin');
  });

  it('maps tokens to sectors', () => {
    const tokens = loadTokens();
    expect(tokens.tokens.ONDO.sector).toBe('rwa');
    expect(tokens.tokens.BTC.sector).toBeNull();
  });
});
