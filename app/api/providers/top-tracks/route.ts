export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '25', 10);

    // Top tracks by stored popularity
    const topTracks = await prisma.cachedTrack.findMany({
      where: { popularity: { not: null, gt: 0 } },
      orderBy: { popularity: 'desc' },
      take: Math.min(limit, 50),
      select: {
        id: true,
        title: true,
        artistName: true,
        albumTitle: true,
        popularity: true,
        playCount: true,
        year: true,
        genre: true,
      },
    });

    // Stats
    const totalTracks = await prisma.cachedTrack.count();
    const checkedTracks = await prisma.cachedTrack.count({ where: { spotifyChecked: true } });
    const withPopularity = await prisma.cachedTrack.count({ where: { popularity: { not: null, gt: 0 } } });
    const unchecked = await prisma.cachedTrack.count({ where: { spotifyChecked: false } });

    // Popularity distribution
    const highPop = await prisma.cachedTrack.count({ where: { popularity: { gte: 70 } } });
    const medPop = await prisma.cachedTrack.count({ where: { popularity: { gte: 40, lt: 70 } } });
    const lowPop = await prisma.cachedTrack.count({ where: { popularity: { gt: 0, lt: 40 } } });
    const zeroPop = await prisma.cachedTrack.count({ where: { OR: [{ popularity: null }, { popularity: 0 }] } });

    return NextResponse.json({
      topTracks,
      stats: {
        totalTracks,
        checkedTracks,
        withPopularity,
        unchecked,
        distribution: { high: highPop, medium: medPop, low: lowPop, none: zeroPop },
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}
