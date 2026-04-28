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
  duration: number; // seconds
  text?: string; // template like {title} or literal
  paletteId?: number;
  color?: string;
  speed?: number;
  intensity?: number;
  custom1?: number;
  custom2?: number;
  custom3?: number;
  option1?: boolean;
};

/**
 * Resolve which step in a playlist we should be showing right now.
 * Returns null if the playlist is empty (single-effect mode).
 */
function resolveStep(playlist: PlaylistStep[], cycleStart: Date | null): PlaylistStep | null {
  if (!playlist.length || !cycleStart) return null;
  const elapsed = (Date.now() - cycleStart.getTime()) / 1000;
  const totalCycle = playlist.reduce((s, p) => s + p.duration, 0);
  if (totalCycle <= 0) return null;
  let pos = elapsed % totalCycle;
  for (const step of playlist) {
    if (pos < step.duration) return step;
    pos -= step.duration;
  }
  return playlist[0]; // shouldn't happen but safe fallback
}

/**
 * Called periodically by the client (~every 5s) to advance effect playlists.
 * For each enabled instance with a non-empty playlist, resolves the current
 * step and pushes the appropriate segment.
 *
 * Body: { title?, artist?, album?, station? }
 *   - track tokens are needed so text steps can display the current song info
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

  const sharedRandom = randomVibrantHex();
  let pushed = 0;

  const jobs = instances.map(async (inst) => {
    const matrixPl: PlaylistStep[] = safeParsePlaylist(inst.matrixPlaylist);
    const perimPl: PlaylistStep[] = safeParsePlaylist(inst.perimeterPlaylist);

    // Skip instances with no playlists at all (handled by /push on track change)
    if (!matrixPl.length && !perimPl.length) return;

    const segs: any[] = [];

    // Output 1
    if (inst.matrixEnabled && matrixPl.length) {
      const step = resolveStep(matrixPl, inst.playlistCycleStart);
      if (step) {
        segs.push(buildSegFromStep(step, {
          segmentId: inst.matrixSegmentId,
          outputType: inst.matrixOutputType,
          fallbackColor: inst.matrixColor,
          fallbackColorMode: inst.matrixColorMode,
          fallbackTextFormat: inst.matrixTextFormat,
          sharedRandom,
          tokens,
        }));
      }
    }

    // Output 2
    if (inst.perimeterEnabled && perimPl.length) {
      const step = resolveStep(perimPl, inst.playlistCycleStart);
      if (step) {
        segs.push(buildSegFromStep(step, {
          segmentId: inst.perimeterSegmentId,
          outputType: inst.perimeterOutputType,
          fallbackColor: inst.perimeterColor,
          fallbackColorMode: inst.perimeterColorMode,
          fallbackTextFormat: inst.perimeterTextFormat,
          sharedRandom,
          tokens,
        }));
      }
    }

    if (!segs.length) return;

    try {
      await postState(inst.host, { on: true, bri: inst.brightnessCap, seg: segs }, 3000);
      pushed++;
    } catch { /* non-critical */ }
  });

  await Promise.allSettled(jobs);
  return NextResponse.json({ ok: true, pushed });
}

function safeParsePlaylist(json: string | null): PlaylistStep[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}

/**
 * Build the right WLED segment for a playlist step.
 * If the step has `text` (template or literal), it's a matrix/text step.
 * Otherwise it's an effect-only step (uses buildPerimeterSeg for palette/effect).
 */
function buildSegFromStep(
  step: PlaylistStep,
  ctx: {
    segmentId: number;
    outputType: string;
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

  // If step has text, it's a scrolling text step (needs effect 122 - Scrolling Text)
  if (step.text !== undefined) {
    const text = formatTrackText(step.text, ctx.tokens);
    return buildMatrixSeg({
      segmentId: ctx.segmentId,
      text,
      effectId: step.effectId,
      color,
      speed,
      intensity,
      custom1: step.custom1, custom2: step.custom2,
      custom3: step.custom3, option1: step.option1,
    });
  }

  // Otherwise it's a pure effect step
  return buildPerimeterSeg({
    segmentId: ctx.segmentId,
    effectId: step.effectId,
    color,
    paletteId: step.paletteId ?? 0,
    speed,
    intensity,
  });
}
