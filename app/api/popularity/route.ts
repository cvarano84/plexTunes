export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getBatchPopularity } from '@/lib/spotify';

export async function POST(req: NextRequest) {
  try {
    const body = await req?.json?.().catch(() => ({}));
    const batchSize = body?.batchSize ?? 50;
    
    // Get unchecked tracks
    const unchecked = await prisma.cachedTrack.findMany({
      where: { spotifyChecked: false },
      take: batchSize,
      select: { id: true, title: true, artistName: true },
    });

    if ((unchecked?.length ?? 0) === 0) {
      const totalChecked = await prisma.cachedTrack.count({ where: { spotifyChecked: true } });
      const withPopularity = await prisma.cachedTrack.count({ where: { popularity: { not: null, gt: 0 } } });
      return NextResponse.json({ done: true, processed: 0, totalChecked, withPopularity });
    }

    const trackInputs = unchecked?.map?.((t: any) => ({
      artistName: t?.artistName ?? '',
      title: t?.title ?? '',
    })) ?? [];

    const popularityMap = await getBatchPopularity(trackInputs);

    // Update tracks with popularity
    let updated = 0;
    let withScore = 0;
    for (const t of (unchecked ?? [])) {
      const key = `${t?.artistName ?? ''}::${t?.title ?? ''}`;
      const pop = popularityMap?.get?.(key) ?? null;
      await prisma.cachedTrack.update({
        where: { id: t?.id ?? '' },
        data: {
          popularity: pop,
          spotifyChecked: true,
        },
      });
      updated++;
      if (pop !== null && pop > 0) withScore++;
    }

    const remaining = await prisma.cachedTrack.count({ where: { spotifyChecked: false } });

    return NextResponse.json({
      done: remaining === 0,
      processed: updated,
      withScore,
      remaining,
    });
  } catch (e: any) {
    console.error('Popularity error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}

// Allow resetting checked status to re-run popularity
export async function DELETE() {
  try {
    const result = await prisma.cachedTrack.updateMany({
      data: { spotifyChecked: false, popularity: null },
    });
    return NextResponse.json({ reset: result.count });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}