export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDecadeFromYear, mapGenreToStation } from '@/lib/stations';

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET() {
  try {
    const stations = await prisma.station.findMany({
      where: { isActive: true },
      orderBy: [{ decade: 'asc' }, { genre: 'asc' }],
    });

    // For each station, get sample album art with better randomization
    const stationsWithArt = await Promise.all(
      (stations ?? []).map(async (station) => {
        try {
          // Get a larger pool and randomize
          const matchingTracks = await prisma.cachedTrack.findMany({
            where: {
              year: { not: null },
              thumb: { not: null },
            },
            include: {
              album: { select: { thumb: true } },
              artist: { select: { name: true } },
            },
            take: 2000,
          });

          const filtered = matchingTracks.filter((t) => {
            const trackDecade = getDecadeFromYear(t.year);
            if (trackDecade !== station.decade) return false;
            const trackGenres = mapGenreToStation(t.genre);
            return trackGenres.includes(station.genre ?? '');
          });

          // Shuffle and collect unique album art from different artists
          const shuffled = shuffle(filtered);
          const thumbSet = new Set<string>();
          const artistSet = new Set<string>();
          for (const t of shuffled) {
            const thumb = t.album?.thumb ?? t.thumb;
            const artistName = t.artist?.name ?? t.artistName ?? '';
            if (thumb && !thumbSet.has(thumb)) {
              // Prefer art from different artists for visual variety
              if (thumbSet.size < 4 && artistSet.has(artistName) && shuffled.length > 20) continue;
              thumbSet.add(thumb);
              artistSet.add(artistName);
            }
            if (thumbSet.size >= 6) break;
          }

          // If we couldn't get enough unique-artist art, fill from any
          if (thumbSet.size < 4) {
            for (const t of shuffled) {
              const thumb = t.album?.thumb ?? t.thumb;
              if (thumb && !thumbSet.has(thumb)) {
                thumbSet.add(thumb);
              }
              if (thumbSet.size >= 6) break;
            }
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
