export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { trackId } = await req.json();
    if (!trackId) {
      return NextResponse.json({ error: 'trackId required' }, { status: 400 });
    }
    const track = await prisma.cachedTrack.findUnique({ where: { id: trackId }, select: { hearted: true } });
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    const updated = await prisma.cachedTrack.update({
      where: { id: trackId },
      data: { hearted: !track.hearted },
    });
    return NextResponse.json({ hearted: updated.hearted });
  } catch (e: any) {
    console.error('Heart toggle error:', e?.message);
    return NextResponse.json({ error: 'Failed to toggle heart' }, { status: 500 });
  }
}

// Bulk fetch heart status for multiple track IDs
export async function PUT(req: NextRequest) {
  try {
    const { trackIds } = await req.json();
    if (!Array.isArray(trackIds)) {
      return NextResponse.json({ error: 'trackIds array required' }, { status: 400 });
    }
    const tracks = await prisma.cachedTrack.findMany({
      where: { id: { in: trackIds }, hearted: true },
      select: { id: true },
    });
    const heartedIds = new Set(tracks.map(t => t.id));
    return NextResponse.json({ heartedIds: [...heartedIds] });
  } catch (e: any) {
    console.error('Heart bulk fetch error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch hearts' }, { status: 500 });
  }
}
