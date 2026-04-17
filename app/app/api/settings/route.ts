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
    const lastfmConfigured = !!(process.env.LASTFM_API_KEY ?? '');

    // Check Spotify status with actual search test
    let spotifyStatus: { working: boolean; error?: string; disabled?: boolean } = { working: false };
    if (spotifyConfigured) {
      try {
        const { checkSpotifyStatus } = await import('@/lib/spotify');
        spotifyStatus = await checkSpotifyStatus();
      } catch (e: any) {
        spotifyStatus = { working: false, error: e?.message };
      }
    }

    const tracksWithPop = await prisma.cachedTrack.count({ where: { spotifyChecked: true } });
    const tracksWithHighPop = await prisma.cachedTrack.count({ where: { popularity: { gt: 0 } } });
    const tracksUnchecked = await prisma.cachedTrack.count({ where: { spotifyChecked: false } });

    return NextResponse.json({
      plex: {
        configured: !!plexConfig,
        serverUrl: plexConfig?.serverUrl ?? null,
        // Multi-backend: expose the active server type and label for the diagnostics UI.
        serverType: (plexConfig as any)?.serverType ?? 'plex',
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
        working: spotifyStatus.working,
        error: spotifyStatus.error,
        disabled: spotifyStatus.disabled,
        tracksChecked: tracksWithPop,
        tracksPopular: tracksWithHighPop,
        tracksUnchecked: tracksUnchecked,
        lastfmConfigured,
      },
    });
  } catch (e: any) {
    console.error('Settings error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}
