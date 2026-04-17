export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { buildAdapter } from '@/lib/media/factory';
import type { MediaServerType } from '@/lib/media/types';

/**
 * Unified config endpoint for all backends.
 * Accepts { serverType, serverUrl, token, username? } and persists after validating.
 *
 * Backward compatibility: if `serverType` is missing it defaults to 'plex' so
 * existing clients continue to work unchanged.
 */

export async function GET() {
  try {
    const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ configured: false });
    }
    return NextResponse.json({
      configured: true,
      serverType: (config as any).serverType ?? 'plex',
      serverUrl: config?.serverUrl ?? '',
      username: (config as any).username ?? null,
      libraryId: (config as any).libraryId ?? null,
    });
  } catch (e: any) {
    console.error('Config GET error:', e?.message);
    return NextResponse.json({ configured: false });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req?.json?.();
    const serverType = ((body?.serverType ?? 'plex') as MediaServerType);
    const serverUrl = (body?.serverUrl ?? '').replace(/\/+$/, '');
    const token = body?.token ?? '';
    const username: string | null = body?.username ?? null;

    if (!['plex', 'jellyfin', 'subsonic'].includes(serverType)) {
      return NextResponse.json({ error: 'Unsupported server type' }, { status: 400 });
    }
    if (!serverUrl || !token) {
      return NextResponse.json({ error: 'Server URL and credentials are required' }, { status: 400 });
    }
    if (serverType === 'subsonic' && !username) {
      return NextResponse.json({ error: 'Username is required for Subsonic' }, { status: 400 });
    }

    // Build adapter and test connection before persisting.
    const adapter = buildAdapter({ serverType, serverUrl, token, username });
    const isValid = await adapter.testConnection();
    if (!isValid) {
      const labels: Record<MediaServerType, string> = {
        plex: 'Plex server',
        jellyfin: 'Jellyfin server',
        subsonic: 'Subsonic server',
      };
      return NextResponse.json(
        { error: `Could not connect to ${labels[serverType]}. Check URL and credentials.` },
        { status: 400 },
      );
    }

    await prisma.plexConfig.upsert({
      where: { id: 'default' },
      update: { serverType, serverUrl, token, username, libraryId: null },
      create: { id: 'default', serverType, serverUrl, token, username, libraryId: null },
    });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Config POST error:', e?.message);
    return NextResponse.json({ error: e?.message ?? 'Failed to save configuration' }, { status: 500 });
  }
}
