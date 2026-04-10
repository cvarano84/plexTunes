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

    // For each station, get sample album art with randomization
    const stationsWithArt = await Promise.all(
      (stations ?? []).map(async (station) => {
        try {
          const stationType = station.stationType ?? 'standard';

          // Build query based on station type
          let where: any = { thumb: { not: null } };

          if (stationType === 'most-played') {
            where.playCount = { gt: 0 };
          } else if (stationType === 'hits') {
            if (station.minPopularity > 0) where.popularity = { gte: station.minPopularity };
            if (station.genre) {
              // Will filter client-side by genre mapping
            }
            if (station.decade) {
              where.year = { not: null };
            }
          } else {
            where.year = { not: null };
          }

          const matchingTracks = await prisma.cachedTrack.findMany({
            where,
            include: {
              album: { select: { thumb: true } },
              artist: { select: { name: true } },
            },
            take: 2000,
            ...(stationType === 'most-played' ? { orderBy: { playCount: 'desc' } } : {}),
          });

          // Filter based on station type
          let filtered = matchingTracks;
          if (stationType === 'standard' || (stationType === 'hits' && (station.decade || station.genre))) {
            filtered = matchingTracks.filter((t) => {
              if (station.decade) {
                const trackDecade = getDecadeFromYear(t.year);
                if (trackDecade !== station.decade) return false;
              }
              if (station.genre) {
                const trackGenres = mapGenreToStation(t.genre);
                if (!trackGenres.includes(station.genre)) return false;
              }
              return true;
            });
          }

          // Shuffle and collect unique album art, preferring different artists
          const shuffled = shuffle(filtered);
          const targetCount = shuffled.length >= 30 ? 9 : 4; // 3x3 for large collections, 2x2 otherwise
          const thumbSet = new Set<string>();
          const artistSet = new Set<string>();

          // First pass: prefer art from different artists
          for (const t of shuffled) {
            const thumb = t.album?.thumb ?? t.thumb;
            const artistName = t.artist?.name ?? t.artistName ?? '';
            if (thumb && !thumbSet.has(thumb) && !artistSet.has(artistName)) {
              thumbSet.add(thumb);
              artistSet.add(artistName);
            }
            if (thumbSet.size >= targetCount) break;
          }

          // Second pass: fill remaining from any unique art
          if (thumbSet.size < targetCount) {
            for (const t of shuffled) {
              const thumb = t.album?.thumb ?? t.thumb;
              if (thumb && !thumbSet.has(thumb)) {
                thumbSet.add(thumb);
              }
              if (thumbSet.size >= targetCount) break;
            }
          }

          return { ...station, sampleArt: Array.from(thumbSet), trackCount: filtered.length };
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
