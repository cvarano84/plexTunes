export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getActiveAdapter } from '@/lib/media/factory';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const mediaKey = searchParams?.get?.('key') ?? '';
    if (!mediaKey) {
      return NextResponse.json({ error: 'Media key required' }, { status: 400 });
    }

    const ctx = await getActiveAdapter();
    if (!ctx) {
      return NextResponse.json({ error: 'Media server not configured' }, { status: 400 });
    }

    const rangeHeader = req?.headers?.get?.('range') ?? null;
    const upstream = await ctx.adapter.fetchStream(mediaKey, rangeHeader);

    const responseHeaders = new Headers();
    const contentType = upstream?.headers?.get?.('content-type') ?? 'audio/mpeg';
    responseHeaders.set('Content-Type', contentType);

    const contentLength = upstream?.headers?.get?.('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    const contentRange = upstream?.headers?.get?.('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);

    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'no-cache');

    return new NextResponse(upstream?.body, {
      status: upstream?.status ?? 200,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('Stream error:', e?.message);
    return NextResponse.json({ error: 'Stream failed' }, { status: 500 });
  }
}
