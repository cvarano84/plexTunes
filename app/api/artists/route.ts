export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const search = searchParams?.get?.('search') ?? '';
    const page = parseInt(searchParams?.get?.('page') ?? '1', 10);
    const limit = parseInt(searchParams?.get?.('limit') ?? '50', 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const [artists, total] = await Promise.all([
      prisma.cachedArtist.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          _count: { select: { cachedTracks: true, cachedAlbums: true } },
        },
      }),
      prisma.cachedArtist.count({ where }),
    ]);

    return NextResponse.json({
      artists: artists ?? [],
      total: total ?? 0,
      page,
      totalPages: Math.ceil((total ?? 0) / limit),
    });
  } catch (e: any) {
    console.error('Artists error:', e?.message);
    return NextResponse.json({ artists: [], total: 0 }, { status: 500 });
  }
}
