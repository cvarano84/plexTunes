export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

let scrapeInProgress = false;
let scrapeAbort = false;
let scrapeStatus = { processed: 0, total: 0, current: '', phase: '' };

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
    return NextResponse.json({ message: 'Stopping...' });
  }

  if (scrapeInProgress) {
    return NextResponse.json({ error: 'Scrape already in progress', ...scrapeStatus }, { status: 409 });
  }

  scrapeInProgress = true;
  scrapeAbort = false;
  scrapeStatus = { processed: 0, total: 0, current: '', phase: 'bios' };

  // Run in background
  runScrape().finally(() => {
    scrapeInProgress = false;
  });

  return NextResponse.json({ message: 'Background scrape started' });
}

async function runScrape() {
  try {
    // Phase 1: Artist bios
    const artistsNeedBio = await prisma.cachedArtist.findMany({
      where: { summary: null },
      select: { id: true, name: true },
    });
    scrapeStatus.total = artistsNeedBio.length;
    scrapeStatus.phase = 'bios';

    for (let i = 0; i < artistsNeedBio.length; i++) {
      if (scrapeAbort) break;
      const artist = artistsNeedBio[i];
      scrapeStatus.current = artist.name;
      scrapeStatus.processed = i;

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

      // Rate limit: 500ms between requests
      await new Promise(r => setTimeout(r, 500));
    }

    if (scrapeAbort) return;

    // Phase 2: Track summaries
    const tracksNeedSummary = await prisma.cachedTrack.findMany({
      where: { summary: null },
      select: { id: true, title: true, artistName: true },
      take: 500, // Limit batch size
    });
    scrapeStatus.total = tracksNeedSummary.length;
    scrapeStatus.processed = 0;
    scrapeStatus.phase = 'summaries';

    for (let i = 0; i < tracksNeedSummary.length; i++) {
      if (scrapeAbort) break;
      const track = tracksNeedSummary[i];
      scrapeStatus.current = `${track.artistName} - ${track.title}`;
      scrapeStatus.processed = i;

      try {
        const res = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/tracks/summary?trackId=${track.id}`);
        // The summary route already saves to DB
      } catch { /* skip failed */ }

      await new Promise(r => setTimeout(r, 500));
    }

    scrapeStatus.phase = 'done';
    scrapeStatus.current = '';
  } catch (e: any) {
    console.error('Background scrape error:', e?.message);
    scrapeStatus.phase = 'error';
    scrapeStatus.current = e?.message ?? 'Unknown error';
  }
}
