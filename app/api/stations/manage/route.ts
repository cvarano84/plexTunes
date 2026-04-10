export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const VALID_DECADES = ['1950s','1960s','1970s','1980s','1990s','2000s','2010s','2020s'];
const VALID_GENRES = ['Rock','Pop','Dance','Hip-Hop','R&B','Country','New Wave','Soul'];

// Create a new station
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, decade, genre, stationType, minPopularity } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const type = stationType || 'standard';

    // For "most-played" type, no decade/genre needed
    if (type === 'most-played') {
      // Check if one already exists
      const existing = await prisma.station.findFirst({
        where: { stationType: 'most-played' },
      });
      if (existing) {
        const updated = await prisma.station.update({
          where: { id: existing.id },
          data: { name, description: description || existing.description, isActive: true },
        });
        return NextResponse.json({ station: updated, reactivated: true });
      }
      const station = await prisma.station.create({
        data: {
          name,
          description: description || 'Your most played tracks, shuffled',
          stationType: 'most-played',
          isActive: true,
        },
      });
      return NextResponse.json({ station });
    }

    // For "hits" type, genre is optional (null = all genres), decade is optional (null = all decades)
    if (type === 'hits') {
      if (genre && !VALID_GENRES.includes(genre)) {
        return NextResponse.json({ error: `Invalid genre. Must be one of: ${VALID_GENRES.join(', ')}` }, { status: 400 });
      }
      if (decade && !VALID_DECADES.includes(decade)) {
        return NextResponse.json({ error: `Invalid decade. Must be one of: ${VALID_DECADES.join(', ')}` }, { status: 400 });
      }

      // Check for existing hits station with same decade+genre combo
      const existing = await prisma.station.findFirst({
        where: {
          stationType: 'hits',
          decade: decade || null,
          genre: genre || null,
        },
      });

      if (existing) {
        const updated = await prisma.station.update({
          where: { id: existing.id },
          data: { name, description: description || existing.description, isActive: true, minPopularity: minPopularity || 40 },
        });
        return NextResponse.json({ station: updated, reactivated: true });
      }

      const station = await prisma.station.create({
        data: {
          name,
          description: description || `The biggest ${genre ? genre + ' ' : ''}hits${decade ? ' from the ' + decade : ''}`,
          decade: decade || null,
          genre: genre || null,
          stationType: 'hits',
          minPopularity: minPopularity || 40,
          isActive: true,
        },
      });
      return NextResponse.json({ station });
    }

    // Standard station: requires both decade and genre
    if (!decade || !genre) {
      return NextResponse.json({ error: 'Standard stations require decade and genre' }, { status: 400 });
    }
    if (!VALID_DECADES.includes(decade)) {
      return NextResponse.json({ error: `Invalid decade. Must be one of: ${VALID_DECADES.join(', ')}` }, { status: 400 });
    }
    if (!VALID_GENRES.includes(genre)) {
      return NextResponse.json({ error: `Invalid genre. Must be one of: ${VALID_GENRES.join(', ')}` }, { status: 400 });
    }

    const existing = await prisma.station.findUnique({
      where: { decade_genre: { decade, genre } },
    });

    if (existing) {
      const updated = await prisma.station.update({
        where: { id: existing.id },
        data: { name, description: description || existing.description, isActive: true },
      });
      return NextResponse.json({ station: updated, reactivated: true });
    }

    const station = await prisma.station.create({
      data: { name, description: description || `${decade} ${genre} hits`, decade, genre, isActive: true },
    });

    return NextResponse.json({ station });
  } catch (e: any) {
    console.error('Station create error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed to create station' }, { status: 500 });
  }
}

// Delete (deactivate) a station
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Station ID is required' }, { status: 400 });
    }

    const station = await prisma.station.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ station });
  } catch (e: any) {
    console.error('Station delete error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed to delete station' }, { status: 500 });
  }
}