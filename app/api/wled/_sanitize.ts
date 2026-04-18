import { isValidHex, normalizeHost } from '@/lib/wled';

/** Fields a client is allowed to submit on create/update. */
const EDITABLE_FIELDS = [
  'name', 'host', 'enabled', 'brightnessCap',
  'matrixEnabled', 'matrixSegmentId', 'matrixTextFormat', 'matrixColorMode',
  'matrixColor', 'matrixEffectId', 'matrixSpeed', 'matrixIntensity',
  'perimeterEnabled', 'perimeterSegmentId', 'perimeterEffectId', 'perimeterColor',
  'perimeterPaletteId', 'perimeterSpeed', 'perimeterIntensity',
] as const;

export function sanitizeBody(body: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of EDITABLE_FIELDS) {
    if (body[k] === undefined) continue;
    out[k] = body[k];
  }
  if (out.host !== undefined) out.host = normalizeHost(out.host);
  if (out.matrixColor !== undefined && !isValidHex(out.matrixColor)) delete out.matrixColor;
  if (out.perimeterColor !== undefined && !isValidHex(out.perimeterColor)) delete out.perimeterColor;
  if (out.matrixColorMode !== undefined && !['fixed', 'random'].includes(out.matrixColorMode)) delete out.matrixColorMode;
  const clampInt = (v: any, lo: number, hi: number) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return undefined;
    return Math.max(lo, Math.min(hi, n));
  };
  const intFields: Array<[string, number, number]> = [
    ['brightnessCap', 0, 255],
    ['matrixSegmentId', 0, 15], ['matrixEffectId', 0, 255],
    ['matrixSpeed', 0, 255], ['matrixIntensity', 0, 255],
    ['perimeterSegmentId', 0, 15], ['perimeterEffectId', 0, 255],
    ['perimeterPaletteId', 0, 71], ['perimeterSpeed', 0, 255], ['perimeterIntensity', 0, 255],
  ];
  for (const [f, lo, hi] of intFields) {
    if (out[f] !== undefined) {
      const v = clampInt(out[f], lo, hi);
      if (v === undefined) delete out[f]; else out[f] = v;
    }
  }
  for (const f of ['enabled', 'matrixEnabled', 'perimeterEnabled']) {
    if (out[f] !== undefined) out[f] = !!out[f];
  }
  return out;
}
