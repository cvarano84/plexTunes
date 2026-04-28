export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

let scrapeInProgress = false;
let scrapeAbort = false;
let scrapeStatus = { processed: 0, total: 0, current: '', phase: '', phasesCompleted: [] as string[] };

export async function GET() {
  return NextResponse.json({
    inProgress: scrapeInProgress,
    ...scrapeStatus,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  if (body?.action === 'stop') {
    scrapeAbort = true;
    // Don't reset status — already-scraped data is preserved
    return NextResponse.json({ message: 'Stopping after current item... Already-scraped data is saved.' });
  }

  if (scrapeInProgress) {
    return NextResponse.json({ error: 'Scrape already in progress', ...scrapeStatus }, { status: 409 });
  }

  scrapeInProgress = true;
  scrapeAbort = false;
  scrapeStatus = { processed: 0, total: 0, current: '', phase: 'starting', phasesCompleted: [] };

  // Run in background
  runScrape().finally(() => {
    scrapeInProgress = false;
  });

  return NextResponse.json({ message: 'Background scrape started' });
}

function normalizeKey(title: string, artist: string): string {
  return `${title}|${artist}`.toLowerCase().replace(/[^a-z0-9|]/g, '');
}

async function runScrape() {
  try {
    // ═══════ Phase 1: Billboard matching (fastest — uses local DB after one-time index build) ═══════
    scrapeStatus.phase = 'billboard';
    scrapeStatus.current = 'Checking billboard data...';
    scrapeStatus.processed = 0;

    const uncheckedCount = await prisma.cachedTrack.count({ where: { billboardCheckedAt: null } });

    if (uncheckedCount > 0) {
      scrapeStatus.total = uncheckedCount;
      scrapeStatus.current = 'Downloading Billboard Hot 100 index...';

      // Build in-memory index from GitHub
      let billboardIndex: Map<string, { peak: number; weeks: number }> | null = null;
      try {
        const url = 'https://raw.githubusercontent.com/mhollingshead/billboard-hot-100/main/chart-data/chart-data.json';
        const res = await fetch(url);
        if (res.ok) {
          const data: Array<{ date: string; data: Array<{ rank: number; song: string; artist: string; weeks_on_chart: number }> }> = await res.json();
          billboardIndex = new Map();
          for (const week of data) {
            for (const entry of (week.data ?? [])) {
              const key = normalizeKey(entry.song ?? '', entry.artist ?? '');
              const existing = billboardIndex.get(key);
              if (existing) {
                if (entry.rank < existing.peak) existing.peak = entry.rank;
                if (entry.weeks_on_chart > existing.weeks) existing.weeks = entry.weeks_on_chart;
              } else {
                billboardIndex.set(key, { peak: entry.rank, weeks: entry.weeks_on_chart });
              }
            }
          }
          console.log(`Billboard index built: ${billboardIndex.size} unique songs`);
        }
      } catch (e: any) {
        console.error('Billboard index fetch failed (non-fatal):', e?.message);
      }

      if (billboardIndex && !scrapeAbort) {
        // Batch-match all unchecked tracks
        const unchecked = await prisma.cachedTrack.findMany({
          where: { billboardCheckedAt: null },
          select: { id: true, title: true, artistName: true },
        });
        const batchSize = 100;
        let processed = 0;
        for (let i = 0; i < unchecked.length; i += batchSize) {
          if (scrapeAbort) break;
          const batch = unchecked.slice(i, i + batchSize);
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
          processed += batch.length;
          scrapeStatus.processed = processed;
          scrapeStatus.current = `Matched ${processed}/${unchecked.length} tracks`;
        }
      }
    } else {
      scrapeStatus.current = 'All tracks already checked';
      scrapeStatus.total = 0;
    }

    scrapeStatus.phasesCompleted.push('billboard');
    if (scrapeAbort) { scrapeStatus.phase = 'stopped'; scrapeStatus.current = 'Stopped — all completed data saved'; return; }

    // ═══════ Phase 2: Artist bios ═══════
    scrapeStatus.phase = 'bios';
    scrapeStatus.processed = 0;
    const artistsNeedBio = await prisma.cachedArtist.findMany({
      where: { summary: null },
      select: { id: true, name: true },
    });
    scrapeStatus.total = artistsNeedBio.length;

    for (let i = 0; i < artistsNeedBio.length; i++) {
      if (scrapeAbort) break;
      const artist = artistsNeedBio[i];
      scrapeStatus.current = artist.name;
      scrapeStatus.processed = i + 1;

      try {
        const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/artists/${artist.id}/bio`);
        if (res.ok) {
          const data = await res.json();
          if (data?.bio) {
            await prisma.cachedArtist.update({
              where: { id: artist.id },
              data: { summary: data.bio },
            });
          }
        }
      } catch { /* skip failed */ }

      await new Promise(r => setTimeout(r, 500));
    }

    scrapeStatus.phasesCompleted.push('bios');
    if (scrapeAbort) { scrapeStatus.phase = 'stopped'; scrapeStatus.current = 'Stopped — all completed data saved'; return; }

    // ═══════ Phase 3: Track summaries ═══════
    scrapeStatus.phase = 'summaries';
    scrapeStatus.processed = 0;
    const tracksNeedSummary = await prisma.cachedTrack.findMany({
      where: { summary: null },
      select: { id: true, title: true, artistName: true },
      take: 500,
    });
    scrapeStatus.total = tracksNeedSummary.length;

    for (let i = 0; i < tracksNeedSummary.length; i++) {
      if (scrapeAbort) break;
      const track = tracksNeedSummary[i];
      scrapeStatus.current = `${track.artistName} - ${track.title}`;
      scrapeStatus.processed = i + 1;

      try {
        await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tracks/summary?trackId=${track.id}`);
      } catch { /* skip failed */ }

      await new Promise(r => setTimeout(r, 500));
    }

    scrapeStatus.phasesCompleted.push('summaries');
    scrapeStatus.phase = 'done';
    scrapeStatus.current = '';
  } catch (e: any) {
    console.error('Background scrape error:', e?.message);
    scrapeStatus.phase = 'error';
    scrapeStatus.current = e?.message ?? 'Unknown error';
  }
}
