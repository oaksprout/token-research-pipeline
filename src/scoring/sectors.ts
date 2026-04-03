import { SECTOR } from './constants.js';
import type { StructuralFilters } from '../lib/types.js';

export function clampSectorSub(value: number): number {
  return Math.max(SECTOR.SUB_SCORE_MIN, Math.min(SECTOR.SUB_SCORE_MAX, value));
}

// ─── Sub-score 1: Dev Activity ─────────────────────────────────────

export function scoreDevActivity(devCommitsProxy: number | null): number {
  if (devCommitsProxy === null) return SECTOR.DEV.NO_DATA;
  if (devCommitsProxy === 0) return SECTOR.DEV.DECLINING;
  if (devCommitsProxy <= 50) return SECTOR.DEV.STABLE;
  if (devCommitsProxy <= 100) return SECTOR.DEV.GROWING;
  return SECTOR.DEV.ACCELERATING;
}

// ─── Sub-score 2: Usage ────────────────────────────────────────────

export function scoreUsage(
  tvlChange30d: number | null,
  feeRevenue30d: number | null,
): number {
  let score: number;

  if (tvlChange30d === null) {
    score = SECTOR.USAGE.TVL_FLAT;
  } else if (tvlChange30d < SECTOR.USAGE.TVL_CONTRACTING_THRESHOLD) {
    score = SECTOR.USAGE.TVL_CONTRACTING;
  } else if (tvlChange30d < SECTOR.USAGE.TVL_GROWING_THRESHOLD) {
    score = SECTOR.USAGE.TVL_FLAT;
  } else if (tvlChange30d < SECTOR.USAGE.TVL_ACCELERATING_THRESHOLD) {
    score = SECTOR.USAGE.TVL_GROWING;
  } else {
    score = SECTOR.USAGE.TVL_ACCELERATING;
  }

  if (feeRevenue30d !== null && feeRevenue30d > 0) {
    score += SECTOR.USAGE.FEE_REVENUE_BONUS;
  }

  return clampSectorSub(score);
}

// ─── Sub-score 3: Funding ──────────────────────────────────────────

export function scoreFunding(fundingTotal30d: number | null): number {
  if (fundingTotal30d === null) return SECTOR.FUNDING.NO_DATA_DEFAULT;
  if (fundingTotal30d === 0) return SECTOR.FUNDING.NONE;
  if (fundingTotal30d <= SECTOR.FUNDING.MINOR_THRESHOLD) return SECTOR.FUNDING.MINOR;
  if (fundingTotal30d <= SECTOR.FUNDING.SIGNIFICANT_THRESHOLD) return SECTOR.FUNDING.SIGNIFICANT;
  return SECTOR.FUNDING.MAJOR;
}

// ─── Sub-score 4: Narrative ────────────────────────────────────────

export function scoreNarrative(basketReturn7d: number | null): number {
  if (basketReturn7d === null) return SECTOR.NARRATIVE.FLAT;
  if (basketReturn7d < SECTOR.NARRATIVE.DOWN_HEAVY_THRESHOLD) return SECTOR.NARRATIVE.DOWN_HEAVY;
  if (basketReturn7d < SECTOR.NARRATIVE.DOWN_LIGHT_THRESHOLD) return SECTOR.NARRATIVE.DOWN_LIGHT;
  if (basketReturn7d < SECTOR.NARRATIVE.UP_LIGHT_THRESHOLD) return SECTOR.NARRATIVE.FLAT;
  if (basketReturn7d < SECTOR.NARRATIVE.UP_HEAVY_THRESHOLD) return SECTOR.NARRATIVE.UP_LIGHT;
  return SECTOR.NARRATIVE.UP_HEAVY;
}

// ─── Sub-score 5: Relative Strength ────────────────────────────────

export function scoreRelativeStrength(
  rsVsBtc30d: number | null,
  rsVsEth30d: number | null,
): number {
  if (rsVsBtc30d === null && rsVsEth30d === null) return SECTOR.RS.MATCH_BOTH;

  const btc = rsVsBtc30d ?? 0;
  const eth = rsVsEth30d ?? 0;

  const btcOver = btc > 0;
  const ethOver = eth > 0;
  const btcUnder = btc < 0;
  const ethUnder = eth < 0;

  if (btcOver && ethOver) {
    if (btc > SECTOR.RS.OUTPERFORM_THRESHOLD && eth > SECTOR.RS.OUTPERFORM_THRESHOLD) {
      return SECTOR.RS.OVER_BOTH_15PCT;
    }
    return SECTOR.RS.OVER_BOTH;
  }
  if (btcUnder && ethUnder) return SECTOR.RS.UNDER_BOTH;
  if (btcOver || ethOver) return SECTOR.RS.OVER_ONE;
  if (btcUnder || ethUnder) return SECTOR.RS.UNDER_ONE;

  return SECTOR.RS.MATCH_BOTH;
}

