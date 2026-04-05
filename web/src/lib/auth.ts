import { NextResponse } from 'next/server';

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function checkAuth(request: Request): boolean {
  const header = request.headers.get('authorization');
  if (!header) return false;
  const token = header.replace('Bearer ', '');
  return token === process.env.API_KEY;
}
