export const dynamic = "force-dynamic";

import { NextResponse } from 'next/server';
import { getActiveAdapter } from '@/lib/media/factory';

export async function GET() {
  try {
    const ctx = await getActiveAdapter();
    if (!ctx) {
      return NextResponse.json({ error: 'Media server not configured' }, { status: 400 });
    }
    const sections = await ctx.adapter.getLibrarySections();
    // Preserve backward compat with the existing setup UI which reads `sections`.
    return NextResponse.json({ sections });
  } catch (e: any) {
    console.error('Library GET error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch libraries' }, { status: 500 });
  }
}
