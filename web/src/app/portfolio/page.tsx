export const dynamic = 'force-dynamic';

import { getLatestPortfolioActions } from '@/lib/queries';
import { formatPct, actionColor } from '@/lib/format';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { InfoTip } from '@/components/info-tip';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function bucketVariant(bucket: string | null | undefined): 'default' | 'secondary' | 'outline' {
  switch (bucket) {
    case 'core': return 'default';
    case 'active': return 'secondary';
    case 'constrained': return 'outline';
    default: return 'outline';
  }
}

export default async function PortfolioPage() {
  const actions = await getLatestPortfolioActions();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>

      <Card>
        <CardHeader>
          <CardTitle>Holdings &amp; Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length === 0 ? (
            <p className="text-muted-foreground text-sm">No portfolio actions available.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead className="text-right"><InfoTip term="currentPct">Current %</InfoTip></TableHead>
                  <TableHead className="text-right"><InfoTip term="targetPct">Target %</InfoTip></TableHead>
                  <TableHead><InfoTip term="proposedAction">Action</InfoTip></TableHead>
                  <TableHead><InfoTip term="reasonCode">Reason</InfoTip></TableHead>
                  <TableHead><InfoTip term="confidence">Confidence</InfoTip></TableHead>
                  <TableHead><InfoTip term="executionBlocked">Blocked</InfoTip></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {actions.map((row) => (
                  <TableRow key={`${row.date}-${row.symbol}`}>
                    <TableCell className="font-medium">{row.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={bucketVariant(row.currentBucket)}>
                        {row.currentBucket ?? '—'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatPct(row.currentPct)}</TableCell>
                    <TableCell className="text-right">{formatPct(row.targetPct)}</TableCell>
                    <TableCell className={actionColor(row.proposedAction)}>
                      {row.proposedAction ?? '—'}
                    </TableCell>
                    <TableCell>{row.reasonCode ?? '—'}</TableCell>
                    <TableCell>{row.confidence ?? '—'}</TableCell>
                    <TableCell>
                      {row.executionBlocked ? (
                        <Badge variant="destructive">Blocked</Badge>
                      ) : (
                        '—'
                      )}
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
