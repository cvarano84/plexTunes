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
        cachedTracks: {
          orderBy: popularOnly ? { popularity: 'desc' } : { trackNumber: 'asc' },
          take: popularOnly ? 20 : undefined,
        },
      },
    });

    if (!artist) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    return NextResponse.json({ artist });
  } catch (e: any) {
    console.error('Artist detail error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch artist' }, { status: 500 });
  }
}
