export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { testGeniusConnection } from '@/lib/genius';

export async function GET() {
  try {
    const plexConfig = await prisma.plexConfig.findUnique({ where: { id: 'default' } });

    const [artistCount, albumCount, trackCount, stationCount] = await Promise.all([
      prisma.cachedArtist.count(),
      prisma.cachedAlbum.count(),
      prisma.cachedTrack.count(),
      prisma.station.count({ where: { isActive: true } }),
    ]);

    const syncStatus = await prisma.librarySyncStatus.findUnique({ where: { id: 'default' } });
    const geniusStatus = await testGeniusConnection();

    const spotifyClientId = process.env.SPOTIFY_CLIENT_ID ?? '';
    const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
    const spotifyConfigured = !!(spotifyClientId && spotifyClientSecret);

    // Check Spotify token works
    let spotifyWorking = false;
    if (spotifyConfigured) {
      try {
        const basic = Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64');
        const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: 'grant_type=client_credentials',
        });
        spotifyWorking = tokenRes.ok;
      } catch { /* ignore */ }
    }

    const tracksWithPop = await prisma.cachedTrack.count({ where: { spotifyChecked: true } });
    const tracksWithHighPop = await prisma.cachedTrack.count({ where: { popularity: { gte: 30 } } });
    const tracksUnchecked = await prisma.cachedTrack.count({ where: { spotifyChecked: false } });

    return NextResponse.json({
      plex: {
        configured: !!plexConfig,
        serverUrl: plexConfig?.serverUrl ?? null,
      },
      library: {
        artists: artistCount,
        albums: albumCount,
        tracks: trackCount,
        stations: stationCount,
        lastSync: syncStatus?.lastSyncAt ?? null,
        syncInProgress: syncStatus?.syncInProgress ?? false,
      },
      genius: geniusStatus,
      spotify: {
        configured: spotifyConfigured,
        working: spotifyWorking,
        tracksChecked: tracksWithPop,
        tracksPopular: tracksWithHighPop,
        tracksUnchecked: tracksUnchecked,
      },
    });
  } catch (e: any) {
    console.error('Settings error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
