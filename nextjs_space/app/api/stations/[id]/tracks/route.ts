export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapGenreToStation, getDecadeFromYear } from '@/lib/stations';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const stationId = params?.id ?? '';
    const station = await prisma.station.findUnique({ where: { id: stationId } });
    
    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    // Get all tracks that match decade and genre
    const allTracks = await prisma.cachedTrack.findMany({
      where: {
        year: { not: null },
      },
      include: {
        artist: { select: { name: true, thumb: true } },
        album: { select: { title: true, thumb: true } },
      },
    });

    // Filter by station criteria
    const matchingTracks = allTracks?.filter?.((t: any) => {
      const trackDecade = getDecadeFromYear(t?.year);
      if (trackDecade !== station?.decade) return false;
      const trackGenres = mapGenreToStation(t?.genre);
      return trackGenres?.includes?.(station?.genre ?? '') ?? false;
    }) ?? [];

    // Sort by popularity (highest first), then shuffle within similar popularity
    const sorted = matchingTracks?.sort?.((a: any, b: any) => {
      const popA = a?.popularity ?? 0;
      const popB = b?.popularity ?? 0;
      if (Math.abs(popA - popB) <= 5) return Math.random() - 0.5;
      return popB - popA;
    }) ?? [];

    // Take top tracks (popular ones preferred)
    const selected = sorted?.slice?.(0, 50) ?? [];

    // Shuffle the selection for variety
    for (let i = (selected?.length ?? 0) - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [selected[i], selected[j]] = [selected[j], selected[i]];
    }

    return NextResponse.json({
      station,
      tracks: selected?.slice?.(0, 30) ?? [],
    });
  } catch (e: any) {
    console.error('Station tracks error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch station tracks' }, { status: 500 });
  }
}
