export type Tier = 'observe' | 'ready' | 'pilot' | 'scale';

export interface TierContext {
  sector: string;
  currentTier: Tier;
  sectorScore: number;
  sectorScoreHistory: number[]; // last N weeks, oldest first
  structuralFilterPasses: boolean;
  validationPasses: boolean;
  leaderToken: string | null;
  leaderTokenScore: number | null;
  regimeLabel: string; // 'deteriorating' | 'stabilising' | 'improving'
  weeksAtCurrentTier: number;
}

export interface TierRecommendation {
  sector: string;
  priorTier: Tier;
  proposedTier: Tier;
  tierChanged: boolean;
  changeReason: string;
  leaderToken: string | null;
  leaderStatus: string | null;
}

// ─── Promotion checks ──────────────────────────────────────────────

function canPromoteToReady(ctx: TierContext): { promote: boolean; reason: string } {
  if (ctx.sectorScore < 40) return { promote: false, reason: '' };
  if (!ctx.structuralFilterPasses) return { promote: false, reason: '' };

  // Rising 2+ weeks: need at least 2 entries in history, each >= prior
  const h = ctx.sectorScoreHistory;
  if (h.length < 2) return { promote: false, reason: '' };
  const rising = h.slice(-2).every((v, i, arr) => i === 0 || v >= arr[i - 1]);
  if (!rising) return { promote: false, reason: '' };

  return { promote: true, reason: 'score_gte_40_rising_2w' };
}

function canPromoteToPilot(ctx: TierContext): { promote: boolean; reason: string } {
  if (ctx.sectorScore < 60) return { promote: false, reason: '' };
  if (!ctx.structuralFilterPasses) return { promote: false, reason: '' };
  if (!ctx.validationPasses) return { promote: false, reason: '' };
  if (ctx.weeksAtCurrentTier < 2) return { promote: false, reason: '' };

  // Stable or rising (not declining 3+ weeks)
  const h = ctx.sectorScoreHistory;
  if (h.length >= 3) {
    const declining3w = h.slice(-3).every((v, i, arr) => i === 0 || v < arr[i - 1]);
    if (declining3w) return { promote: false, reason: '' };
  }

  return { promote: true, reason: 'score_gte_60_validated_stable' };
}

function canPromoteToScale(ctx: TierContext): { promote: boolean; reason: string } {
  if (ctx.regimeLabel === 'deteriorating') return { promote: false, reason: '' };
  if (ctx.sectorScore < 60) return { promote: false, reason: '' };
  if (ctx.leaderTokenScore == null || ctx.leaderTokenScore < 70) {
    return { promote: false, reason: '' };
  }

  // Not declining 3+ weeks
  const h = ctx.sectorScoreHistory;
  if (h.length >= 3) {
    const declining3w = h.slice(-3).every((v, i, arr) => i === 0 || v < arr[i - 1]);
    if (declining3w) return { promote: false, reason: '' };
  }

  return { promote: true, reason: 'regime_ok_leader_gte_70' };
}

// ─── Demotion check ────────────────────────────────────────────────

function shouldDemote(ctx: TierContext): { demote: boolean; reason: string; targetTier: Tier } {
  // Structural filter failure → observe
  if (!ctx.structuralFilterPasses) {
    return { demote: true, reason: 'structural_filter_failed', targetTier: 'observe' };
  }

  // Declining 3+ consecutive weeks
  const h = ctx.sectorScoreHistory;
  if (h.length >= 3) {
    const declining3w = h.slice(-3).every((v, i, arr) => i === 0 || v < arr[i - 1]);
    if (declining3w) {
      const target = ctx.currentTier === 'scale' ? 'pilot'
        : ctx.currentTier === 'pilot' ? 'ready'
        : 'observe';
      return { demote: true, reason: 'declining_3w', targetTier: target };
    }
  }

  // Leader token lost (score dropped below 50 for pilot/scale tiers)
  if ((ctx.currentTier === 'pilot' || ctx.currentTier === 'scale') &&
    (ctx.leaderTokenScore == null || ctx.leaderTokenScore < 50)) {
    const target = ctx.currentTier === 'scale' ? 'pilot' : 'ready';
    return { demote: true, reason: 'leader_token_lost', targetTier: target };
  }

  // Validation failure at pilot/scale → cap at ready
  if ((ctx.currentTier === 'pilot' || ctx.currentTier === 'scale') && !ctx.validationPasses) {
    return { demote: true, reason: 'validation_failed', targetTier: 'ready' };
  }

  return { demote: false, reason: '', targetTier: ctx.currentTier };
}

// ─── Main ──────────────────────────────────────────────────────────

export function computeTierRecommendation(ctx: TierContext): TierRecommendation {
  const base = {
    sector: ctx.sector,
    priorTier: ctx.currentTier,
    leaderToken: ctx.leaderToken,
    leaderStatus: ctx.leaderTokenScore != null
      ? (ctx.leaderTokenScore >= 70 ? 'scale' : ctx.leaderTokenScore >= 50 ? 'pilot' : ctx.leaderTokenScore >= 30 ? 'ready' : 'observe')
      : null,
  };

  // 1. Check demotion first (safety)
  const demotion = shouldDemote(ctx);
  if (demotion.demote) {
    return {
      ...base,
      proposedTier: demotion.targetTier,
      tierChanged: demotion.targetTier !== ctx.currentTier,
      changeReason: demotion.reason,
    };
  }

  // 2. Check promotion (only one tier at a time)
  if (ctx.currentTier === 'observe') {
    const result = canPromoteToReady(ctx);
    if (result.promote) {
      return { ...base, proposedTier: 'ready', tierChanged: true, changeReason: result.reason };
    }
  } else if (ctx.currentTier === 'ready') {
    const result = canPromoteToPilot(ctx);
    if (result.promote) {
      return { ...base, proposedTier: 'pilot', tierChanged: true, changeReason: result.reason };
    }
  } else if (ctx.currentTier === 'pilot') {
    const result = canPromoteToScale(ctx);
    if (result.promote) {
      return { ...base, proposedTier: 'scale', tierChanged: true, changeReason: result.reason };
    }
  }

  // 3. No change
  return { ...base, proposedTier: ctx.currentTier, tierChanged: false, changeReason: 'no_change' };
}
