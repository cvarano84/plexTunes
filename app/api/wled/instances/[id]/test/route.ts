export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { postState, buildMatrixSeg, buildPerimeterSeg, formatTrackText } from '@/lib/wled';

/**
 * Push a preview to the WLED unit so the user can confirm config is correct.
 *
 * For each output, branches on outputType:
 *   - matrix: scrolling text preview using that output's textFormat/color
 *   - strip : ambient effect + palette for traditional LED strips
 *
 * Body can optionally include { text } to override the preview text.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const inst = await prisma.wledInstance.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const overrideText: string | undefined = typeof body?.text === 'string' ? body.text : undefined;

  const buildText = (format: string) => overrideText ?? formatTrackText(format, {
    title: 'NOW PLAYING',
    artist: inst.name,
    album: '',
    station: '',
  });

  const segs: any[] = [];

  // ---- Output 1 ----
  if (inst.matrixEnabled) {
    if (inst.matrixOutputType === 'matrix') {
      segs.push(buildMatrixSeg({
        segmentId: inst.matrixSegmentId,
        text: buildText(inst.matrixTextFormat),
        effectId: inst.matrixEffectId,
        color: inst.matrixColor,
        speed: inst.matrixSpeed,
        intensity: inst.matrixIntensity,
      }));
    } else {
      // 'strip': treat Output 1 as ambient LED strip
      segs.push(buildPerimeterSeg({
        segmentId: inst.matrixSegmentId,
        effectId: inst.matrixEffectId,
        color: inst.matrixColor,
        paletteId: inst.matrixPaletteId,
        speed: inst.matrixSpeed,
        intensity: inst.matrixIntensity,
      }));
    }
  }

  // ---- Output 2 ----
  if (inst.perimeterEnabled) {
    if (inst.perimeterOutputType === 'matrix') {
      segs.push(buildMatrixSeg({
        segmentId: inst.perimeterSegmentId,
        text: buildText(inst.perimeterTextFormat),
        effectId: inst.perimeterEffectId,
        color: inst.perimeterColor,
        speed: inst.perimeterSpeed,
        intensity: inst.perimeterIntensity,
      }));
    } else {
      // 'strip' (default for Output 2): ambient LED strip
      segs.push(buildPerimeterSeg({
        segmentId: inst.perimeterSegmentId,
        effectId: inst.perimeterEffectId,
        color: inst.perimeterColor,
        paletteId: inst.perimeterPaletteId,
        speed: inst.perimeterSpeed,
        intensity: inst.perimeterIntensity,
      }));
    }
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
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Timed out' : (e?.message ?? 'Push failed');
    await prisma.wledInstance.update({
      where: { id: inst.id },
      data: { lastError: msg },
    }).catch(() => {});
    return NextResponse.json({ ok: false, error: msg }, { status: 200 });
  }
}
