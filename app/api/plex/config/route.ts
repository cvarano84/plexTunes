export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { testPlexConnection } from '@/lib/plex';

export async function GET() {
  try {
    const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({
      configured: true,
      serverUrl: config?.serverUrl ?? '',
    });
  } catch (e: any) {
    console.error('Config GET error:', e?.message);
    return NextResponse.json({ configured: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req?.json?.();
    const serverUrl = (body?.serverUrl ?? '')?.replace?.(/\/+$/, '') ?? '';
    const token = body?.token ?? '';

    if (!serverUrl || !token) {
      return NextResponse.json({ error: 'Server URL and token are required' }, { status: 400 });
    }

    // Test connection
    const isValid = await testPlexConnection(serverUrl, token);
    if (!isValid) {
      return NextResponse.json({ error: 'Could not connect to Plex server. Check URL and token.' }, { status: 400 });
    }

    await prisma.plexConfig.upsert({
      where: { id: 'default' },
      update: { serverUrl, token },
      create: { id: 'default', serverUrl, token },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Config POST error:', e?.message);
    return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
  }
}
