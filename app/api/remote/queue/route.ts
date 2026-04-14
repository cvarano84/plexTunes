export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET: fetch unprocessed queue additions (polled by main jukebox)
export async function GET() {
  try {
    const actions = await prisma.remoteAction.findMany({
      where: { processed: false },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });
    // Mark them as processed
    if (actions.length > 0) {
      await prisma.remoteAction.updateMany({
        where: { id: { in: actions.map(a => a.id) } },
        data: { processed: true },
      });
    }
    const parsed = actions.map(a => {
      try { return { ...a, payload: JSON.parse(a.payload) }; } catch { return a; }
    });
    return NextResponse.json({ actions: parsed });
  } catch (e: any) {
    return NextResponse.json({ actions: [], error: 'Failed' }, { status: 500 });
  }
}

// POST: add a track to the queue (from mobile clients)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await prisma.remoteAction.create({
      data: {
        type: body?.type ?? 'add_to_queue',
        payload: JSON.stringify(body?.track ?? body),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// DELETE: clean up old processed actions
export async function DELETE() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.remoteAction.deleteMany({
      where: { processed: true, createdAt: { lt: cutoff } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
