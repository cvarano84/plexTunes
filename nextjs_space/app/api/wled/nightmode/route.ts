export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { postState } from '@/lib/wled';

/**
 * POST /api/wled/nightmode
 * Body: { on: boolean }
 * Turns all enabled WLED instances on or off for night mode.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const on = !!body?.on;
    const instances = await prisma.wledInstance.findMany({ where: { enabled: true } });
    const results: { id: string; ok: boolean; error?: string }[] = [];
    for (const inst of instances) {
      try {
        await postState(inst.host, { on });
        results.push({ id: inst.id, ok: true });
      } catch (e: any) {
        results.push({ id: inst.id, ok: false, error: e?.message });
      }
    }
    return NextResponse.json({ success: true, on, results });
  } catch (e: any) {
    console.error('WLED nightmode error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed' }, { status: 500 });
  }
}
