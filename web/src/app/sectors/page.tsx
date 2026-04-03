export const dynamic = 'force-dynamic';

import Link from "next/link";
import {
  getLatestSectorScores,
  getLatestTierRecommendations,
  getLatestTokenScores,
} from "@/lib/queries";
import { formatScore } from "@/lib/format";
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

export default async function SectorsPage() {
  const [sectors, tiers, tokens] = await Promise.all([
    getLatestSectorScores(),
    getLatestTierRecommendations(),
    getLatestTokenScores(),
  ]);

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-semibold">Sectors</h1>

      {/* Sector Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sector Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">Dev</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Funding</TableHead>
                <TableHead className="text-right">Narrative</TableHead>
                <TableHead className="text-right">RS</TableHead>
                <TableHead>Filter</TableHead>
                <TableHead>Validation</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Leader</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectors.map((s) => (
                <TableRow key={s.sector}>
                  <TableCell>
                    <Link
                      href={`/sectors/${s.sector}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {s.sector}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(s.scoreTotal)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(s.subDev)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(s.subUsage)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(s.subFunding)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(s.subNarrative)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatScore(s.subRs)}
                  </TableCell>
                  <TableCell>{s.structuralFilter ?? "---"}</TableCell>
                  <TableCell>{s.validation ?? "---"}</TableCell>
                  <TableCell>{s.tierCandidate ?? "---"}</TableCell>
                  <TableCell>{s.leaderTokens ?? "---"}</TableCell>
                </TableRow>
              ))}
              {sectors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground">
                    No sector data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Tier Recommendations Table */}
      <Card>
        <CardHeader>
          <CardTitle>Tier Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sector</TableHead>
                <TableHead>Prior</TableHead>
                <TableHead>Proposed</TableHead>
                <TableHead>Changed</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Leader</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((t) => (
                <TableRow key={t.sector}>
                  <TableCell className="font-medium">{t.sector}</TableCell>
                  <TableCell>{t.priorTier ?? "---"}</TableCell>
                  <TableCell>{t.proposedTier ?? "---"}</TableCell>
                  <TableCell>
                    <Badge variant={t.tierChanged ? "destructive" : "secondary"}>
                      {t.tierChanged ? "yes" : "no"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {t.changeReason ?? "---"}
                  </TableCell>
                  <TableCell>{t.leaderToken ?? "---"}</TableCell>
                  <TableCell>{t.leaderStatus ?? "---"}</TableCell>
                </TableRow>
              ))}
              {tiers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No tier recommendations available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Token Scores Table */}
      <Card>
        <CardHeader>
          <CardTitle>Token Scores</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Sector</TableHead>
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
                  <TableCell>{t.sector ?? "---"}</TableCell>
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
                    <Badge variant={t.candidateStatus === "selected" ? "default" : "outline"}>
                      {t.candidateStatus ?? "---"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {tokens.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No token data available.
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
