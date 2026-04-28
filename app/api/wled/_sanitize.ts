import { isValidHex, normalizeHost } from '@/lib/wled';

/** Fields a client is allowed to submit on create/update. */
const EDITABLE_FIELDS = [
  'name', 'host', 'enabled', 'brightnessCap',
  'matrixEnabled', 'matrixSegmentId', 'matrixOutputType',
  'matrixTextFormat', 'matrixColorMode', 'matrixColor',
  'matrixEffectId', 'matrixPaletteId', 'matrixSpeed', 'matrixIntensity',
  'matrixCustom1', 'matrixCustom2', 'matrixCustom3', 'matrixOption1',
  'perimeterEnabled', 'perimeterSegmentId', 'perimeterOutputType',
  'perimeterTextFormat', 'perimeterColorMode',
  'perimeterEffectId', 'perimeterColor', 'perimeterPaletteId',
  'perimeterSpeed', 'perimeterIntensity',
  'perimeterCustom1', 'perimeterCustom2', 'perimeterCustom3', 'perimeterOption1',
  'matrixPlaylist', 'perimeterPlaylist',
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
  if (out.perimeterColorMode !== undefined && !['fixed', 'random'].includes(out.perimeterColorMode)) delete out.perimeterColorMode;
  if (out.matrixOutputType !== undefined && !['matrix', 'strip'].includes(out.matrixOutputType)) delete out.matrixOutputType;
  if (out.perimeterOutputType !== undefined && !['matrix', 'strip'].includes(out.perimeterOutputType)) delete out.perimeterOutputType;
  const clampInt = (v: any, lo: number, hi: number) => {
    const n = parseInt(v, 10);
    if (isNaN(n)) return undefined;
    return Math.max(lo, Math.min(hi, n));
  };
  const intFields: Array<[string, number, number]> = [
    ['brightnessCap', 0, 255],
    ['matrixSegmentId', 0, 15], ['matrixEffectId', 0, 255],
    ['matrixPaletteId', 0, 71],
    ['matrixSpeed', 0, 255], ['matrixIntensity', 0, 255],
    ['matrixCustom1', 0, 255], ['matrixCustom2', 0, 255], ['matrixCustom3', 0, 255],
    ['perimeterSegmentId', 0, 15], ['perimeterEffectId', 0, 255],
    ['perimeterPaletteId', 0, 71], ['perimeterSpeed', 0, 255], ['perimeterIntensity', 0, 255],
    ['perimeterCustom1', 0, 255], ['perimeterCustom2', 0, 255], ['perimeterCustom3', 0, 255],
  ];
  for (const [f, lo, hi] of intFields) {
    if (out[f] !== undefined) {
      const v = clampInt(out[f], lo, hi);
      if (v === undefined) delete out[f]; else out[f] = v;
    }
  }
  for (const f of ['enabled', 'matrixEnabled', 'perimeterEnabled', 'matrixOption1', 'perimeterOption1']) {
    if (out[f] !== undefined) out[f] = !!out[f];
  }
  // Validate playlist JSON strings
  for (const f of ['matrixPlaylist', 'perimeterPlaylist']) {
    if (out[f] !== undefined) {
      if (typeof out[f] === 'string') {
        try {
          const arr = JSON.parse(out[f]);
          if (!Array.isArray(arr)) { delete out[f]; continue; }
          // Sanitize each step
          const clean = arr.map((s: any) => ({
            effectId: Math.max(0, Math.min(255, parseInt(s.effectId) || 0)),
            duration: Math.max(1, Math.min(600, parseInt(s.duration) || 10)),
            ...(typeof s.text === 'string' ? { text: s.text } : {}),
            ...(s.paletteId !== undefined ? { paletteId: Math.max(0, Math.min(71, parseInt(s.paletteId) || 0)) } : {}),
            ...(typeof s.color === 'string' && isValidHex(s.color) ? { color: s.color } : {}),
            ...(s.speed !== undefined ? { speed: Math.max(0, Math.min(255, parseInt(s.speed) || 128)) } : {}),
            ...(s.intensity !== undefined ? { intensity: Math.max(0, Math.min(255, parseInt(s.intensity) || 128)) } : {}),
            ...(s.custom1 !== undefined ? { custom1: Math.max(0, Math.min(255, parseInt(s.custom1) || 128)) } : {}),
            ...(s.custom2 !== undefined ? { custom2: Math.max(0, Math.min(255, parseInt(s.custom2) || 128)) } : {}),
            ...(s.custom3 !== undefined ? { custom3: Math.max(0, Math.min(255, parseInt(s.custom3) || 128)) } : {}),
            ...(s.option1 !== undefined ? { option1: !!s.option1 } : {}),
          }));
          out[f] = JSON.stringify(clean);
        } catch { delete out[f]; }
      } else {
        delete out[f];
      }
    }
  }
  return out;
}
