# Token Research Pipeline — Weakness Analysis Prompt

You are a senior quantitative portfolio analyst and systems critic. Your job is to identify where this token research pipeline will produce weak signals that lead to **bad investment decisions** — missed entries, late exits, false confidence, or misallocated capital.

You have been given the full system design below. Analyse it ruthlessly. Do not praise the system. Focus exclusively on where it will fail the operator in practice.

---

## System Overview

This is a weekly crypto portfolio management pipeline. It runs two cron jobs:

1. **Daily ingest** — fetches market data (prices, flows, on-chain metrics) from CoinGecko, Binance Futures, and DefiLlama. Computes technical indicators (SMA 20/50/200, RSI 14, ETH/BTC and SOL/BTC ratios).
2. **Weekly scoring** — computes a regime score, sector scores, token scores, and portfolio action recommendations. All scoring is deterministic (rule-based, no ML). Results are passed to three LLM prompts for human-in-the-loop review.

The operator manages a concentrated portfolio: 3 core positions (BTC, ETH, SOL), ~5 active sector bets, and 1 constrained position (OLAS — co-founder, cannot sell). Target allocation: max 3 sectors at Pilot/Scale, 10% cash reserve, pilot sizing 2-5%, scale sizing 10-15%.

---

## Regime Scoring (Market Health)

Five sub-scores, each clamped to [-20, +20]. Total range: -100 to +100.

### 1. Market Structure
- BTC above SMA200: +6, SMA50: +4, SMA20: +3
- Higher weekly lows (4 weeks): +7; lower weekly lows: -7
- Within 10% of 52-week low: -4 (panic); within 20% of 52-week high: +4

### 2. Leverage Stress
- Funding rate negative (<-0.01%): +8 (bears overcrowded, bullish)
- Funding rate positive (>0.03%): -8 (excess longs, risky)
- Funding near zero: +4 (healthy)
- OI declining >10% (7d): +4 (deleveraging); OI expanding >15% (7d): -4
- Liquidations >$200M long: +4 (flush); >$200M short: -4 (squeeze)

### 3. Flow Support
- ETF net inflow: +6; outflow: -6
- Stablecoin growing >1% (7d): +5; shrinking: -5
- Stablecoin accelerating: +3; decelerating: -3
- Exchange outflow (accumulation): +5; inflow (distribution): -5

### 4. On-Chain Stress
- BTC <30% of ATH: +12 (deep washout); <50% of ATH: +8
- BTC >80% of ATH: -8 (near top, risky)
- RSI <30: +6 (oversold); RSI >70: -6 (overbought)

### 5. Alt Relative Strength
- ETH/BTC above SMA20: +5; below: -5
- SOL/BTC above SMA20: +5; below: -5
- ETH/BTC rising 3 weeks: +5; falling: -5
- SOL/BTC rising 3 weeks: +5; falling: -5

**Labels:**
- Score <= -20: "deteriorating" (no aggressive risk)
- -20 to +20: "stabilising" (pilot OK)
- Score >= +20: "improving" (full sizing OK)

---

## Sector Scoring (Fundamental Health)

Five sub-scores, each 0-20. Total: 0-100.

1. **Dev Activity**: GitHub commits (no data=10, declining=5, stable=10, growing=15, accelerating=20)
2. **Usage/Growth**: TVL trends + fee revenue (contracting=3, flat=8, growing=14, accelerating=18, +fee bonus +2)
3. **Funding**: Capital raised in 30 days (none=2, minor <$10M=8, significant ~$50M=14, major=20)
4. **Narrative/Momentum**: 30-day price performance (down heavy=3, down light=6, flat=10, up light=14, up heavy=18)
5. **Relative Strength**: Performance vs BTC and ETH (under both=3, under one=8, match=10, over one=14, over both=18-20)

**Tier thresholds:** <40 = Not candidate, 40-60 = Ready, 60+ = Pilot

**Structural filter gate:** Each sector must pass 3 booleans (novel_capability, capital_pathway, distribution_vector). All 3 must pass for Pilot eligibility. Failure caps at Ready.

---

## Token Scoring (Individual Quality)

Five sub-scores, each 0-20. Total: 0-100.

