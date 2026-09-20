import { NextRequest, NextResponse } from 'next/server';

export default function authorizeCron(req: NextRequest) {
  const cronKey = process.env.CRON_SECRET || process.env.CRON_AUTH_KEY;
  if (!cronKey || req.headers.get('authorization') !== `Bearer ${cronKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
