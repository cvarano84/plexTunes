export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const artistId = params?.id ?? '';
    const searchParams = req?.nextUrl?.searchParams;
    const popularOnly = searchParams?.get?.('popular') !== 'false';

    const artist = await prisma.cachedArtist.findUnique({
      where: { id: artistId },
      include: {
        cachedAlbums: {
          orderBy: { year: 'desc' },
        },
        cachedTracks: popularOnly ? {
          orderBy: [{ popularity: 'desc' }, { playCount: 'desc' }, { title: 'asc' }],
          where: { OR: [{ popularity: { gt: 0 } }, { playCount: { gt: 0 } }, { billboardPeak: { not: null } }] },
          take: 30,
        } : {
          orderBy: [{ title: 'asc' }],
        },
      },
    });

    // If popular mode returned too few tracks (not enough with popularity data), supplement with remaining
    if (popularOnly && artist && (artist.cachedTracks?.length ?? 0) < 10) {
      const existingIds = new Set(artist.cachedTracks.map(t => t.id));
      const moreTracks = await prisma.cachedTrack.findMany({
        where: { artistId, id: { notIn: [...existingIds] } },
        orderBy: [{ playCount: 'desc' }, { title: 'asc' }],
        take: 20 - (artist.cachedTracks?.length ?? 0),
      });
      artist.cachedTracks = [...artist.cachedTracks, ...moreTracks];
    }

    // Deduplicate tracks by title — same song on multiple albums should appear once.
    // Keep the version with highest popularity/playCount.
    if (artist && popularOnly) {
      const seen = new Map<string, typeof artist.cachedTracks[0]>();
      for (const t of artist.cachedTracks) {
        const key = (t.title ?? '').toLowerCase().replace(/\s*\(.*?\)\s*/g, '').trim();
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, t);
        } else {
          const existPop = (existing.popularity ?? 0) + (existing.playCount ?? 0);
          const newPop = (t.popularity ?? 0) + (t.playCount ?? 0);
          if (newPop > existPop) seen.set(key, t);
        }
      }
      artist.cachedTracks = [...seen.values()];
    }

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    return NextResponse.json({ artist });
  } catch (e: any) {
    console.error('Artist detail error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch artist' }, { status: 500 });
  }
}
