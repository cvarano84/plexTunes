export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getDecadeFromYear, mapGenreToStation } from '@/lib/stations';

export async function POST(req: NextRequest) {
  try {
    const body = await req?.json?.().catch(() => ({}));
    const newMinPopularity = body?.minPopularity ?? null; // null = don't change

    // Fetch ALL tracks with album genre for fallback matching
    const allTracks = await prisma.cachedTrack.findMany({
      select: { year: true, genre: true, popularity: true, playCount: true, album: { select: { genre: true } } },
    });

    const stations = await prisma.station.findMany({ where: { isActive: true } });

    const results: { id: string; name: string; trackCount: number; stationType: string }[] = [];

    for (const station of stations) {
      const stationType = station.stationType ?? 'standard';
      let minPop = station.minPopularity;

      // Update minPopularity for hits stations if a new value was provided
      if (newMinPopularity !== null && stationType === 'hits') {
        minPop = newMinPopularity;
      }

      let count = 0;
      if (stationType === 'most-played') {
        count = allTracks.filter(t => (t.playCount ?? 0) > 0).length;
      } else if (stationType === 'hits') {
        count = allTracks.filter(t => {
          if (minPop > 0 && (t.popularity ?? 0) < minPop) return false;
          if (station.decade) {
            const decadeNum = parseInt(station.decade, 10);
            if (!isNaN(decadeNum) && (t.year == null || t.year < decadeNum || t.year >= decadeNum + 10)) return false;
          }
          if (station.genre && !mapGenreToStation(t.genre, t.album?.genre).includes(station.genre)) return false;
          return true;
        }).length;
      } else {
        count = allTracks.filter(t => {
          if (station.decade && getDecadeFromYear(t.year) !== station.decade) return false;
          if (station.genre && !mapGenreToStation(t.genre, t.album?.genre).includes(station.genre)) return false;
          return true;
        }).length;
      }

      // Update the station record
      const updateData: any = { trackCount: count };
      if (newMinPopularity !== null && stationType === 'hits') {
        updateData.minPopularity = newMinPopularity;
      }
      await prisma.station.update({ where: { id: station.id }, data: updateData });

      results.push({ id: station.id, name: station.name, trackCount: count, stationType });
    }

    // Gather stats
    const totalTracks = allTracks.length;
    const withGenre = allTracks.filter(t => !!(t.genre || t.album?.genre)).length;
    const withYear = allTracks.filter(t => t.year != null).length;
    const withPopularity = allTracks.filter(t => (t.popularity ?? 0) > 0).length;
    const totalQualifying = new Set(results.flatMap(r => r.id)).size; // stations with tracks
    const totalMatchedTracks = results.reduce((sum, r) => sum + r.trackCount, 0);

    return NextResponse.json({
      stations: results,
      stats: { totalTracks, withGenre, withYear, withPopularity, totalMatchedTracks },
    });
  } catch (e: any) {
    console.error('Station rescan error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Rescan failed' }, { status: 500 });
  }
}

// Preview endpoint - returns counts without saving
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const minPopularity = parseInt(url.searchParams.get('minPopularity') ?? '40', 10);

    const allTracks = await prisma.cachedTrack.findMany({
      select: { year: true, genre: true, popularity: true, playCount: true, album: { select: { genre: true } } },
    });

    const stations = await prisma.station.findMany({ where: { isActive: true } });

    const results = stations.map(station => {
      const stationType = station.stationType ?? 'standard';
      let count = 0;

      if (stationType === 'most-played') {
        count = allTracks.filter(t => (t.playCount ?? 0) > 0).length;
      } else if (stationType === 'hits') {
        count = allTracks.filter(t => {
          if (minPopularity > 0 && (t.popularity ?? 0) < minPopularity) return false;
          if (station.decade) {
            const decadeNum = parseInt(station.decade, 10);
            if (!isNaN(decadeNum) && (t.year == null || t.year < decadeNum || t.year >= decadeNum + 10)) return false;
          }
          if (station.genre && !mapGenreToStation(t.genre, t.album?.genre).includes(station.genre)) return false;
          return true;
        }).length;
      } else {
        count = allTracks.filter(t => {
          if (station.decade && getDecadeFromYear(t.year) !== station.decade) return false;
          if (station.genre && !mapGenreToStation(t.genre, t.album?.genre).includes(station.genre)) return false;
          return true;
        }).length;
      }

      return { id: station.id, name: station.name, trackCount: count, stationType, decade: station.decade, genre: station.genre };
    });

    const totalTracks = allTracks.length;
    const withGenre = allTracks.filter(t => !!(t.genre || t.album?.genre)).length;
    const withYear = allTracks.filter(t => t.year != null).length;
    const withPopularity = allTracks.filter(t => (t.popularity ?? 0) > 0).length;

    return NextResponse.json({
      stations: results,
      stats: { totalTracks, withGenre, withYear, withPopularity, minPopularity },
    });
  } catch (e: any) {
    console.error('Station preview error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Preview failed' }, { status: 500 });
  }
}
