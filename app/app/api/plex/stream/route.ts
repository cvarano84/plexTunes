export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const mediaKey = searchParams?.get?.('key') ?? '';
    
    if (!mediaKey) {
      return NextResponse.json({ error: 'Media key required' }, { status: 400 });
    }

    const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Plex not configured' }, { status: 400 });
    }

    const streamUrl = `${config.serverUrl}${mediaKey}?X-Plex-Token=${config.token}`;
    
    // Proxy the stream
    const rangeHeader = req?.headers?.get?.('range') ?? '';
    const headers: Record<string, string> = {
      'X-Plex-Client-Identifier': 'plex-jukebox-app',
      'X-Plex-Product': 'Plex Jukebox',
    };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }

    const plexRes = await fetch(streamUrl, { headers });
    
    const responseHeaders = new Headers();
    const contentType = plexRes?.headers?.get?.('content-type') ?? 'audio/mpeg';
    responseHeaders.set('Content-Type', contentType);
    
    const contentLength = plexRes?.headers?.get?.('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);
    
    const contentRange = plexRes?.headers?.get?.('content-range');
    if (contentRange) responseHeaders.set('Content-Range', contentRange);
    
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Cache-Control', 'no-cache');

    return new NextResponse(plexRes?.body, {
      status: plexRes?.status ?? 200,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('Stream error:', e?.message);
    return NextResponse.json({ error: 'Stream failed' }, { status: 500 });
  }
}
