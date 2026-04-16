export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// In-memory billboard index: { "title|artist" -> { peak, weeks } }
let billboardIndex: Map<string, { peak: number; weeks: number }> | null = null;
let indexLoading = false;
let indexError = '';
let indexStats = { totalEntries: 0, matched: 0, lastBuilt: '' };

function normalizeKey(title: string, artist: string): string {
  return `${title}|${artist}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
}

async function buildBillboardIndex(): Promise<Map<string, { peak: number; weeks: number }>> {
  const idx = new Map<string, { peak: number; weeks: number }>();
  // Fetch chart data from the GitHub repo (raw JSON endpoint)
  // The repo provides a compiled JSON with all chart entries
  const url = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/chart-data/chart-data.json';
  console.log('Fetching Billboard data from GitHub...');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch billboard data: ${res.status}`);
  const data: Array<{ date: string; data: Array<{ rank: number; song: string; artist: string; weeks_on_chart: number }> }> = await res.json();

  // Build aggregated index: track best peak position and max weeks on chart
  for (const week of data) {
    for (const entry of (week.data ?? [])) {
      const key = normalizeKey(entry.song ?? '', entry.artist ?? '');
      const existing = idx.get(key);
      if (existing) {
        if (entry.rank < existing.peak) existing.peak = entry.rank;
        if (entry.weeks_on_chart > existing.weeks) existing.weeks = entry.weeks_on_chart;
      } else {
        idx.set(key, { peak: entry.rank, weeks: entry.weeks_on_chart });
      }
    }
  }
  console.log(`Billboard index built: ${idx.size} unique songs from ${data.length} weeks`);
  return idx;
}

// GET: Lookup a single track OR get index status
export async function GET(req: NextRequest) {
  try {
    const trackId = req.nextUrl.searchParams.get('trackId');
    const statusOnly = req.nextUrl.searchParams.get('status');

    if (statusOnly) {
      return NextResponse.json({
        indexed: !!billboardIndex,
        loading: indexLoading,
        error: indexError,
        ...indexStats,
      });
    }

    if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 });

    const track = await prisma.cachedTrack.findUnique({
      where: { id: trackId },
      select: { id: true, title: true, artistName: true, billboardPeak: true, billboardWeeks: true, billboardCheckedAt: true },
    });
    if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    if (track.billboardCheckedAt) {
      return NextResponse.json({ peak: track.billboardPeak, weeks: track.billboardWeeks, cached: true });
    }

    // If index not built, return pending
    if (!billboardIndex) {
      return NextResponse.json({ error: 'Billboard index not built. POST to /api/tracks/billboard to build it.' }, { status: 425 });
    }

    const key = normalizeKey(track.title, track.artistName ?? '');
    const match = billboardIndex.get(key);
    const peak = match?.peak ?? null;
    const weeks = match?.weeks ?? null;

    await prisma.cachedTrack.update({
      where: { id: trackId },
      data: { billboardPeak: peak, billboardWeeks: weeks, billboardCheckedAt: new Date() },
    });

    return NextResponse.json({ peak, weeks, cached: false });
  } catch (e: any) {
    console.error('Billboard lookup error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST: Build the index from GitHub and batch-match all tracks
export async function POST() {
  if (indexLoading) {
    return NextResponse.json({ error: 'Already building index', ...indexStats }, { status: 409 });
  }

  indexLoading = true;
  indexError = '';

  // Run in background
  (async () => {
    try {
      billboardIndex = await buildBillboardIndex();
      indexStats.totalEntries = billboardIndex.size;
      indexStats.lastBuilt = new Date().toISOString();

      // Batch match against all tracks in DB
      const allTracks = await prisma.cachedTrack.findMany({
        where: { billboardCheckedAt: null },
        select: { id: true, title: true, artistName: true },
      });

      let matched = 0;
      const batchSize = 100;
      for (let i = 0; i < allTracks.length; i += batchSize) {
        const batch = allTracks.slice(i, i + batchSize);
        const updates = batch.map(track => {
          const key = normalizeKey(track.title, track.artistName ?? '');
          const match = billboardIndex!.get(key);
          return prisma.cachedTrack.update({
            where: { id: track.id },
            data: {
              billboardPeak: match?.peak ?? null,
              billboardWeeks: match?.weeks ?? null,
              billboardCheckedAt: new Date(),
            },
          });
        });
        await Promise.all(updates);
        matched += batch.filter(t => {
          const key = normalizeKey(t.title, t.artistName ?? '');
          return billboardIndex!.has(key);
        }).length;
      }

      indexStats.matched = matched;
      console.log(`Billboard batch match: ${matched}/${allTracks.length} tracks matched`);
    } catch (e: any) {
      console.error('Billboard index build error:', e?.message);
      indexError = e?.message ?? 'Unknown error';
    } finally {
      indexLoading = false;
    }
  })();

  return NextResponse.json({ message: 'Building billboard index in background...' });
}
