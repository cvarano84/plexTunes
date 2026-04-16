export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const [totalTracks, totalArtists, totalAlbums, withPopularity, withSummary, withBillboard, withLyrics, syncStatus] = await Promise.all([
      prisma.cachedTrack.count(),
      prisma.cachedArtist.count(),
      prisma.cachedAlbum.count(),
      prisma.cachedTrack.count({ where: { popularity: { not: null } } }),
      prisma.cachedTrack.count({ where: { summary: { not: null } } }),
      prisma.cachedTrack.count({ where: { billboardCheckedAt: { not: null } } }),
      // We don't cache lyrics in DB, but we track summaries as a proxy
      prisma.cachedTrack.count({ where: { summary: { not: null } } }),
      prisma.librarySyncStatus.findUnique({ where: { id: 'default' } }),
    ]);

    const withArtistBio = await prisma.cachedArtist.count({ where: { summary: { not: null } } });

    return NextResponse.json({
      library: {
        totalTracks,
        totalArtists,
        totalAlbums,
        lastSync: syncStatus?.lastSyncAt ?? null,
        syncInProgress: syncStatus?.syncInProgress ?? false,
      },
      metadata: {
        popularity: { filled: withPopularity, total: totalTracks, pct: totalTracks > 0 ? Math.round((withPopularity / totalTracks) * 100) : 0 },
        trackSummary: { filled: withSummary, total: totalTracks, pct: totalTracks > 0 ? Math.round((withSummary / totalTracks) * 100) : 0 },
        billboard: { filled: withBillboard, total: totalTracks, pct: totalTracks > 0 ? Math.round((withBillboard / totalTracks) * 100) : 0 },
        artistBio: { filled: withArtistBio, total: totalArtists, pct: totalArtists > 0 ? Math.round((withArtistBio / totalArtists) * 100) : 0 },
      },
    });
  } catch (e: any) {
    console.error('Metadata status error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
