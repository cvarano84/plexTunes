export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sanitizeBody } from '../../_sanitize';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const instance = await prisma.wledInstance.findUnique({ where: { id: params.id } });
    if (!instance) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ instance });
  } catch (e: any) {
    console.error('WLED instance GET error:', e?.message);
    return NextResponse.json({ error: 'Failed to fetch WLED instance' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const data = sanitizeBody(body);
    const updated = await prisma.wledInstance.update({
      where: { id: params.id },
      data: data as any,
    });
    return NextResponse.json({ instance: updated });
  } catch (e: any) {
    console.error('WLED instance PATCH error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.wledInstance.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('WLED instance DELETE error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed to delete' }, { status: 500 });
  }
}
