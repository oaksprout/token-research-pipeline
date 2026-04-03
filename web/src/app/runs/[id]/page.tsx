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

            const isLlmResponse = t.phase === 'llm' && t.step.startsWith('llm_response');
            const isLlmRequest = t.phase === 'llm' && t.step.startsWith('llm_request');
            const isComputation = t.category === 'computation';
            const isDecision = t.category === 'decision';

            return (
              <Card key={t.id} className="bg-zinc-900 border-zinc-800">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-3 mb-3">
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

                  {/* LLM Request — show model, auth method, prompt preview */}
                  {isLlmRequest && (
                    <div className="space-y-2 text-sm">
                      <div className="flex gap-4">
                        <span className="text-zinc-500">Model:</span>
                        <span className="font-mono text-blue-400">{String(detail.model ?? '—')}</span>
                        <span className="text-zinc-500">Auth:</span>
                        <span className="text-zinc-300">{String(detail.authMethod ?? '—')}</span>
                        <span className="text-zinc-500">Temp:</span>
                        <span className="text-zinc-300">{String(detail.temperature ?? '—')}</span>
                      </div>
                      <div>
                        <div className="text-zinc-500 text-xs mb-1">System Prompt Preview:</div>
                        <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 whitespace-pre-wrap max-h-40 overflow-y-auto">
                          {String(detail.systemPromptPreview ?? '')}
                        </pre>
                      </div>
                      <div className="text-xs text-zinc-500">
                        Context: {String(detail.userContentLength ?? '?')} chars | Prompt: {String(detail.systemPromptLength ?? '?')} chars
                      </div>
                    </div>
                  )}

                  {/* LLM Response — show usage, full response rendered */}
                  {isLlmResponse && (
                    <div className="space-y-3 text-sm">
                      <div className="flex gap-4 text-xs">
                        <span className="text-zinc-500">Model: <span className="text-blue-400 font-mono">{String(detail.model ?? '—')}</span></span>
                        <span className="text-zinc-500">Finish: <span className="text-zinc-300">{String(detail.finishReason ?? '—')}</span></span>
                        {detail.usage != null && typeof detail.usage === 'object' ? (
                          <>
                            <span className="text-zinc-500">Prompt tokens: <span className="text-zinc-300">{String((detail.usage as Record<string, unknown>).prompt_tokens ?? '—')}</span></span>
                            <span className="text-zinc-500">Completion: <span className="text-zinc-300">{String((detail.usage as Record<string, unknown>).completion_tokens ?? '—')}</span></span>
                            <span className="text-zinc-500">Total: <span className="text-zinc-200 font-medium">{String((detail.usage as Record<string, unknown>).total_tokens ?? '—')}</span></span>
                          </>
                        ) : null}
                      </div>
                      {detail.fullSystemPrompt ? (
                        <details className="group">
                          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">System Prompt</summary>
                          <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 mt-1 whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {String(detail.fullSystemPrompt)}
                          </pre>
                        </details>
                      ) : null}
                      {detail.fullUserContent ? (
                        <details className="group">
                          <summary className="text-xs text-zinc-500 cursor-pointer hover:text-zinc-300">User Content (Context Bundle)</summary>
                          <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 mt-1 whitespace-pre-wrap max-h-60 overflow-y-auto">
                            {String(detail.fullUserContent)}
                          </pre>
                        </details>
                      ) : null}
                      <div>
                        <div className="text-xs text-zinc-500 mb-1">LLM Response:</div>
                        <div className="text-sm text-zinc-200 bg-zinc-950 rounded p-3 whitespace-pre-wrap border border-zinc-800 max-h-96 overflow-y-auto">
                          {String(detail.fullResponse ?? detail.responsePreview ?? '—')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Computation — show inputs and output clearly */}
                  {isComputation && !isLlmResponse && (
                    <div className="space-y-2">
                      {detail.input ? (
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Inputs:</div>
                          <pre className="text-xs text-zinc-300 bg-zinc-950 rounded p-2 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {JSON.stringify(detail.input ?? detail.inputs, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                      {detail.output !== undefined ? (
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Output: <span className="text-zinc-200 font-mono">{typeof detail.output === 'number' ? String(detail.output) : ''}</span></div>
                          {typeof detail.output === 'object' ? (
                            <pre className="text-xs text-zinc-300 bg-zinc-950 rounded p-2 whitespace-pre-wrap">
                              {JSON.stringify(detail.output, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      ) : null}
                      {detail.reasoning ? (
                        <div className="text-xs text-yellow-400/80 bg-yellow-950/20 rounded p-2 border border-yellow-900/30">
                          {String(detail.reasoning)}
                        </div>
                      ) : null}
                      {detail.dataCompleteness ? (
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Data Completeness:</div>
                          <pre className="text-xs text-zinc-400 bg-zinc-950 rounded p-2 whitespace-pre-wrap">
                            {JSON.stringify(detail.dataCompleteness, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Decision — show context and recommendation */}
                  {isDecision && (
                    <div className="space-y-2">
                      {detail.context ? (
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Decision Context:</div>
                          <pre className="text-xs text-zinc-300 bg-zinc-950 rounded p-2 whitespace-pre-wrap max-h-48 overflow-y-auto">
                            {JSON.stringify(detail.context, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                      {detail.recommendation ? (
                        <div>
                          <div className="text-xs text-zinc-500 mb-1">Recommendation:</div>
                          <pre className="text-xs text-green-300 bg-zinc-950 rounded p-2 whitespace-pre-wrap">
                            {JSON.stringify(detail.recommendation, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Fallback: raw JSON for other categories */}
                  {!isLlmRequest && !isLlmResponse && !isComputation && !isDecision && (
                    <pre className="text-xs text-zinc-300 bg-zinc-950 rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-96">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
