export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { testGeniusConnection } from '@/lib/genius';

export async function GET() {
  try {
    // Get Plex config
    const plexConfig = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    
    // Get library stats
    const [artistCount, albumCount, trackCount, stationCount] = await Promise.all([
      prisma.cachedArtist.count(),
      prisma.cachedAlbum.count(),
      prisma.cachedTrack.count(),
      prisma.station.count({ where: { isActive: true } }),
    ]);

    // Get sync status
    const syncStatus = await prisma.librarySyncStatus.findUnique({ where: { id: 'default' } });

    // Test Genius
    const geniusStatus = await testGeniusConnection();

    // Spotify config
    const spotifyConfigured = !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);

    // Tracks with popularity
    const tracksWithPop = await prisma.cachedTrack.count({ where: { spotifyChecked: true } });
    const tracksWithHighPop = await prisma.cachedTrack.count({ where: { popularity: { gte: 30 } } });

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
        tracksChecked: tracksWithPop,
        tracksPopular: tracksWithHighPop,
      },
    });
  } catch (e: any) {
    console.error('Settings error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'resync') {
      // Trigger a resync
      return NextResponse.json({ message: 'Use /api/plex/sync to resync' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
