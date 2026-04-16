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
          orderBy: [{ trackNumber: 'asc' }],
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

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    return NextResponse.json({ artist });
  } catch (e: any) {
    console.error('Artist detail error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch artist' }, { status: 500 });
  }
}
