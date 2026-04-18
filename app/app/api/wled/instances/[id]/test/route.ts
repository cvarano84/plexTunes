export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { postState, buildMatrixSeg, buildPerimeterSeg, formatTrackText } from '@/lib/wled';

/**
 * Push a preview to the WLED unit so the user can confirm config is correct.
 * Body can optionally include { text } to override the preview text.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const inst = await prisma.wledInstance.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const text: string = body?.text ?? formatTrackText(inst.matrixTextFormat, {
    title: 'NOW PLAYING',
    artist: inst.name,
    album: '',
    station: '',
  });

  const segs: any[] = [];
  if (inst.matrixEnabled) {
    segs.push(buildMatrixSeg({
      segmentId: inst.matrixSegmentId,
      text,
      effectId: inst.matrixEffectId,
      color: inst.matrixColor,
      speed: inst.matrixSpeed,
      intensity: inst.matrixIntensity,
    }));
  }
  if (inst.perimeterEnabled) {
    segs.push(buildPerimeterSeg({
      segmentId: inst.perimeterSegmentId,
      effectId: inst.perimeterEffectId,
      color: inst.perimeterColor,
      paletteId: inst.perimeterPaletteId,
      speed: inst.perimeterSpeed,
      intensity: inst.perimeterIntensity,
    }));
  }

  if (segs.length === 0) {
    return NextResponse.json({ error: 'Both outputs are disabled - enable at least one.' }, { status: 400 });
  }

  try {
    await postState(inst.host, {
      on: true,
      bri: inst.brightnessCap,
      seg: segs,
    }, 3500);
    await prisma.wledInstance.update({
      where: { id: inst.id },
      data: { lastSeenAt: new Date(), lastError: null },
    }).catch(() => {});
    return NextResponse.json({ ok: true, text });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Timed out' : (e?.message ?? 'Push failed');
    await prisma.wledInstance.update({
      where: { id: inst.id },
      data: { lastError: msg },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
