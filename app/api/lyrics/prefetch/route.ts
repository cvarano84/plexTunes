export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { searchGeniusSong, fetchLyricsFromGenius } from '@/lib/genius';

// Shared LRCLIB fetcher (duplicated from parent route to keep route self-contained)
async function fetchFromLrclib(title: string, artist: string, album?: string, durationSec?: number): Promise<{
  syncedLyrics: string | null;
  plainLyrics: string | null;
}> {
  try {
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
    const searchParams = new URLSearchParams({ track_name: title, artist_name: artist });
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
    console.error('LRCLIB prefetch error:', e?.message);
    return { syncedLyrics: null, plainLyrics: null };
  }
}

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
    console.error('Cache lyrics prefetch error:', e?.message);
  }
}

/**
 * POST /api/lyrics/prefetch
 * Body: { tracks: [{ id, title, artistName, albumTitle?, duration? }] }
 *
 * Checks which tracks already have cached lyrics, then fetches the rest
 * in the background. Returns immediately with which tracks were already cached
 * and which are being fetched.
 */
export async function POST(req: NextRequest) {
  try {
    const { tracks } = await req.json();
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return NextResponse.json({ error: 'tracks array required' }, { status: 400 });
    }

    // Limit to prevent abuse
    const batch = tracks.slice(0, 20);
    const trackIds = batch.map((t: any) => t.id).filter(Boolean);

    // Check which tracks already have lyrics cached
    const cached = await prisma.cachedTrack.findMany({
      where: { id: { in: trackIds } },
      select: { id: true, syncedLyrics: true, plainLyrics: true, lyricsCheckedAt: true },
    });

    const cachedMap = new Map(cached.map(c => [c.id, c]));
    const needsFetch: any[] = [];

    for (const track of batch) {
      if (!track.id || !track.title || !track.artistName) continue;
      const c = cachedMap.get(track.id);
      // Already has synced lyrics — skip
      if (c?.syncedLyrics) continue;
      // Already has plain lyrics — skip (good enough for prefetch)
      if (c?.plainLyrics) continue;
      // Was checked recently (within 7 days) and found nothing — skip
      if (c?.lyricsCheckedAt) {
        const daysSince = (Date.now() - c.lyricsCheckedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) continue;
      }
      needsFetch.push(track);
    }

    // Fire off fetches in the background — don't block the response
    if (needsFetch.length > 0) {
      // Process sequentially to be kind to LRCLIB rate limits
      const doFetch = async () => {
        for (const track of needsFetch) {
          try {
            const durationSec = track.duration ? Math.round(track.duration / 1000) : 0;
            const lrclib = await fetchFromLrclib(
              track.title,
              track.artistName,
              track.albumTitle || undefined,
              durationSec || undefined
            );

            if (lrclib.syncedLyrics || lrclib.plainLyrics) {
              await cacheLyrics(track.id, lrclib.syncedLyrics, lrclib.plainLyrics);
              continue;
            }

            // Try Genius as fallback
            const searchResult = await searchGeniusSong(track.title, track.artistName);
            if (searchResult.song) {
              const lyricsResult = await fetchLyricsFromGenius(searchResult.song?.url ?? '');
              if (lyricsResult.lyrics) {
                await cacheLyrics(track.id, null, lyricsResult.lyrics);
                continue;
              }
            }

            // Mark as checked even if nothing found
            await cacheLyrics(track.id, null, null);
          } catch (e: any) {
            console.error(`Prefetch lyrics error for ${track.title}:`, e?.message);
          }
        }
      };
      // Fire and forget
      doFetch().catch(() => {});
    }

    return NextResponse.json({
      total: batch.length,
      alreadyCached: batch.length - needsFetch.length,
      fetching: needsFetch.length,
    });
  } catch (e: any) {
    console.error('Lyrics prefetch error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
