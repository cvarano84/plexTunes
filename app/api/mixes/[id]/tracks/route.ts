export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const mix = await prisma.mix.findUnique({ where: { id: params.id } });
    if (!mix) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '25', 10);

    let allTracks: any[] = [];

    // Get tracks from stations
    if (mix.stationIds?.length > 0) {
      const stations = await prisma.station.findMany({
        where: { id: { in: mix.stationIds }, isActive: true },
      });

      for (const station of stations) {
        const where: any = {};
        if (station.decade) {
          const startYear = parseInt(station.decade);
          where.year = { gte: startYear, lt: startYear + 10 };
        }
        if (station.genre) {
          where.genre = { contains: station.genre, mode: 'insensitive' };
        }
        if (station.minPopularity > 0) {
          where.popularity = { gte: station.minPopularity };
        }

        const tracks = await prisma.cachedTrack.findMany({
          where,
          include: {
            artist: { select: { name: true, thumb: true } },
            album: { select: { title: true, thumb: true, year: true } },
          },
          take: 200,
        });
        allTracks.push(...tracks);
      }
    }

    // Get tracks from emphasized artists
    if (mix.artistIds?.length > 0) {
      const artistWhere: any = { artistId: { in: mix.artistIds } };
      if (mix.popularOnly) {
        artistWhere.popularity = { gte: 1 };
      }
      const artistTracks = await prisma.cachedTrack.findMany({
        where: artistWhere,
        include: {
          artist: { select: { name: true, thumb: true } },
          album: { select: { title: true, thumb: true, year: true } },
        },
        take: 200,
      });
      // Add artist tracks with higher weight for emphasis
      allTracks.push(...artistTracks, ...artistTracks); // double weight
    }

    // Deduplicate and shuffle
    const seen = new Set<string>();
    const unique = allTracks.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    // Weighted shuffle
    const shuffled = unique.map(t => ({ ...t, sort: Math.random() }));
    shuffled.sort((a, b) => a.sort - b.sort);
    const selected = shuffled.slice(0, limit);

    return NextResponse.json({ mix, tracks: selected });
  } catch (e: any) {
    console.error('Mix tracks error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
