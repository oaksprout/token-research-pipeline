import { rateLimitedSleep } from '../lib/api.js';
import { loadTokens } from '../lib/config.js';
import { trace } from '../lib/trace.js';

// ─── Types ─────────────────────────────────────────────────────────

export interface PortfolioPosition {
  symbol: string;
  name: string;
  quantity: number;
  valueUsd: number;
  priceUsd: number;
  chain: string;
  verified: boolean;
}

export interface PortfolioSnapshot {
  timestamp: string;
  totalValueUsd: number;
  positions: PortfolioPosition[];
  trackedPositions: PortfolioPosition[];
  walletCount: number;
}

// ─── Constants ─────────────────────────────────────────────────────

const WALLET_ADDRESSES = [
  '0x7eb9d67f9daea510399a1ee978b36e66626058d3',
  '0xe84b217ba16dc2ea132911e468cbd24ece7fd871',
  '0xfb752162a2effd235130df67d5094e6ecb5f2891',
];

const ZERION_BASE = 'https://api.zerion.io/v1';

// ─── Zerion API response shape ─────────────────────────────────────

interface ZerionPosition {
  attributes: {
    quantity: { float: number };
    value: number | null;
    price: number;
    fungible_info: {
      name: string;
      symbol: string;
      flags: { verified: boolean };
    };
  };
  relationships: {
    chain: { data: { id: string } };
  };
}

interface ZerionResponse {
  data: ZerionPosition[];
}

// ─── Auth helper ───────────────────────────────────────────────────

function getZerionAuthHeader(): string {
  const apiKey = process.env.ZERION_API_KEY;
  if (!apiKey) throw new Error('ZERION_API_KEY is not set');
  const encoded = Buffer.from(`${apiKey}:`).toString('base64');
  return `Basic ${encoded}`;
}

// ─── Fetch helper with retry ───────────────────────────────────────

async function fetchZerion<T>(path: string, retries = 3, baseDelayMs = 1500): Promise<T | null> {
  const url = `${ZERION_BASE}${path}`;
  const auth = getZerionAuthHeader();

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          accept: 'application/json',
          authorization: auth,
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      const isLast = attempt === retries - 1;
      if (isLast) {
        console.error(
          `fetchZerion failed after ${retries} attempts for ${url}:`,
          err instanceof Error ? err.message : err,
        );
        return null;
      }
      const delay = baseDelayMs * 2 ** attempt;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return null;
}

// ─── Fetch wallet positions ────────────────────────────────────────

async function fetchWalletPositions(address: string): Promise<PortfolioPosition[]> {
  const start = Date.now();
  const path = `/wallets/${address}/positions/?filter[positions]=only_simple&currency=usd&page[size]=100`;
  const data = await fetchZerion<ZerionResponse>(path);
  const durationMs = Date.now() - start;

  if (!data?.data) {
    await trace('ingest', 'fetch_zerion_wallet', 'error', {
      address,
      error: 'No data returned',
    }, durationMs);
    return [];
  }

  const positions: PortfolioPosition[] = data.data.map((p) => ({
    symbol: p.attributes.fungible_info.symbol.toUpperCase(),
    name: p.attributes.fungible_info.name,
    quantity: p.attributes.quantity.float,
    valueUsd: p.attributes.value ?? 0,
    priceUsd: p.attributes.price,
    chain: p.relationships.chain.data.id,
    verified: p.attributes.fungible_info.flags.verified,
  }));

  const totalValue = positions.reduce((sum, p) => sum + p.valueUsd, 0);

  await trace('ingest', 'fetch_zerion_wallet', 'api_call', {
    address,
    positionCount: positions.length,
    totalValue,
  }, durationMs);

  return positions;
}

// ─── Aggregate positions across wallets ────────────────────────────

function aggregatePositions(allPositions: PortfolioPosition[]): PortfolioPosition[] {
  const bySymbol = new Map<string, PortfolioPosition>();

  for (const p of allPositions) {
    const key = p.symbol;
    const existing = bySymbol.get(key);
    if (existing) {
      existing.quantity += p.quantity;
      existing.valueUsd += p.valueUsd;
      // Keep latest price (last write wins — fine for same-day snapshots)
      existing.priceUsd = p.priceUsd;
      // Keep verified if any wallet's position is verified
      existing.verified = existing.verified || p.verified;
    } else {
      bySymbol.set(key, { ...p });
    }
  }

  return Array.from(bySymbol.values()).sort((a, b) => b.valueUsd - a.valueUsd);
}

// ─── Main orchestrator ─────────────────────────────────────────────

export async function ingestPortfolio(): Promise<PortfolioSnapshot> {
  console.log('[ingest_portfolio] Starting wallet position fetch');

  // Fetch all wallets sequentially with rate limiting
  const allPositions: PortfolioPosition[] = [];
  for (let i = 0; i < WALLET_ADDRESSES.length; i++) {
    if (i > 0) await rateLimitedSleep();
    const positions = await fetchWalletPositions(WALLET_ADDRESSES[i]);
    allPositions.push(...positions);
  }

  // Aggregate across wallets
  const aggregated = aggregatePositions(allPositions);

  // Load tracked token universe
  const tokensConfig = loadTokens();
  const trackedSymbols = new Set(
    Object.keys(tokensConfig.tokens).map((s) => s.toUpperCase()),
  );

  // Filter: tracked tokens
  const trackedPositions = aggregated.filter((p) => trackedSymbols.has(p.symbol));

  // All positions: tracked + any position > $100 (for discovery)
  const positions = aggregated.filter(
    (p) => trackedSymbols.has(p.symbol) || p.valueUsd > 100,
  );

  const totalValueUsd = aggregated.reduce((sum, p) => sum + p.valueUsd, 0);

  const snapshot: PortfolioSnapshot = {
    timestamp: new Date().toISOString(),
    totalValueUsd,
    positions,
    trackedPositions,
    walletCount: WALLET_ADDRESSES.length,
  };

  await trace('ingest', 'portfolio_snapshot', 'computation', {
    walletCount: WALLET_ADDRESSES.length,
    totalPositions: positions.length,
    trackedPositions: trackedPositions.length,
    totalValueUsd: snapshot.totalValueUsd,
    topPositions: snapshot.positions.slice(0, 10).map((p) => ({
      symbol: p.symbol,
      value: p.valueUsd,
    })),
  });

  console.log(
    `[ingest_portfolio] Done — ${positions.length} positions, ${trackedPositions.length} tracked, $${totalValueUsd.toFixed(2)} total`,
  );

  return snapshot;
}
