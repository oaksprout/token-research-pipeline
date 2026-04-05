import { NextResponse } from 'next/server';
import { checkAuth, unauthorized } from '@/lib/auth';
import { getLatestPortfolioActions } from '@/lib/queries';

export async function GET(request: Request) {
  if (!checkAuth(request)) return unauthorized();

  const actions = await getLatestPortfolioActions();

  return NextResponse.json({ actions });
}
