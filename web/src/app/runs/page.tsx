export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getRecentRuns } from '@/lib/queries';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatDuration(start: Date | null, end: Date | null): string {
  if (!start || !end) return '—';
  const ms = end.getTime() - start.getTime();
  if (ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}m ${seconds}s`;
}

function formatTimestamp(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function truncate(text: string | null, maxLen: number): string {
  if (!text) return '—';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '...';
}

export default async function RunsPage() {
  const runs = await getRecentRuns(50);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Pipeline Runs</h1>

      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-muted-foreground text-sm">No runs recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Script</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Finished</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      <Link href={`/runs/${run.id}`} className="text-blue-400 hover:underline">
                        {run.script}
                      </Link>
                    </TableCell>
                    <TableCell>{formatTimestamp(run.startedAt)}</TableCell>
                    <TableCell>{formatTimestamp(run.finishedAt)}</TableCell>
                    <TableCell>{formatDuration(run.startedAt, run.finishedAt)}</TableCell>
                    <TableCell>
                      {run.status === 'success' ? (
                        <Badge variant="default">success</Badge>
                      ) : run.status === 'failed' ? (
                        <Badge variant="destructive">failed</Badge>
                      ) : (
                        <Badge variant="secondary">{run.status ?? '—'}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <span className="text-muted-foreground text-xs">
                        {truncate(run.errors, 100)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
