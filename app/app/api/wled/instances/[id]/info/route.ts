export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFullJson } from '@/lib/wled';

/**
 * Proxy /json from the WLED device so the settings UI can populate effect /
 * palette dropdowns, detect whether a 2D matrix is configured, and verify
 * reachability. Updates lastSeenAt / lastError for the row.
 */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const inst = await prisma.wledInstance.findUnique({ where: { id: params.id } }).catch(() => null);
  if (!inst) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Allow an optional ?host= query override to probe a host before saving it.
  const host = req.nextUrl.searchParams.get('host') || inst.host;

  try {
    const full = await getFullJson(host, 3500);
    await prisma.wledInstance.update({
      where: { id: inst.id },
      data: { lastSeenAt: new Date(), lastError: null },
    }).catch(() => {});
    const matrix = full.info?.leds?.matrix;
    const is2d = !!(matrix && (matrix.w ?? 0) > 0 && (matrix.h ?? 0) > 0);
    return NextResponse.json({
      online: true,
      host,
      version: full.info?.ver ?? null,
      name: full.info?.name ?? null,
      ledCount: full.info?.leds?.count ?? null,
      is2d,
      matrix: matrix ?? null,
      effects: full.effects ?? [],
      palettes: full.palettes ?? [],
      state: full.state ?? null,
    });
  } catch (e: any) {
    const msg = e?.name === 'AbortError' ? 'Timed out' : (e?.message ?? 'Unreachable');
    await prisma.wledInstance.update({
      where: { id: inst.id },
      data: { lastError: msg },
    }).catch(() => {});
    return NextResponse.json({ online: false, host, error: msg }, { status: 200 });
  }
}
