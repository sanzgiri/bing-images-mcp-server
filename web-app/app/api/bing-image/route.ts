import { NextResponse } from 'next/server';
import { getBingImage } from '@/lib/mcp';

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country') ?? 'us';
  const date = searchParams.get('date') ?? undefined;

  const data = await getBingImage(country, date ?? undefined);
  if (!data) {
    return NextResponse.json({ error: 'Failed to fetch image.' }, { status: 502 });
  }

  try {
    return NextResponse.json(JSON.parse(data));
  } catch {
    return NextResponse.json({ error: 'Invalid MCP response.' }, { status: 502 });
  }
}
