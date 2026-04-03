export function formatPct(value: number | null | undefined): string {
  if (value == null) return '—';
  return (value * 100).toFixed(1) + '%';
}

export function formatScore(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toFixed(0);
}

export function formatUsd(value: number | null | undefined): string {
  if (value == null) return '—';
  if (Math.abs(value) >= 1_000_000_000_000) return '$' + (value / 1_000_000_000_000).toFixed(2) + 'T';
  if (Math.abs(value) >= 1_000_000_000) return '$' + (value / 1_000_000_000).toFixed(2) + 'B';
  if (Math.abs(value) >= 1_000_000) return '$' + (value / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(value) >= 1_000) return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + value.toFixed(2);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function regimeLabelColor(label: string | null | undefined): string {
  switch (label) {
    case 'improving': return 'text-green-400';
    case 'stabilising': return 'text-yellow-400';
    case 'deteriorating': return 'text-red-400';
    default: return 'text-zinc-400';
  }
}

export function regimeBadgeVariant(label: string | null | undefined): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (label) {
    case 'improving': return 'default';
    case 'stabilising': return 'secondary';
    case 'deteriorating': return 'destructive';
    default: return 'outline';
  }
}

export function actionColor(action: string | null | undefined): string {
  switch (action) {
    case 'add': return 'text-green-400';
    case 'trim': return 'text-yellow-400';
    case 'exit': return 'text-red-400';
    case 'hold': return 'text-zinc-400';
    default: return 'text-zinc-500';
  }
}
