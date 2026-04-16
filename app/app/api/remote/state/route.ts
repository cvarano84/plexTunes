export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET: read current playback state (for mobile clients)
export async function GET() {
  try {
    const state = await prisma.nowPlayingState.findUnique({ where: { id: 'default' } });
    if (!state) return NextResponse.json({ state: null });
    try {
      return NextResponse.json({ state: JSON.parse(state.state), updatedAt: state.updatedAt });
    } catch {
      return NextResponse.json({ state: null });
    }
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// POST: update current playback state (from main jukebox)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await prisma.nowPlayingState.upsert({
      where: { id: 'default' },
      update: { state: JSON.stringify(body) },
      create: { id: 'default', state: JSON.stringify(body) },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
