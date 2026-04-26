export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  postState,
  buildMatrixSeg,
  buildPerimeterSeg,
  formatTrackText,
  randomVibrantHex,
} from '@/lib/wled';

type PlaylistStep = {
  effectId: number;
  duration: number;
  text?: string;
  paletteId?: number;
  color?: string;
  speed?: number;
  intensity?: number;
};

function safeParsePlaylist(json: string | null): PlaylistStep[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/**
 * Fan out a track-change update to every enabled WLED instance.
 *
 * For outputs with a non-empty playlist, we reset the cycle timer and push
 * the first step. For outputs without a playlist, we use the single-effect
 * config (matrix outputs get scrolling text, strip outputs are skipped so
 * their ambient effect keeps running).
 *
 * Body: { title?, artist?, album?, station?, trackId? }
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

  const sharedRandom = randomVibrantHex();
  const now = new Date();

  const jobs = instances.map(async (inst) => {
    const matrixPl = safeParsePlaylist(inst.matrixPlaylist);
    const perimPl = safeParsePlaylist(inst.perimeterPlaylist);
    const hasAnyPlaylist = matrixPl.length > 0 || perimPl.length > 0;

    // Reset playlist cycle on every track change
    if (hasAnyPlaylist) {
      await prisma.wledInstance.update({
        where: { id: inst.id },
        data: { playlistCycleStart: now },
      }).catch(() => {});
    }

    const segs: any[] = [];

    // ---- Output 1 ----
    if (inst.matrixEnabled) {
      if (matrixPl.length > 0) {
        // Push first step of playlist
        const step = matrixPl[0];
        segs.push(buildStepSeg(step, {
          segmentId: inst.matrixSegmentId,
          fallbackColor: inst.matrixColor,
          fallbackColorMode: inst.matrixColorMode,
          fallbackTextFormat: inst.matrixTextFormat,
          sharedRandom, tokens,
        }));
      } else if (inst.matrixOutputType === 'matrix') {
        // Single-effect matrix mode
        const text = formatTrackText(inst.matrixTextFormat, tokens);
        const color = inst.matrixColorMode === 'random' ? sharedRandom : inst.matrixColor;
        segs.push(buildMatrixSeg({
          segmentId: inst.matrixSegmentId, text,
          effectId: inst.matrixEffectId, color,
          speed: inst.matrixSpeed, intensity: inst.matrixIntensity,
        }));
      }
      // strip without playlist = skip (keep ambient)
    }

    // ---- Output 2 ----
    if (inst.perimeterEnabled) {
      if (perimPl.length > 0) {
        const step = perimPl[0];
        segs.push(buildStepSeg(step, {
          segmentId: inst.perimeterSegmentId,
          fallbackColor: inst.perimeterColor,
          fallbackColorMode: inst.perimeterColorMode,
          fallbackTextFormat: inst.perimeterTextFormat,
          sharedRandom, tokens,
        }));
      } else if (inst.perimeterOutputType === 'matrix') {
        const text = formatTrackText(inst.perimeterTextFormat, tokens);
        const color = inst.perimeterColorMode === 'random' ? sharedRandom : inst.perimeterColor;
        segs.push(buildMatrixSeg({
          segmentId: inst.perimeterSegmentId, text,
          effectId: inst.perimeterEffectId, color,
          speed: inst.perimeterSpeed, intensity: inst.perimeterIntensity,
        }));
      }
    }

    if (segs.length === 0) {
      return { id: inst.id, ok: true, skipped: true };
    }

    try {
      await postState(inst.host, {
        on: true, bri: inst.brightnessCap, seg: segs,
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
    ok: true, dispatched: instances.length, color: sharedRandom, details,
  });
}

function buildStepSeg(
  step: PlaylistStep,
  ctx: {
    segmentId: number;
    fallbackColor: string;
    fallbackColorMode: string;
    fallbackTextFormat: string;
    sharedRandom: string;
    tokens: { title: string; artist: string; album: string; station: string };
  },
) {
  const color = step.color ?? (ctx.fallbackColorMode === 'random' ? ctx.sharedRandom : ctx.fallbackColor);
  const speed = step.speed ?? 128;
  const intensity = step.intensity ?? 128;

  if (step.text !== undefined) {
    const text = formatTrackText(step.text, ctx.tokens);
    return buildMatrixSeg({
      segmentId: ctx.segmentId, text,
      effectId: step.effectId, color, speed, intensity,
    });
  }

  return buildPerimeterSeg({
    segmentId: ctx.segmentId,
    effectId: step.effectId, color,
    paletteId: step.paletteId ?? 0, speed, intensity,
  });
}
