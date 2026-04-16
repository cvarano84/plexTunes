export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const albumId = params?.id ?? '';

    const album = await prisma.cachedAlbum.findUnique({
      where: { id: albumId },
      include: {
        artist: true,
        cachedTracks: {
          orderBy: { trackNumber: 'asc' },
        },
      },
    });

    if (!album) {
      return NextResponse.json({ error: 'Album not found' }, { status: 404 });
    }

    return NextResponse.json({ album });
  } catch (e: any) {
    console.error('Album detail error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch album' }, { status: 500 });
  }
}
