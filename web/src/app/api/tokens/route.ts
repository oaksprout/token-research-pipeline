import { NextResponse } from 'next/server';
import { checkAuth, unauthorized } from '@/lib/auth';
import { getLatestTokenScores } from '@/lib/queries';

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  const sector = new URL(request.url).searchParams.get('sector') ?? undefined;
  const tokens = await getLatestTokenScores(sector);

  return NextResponse.json({ tokens });
}
