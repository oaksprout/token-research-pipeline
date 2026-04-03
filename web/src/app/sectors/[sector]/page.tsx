export const dynamic = 'force-dynamic';

import { getSectorDetail } from "@/lib/queries";
import { formatScore, formatPct, formatUsd } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

export default async function SectorDetailPage({
  params,
}: {
  params: Promise<{ sector: string }>;
}) {
  const { sector } = await params;
  const data = await getSectorDetail(sector);

  if (!data) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-semibold">{sector}</h1>
        <p className="text-muted-foreground">
          No data available for this sector.
        </p>
      </div>
    );
  }

  const { metrics, scores, tier, tokens } = data;

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">{sector}</h1>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Score Card */}
        <Card>
          <CardHeader>
            <CardTitle>Score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores ? (
              <>
                <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Score</span>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatScore(scores.scoreTotal)}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Tier Candidate</span>
                    <p className="font-medium">{scores.tierCandidate ?? "---"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Structural Filter</span>
                    <p className="font-medium">
                      {scores.structuralFilter ?? "---"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Validation</span>
                    <p className="font-medium">{scores.validation ?? "---"}</p>
                  </div>
                </div>
                <div className="space-y-1 pt-2 text-sm">
                  <p className="text-muted-foreground">Sub-Scores</p>
                  <div className="grid grid-cols-5 gap-2 text-center">
                    {(
                      [
                        ["Dev", scores.subDev],
                        ["Usage", scores.subUsage],
                        ["Funding", scores.subFunding],
                        ["Narrative", scores.subNarrative],
                        ["RS", scores.subRs],
                      ] as const
                    ).map(([label, val]) => (
                      <div key={label} className="rounded bg-zinc-800 px-2 py-1">
                        <p className="text-xs text-muted-foreground">{label}</p>
                        <p className="font-medium tabular-nums">
                          {formatScore(val)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">No score data.</p>
            )}
          </CardContent>
        </Card>

        {/* Metrics Card */}
        <Card>
          <CardHeader>
            <CardTitle>Metrics</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics ? (
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Basket Return 7d</span>
                  <p className="font-medium tabular-nums">
                    {formatPct(metrics.basketReturn7d)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Basket Return 30d</span>
                  <p className="font-medium tabular-nums">
                    {formatPct(metrics.basketReturn30d)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">RS vs BTC 30d</span>
                  <p className="font-medium tabular-nums">
                    {formatPct(metrics.rsVsBtc30d)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">RS vs ETH 30d</span>
                  <p className="font-medium tabular-nums">
                    {formatPct(metrics.rsVsEth30d)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">TVL</span>
                  <p className="font-medium tabular-nums">
                    {formatUsd(metrics.tvlTotal)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">TVL Change 30d</span>
                  <p className="font-medium tabular-nums">
                    {formatPct(metrics.tvlChange30d)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Fee Revenue 30d</span>
                  <p className="font-medium tabular-nums">
                    {formatUsd(metrics.feeRevenue30d)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Dev Commits</span>
                  <p className="font-medium tabular-nums">
                    {metrics.devCommitsProxy != null
                      ? metrics.devCommitsProxy.toFixed(0)
                      : "---"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">No metrics data.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tier Info */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Recommendation</CardTitle>
        </CardHeader>
        <CardContent>
          {tier ? (
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
              <div>
                <span className="text-muted-foreground">Prior Tier</span>
                <p className="font-medium">{tier.priorTier ?? "---"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Proposed Tier</span>
                <p className="font-medium">{tier.proposedTier ?? "---"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Changed</span>
                <p>
                  <Badge variant={tier.tierChanged ? "destructive" : "secondary"}>
                    {tier.tierChanged ? "yes" : "no"}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Leader Token</span>
                <p className="font-medium">{tier.leaderToken ?? "---"}</p>
              </div>
              <div className="col-span-2 sm:col-span-4">
                <span className="text-muted-foreground">Reason</span>
                <p className="font-medium">{tier.changeReason ?? "---"}</p>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground">No tier data.</p>
          )}
        </CardContent>
      </Card>

      {/* Token Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Rank</TableHead>
                <TableHead className="text-right">Liquidity</TableHead>
                <TableHead className="text-right">RS</TableHead>
                <TableHead className="text-right">Structure</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Valuation</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.symbol}>
                  <TableCell className="font-medium">{t.symbol}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(t.scoreTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {t.rankInSector ?? "---"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(t.subLiquidity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(t.subRs)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(t.subStructure)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(t.subVolume)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(t.subValuation)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.candidateStatus === "selected" ? "default" : "outline"
                      }
                    >
                      {t.candidateStatus ?? "---"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {tokens.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center text-muted-foreground"
                  >
                    No tokens for this sector.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
