export const dynamic = 'force-dynamic';

import { getRunById, getRunTraces } from "@/lib/queries";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

function formatTs(ts: Date | null): string {
  if (!ts) return "—";
  return ts.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "medium" });
}

function categoryColor(cat: string): string {
  switch (cat) {
    case "api_call": return "text-blue-400";
    case "computation": return "text-green-400";
    case "decision": return "text-yellow-400";
    case "upsert": return "text-zinc-400";
    case "error": return "text-red-400";
    default: return "text-zinc-500";
  }
}

function categoryBadgeVariant(cat: string): "default" | "secondary" | "destructive" | "outline" {
  switch (cat) {
    case "api_call": return "default";
    case "computation": return "secondary";
    case "decision": return "outline";
    case "error": return "destructive";
    default: return "outline";
  }
}

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run, traces] = await Promise.all([getRunById(id), getRunTraces(id)]);

  if (!run) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Run not found</h1>
        <Link href="/runs" className="text-blue-400 hover:underline">Back to runs</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/runs" className="text-zinc-400 hover:text-zinc-200">&larr; Runs</Link>
        <h1 className="text-2xl font-bold">{run.script}</h1>
        <Badge variant={run.status === "success" ? "default" : "destructive"}>
          {run.status}
        </Badge>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-lg">Run Info</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-zinc-500">Started</div>
            <div>{formatTs(run.startedAt)}</div>
          </div>
          <div>
            <div className="text-zinc-500">Finished</div>
            <div>{formatTs(run.finishedAt)}</div>
          </div>
          <div>
            <div className="text-zinc-500">Duration</div>
            <div>
              {run.startedAt && run.finishedAt
                ? `${((run.finishedAt.getTime() - run.startedAt.getTime()) / 1000).toFixed(1)}s`
                : "—"}
            </div>
          </div>
          <div>
            <div className="text-zinc-500">Trace entries</div>
            <div>{traces.length}</div>
          </div>
        </CardContent>
      </Card>

      {run.errors && (
        <Card className="bg-red-950/30 border-red-900">
          <CardHeader>
            <CardTitle className="text-lg text-red-400">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-red-300 whitespace-pre-wrap">{run.errors}</pre>
          </CardContent>
        </Card>
      )}

      <h2 className="text-xl font-bold">Execution Trace</h2>

      {traces.length === 0 ? (
        <p className="text-zinc-500">No trace entries for this run. Tracing may not have been enabled.</p>
      ) : (
        <div className="space-y-3">
          {traces.map((t) => {
            let detail: Record<string, unknown> = {};
            try { detail = JSON.parse(t.detail); } catch { /* ignore */ }

            return (
              <Card key={t.id} className="bg-zinc-900 border-zinc-800">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge variant={categoryBadgeVariant(t.category)}>
                      {t.category}
                    </Badge>
                    <span className="font-mono text-sm font-medium">
                      {t.phase}/{t.step}
                    </span>
                    {t.durationMs != null && (
                      <span className="text-xs text-zinc-500">{t.durationMs}ms</span>
                    )}
                  </div>
                  <pre className="text-xs text-zinc-300 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-96">
                    {JSON.stringify(detail, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
