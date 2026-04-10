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

    // Pre-fetch a pool of tracks for art collage generation (lightweight)
    const allTracksWithArt = await prisma.cachedTrack.findMany({
      where: { thumb: { not: null } },
      select: { thumb: true, artistName: true, year: true, genre: true, popularity: true, playCount: true,
        album: { select: { thumb: true, genre: true } } },
      take: 5000,
    });

    const stationsWithArt = (stations ?? []).map((station) => {
      try {
        const stationType = station.stationType ?? 'standard';

        // Filter tracks for art collage from the pre-fetched pool
        let filtered = allTracksWithArt;
        if (stationType === 'most-played') {
          filtered = allTracksWithArt.filter(t => (t.playCount ?? 0) > 0);
        } else if (stationType === 'hits') {
          filtered = allTracksWithArt.filter(t => {
            if (station.minPopularity > 0 && (t.popularity ?? 0) < station.minPopularity) return false;
            if (station.decade && getDecadeFromYear(t.year) !== station.decade) return false;
            if (station.genre && !mapGenreToStation(t.genre, t.album?.genre).includes(station.genre)) return false;
            return true;
          });
        } else {
          filtered = allTracksWithArt.filter(t => {
            if (station.decade && getDecadeFromYear(t.year) !== station.decade) return false;
            if (station.genre && !mapGenreToStation(t.genre, t.album?.genre).includes(station.genre)) return false;
            return true;
          });
        }

        // Shuffle and collect unique album art, preferring different artists
        const shuffled = shuffle(filtered);
        const targetCount = shuffled.length >= 30 ? 9 : 4;
        const thumbSet = new Set<string>();
        const artistSet = new Set<string>();

        for (const t of shuffled) {
          const thumb = t.album?.thumb ?? t.thumb;
          const artistName = t.artistName ?? '';
          if (thumb && !thumbSet.has(thumb) && !artistSet.has(artistName)) {
            thumbSet.add(thumb);
            artistSet.add(artistName);
          }
          if (thumbSet.size >= targetCount) break;
        }

        if (thumbSet.size < targetCount) {
          for (const t of shuffled) {
            const thumb = t.album?.thumb ?? t.thumb;
            if (thumb && !thumbSet.has(thumb)) {
              thumbSet.add(thumb);
            }
            if (thumbSet.size >= targetCount) break;
          }
        }

        // Use stored trackCount from DB (updated by rescan), not the 5000-sample count
        return { ...station, sampleArt: Array.from(thumbSet), trackCount: station.trackCount ?? filtered.length };
      } catch {
        return { ...station, sampleArt: [] };
      }
    });

    return NextResponse.json({ stations: stationsWithArt });
  } catch (e: any) {
    console.error('Stations error:', e?.message);
    return NextResponse.json({ stations: [] }, { status: 500 });
  }
}
