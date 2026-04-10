export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDecadeFromYear, mapGenreToStation } from '@/lib/stations';

export async function GET() {
  try {
    const stations = await prisma.station.findMany({
      where: { isActive: true },
      orderBy: [{ decade: 'asc' }, { genre: 'asc' }],
    });

    // For each station, get a sample of album art from matching tracks
    const stationsWithArt = await Promise.all(
      (stations ?? []).map(async (station) => {
        try {
          const matchingTracks = await prisma.cachedTrack.findMany({
            where: {
              year: { not: null },
              thumb: { not: null },
            },
            include: {
              album: { select: { thumb: true } },
            },
            take: 500,
          });

          const filtered = matchingTracks.filter((t) => {
            const trackDecade = getDecadeFromYear(t.year);
            if (trackDecade !== station.decade) return false;
            const trackGenres = mapGenreToStation(t.genre);
            return trackGenres.includes(station.genre ?? '');
          });

          // Get unique album thumbs
          const thumbSet = new Set<string>();
          for (const t of filtered) {
            const thumb = t.album?.thumb ?? t.thumb;
            if (thumb) thumbSet.add(thumb);
            if (thumbSet.size >= 6) break;
          }

          return { ...station, sampleArt: Array.from(thumbSet) };
        } catch {
          return { ...station, sampleArt: [] };
        }
      })
    );

    return NextResponse.json({ stations: stationsWithArt });
  } catch (e: any) {
    console.error('Stations error:', e?.message);
    return NextResponse.json({ stations: [] }, { status: 500 });
  }
}
