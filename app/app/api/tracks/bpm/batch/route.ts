export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Fetch BPM from Deezer for a track
async function fetchBpmFromDeezer(artistName: string, trackTitle: string): Promise<number | null> {
  try {
    const query = encodeURIComponent(`artist:"${artistName}" track:"${trackTitle}"`);
    const searchRes = await fetch(`https://api.deezer.com/search/track?q=${query}&limit=3`, {
      headers: { 'User-Agent': 'PlexJukebox/1.0' },
    });
    if (!searchRes?.ok) return null;
    const searchData = await searchRes?.json?.();
    const items = searchData?.data ?? [];
    if (items.length === 0) return null;

    const normalizedArtist = artistName.toLowerCase().trim();
    const normalizedTitle = trackTitle.toLowerCase().trim();
    let bestMatch = items[0];
    for (const item of items) {
      const itemArtist = (item?.artist?.name ?? '').toLowerCase();
      const itemTitle = (item?.title ?? '').toLowerCase();
      if (itemArtist.includes(normalizedArtist) || normalizedArtist.includes(itemArtist)) {
        if (itemTitle.includes(normalizedTitle) || normalizedTitle.includes(itemTitle)) {
          bestMatch = item;
          break;
        }
      }
    }

    const trackId = bestMatch?.id;
    if (!trackId) return null;
    const trackRes = await fetch(`https://api.deezer.com/track/${trackId}`, {
      headers: { 'User-Agent': 'PlexJukebox/1.0' },
    });
    if (!trackRes?.ok) return null;
    const trackData = await trackRes?.json?.();
    const bpm = trackData?.bpm;
    if (typeof bpm === 'number' && bpm > 0) return bpm;
    return null;
  } catch {
    return null;
  }
}

// POST /api/tracks/bpm/batch - Batch scrape BPM data
export async function POST(req: NextRequest) {
  try {
    const body = await req?.json?.().catch(() => ({}));
    const batchSize = Math.min(body?.batchSize ?? 25, 50); // limit to 50 per batch
    const delayMs = body?.delayMs ?? 300; // delay between Deezer API calls to avoid rate limiting

    // Get unchecked tracks
    const unchecked = await prisma.cachedTrack.findMany({
      where: { bpmChecked: false },
      take: batchSize,
      select: { id: true, title: true, artistName: true },
    });

    if ((unchecked?.length ?? 0) === 0) {
      const totalChecked = await prisma.cachedTrack.count({ where: { bpmChecked: true } });
      const withBpm = await prisma.cachedTrack.count({ where: { bpm: { not: null, gt: 0 } } });
      const totalTracks = await prisma.cachedTrack.count();
      return NextResponse.json({ done: true, processed: 0, totalChecked, withBpm, totalTracks });
    }

    let processed = 0;
    let withBpm = 0;
    let errors = 0;

    for (const t of unchecked) {
      try {
        const bpm = await fetchBpmFromDeezer(t.artistName ?? '', t.title ?? '');
        await prisma.cachedTrack.update({
          where: { id: t.id },
          data: { bpm, bpmChecked: true },
        });
        processed++;
        if (bpm !== null && bpm > 0) withBpm++;
      } catch {
        errors++;
        // Mark as checked even if errored so we don't retry endlessly
        await prisma.cachedTrack.update({
          where: { id: t.id },
          data: { bpmChecked: true },
        }).catch(() => {});
      }

      // Respect Deezer rate limits
      if (delayMs > 0) await new Promise(r => setTimeout(r, delayMs));
    }

    const remaining = await prisma.cachedTrack.count({ where: { bpmChecked: false } });
    const totalChecked = await prisma.cachedTrack.count({ where: { bpmChecked: true } });
    const totalWithBpm = await prisma.cachedTrack.count({ where: { bpm: { not: null, gt: 0 } } });

    return NextResponse.json({
      done: remaining === 0,
      processed,
      withBpm,
      errors,
      remaining,
      totalChecked,
      totalWithBpm,
    });
  } catch (err: any) {
    console.error('[BPM Batch] Error:', err?.message);
    return NextResponse.json({ error: 'Batch BPM scrape failed' }, { status: 500 });
  }
}

// GET /api/tracks/bpm/batch - Get BPM scrape progress
export async function GET() {
  try {
    const totalTracks = await prisma.cachedTrack.count();
    const totalChecked = await prisma.cachedTrack.count({ where: { bpmChecked: true } });
    const withBpm = await prisma.cachedTrack.count({ where: { bpm: { not: null, gt: 0 } } });
    const remaining = totalTracks - totalChecked;

    return NextResponse.json({
      totalTracks,
      totalChecked,
      withBpm,
      remaining,
      done: remaining === 0,
    });
  } catch (err: any) {
    console.error('[BPM Batch] Progress error:', err?.message);
    return NextResponse.json({ error: 'Failed to get BPM progress' }, { status: 500 });
  }
}
