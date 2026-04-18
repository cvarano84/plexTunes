export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sanitizeBody } from '../_sanitize';

export async function GET() {
  try {
    const instances = await prisma.wledInstance.findMany({
      orderBy: [{ createdAt: 'asc' }],
    });
    return NextResponse.json({ instances });
  } catch (e: any) {
    console.error('WLED instances GET error:', e?.message);
    return NextResponse.json({ error: 'Failed to list WLED instances' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = sanitizeBody(body);
    if (!data.name || typeof data.name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!data.host || typeof data.host !== 'string') {
      return NextResponse.json({ error: 'Host is required' }, { status: 400 });
    }
    const created = await prisma.wledInstance.create({ data: data as any });
    return NextResponse.json({ instance: created });
  } catch (e: any) {
    console.error('WLED instances POST error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed to create WLED instance' }, { status: 500 });
  }
}
