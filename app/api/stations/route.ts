export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapGenreToStation } from '@/lib/stations';

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Lean projection used for art collage construction
type ArtTrack = {
  thumb: string | null;
  artistName: string | null;
  year: number | null;
  genre: string | null;
  popularity: number | null;
  playCount: number | null;
  album: { thumb: string | null; genre: string | null } | null;
};

const ART_SELECT = {
  thumb: true,
  artistName: true,
  year: true,
  genre: true,
  popularity: true,
  playCount: true,
  album: { select: { thumb: true, genre: true } },
} as const;

const HAS_ART_OR = [
  { thumb: { not: null } },
  { album: { thumb: { not: null } } },
];

function pickArt(tracks: ArtTrack[], targetCount: number): string[] {
  const shuffled = shuffle(tracks);
  const thumbSet = new Set<string>();
  const artistSet = new Set<string>();

  // Pass 1: prefer unique artists
  for (const t of shuffled) {
    const thumb = t.album?.thumb ?? t.thumb;
    const artistName = t.artistName ?? '';
    if (thumb && !thumbSet.has(thumb) && !artistSet.has(artistName)) {
      thumbSet.add(thumb);
      artistSet.add(artistName);
    }
    if (thumbSet.size >= targetCount) break;
  }
  // Pass 2: fill remaining slots ignoring artist uniqueness
  if (thumbSet.size < targetCount) {
    for (const t of shuffled) {
      const thumb = t.album?.thumb ?? t.thumb;
      if (thumb && !thumbSet.has(thumb)) {
        thumbSet.add(thumb);
      }
      if (thumbSet.size >= targetCount) break;
    }
  }
  return Array.from(thumbSet);
}

async function artTracksForStation(station: any): Promise<ArtTrack[]> {
  const stationType = station.stationType ?? 'standard';

  // most-played: only tracks that have been played
  if (stationType === 'most-played') {
    return prisma.cachedTrack.findMany({
      where: { AND: [{ OR: HAS_ART_OR }, { playCount: { gt: 0 } }] },
      select: ART_SELECT,
      orderBy: { playCount: 'desc' },
      take: 500,
    }) as any;
  }

  // Decade filter so we only scan the relevant year range in SQL
  const andClauses: any[] = [{ OR: HAS_ART_OR }];
  if (station.decade) {
    const decadeNum = parseInt(String(station.decade), 10);
    if (!isNaN(decadeNum)) {
      andClauses.push({ year: { gte: decadeNum, lt: decadeNum + 10 } });
    }
  }
  // hits: include popularity>=min OR null (unscored). Standard stations accept all popularities.
  if (stationType === 'hits') {
    const minPop = station.minPopularity || 0;
    if (minPop > 0) {
      andClauses.push({ OR: [{ popularity: { gte: minPop } }, { popularity: null }] });
    }
  }

  // Over-fetch from decade then filter genre in-memory (uses mapGenreToStation
  // with album-genre fallback + fuzzy dictionary).
  const tracks = await prisma.cachedTrack.findMany({
    where: { AND: andClauses },
    select: ART_SELECT,
    take: 2000,
  });

  if (!station.genre) return tracks as any;
  return (tracks as any as ArtTrack[]).filter((t) =>
    mapGenreToStation(t.genre, t.album?.genre).includes(station.genre)
  );
}

export async function GET() {
  try {
    const stations = await prisma.station.findMany({
      where: { isActive: true },
      orderBy: [{ decade: 'asc' }, { genre: 'asc' }],
    });

    // Per-station targeted queries. Serial to keep DB connection pressure low.
    const stationsWithArt: any[] = [];
    for (const station of stations ?? []) {
      try {
        const tracks = await artTracksForStation(station);
        const targetCount = tracks.length >= 30 ? 9 : 4;
        const sampleArt = pickArt(tracks, targetCount);
        stationsWithArt.push({
          ...station,
          sampleArt,
          trackCount: station.trackCount ?? tracks.length,
        });
      } catch (err: any) {
        console.error(`Stations art error for ${station?.id}:`, err?.message);
        stationsWithArt.push({ ...station, sampleArt: [] });
      }
    }

    return NextResponse.json({ stations: stationsWithArt });
  } catch (e: any) {
    console.error('Stations error:', e?.message);
    return NextResponse.json({ stations: [] }, { status: 500 });
  }
}
