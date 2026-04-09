export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const q = searchParams?.get?.('q') ?? '';

    if (!q || q?.length < 2) {
      return NextResponse.json({ artists: [], albums: [], tracks: [] });
    }

    const [artists, albums, tracks] = await Promise.all([
      prisma.cachedArtist.findMany({
        where: { name: { contains: q, mode: 'insensitive' } },
        take: 5,
      }),
      prisma.cachedAlbum.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        take: 5,
        include: { artist: { select: { name: true } } },
      }),
      prisma.cachedTrack.findMany({
        where: { title: { contains: q, mode: 'insensitive' } },
        take: 10,
        orderBy: { popularity: 'desc' },
        include: {
          artist: { select: { name: true } },
          album: { select: { title: true, thumb: true } },
        },
      }),
    ]);

    return NextResponse.json({
      artists: artists ?? [],
      albums: albums ?? [],
      tracks: tracks ?? [],
    });
  } catch (e: any) {
    console.error('Search error:', e?.message);
    return NextResponse.json({ artists: [], albums: [], tracks: [] });
  }
}
