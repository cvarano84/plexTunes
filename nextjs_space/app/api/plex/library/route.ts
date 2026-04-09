export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMusicLibrarySections } from '@/lib/plex';

export async function GET() {
  try {
    const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Plex not configured' }, { status: 400 });
    }

    const sections = await getMusicLibrarySections(config.serverUrl, config.token);
    return NextResponse.json({ sections });
  } catch (e: any) {
    console.error('Library GET error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch libraries' }, { status: 500 });
  }
}
