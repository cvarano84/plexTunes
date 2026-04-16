export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Fetch BPM from Deezer for a track
async function fetchBpmFromDeezer(artistName: string, trackTitle: string): Promise<number | null> {
  try {
    // Search for the track
    const query = encodeURIComponent(`artist:"${artistName}" track:"${trackTitle}"`);
    const searchRes = await fetch(`https://api.deezer.com/search/track?q=${query}&limit=3`, {
      headers: { 'User-Agent': 'PlexJukebox/1.0' },
    });
    if (!searchRes?.ok) return null;
    const searchData = await searchRes?.json?.();
    const items = searchData?.data ?? [];
    if (items.length === 0) return null;

    // Try to find the best match
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

    // Get full track details (includes BPM)
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

// GET /api/tracks/bpm?trackId=xxx
export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get('trackId');
  if (!trackId) return NextResponse.json({ error: 'trackId required' }, { status: 400 });

  try {
    const track = await prisma.cachedTrack.findUnique({
      where: { id: trackId },
      select: { bpm: true, bpmChecked: true, title: true, artistName: true },
    });
    if (!track) return NextResponse.json({ error: 'Track not found' }, { status: 404 });

    // Return cached BPM if already checked
    if (track.bpmChecked) {
      return NextResponse.json({ bpm: track.bpm });
    }

    // Fetch from Deezer
    const bpm = await fetchBpmFromDeezer(track.artistName ?? '', track.title ?? '');

    // Store in DB
    await prisma.cachedTrack.update({
      where: { id: trackId },
      data: { bpm, bpmChecked: true },
    });

    return NextResponse.json({ bpm });
  } catch (err: any) {
    console.error('[BPM] Error:', err?.message);
    return NextResponse.json({ error: 'Failed to fetch BPM' }, { status: 500 });
  }
}