1. **Liquidity**: Volume/MCap ratio (<1%=4, 1-5%=10, 5-15%=16, >15%=20)
2. **Relative Strength**: vs BTC + vs ETH (under both=4, over one=10, over both=16, over both >15%=20)
3. **Structure**: Price trend across 7/30/90-day (all negative=3, mixed=8, inflection=12, uptrend forming=16, established=20)
4. **Volume**: Volume expansion vs average (below 50%=4, below avg=10, expanding=16, strong=20)
5. **Valuation**: FDV/MCap dilution ratio (>10x=4, 5-10x=8, 2-5x=12, <2x=16, +fee revenue +4)

**Candidate status:** <30=Observe, 30-50=Ready, 50-70=Pilot, 70+=Scale

---

## Tracked Universe

**8 Sectors:**
- RWA: ONDO, CFG, MPL, BUIDL (BUIDL not tradeable — TVL signal only)
- DePIN: HNT, RENDER, DIMO
- AI Agent: VIRTUAL, TAO, OLAS (OLAS = co-founder, execution exempt)
- DA: TIA, AVAIL
- BTC L2: STX, BABY
- ZK Infra: PROVE (supply cliff August 2026, 80% locked)
- Stablecoin Infra: empty universe (planned)
- DeFi Infra: AAVE, LDO, UNI, MKR (capped at Ready — fails novelty gate)

**Core positions (no sector):** BTC, ETH, SOL, ZORA (marked for exit)

---

## Current Portfolio Holdings

| Symbol | Bucket | Units | Cost Basis | Thesis Status | Notes |
|--------|--------|-------|------------|---------------|-------|
| BTC | core | 0.5 | $25,000 | intact | Permanent hold |
| ETH | core | 5.0 | $1,200 | intact | Sold 60%, holding rest |
| SOL | core | 50 | $20 | intact | Sold 60%, holding rest |
| AAVE | active | 10 | $180 | intact | TradFi entry thesis |
| LDO | active | 500 | $2.50 | weakening | Can't add. Share dropping. |
| ZORA | active | 1000 | $0.05 | invalidated | Sell. No conviction. |
| TIA | active | 200 | $8.00 | intact | DA bet. ETH competition risk. |
| PROVE | active | 5000 | $0.80 | intact | Supply cliff Aug 2026 |
| OLAS | constrained | 10000 | $0 | intact | Co-founder. Cannot sell. |

---

## Data Sources & Known Gaps

- **Liquidations**: NULL — CoinGlass API not integrated yet
- **ETF flows**: NULL — SoSoValue not integrated yet
- **Exchange flows**: Skipped in v1
- **Sector metrics** (TVL, dev activity, funding events): Placeholder/dummy values pending DefiLlama + GitHub integration
- **GitHub repos**: Empty arrays for all sectors currently
- Only CoinGecko free tier for prices (rate limited)

---

## Your Analysis

Structure your response in these sections. Be specific — name the exact scoring rule, threshold, data gap, or structural blind spot. Give concrete scenarios where the system leads to a bad trade.

### 1. REGIME SCORING WEAKNESSES
Where will the regime score give false confidence or false alarm? Which sub-scores are most likely to mislead? Are the thresholds calibrated for current market structure? What market conditions will break this model?

### 2. SECTOR & TOKEN SCORING WEAKNESSES
Where will the scoring logic systematically over- or under-rate sectors/tokens? What important signals are missing entirely? How do the equal-weighted sub-scores distort reality?

### 3. DATA & COVERAGE BLIND SPOTS
Beyond the known NULL fields — what critical data is the system structurally unable to capture? What market-moving information arrives between weekly scoring runs? How do the data source limitations (free-tier CoinGecko, no on-chain data beyond BTC) create systematic bias?

### 4. PORTFOLIO CONSTRUCTION RISKS
Where will the sizing rules, tier system, and structural filters lead to poor allocation? Consider concentration risk, timing of entries/exits, the 3-sector cap, and interaction effects between regime and sector scores.

### 5. UNIVERSE SELECTION BIAS
Is the tracked universe likely to cause the operator to miss better opportunities or hold losers too long? How does the fixed universe interact with the scoring system?

### 6. TOP 5 SCENARIOS THAT LOSE MONEY
Describe five concrete, realistic market scenarios where this system's output would lead the operator to make a bad investment decision. For each: what happens in the market, what the system says, what the operator does, and why it loses money.

---

Be direct, specific, and adversarial. The operator wants to know where they'll get hurt, not where the system works fine. British English. No hedging. No filler. Max 2000 words.
