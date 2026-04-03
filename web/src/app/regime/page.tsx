export const dynamic = 'force-dynamic';

import { getLatestRegime } from "@/lib/queries";
import { formatScore, formatDate, regimeBadgeVariant } from "@/lib/format";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InfoTip } from "@/components/info-tip";

const SUB_SCORES = [
  { key: "subStructure", label: "Market Structure", term: "marketStructure" },
  { key: "subLeverage", label: "Leverage Stress", term: "leverageStress" },
  { key: "subFlows", label: "Flow Support", term: "flowSupport" },
  { key: "subOnchain", label: "On-Chain Stress", term: "onchainStress" },
  { key: "subAltStrength", label: "Alt Relative Strength", term: "altStrength" },
] as const;

function ScoreBar({ value }: { value: number | null | undefined }) {
  const v = value ?? 0;
  const pct = Math.abs(v) / 20 * 50; // 50% = full side
  const isNeg = v < 0;

  return (
    <div className="relative h-4 w-full rounded bg-zinc-800">
      {/* center line */}
      <div className="absolute left-1/2 top-0 h-full w-px bg-zinc-600" />
      {/* bar */}
      <div
        className={`absolute top-0 h-full rounded ${isNeg ? "bg-red-500" : "bg-green-500"}`}
        style={{
          left: isNeg ? `${50 - pct}%` : "50%",
          width: `${pct}%`,
        }}
      />
    </div>
  );
}

export default async function RegimePage() {
  const regime = await getLatestRegime();

  if (!regime) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-semibold">Regime</h1>
        <p className="text-muted-foreground">No regime data available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page title */}
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Regime</h1>
        <Badge variant="outline">{formatDate(regime.date)}</Badge>
      </div>

      {/* Status card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Badge variant={regimeBadgeVariant(regime.label)}>
              <InfoTip term="regime">{regime.label ?? "unknown"}</InfoTip>
            </Badge>
            <span className="text-xl tabular-nums">
              <InfoTip term="regimeScore">{formatScore(regime.scoreTotal)}</InfoTip>
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Sizing</span>
              <p className="font-medium"><InfoTip term="sizingImplication">{regime.sizingImplication ?? "---"}</InfoTip></p>
            </div>
            <div>
              <span className="text-muted-foreground">Confidence</span>
              <p className="font-medium"><InfoTip term="confidence">{regime.confidence ?? "---"}</InfoTip></p>
            </div>
            <div>
              <span className="text-muted-foreground"><InfoTip term="etfDataAvailable">ETF Data</InfoTip></span>
              <p className="font-medium">
                {regime.etfDataAvailable ? "Yes" : "No"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sub-scores */}
      <Card>
        <CardHeader>
          <CardTitle>Sub-Scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {SUB_SCORES.map(({ key, label, term }) => {
            const val = regime[key];
            return (
              <div key={key} className="grid grid-cols-[160px_1fr_48px] items-center gap-3">
                <span className="text-sm text-muted-foreground"><InfoTip term={term}>{label}</InfoTip></span>
                <ScoreBar value={val} />
                <span className="text-right text-sm tabular-nums font-medium">
                  {formatScore(val)}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
