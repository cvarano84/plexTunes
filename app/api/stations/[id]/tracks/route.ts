export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapGenreToStation, getDecadeFromYear } from '@/lib/stations';

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Deduplicate tracks by artist+title so the same song on multiple albums
 *  only counts once. Keeps the version with highest popularity/playCount. */
function dedupeTracks(tracks: any[]): any[] {
  const seen = new Map<string, any>();
  for (const t of tracks) {
    const key = `${(t?.artistName ?? t?.artist?.name ?? '').toLowerCase()}::${(t?.title ?? '').toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim()}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, t);
    } else {
      const ep = (existing?.popularity ?? 0) + (existing?.playCount ?? 0);
      const np = (t?.popularity ?? 0) + (t?.playCount ?? 0);
      if (np > ep) seen.set(key, t);
    }
  }
  return [...seen.values()];
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const stationId = params?.id ?? '';
    const limitParam = _req?.nextUrl?.searchParams?.get?.('limit');
    const requestedLimit = limitParam ? parseInt(limitParam, 10) : 30;
    const limit = Math.max(1, Math.min(100, isNaN(requestedLimit) ? 30 : requestedLimit));
    const station = await prisma.station.findUnique({ where: { id: stationId } });

    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    // Handle "most-played" station type
    if (station.stationType === 'most-played') {
      const topPlayed = await prisma.cachedTrack.findMany({
        where: { playCount: { gt: 0 } },
        orderBy: [{ playCount: 'desc' }, { lastPlayedAt: 'desc' }],
        take: 100,
        include: {
          artist: { select: { name: true, thumb: true } },
          album: { select: { title: true, thumb: true, year: true } },
        },
      });

      // Weighted shuffle - higher play count = higher chance of appearing early
      const weighted = topPlayed.map((t: any) => ({
        ...t,
        weight: (t.playCount ?? 1) + Math.random() * 5,
      }));
      weighted.sort((a: any, b: any) => b.weight - a.weight);
      const selected = dedupeTracks(weighted).slice(0, limit);

      return NextResponse.json({ station, tracks: selected });
    }

    // Handle "hits" station type (cross-decade and/or cross-genre)
    if (station.stationType === 'hits') {
      const minPop = station.minPopularity || 40;

      // Build where clause — include tracks with popularity >= minPop, null popularity (unscored), or hearted
      const where: any = {
        OR: [
          { popularity: { gte: minPop } },
          { popularity: null },
          { hearted: true },
        ],
      };

      // If genre is set, we need to filter by genre mapping (can't do in SQL)
      // If decade is set, filter by year range
      if (station.decade) {
        const decadeNum = parseInt(station.decade, 10);
        if (!isNaN(decadeNum)) {
          where.year = { gte: decadeNum, lt: decadeNum + 10 };
        }
      }

      const tracks = await prisma.cachedTrack.findMany({
        where,
        orderBy: { popularity: 'desc' },
        take: 500,
        include: {
          artist: { select: { name: true, thumb: true } },
          album: { select: { title: true, thumb: true, year: true, genre: true } },
        },
      });

      // Further filter by genre if specified (with album genre fallback)
      let filtered = tracks;
      if (station.genre) {
        filtered = tracks.filter((t: any) => {
          const stationGenres = mapGenreToStation(t?.genre, t?.album?.genre);
          return stationGenres.includes(station.genre ?? '');
        });
      }

      // Sort: tracks with popularity first (descending), then unscored shuffled
      const withPop = filtered.filter((t: any) => t?.popularity != null && t.popularity >= minPop);
      const noPop = filtered.filter((t: any) => t?.popularity == null);
      withPop.sort((a: any, b: any) => {
        const popA = a?.popularity ?? 0;
        const popB = b?.popularity ?? 0;
        if (Math.abs(popA - popB) <= 5) return Math.random() - 0.5;
        return popB - popA;
      });
      const combined = dedupeTracks([...withPop.slice(0, 50), ...shuffle(noPop).slice(0, Math.max(0, 50 - withPop.length))]);
      const selected = shuffle(combined).slice(0, limit);

      return NextResponse.json({ station, tracks: selected });
    }

    // Standard station: match by decade AND genre (with album genre fallback)
    const allTracks = await prisma.cachedTrack.findMany({
      where: { year: { not: null } },
      include: {
        artist: { select: { name: true, thumb: true } },
        album: { select: { title: true, thumb: true, year: true, genre: true } },
      },
    });

    const matchingTracks = allTracks?.filter?.((t: any) => {
      const trackDecade = getDecadeFromYear(t?.year);
      if (trackDecade !== station?.decade) return false;
      const trackGenres = mapGenreToStation(t?.genre, t?.album?.genre);
      return trackGenres?.includes?.(station?.genre ?? '') ?? false;
    }) ?? [];

    const sorted = matchingTracks?.sort?.((a: any, b: any) => {
      const popA = a?.popularity ?? 0;
      const popB = b?.popularity ?? 0;
      if (Math.abs(popA - popB) <= 5) return Math.random() - 0.5;
      return popB - popA;
    }) ?? [];

    const deduped = dedupeTracks(sorted ?? []);
    const selected = deduped.slice(0, 50);
    const shuffled = shuffle(selected).slice(0, limit);

    return NextResponse.json({ station, tracks: shuffled });
  } catch (e: any) {
    console.error('Station tracks error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch station tracks' }, { status: 500 });
  }
}