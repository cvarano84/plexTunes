export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { getActiveAdapter } from '@/lib/media/factory';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const thumb = searchParams?.get?.('thumb') ?? '';
    const width = Number(searchParams?.get?.('w') ?? '600');
    const height = Number(searchParams?.get?.('h') ?? '600');

    if (!thumb) {
      return NextResponse.json({ error: 'Thumb required' }, { status: 400 });
    }

    const ctx = await getActiveAdapter();
    if (!ctx) {
      return NextResponse.json({ error: 'Media server not configured' }, { status: 400 });
    }

    const upstream = await ctx.adapter.fetchImage(thumb, width, height);

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', upstream?.headers?.get?.('content-type') ?? 'image/jpeg');
    responseHeaders.set('Cache-Control', 'public, max-age=86400');

    return new NextResponse(upstream?.body, {
      status: upstream?.status ?? 200,
      headers: responseHeaders,
    });
  } catch (e: any) {
    console.error('Image proxy error:', e?.message);
    return NextResponse.json({ error: 'Image fetch failed' }, { status: 500 });
  }
}
