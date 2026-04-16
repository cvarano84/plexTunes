export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { testProvider, type PopularityProvider } from '@/lib/spotify';
import { testGeniusConnection } from '@/lib/genius';

export async function POST(req: NextRequest) {
  try {
    const body = await req?.json?.().catch(() => ({}));
    const provider = body?.provider ?? '';
    const type = body?.type ?? 'popularity'; // 'popularity' or 'lyrics'

    if (type === 'lyrics') {
      if (provider === 'genius') {
        const result = await testGeniusConnection();
        return NextResponse.json({
          provider: 'genius',
          type: 'lyrics',
          working: result.connected,
          error: result.error,
          configured: !!(process.env.GENIUS_ACCESS_TOKEN),
        });
      }
      if (provider === 'lrclib') {
        try {
          const res = await fetch(
            'https://lrclib.net/api/search?track_name=Bohemian+Rhapsody&artist_name=Queen',
            { headers: { 'User-Agent': 'PlexJukebox/1.0' } }
          );
          const data = await res.json();
          const hasSynced = Array.isArray(data) && data.some((r: any) => r?.syncedLyrics);
          const hasPlain = Array.isArray(data) && data.length > 0;
          return NextResponse.json({
            provider: 'lrclib',
            type: 'lyrics',
            working: hasPlain,
            synced: hasSynced,
            configured: true, // no config needed
            resultCount: Array.isArray(data) ? data.length : 0,
          });
        } catch (e: any) {
          return NextResponse.json({
            provider: 'lrclib',
            type: 'lyrics',
            working: false,
            error: e?.message ?? 'Connection failed',
            configured: true,
          });
        }
      }
      return NextResponse.json({ error: 'Unknown lyrics provider' }, { status: 400 });
    }

    // Popularity provider test
    if (!['spotify', 'lastfm', 'deezer'].includes(provider)) {
      return NextResponse.json({ error: 'Unknown provider' }, { status: 400 });
    }

    const result = await testProvider(provider as PopularityProvider);
    return NextResponse.json({
      provider,
      type: 'popularity',
      ...result,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'Test failed' }, { status: 500 });
  }
}
