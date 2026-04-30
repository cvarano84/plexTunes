export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { searchGeniusSong, fetchLyricsFromGenius } from '@/lib/genius';
import { prisma } from '@/lib/db';

// Try LRCLIB first for synced lyrics (free, no API key needed)
async function fetchFromLrclib(title: string, artist: string, album?: string, durationSec?: number): Promise<{
  syncedLyrics: string | null;
  plainLyrics: string | null;
}> {
  try {
    // Try exact match with /api/get first (requires duration)
    if (durationSec && durationSec > 0) {
      const params = new URLSearchParams({
        track_name: title,
        artist_name: artist,
        ...(album ? { album_name: album } : {}),
        duration: String(Math.round(durationSec)),
      });
      const res = await fetch(`https://lrclib.net/api/get?${params}`, {
        headers: { 'User-Agent': 'PlexJukebox/1.0 (https://github.com/gilligan5000/plexTunes)' },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.syncedLyrics || data?.plainLyrics) {
          return { syncedLyrics: data.syncedLyrics ?? null, plainLyrics: data.plainLyrics ?? null };
        }
      }
    }

    // Fall back to search if exact match fails
    const searchParams = new URLSearchParams({
      track_name: title,
      artist_name: artist,
    });
    const searchRes = await fetch(`https://lrclib.net/api/search?${searchParams}`, {
      headers: { 'User-Agent': 'PlexJukebox/1.0 (https://github.com/gilligan5000/plexTunes)' },
    });
    if (searchRes.ok) {
      const results = await searchRes.json();
      if (Array.isArray(results) && results.length > 0) {
        const withSynced = results.find((r: any) => r?.syncedLyrics);
        const best = withSynced ?? results[0];
        return { syncedLyrics: best?.syncedLyrics ?? null, plainLyrics: best?.plainLyrics ?? null };
      }
    }

    return { syncedLyrics: null, plainLyrics: null };
  } catch (e: any) {
    console.error('LRCLIB error:', e?.message);
    return { syncedLyrics: null, plainLyrics: null };
  }
}

/** Persist lyrics to the CachedTrack row. */
async function cacheLyrics(trackId: string, synced: string | null, plain: string | null) {
  try {
    await prisma.cachedTrack.update({
      where: { id: trackId },
      data: {
        ...(synced ? { syncedLyrics: synced } : {}),
        ...(plain ? { plainLyrics: plain } : {}),
        lyricsCheckedAt: new Date(),
      },
    });
  } catch (e: any) {
    console.error('Cache lyrics error:', e?.message);
  }
}

/** Search LRCLIB + Genius and return lyrics. Also caches results. */
async function searchAndCache(trackId: string | null, title: string, artist: string, album: string, durationSec: number) {
  // 1. Try LRCLIB first (synced lyrics)
  const lrclib = await fetchFromLrclib(title, artist, album || undefined, durationSec || undefined);

  if (lrclib.syncedLyrics) {
    if (trackId) cacheLyrics(trackId, lrclib.syncedLyrics, lrclib.plainLyrics);
    return {
      lyrics: lrclib.plainLyrics ?? lrclib.syncedLyrics,
      syncedLyrics: lrclib.syncedLyrics,
      source: 'lrclib',
      cached: false,
    };
  }

  if (lrclib.plainLyrics) {
    if (trackId) cacheLyrics(trackId, null, lrclib.plainLyrics);
    return {
      lyrics: lrclib.plainLyrics,
      syncedLyrics: null,
      source: 'lrclib',
      cached: false,
    };
  }

  // 2. Fall back to Genius (plain lyrics only)
  const searchResult = await searchGeniusSong(title, artist);

  if (!searchResult.song) {
    // Nothing found anywhere — mark as checked so we don't re-search constantly
    if (trackId) cacheLyrics(trackId, null, null);
    return {
      lyrics: null,
      syncedLyrics: null,
      source: null,
      message: searchResult.error ?? 'No lyrics found',
    };
  }

  const lyricsResult = await fetchLyricsFromGenius(searchResult.song?.url ?? '');
  const plainText = lyricsResult.lyrics ?? null;
  if (trackId && plainText) cacheLyrics(trackId, null, plainText);

  return {
    lyrics: plainText,
    syncedLyrics: null,
    source: 'genius',
    cached: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const title = searchParams?.get?.('title') ?? '';
    const artist = searchParams?.get?.('artist') ?? '';
    const album = searchParams?.get?.('album') ?? '';
    const trackId = searchParams?.get?.('trackId') ?? null;
    const durationMs = parseInt(searchParams?.get?.('duration') ?? '0', 10);
    const durationSec = durationMs > 0 ? Math.round(durationMs / 1000) : 0;

    if (!title || !artist) {
      return NextResponse.json({ error: 'Title and artist required' }, { status: 400 });
    }

    // Check DB cache first
    if (trackId) {
      const cached = await prisma.cachedTrack.findUnique({
        where: { id: trackId },
        select: { syncedLyrics: true, plainLyrics: true, lyricsCheckedAt: true },
      }).catch(() => null);

      if (cached?.syncedLyrics) {
        // We have synced lyrics cached — return immediately
        return NextResponse.json({
          lyrics: cached.plainLyrics ?? cached.syncedLyrics,
          syncedLyrics: cached.syncedLyrics,
          source: 'cache',
          cached: true,
        });
      }

      if (cached?.plainLyrics) {
        // Have plain lyrics but no synced — return plain immediately,
        // then try to find synced lyrics in the background
        const checkedAt = cached.lyricsCheckedAt?.getTime?.() ?? 0;
        const hoursSince = (Date.now() - checkedAt) / (1000 * 60 * 60);
        // Only re-search for synced if we haven't checked in the last 24 hours
        if (hoursSince > 24) {
          // Background search for synced lyrics (don't await)
          searchAndCache(trackId, title, artist, album, durationSec).catch(() => {});
        }
        return NextResponse.json({
          lyrics: cached.plainLyrics,
          syncedLyrics: null,
          source: 'cache',
          cached: true,
          searching: hoursSince > 24, // tells UI we're looking for synced in background
        });
      }

      // If lyricsCheckedAt is set but both fields null => previously found nothing.
      // Only re-search if it's been > 7 days.
      if (cached?.lyricsCheckedAt) {
        const daysSince = (Date.now() - cached.lyricsCheckedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          return NextResponse.json({
            lyrics: null,
            syncedLyrics: null,
            source: null,
            cached: true,
            message: 'No lyrics found (checked recently)',
          });
        }
      }
    }

    // No cache hit — do the full search
    const result = await searchAndCache(trackId, title, artist, album, durationSec);
    return NextResponse.json(result);
  } catch (e: any) {
    console.error('Lyrics error:', e?.message);
    return NextResponse.json({ lyrics: null, syncedLyrics: null, error: 'Failed to fetch lyrics' });
  }
}
