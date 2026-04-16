export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get('period') || 'all';
    const limit = parseInt(req.nextUrl.searchParams.get('limit') || '50', 10);

    let dateFilter: Date | null = null;
    const now = new Date();
    if (period === '30d') {
      dateFilter = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (period === '90d') {
      dateFilter = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (period === '1y') {
      dateFilter = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }

    const where: any = { playCount: { gt: 0 } };
    if (dateFilter) {
      where.lastPlayedAt = { gte: dateFilter };
    }

    const tracks = await prisma.cachedTrack.findMany({
      where,
      orderBy: { playCount: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        title: true,
        artistName: true,
        albumTitle: true,
        thumb: true,
        mediaKey: true,
        duration: true,
        ratingKey: true,
        year: true,
        playCount: true,
        lastPlayedAt: true,
        popularity: true,
        billboardPeak: true,
        billboardWeeks: true,
      },
    });

    const totalPlays = tracks.reduce((sum, t) => sum + (t.playCount ?? 0), 0);

    return NextResponse.json({
      tracks,
      totalPlays,
      period,
      count: tracks.length,
    });
  } catch (e: any) {
    console.error('Stats error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
