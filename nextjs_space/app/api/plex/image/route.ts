export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const thumb = searchParams?.get?.('thumb') ?? '';
    const width = searchParams?.get?.('w') ?? '600';
    const height = searchParams?.get?.('h') ?? '600';
    
    if (!thumb) {
      return NextResponse.json({ error: 'Thumb required' }, { status: 400 });
    }

    const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Plex not configured' }, { status: 400 });
    }

    const imageUrl = `${config.serverUrl}/photo/:/transcode?width=${width}&height=${height}&minSize=1&upscale=1&url=${encodeURIComponent(thumb)}&X-Plex-Token=${config.token}`;
    
    const plexRes = await fetch(imageUrl);
    
    const responseHeaders = new Headers();
    const contentType = plexRes?.headers?.get?.('content-type') ?? 'image/jpeg';
    responseHeaders.set('Content-Type', contentType);
    responseHeaders.set('Cache-Control', 'public, max-age=86400');

    return new NextResponse(plexRes?.body, {
      status: plexRes?.status ?? 200,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('Image proxy error:', e?.message);
    return NextResponse.json({ error: 'Image fetch failed' }, { status: 500 });
  }
}
