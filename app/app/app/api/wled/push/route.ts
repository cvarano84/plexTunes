export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  postState,
  buildMatrixSeg,
  formatTrackText,
  randomVibrantHex,
} from '@/lib/wled';

/**
 * Fan out a track-change update to every enabled WLED instance.
 *
 * For each enabled output whose outputType === 'matrix', we push a scrolling
 * text segment. Outputs configured as 'strip' keep whatever ambient effect
 * the user picked (they only get updated on save/test, not per track).
 *
 * Body: { title?, artist?, album?, station?, trackId? }
 * Non-blocking: uses Promise.allSettled + per-unit timeouts.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const tokens = {
    title:   typeof body.title   === 'string' ? body.title   : '',
    artist:  typeof body.artist  === 'string' ? body.artist  : '',
    album:   typeof body.album   === 'string' ? body.album   : '',
    station: typeof body.station === 'string' ? body.station : '',
  };

  const instances = await prisma.wledInstance.findMany({
    where: { enabled: true },
  }).catch(() => []);

  if (instances.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  // Pre-compute a single random colour for this track so every panel stays
  // in sync when colorMode === 'random'.
  const sharedRandom = randomVibrantHex();

  const jobs = instances.map(async (inst) => {
    // Build one matrix segment per output that is (a) enabled and (b) set
    // to 'matrix' type. Outputs set to 'strip' are intentionally skipped so
    // the user's ambient pattern keeps running.
    const segs: any[] = [];

    if (inst.matrixEnabled && inst.matrixOutputType === 'matrix') {
      const text = formatTrackText(inst.matrixTextFormat, tokens);
      const color = inst.matrixColorMode === 'random' ? sharedRandom : inst.matrixColor;
      segs.push(buildMatrixSeg({
        segmentId: inst.matrixSegmentId,
        text,
        effectId: inst.matrixEffectId,
        color,
        speed: inst.matrixSpeed,
        intensity: inst.matrixIntensity,
      }));
    }

    if (inst.perimeterEnabled && inst.perimeterOutputType === 'matrix') {
      const text = formatTrackText(inst.perimeterTextFormat, tokens);
      const color = inst.perimeterColorMode === 'random' ? sharedRandom : inst.perimeterColor;
      segs.push(buildMatrixSeg({
        segmentId: inst.perimeterSegmentId,
        text,
        effectId: inst.perimeterEffectId,
        color,
        speed: inst.perimeterSpeed,
        intensity: inst.perimeterIntensity,
      }));
    }

    if (segs.length === 0) {
      return { id: inst.id, ok: true, skipped: true };
    }

    try {
      await postState(inst.host, {
        on: true,
        bri: inst.brightnessCap,
        seg: segs,
      }, 3000);
      await prisma.wledInstance.update({
        where: { id: inst.id },
        data: { lastSeenAt: new Date(), lastError: null },
      }).catch(() => {});
      return { id: inst.id, ok: true };
    } catch (e: any) {
      const msg = e?.name === 'AbortError' ? 'Timed out' : (e?.message ?? 'Push failed');
      await prisma.wledInstance.update({
        where: { id: inst.id },
        data: { lastError: msg },
      }).catch(() => {});
      return { id: inst.id, ok: false, error: msg };
    }
  });

  const results = await Promise.allSettled(jobs);
  const details = results.map((r) =>
    r.status === 'fulfilled' ? r.value : { ok: false, error: 'rejected' }
  );

  return NextResponse.json({
    ok: true,
    dispatched: instances.length,
    color: sharedRandom,
    details,
  });
}
