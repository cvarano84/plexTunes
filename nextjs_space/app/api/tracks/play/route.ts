export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Record a play for a track
export async function POST(req: NextRequest) {
  try {
    const body = await req?.json?.().catch(() => ({}));
    const trackId = body?.trackId;

    if (!trackId) {
      return NextResponse.json({ error: 'trackId required' }, { status: 400 });
    }

    const track = await prisma.cachedTrack.update({
      where: { id: trackId },
      data: {
        playCount: { increment: 1 },
        lastPlayedAt: new Date(),
      },
    });

    return NextResponse.json({ playCount: track.playCount });
  } catch (e: any) {
    // Track might not exist (stale queue), ignore gracefully
    console.error('Play count error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