// ─── Structural Filters ────────────────────────────────────────────

export function checkStructuralFilters(
  filters: StructuralFilters,
): { passes: boolean; failedFilters: string[] } {
  const failedFilters: string[] = [];

  if (!filters.novel_capability) failedFilters.push('novel_capability');
  if (!filters.capital_pathway) failedFilters.push('capital_pathway');
  if (!filters.distribution_vector) failedFilters.push('distribution_vector');

  return { passes: failedFilters.length === 0, failedFilters };
}

// ─── Validation ────────────────────────────────────────────────────

export function checkValidation(
  tvlChange30d: number | null,
  feeRevenue30d: number | null,
): { passes: boolean; notes: string[] } {
  const notes: string[] = [];

  const retention = tvlChange30d !== null && tvlChange30d > 0;
  const unitEconomics = feeRevenue30d !== null && feeRevenue30d > 0;
  const composability = tvlChange30d !== null;

  if (!retention) notes.push('retention');
  if (!unitEconomics) notes.push('unit_economics');
  if (!composability) notes.push('composability');

  return { passes: notes.length === 0, notes };
}

// ─── Sector Total ──────────────────────────────────────────────────

export interface SectorMetricsInput {
  devCommitsProxy: number | null;
  tvlChange30d: number | null;
  feeRevenue30d: number | null;
  fundingTotal30d: number | null;
  basketReturn7d: number | null;
  basketReturn30d: number | null;
  rsVsBtc30d: number | null;
  rsVsEth30d: number | null;
}

export interface SectorScoreResult {
  scoreTotal: number;
  scoreDelta4w: number | null;
  confidence: 'low' | 'medium' | 'high';
  structuralFilter: 'pass' | 'fail';
  validation: 'pass' | 'fail' | 'n/a';
  subDev: number;
  subUsage: number;
  subFunding: number;
  subNarrative: number;
  subRs: number;
  tierCandidate: 'observe' | 'ready' | 'pilot';
  leaderTokens: string;
}

export function computeSectorScore(
  input: SectorMetricsInput,
  filters: StructuralFilters,
  priorScore4wAgo: number | null,
  leaderTokens: string,
): SectorScoreResult {
  const subDev = scoreDevActivity(input.devCommitsProxy);
  const subUsage = scoreUsage(input.tvlChange30d, input.feeRevenue30d);
  const subFunding = scoreFunding(input.fundingTotal30d);
  const subNarrative = scoreNarrative(input.basketReturn7d);
  const subRs = scoreRelativeStrength(input.rsVsBtc30d, input.rsVsEth30d);

  const scoreTotal = subDev + subUsage + subFunding + subNarrative + subRs;

  // Determine base tier
  let tierCandidate: SectorScoreResult['tierCandidate'];
  if (scoreTotal < SECTOR.READY_THRESHOLD) {
    tierCandidate = 'observe';
  } else if (scoreTotal < SECTOR.PILOT_THRESHOLD) {
    tierCandidate = 'ready';
  } else {
    tierCandidate = 'pilot';
  }

  // Structural filter: if fails, cap at observe
  const structural = checkStructuralFilters(filters);
  if (!structural.passes) {
    tierCandidate = 'observe';
  }

  // Validation: if score >= 60 and validation fails, cap at ready
  const val = checkValidation(input.tvlChange30d, input.feeRevenue30d);
  let validation: SectorScoreResult['validation'];
  if (scoreTotal >= SECTOR.PILOT_THRESHOLD) {
    validation = val.passes ? 'pass' : 'fail';
    if (!val.passes && tierCandidate === 'pilot') {
      tierCandidate = 'ready';
    }
  } else {
    validation = 'n/a';
  }

  // Score delta
  const scoreDelta4w = priorScore4wAgo !== null ? scoreTotal - priorScore4wAgo : null;

  // Confidence based on delta magnitude
  let confidence: SectorScoreResult['confidence'];
  if (scoreDelta4w !== null && Math.abs(scoreDelta4w) > 15) {
    confidence = 'high';
  } else if (scoreDelta4w !== null && Math.abs(scoreDelta4w) > 5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  return {
    scoreTotal,
    scoreDelta4w,
    confidence,
    structuralFilter: structural.passes ? 'pass' : 'fail',
    validation,
    subDev,
    subUsage,
    subFunding,
    subNarrative,
    subRs,
    tierCandidate,
    leaderTokens,
  };
}
