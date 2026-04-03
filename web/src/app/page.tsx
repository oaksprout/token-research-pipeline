export const dynamic = 'force-dynamic';

import Link from "next/link";
import {
  getLatestMarketData,
  getLatestRegime,
  getLatestSectorScores,
  getLatestPortfolioActions,
} from "@/lib/queries";
import {
  formatUsd,
  formatPct,
  formatScore,
  formatDate,
  regimeBadgeVariant,
  actionColor,
} from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/info-tip";

export default async function DashboardPage() {
  const [market, regime, sectors, actions] = await Promise.all([
    getLatestMarketData(),
    getLatestRegime(),
    getLatestSectorScores(),
    getLatestPortfolioActions(),
  ]);

  const sortedSectors = sectors
    ? [...sectors].sort((a, b) => (b.scoreTotal ?? 0) - (a.scoreTotal ?? 0))
    : [];

  return (
    <div className="space-y-8">
      {/* First-run data quality notice */}
      {market && market.btcSma200 == null && (
        <Card className="border-yellow-800 bg-yellow-950/30">
          <CardContent className="pt-4 text-sm text-yellow-300">
            First-run data: some indicators require historical accumulation.{" "}
            <InfoTip term="firstRunWarning">Learn more</InfoTip>
          </CardContent>
        </Card>
      )}

      {/* Market Header */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Market
        </h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="BTC Price"
            value={market ? formatUsd(market.btcPrice) : "--"}
          />
          <StatCard
            label="ETH Price"
            value={market ? formatUsd(market.ethPrice) : "--"}
          />
          <StatCard
            label="SOL Price"
            value={market ? formatUsd(market.solPrice) : "--"}
          />
          <StatCard
            label="BTC Dominance"
            value={market ? formatPct(market.btcDominance) : "--"}
          />
        </div>
      </section>

      {/* Regime Status */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          <InfoTip term="regime">Regime</InfoTip>
        </h2>
        {regime ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Badge variant={regimeBadgeVariant(regime.label)}>
                  {regime.label}
                </Badge>
                <Badge variant="outline"><InfoTip term="confidence">{regime.confidence ?? "—"}</InfoTip> confidence</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
                <span className="text-3xl font-bold tabular-nums text-zinc-100">
                  <InfoTip term="regimeScore">{formatScore(regime.scoreTotal)}</InfoTip>
                </span>
                <span className="text-sm text-zinc-400">
                  <InfoTip term="sizingImplication">{regime.sizingImplication}</InfoTip>
                </span>
                <span className="ml-auto text-xs text-zinc-600">
                  {formatDate(regime.date)}
                </span>
              </div>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-zinc-500">No regime data available.</p>
        )}
      </section>

      {/* Sector Overview */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Sectors
        </h2>
        {sortedSectors.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sector</TableHead>
                    <TableHead className="text-right"><InfoTip term="sectorScore">Score</InfoTip></TableHead>
                    <TableHead className="text-right">Delta 4w</TableHead>
                    <TableHead><InfoTip term="tierCandidate">Tier</InfoTip></TableHead>
                    <TableHead>Leader</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSectors.map((s) => (
                    <TableRow key={s.sector}>
                      <TableCell>
                        <Link
                          href={`/sectors/${s.sector}`}
                          className="text-zinc-200 underline-offset-4 hover:underline"
                        >
                          {s.sector}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatScore(s.scoreTotal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatScore(s.scoreDelta4w)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {s.tierCandidate}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {s.leaderTokens}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-zinc-500">No sector data available.</p>
        )}
      </section>

      {/* Portfolio Actions */}
      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-zinc-500">
          Portfolio Actions
        </h2>
        {actions && actions.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Bucket</TableHead>
                    <TableHead><InfoTip term="proposedAction">Action</InfoTip></TableHead>
                    <TableHead className="text-right"><InfoTip term="currentPct">Current %</InfoTip></TableHead>
                    <TableHead className="text-right"><InfoTip term="targetPct">Target %</InfoTip></TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Confidence</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {actions.map((a) => (
                    <TableRow
                      key={a.symbol}
                      className={a.executionBlocked ? "opacity-50" : ""}
                    >
                      <TableCell className="font-medium text-zinc-200">
                        {a.symbol}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {a.currentBucket}
                      </TableCell>
                      <TableCell>
                        <span className={actionColor(a.proposedAction)}>
                          {a.proposedAction}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(a.currentPct)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPct(a.targetPct)}
                      </TableCell>
                      <TableCell className="text-xs text-zinc-400">
                        {a.reasonCode}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {a.confidence ?? "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <p className="text-sm text-zinc-500">
            No portfolio actions available.
          </p>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs font-medium text-zinc-500">{label}</p>
        <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-100">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
