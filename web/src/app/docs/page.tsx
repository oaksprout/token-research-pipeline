import { glossary } from "@/lib/glossary";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "Documentation | Token Research Pipeline",
  description: "How the Token Research Pipeline works.",
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function SectionHeading({
  id,
  number,
  title,
}: {
  id: string;
  number: string;
  title: string;
}) {
  return (
    <h2 id={id} className="flex items-baseline gap-3 text-lg font-semibold text-zinc-100">
      <span className="font-mono text-xs text-zinc-500">{number}</span>
      {title}
    </h2>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-zinc-500 ${className ?? ""}`}>
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`px-3 py-2 text-sm text-zinc-300 ${className ?? ""}`}>
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function DocsPage() {
  return (
    <div className="space-y-10">
      {/* ── Header ────────────────────────────────────────────────── */}
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Documentation
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          How the Token Research Pipeline works.
        </p>
      </header>

      {/* ── 1. Pipeline Overview ──────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="pipeline" number="01" title="Pipeline Overview" />
        <Card>
          <CardContent className="pt-4">
            <p className="mb-3 text-sm text-zinc-400">
              Data flows through two scheduled jobs, with an optional LLM
              interpretation layer at the end.
            </p>
            <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-4 font-mono text-xs leading-relaxed text-zinc-300 ring-1 ring-zinc-800">
{`Daily Ingest (7 AM)
  ├─ Market data    (prices, dominance, funding, OI)
  ├─ Sector metrics (TVL, fees, dev commits)
  └─ Wallet positions (Zerion)

Weekly Scoring (Sundays 8 AM)
  ├─ 1. Regime scoring
  ├─ 2. Sector scoring
  ├─ 3. Token scoring
  ├─ 4. Tier rules & recommendations
  ├─ 5. Portfolio actions
  └─ 6. Report generation

Optional: LLM Review
  └─ GPT-4o interprets the structured output
     (regime review, sector review, portfolio briefing)`}
            </pre>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 2. Regime Scoring ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="regime" number="02" title="Regime Scoring" />
        <Card>
          <CardHeader>
            <CardTitle>Five sub-scores, each -20 to +20. Total: -100 to +100.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <Th>Sub-score</Th>
                    <Th>Measures</Th>
                    <Th>Data sources</Th>
                    <Th>Range</Th>
                    <Th>Key thresholds</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  <tr>
                    <Td className="font-medium text-zinc-200">Market Structure</Td>
                    <Td>{glossary.marketStructure.short}</Td>
                    <Td className="text-zinc-400">CoinGecko (BTC price, 52w high/low)</Td>
                    <Td className="font-mono text-xs">-20 to +20</Td>
                    <Td className="text-xs text-zinc-400">Above 200d SMA = +6; rising weekly lows = +7; near 52w low = -7</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Leverage Stress</Td>
                    <Td>{glossary.leverageStress.short}</Td>
                    <Td className="text-zinc-400">Binance (funding, OI)</Td>
                    <Td className="font-mono text-xs">-20 to +20</Td>
                    <Td className="text-xs text-zinc-400">Negative funding = +8 (bears crowded); high positive = -8 (excess leverage)</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Flow Support</Td>
                    <Td>{glossary.flowSupport.short}</Td>
                    <Td className="text-zinc-400">Manual ETF, DefiLlama (stablecoins)</Td>
                    <Td className="font-mono text-xs">-20 to +20</Td>
                    <Td className="text-xs text-zinc-400">ETF inflows = +6; stablecoin growth = +5; acceleration = +3</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">On-chain Stress</Td>
                    <Td>{glossary.onchainStress.short}</Td>
                    <Td className="text-zinc-400">CoinGecko (BTC ATH, RSI derived)</Td>
                    <Td className="font-mono text-xs">-20 to +20</Td>
                    <Td className="text-xs text-zinc-400">Deep drawdown {"<"}0.3x ATH = +12 (near bottom); {">"}0.8x ATH = -8</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Alt Strength</Td>
                    <Td>{glossary.altStrength.short}</Td>
                    <Td className="text-zinc-400">CoinGecko (ETH/BTC, SOL/BTC)</Td>
                    <Td className="font-mono text-xs">-20 to +20</Td>
                    <Td className="text-xs text-zinc-400">Ratio above 20d SMA = +5 each; rising 3 weeks = +5 each</Td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-3">
              <h4 className="text-sm font-medium text-zinc-200">Labels</h4>
              <div className="flex flex-wrap gap-2">
                <Badge variant="destructive">Deteriorating: score &le; -20</Badge>
                <Badge variant="outline">Stabilising: -19 to +19</Badge>
                <Badge variant="default">Improving: score &ge; +20</Badge>
              </div>

              <h4 className="mt-4 text-sm font-medium text-zinc-200">Confidence</h4>
              <ul className="list-inside list-disc space-y-1 text-sm text-zinc-400">
                <li><span className="text-zinc-200">High</span> &mdash; |score| &ge; 40</li>
                <li><span className="text-zinc-200">Medium</span> &mdash; |score| &ge; 20</li>
                <li><span className="text-zinc-200">Low</span> &mdash; |score| &lt; 20</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 3. Sector Scoring ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="sectors" number="03" title="Sector Scoring" />
        <Card>
          <CardHeader>
            <CardTitle>Five sub-scores, each 0-20. Total: 0-100.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <Th>Sub-score</Th>
                    <Th>Measures</Th>
                    <Th>Range</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  <tr>
                    <Td className="font-medium text-zinc-200">Dev Activity</Td>
                    <Td>{glossary.subDev.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Usage / TVL</Td>
                    <Td>{glossary.subUsage.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Funding</Td>
                    <Td>{glossary.subFunding.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Narrative</Td>
                    <Td>{glossary.subNarrative.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Relative Strength</Td>
                    <Td>{glossary.subRs.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <h4 className="text-sm font-medium text-zinc-200">Structural Filter Gate</h4>
                <p className="mt-1 text-xs text-zinc-500">All three must pass or the tier is capped at Observe.</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
                  <li><span className="text-zinc-200">Novel capability</span> &mdash; does the sector offer something genuinely new?</li>
                  <li><span className="text-zinc-200">Capital pathway</span> &mdash; clear token value accrual mechanism?</li>
                  <li><span className="text-zinc-200">Distribution vector</span> &mdash; organic growth channel?</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-200">Validation Gate</h4>
                <p className="mt-1 text-xs text-zinc-500">Checked when score &ge; 60. Failure caps the tier at Ready.</p>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
                  <li><span className="text-zinc-200">Retention</span> &mdash; TVL growing</li>
                  <li><span className="text-zinc-200">Unit economics</span> &mdash; fee revenue {">"} 0</li>
                  <li><span className="text-zinc-200">Composability</span> &mdash; measurable TVL exists</li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-200">Tier Thresholds</h4>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Badge variant="outline">&lt; 40: Observe</Badge>
                  <Badge variant="outline">&lt; 60: Ready</Badge>
                  <Badge variant="default">&ge; 60 + validation: Pilot</Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 4. Token Scoring ──────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="tokens" number="04" title="Token Scoring" />
        <Card>
          <CardHeader>
            <CardTitle>Five sub-scores, each 0-20. Total: 0-100.</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <Th>Sub-score</Th>
                    <Th>Measures</Th>
                    <Th>Range</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  <tr>
                    <Td className="font-medium text-zinc-200">Liquidity</Td>
                    <Td>{glossary.subLiquidity.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Relative Strength</Td>
                    <Td>{glossary.tokenSubRs.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Price Structure</Td>
                    <Td>{glossary.subStructure.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Volume Trend</Td>
                    <Td>{glossary.subVolume.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Valuation</Td>
                    <Td>{glossary.subValuation.short}</Td>
                    <Td className="font-mono text-xs">0-20</Td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-zinc-200">Status Thresholds</h4>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="outline">&lt; 30: Observe</Badge>
                <Badge variant="outline">&lt; 50: Ready</Badge>
                <Badge variant="secondary">&lt; 70: Pilot</Badge>
                <Badge variant="default">&ge; 70: Scale</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 5. Decision Rules ─────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="decisions" number="05" title="Decision Rules" />
        <Card>
          <CardHeader>
            <CardTitle>Tier Transitions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-zinc-950 p-4 ring-1 ring-zinc-800">
                <h4 className="text-sm font-medium text-emerald-400">Observe &rarr; Ready</h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
                  <li>Score &ge; 40</li>
                  <li>Rising for 2+ consecutive weeks</li>
                  <li>Structural filter passes</li>
                </ul>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4 ring-1 ring-zinc-800">
                <h4 className="text-sm font-medium text-emerald-400">Ready &rarr; Pilot</h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
                  <li>Score &ge; 60</li>
                  <li>Score stable or rising</li>
                  <li>Validation gate passes</li>
                  <li>Minimum 2 weeks at Ready</li>
                </ul>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4 ring-1 ring-zinc-800">
                <h4 className="text-sm font-medium text-emerald-400">Pilot &rarr; Scale</h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
                  <li>Regime not deteriorating</li>
                  <li>Leader token score &ge; 70</li>
                </ul>
              </div>

              <div className="rounded-lg bg-zinc-950 p-4 ring-1 ring-zinc-800">
                <h4 className="text-sm font-medium text-red-400">Down-tier</h4>
                <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-zinc-400">
                  <li>Declining for 3+ consecutive weeks</li>
                  <li>Leader token lost (no longer rank 1 or score dropped)</li>
                  <li>Structural filter or validation gate failure</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 6. Portfolio Actions ───────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="portfolio" number="06" title="Portfolio Actions" />
        <Card>
          <CardHeader>
            <CardTitle>Three bucket types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-zinc-200">Core</h4>
                <p className="mt-1 text-sm text-zinc-400">
                  Responds only to regime signals. Add if regime is improving,
                  hold otherwise. These are long-term conviction positions
                  (e.g. BTC, ETH).
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-200">Active</h4>
                <p className="mt-1 text-sm text-zinc-400">
                  Uses ordered rule evaluation: thesis invalidated &rarr; exit;
                  thesis weakening &rarr; trim; overweight &rarr; trim; below
                  target &rarr; add; underperforming &rarr; trim. Rules are
                  evaluated in priority order; the first match fires.
                </p>
              </div>

              <div>
                <h4 className="text-sm font-medium text-zinc-200">Constrained</h4>
                <p className="mt-1 text-sm text-zinc-400">
                  Generates no actions. These are positions where trading is
                  restricted (e.g. locked tokens, co-founder allocations). They
                  appear in reports for awareness only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 7. Data Sources ───────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="sources" number="07" title="Data Sources" />
        <Card>
          <CardContent className="pt-4">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <Th>Source</Th>
                    <Th>Data</Th>
                    <Th>Frequency</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  <tr>
                    <Td className="font-medium text-zinc-200">CoinGecko</Td>
                    <Td>Prices, volumes, market caps, BTC dominance, 52w high/low</Td>
                    <Td className="text-zinc-400">Daily</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Binance</Td>
                    <Td>Funding rates, open interest</Td>
                    <Td className="text-zinc-400">Daily</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">DefiLlama</Td>
                    <Td>Stablecoin market cap, sector TVL, protocol fees</Td>
                    <Td className="text-zinc-400">Daily</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">Zerion</Td>
                    <Td>Wallet positions across tracked addresses</Td>
                    <Td className="text-zinc-400">Daily</Td>
                  </tr>
                  <tr>
                    <Td className="font-medium text-zinc-200">GitHub</Td>
                    <Td>Developer commit counts per tracked repository</Td>
                    <Td className="text-zinc-400">Daily</Td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 8. Data Quality / Known Limitations ───────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="limitations" number="08" title="Data Quality / Known Limitations" />
        <Card>
          <CardContent className="pt-4">
            <ul className="space-y-3 text-sm text-zinc-400">
              <li className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <div>
                  <span className="font-medium text-zinc-200">First-run degradation</span>
                  <p className="mt-0.5">
                    SMAs need 20-200 days, RSI needs 15 days, stablecoin 7d
                    change needs a week, score deltas need 4 weeks. On the first
                    run, many indicators are null and scores are partially
                    informed.
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <div>
                  <span className="font-medium text-zinc-200">No automated ETF flow data</span>
                  <p className="mt-0.5">
                    ETF net flows must be manually entered or fetched from
                    SoSoValue. When missing, the flow support sub-score loses
                    its ETF component (&plusmn;6 points unavailable).
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <div>
                  <span className="font-medium text-zinc-200">No exchange netflow data</span>
                  <p className="mt-0.5">
                    Exchange inflow/outflow tracking is not yet implemented.
                    The flow support sub-score operates without this signal.
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <div>
                  <span className="font-medium text-zinc-200">Funding data defaults to neutral</span>
                  <p className="mt-0.5">
                    If Binance funding rate data is unavailable, the leverage
                    stress sub-score treats funding as neutral (0 contribution).
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <div>
                  <span className="font-medium text-zinc-200">Dev commit repos mostly unconfigured</span>
                  <p className="mt-0.5">
                    Most sectors have no GitHub repositories configured. The dev
                    activity sub-score defaults to 10 (neutral) when no data is
                    available.
                  </p>
                </div>
              </li>
              <li className="flex gap-2">
                <span className="mt-0.5 text-amber-500">&#9679;</span>
                <div>
                  <span className="font-medium text-zinc-200">Validation proxies are coarse</span>
                  <p className="mt-0.5">
                    The validation gate uses TVL and fees as proxies for
                    retention and unit economics. These are not true retention
                    metrics and may misrepresent sector health.
                  </p>
                </div>
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* ── 9. Glossary ───────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeading id="glossary" number="09" title="Glossary" />
        <Card>
          <CardContent className="pt-4">
            <dl>
              {Object.entries(glossary).map(([key, { short, long: longDesc }]) => (
                <div key={key}>
                  <dt className="font-mono text-sm text-zinc-200">{key}</dt>
                  <dd className="text-zinc-400 text-sm mb-1">{short}</dd>
                  <dd className="text-zinc-500 text-xs mb-4">{longDesc}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
