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
 * Only the matrix output is touched here — the perimeter keeps whatever
 * ambient effect the user configured (only pushed on save/test).
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
    where: { enabled: true, matrixEnabled: true },
  }).catch(() => []);

  if (instances.length === 0) {
    return NextResponse.json({ ok: true, dispatched: 0 });
  }

  // Pre-compute a single random colour for this track so every panel stays
  // in sync when colorMode === 'random'.
  const sharedRandom = randomVibrantHex();

  const jobs = instances.map(async (inst) => {
    const text = formatTrackText(inst.matrixTextFormat, tokens);
    const color = inst.matrixColorMode === 'random' ? sharedRandom : inst.matrixColor;
    const seg = buildMatrixSeg({
      segmentId: inst.matrixSegmentId,
      text,
      effectId: inst.matrixEffectId,
      color,
      speed: inst.matrixSpeed,
      intensity: inst.matrixIntensity,
    });
    try {
      await postState(inst.host, {
        on: true,
        bri: inst.brightnessCap,
        seg: [seg],
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
