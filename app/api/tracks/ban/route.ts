export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST - toggle ban for a single track
export async function POST(req: NextRequest) {
  try {
    const { trackId } = await req.json();
    if (!trackId) {
      return NextResponse.json({ error: 'trackId required' }, { status: 400 });
    }
    const track = await prisma.cachedTrack.findUnique({ where: { id: trackId }, select: { banned: true } });
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    const updated = await prisma.cachedTrack.update({
      where: { id: trackId },
      data: { banned: !track.banned },
    });
    return NextResponse.json({ banned: updated.banned });
  } catch (e: any) {
    console.error('Ban toggle error:', e?.message);
    return NextResponse.json({ error: 'Failed to toggle ban' }, { status: 500 });
  }
}

// PUT - bulk fetch ban status for multiple track IDs
export async function PUT(req: NextRequest) {
  try {
    const { trackIds } = await req.json();
    if (!Array.isArray(trackIds)) {
      return NextResponse.json({ error: 'trackIds array required' }, { status: 400 });
    }
    const tracks = await prisma.cachedTrack.findMany({
      where: { id: { in: trackIds }, banned: true },
      select: { id: true },
    });
    const bannedIds = tracks.map(t => t.id);
    return NextResponse.json({ bannedIds });
  } catch (e: any) {
    console.error('Ban bulk fetch error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch bans' }, { status: 500 });
  }
}

// GET - list all banned tracks alphabetically
export async function GET() {
  try {
    const tracks = await prisma.cachedTrack.findMany({
      where: { banned: true },
      orderBy: { title: 'asc' },
      include: {
        artist: { select: { name: true, thumb: true } },
        album: { select: { title: true, thumb: true, year: true } },
      },
    });
    return NextResponse.json({ tracks });
  } catch (e: any) {
    console.error('Banned list error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch banned tracks' }, { status: 500 });
  }
}
