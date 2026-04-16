export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Get similar artists using Last.fm API or LLM fallback
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const artistId = params?.id ?? '';
    const artist = await prisma.cachedArtist.findUnique({
      where: { id: artistId },
      select: { name: true },
    });
    if (!artist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Try Last.fm similar artists
    const lastfmKey = process.env.LASTFM_API_KEY ?? '';
    if (lastfmKey) {
      try {
        const res = await fetch(
          `https://ws.audioscrobbler.com/2.0/?method=artist.getsimilar&artist=${encodeURIComponent(artist.name)}&api_key=${lastfmKey}&format=json&limit=12`
        );
        if (res.ok) {
          const data = await res.json();
          const similar = (data?.similarartists?.artist ?? []).map((a: any) => a?.name).filter(Boolean);
          if (similar.length > 0) {
            // Match against our library
            const matched = await prisma.cachedArtist.findMany({
              where: { name: { in: similar, mode: 'insensitive' } },
              take: 10,
            });
            return NextResponse.json({ artists: matched, source: 'lastfm' });
          }
        }
      } catch { /* Last.fm failed */ }
    }

    // Fallback: use LLM to suggest similar artists, then match against our library
    const apiKey = process.env.ABACUSAI_API_KEY;
    if (apiKey) {
      try {
        const llmRes = await fetch('https://apps.abacus.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4.1-mini',
            messages: [{
              role: 'user',
              content: `List 15 musical artists similar to "${artist.name}". Return ONLY a JSON array of artist name strings. Example: ["Artist 1", "Artist 2"]`,
            }],
            max_tokens: 300,
            response_format: { type: 'json_object' },
          }),
        });
        if (llmRes.ok) {
          const data = await llmRes.json();
          const content = data?.choices?.[0]?.message?.content ?? '';
          let names: string[] = [];
          try {
            const parsed = JSON.parse(content);
            names = Array.isArray(parsed) ? parsed : (parsed?.artists ?? parsed?.similar ?? []);
          } catch { /* parse failed */ }
          if (names.length > 0) {
            const matched = await prisma.cachedArtist.findMany({
              where: { name: { in: names, mode: 'insensitive' } },
              take: 10,
            });
            return NextResponse.json({ artists: matched, source: 'llm' });
          }
        }
      } catch { /* LLM failed */ }
    }

    // Final fallback: same-genre artists from library
    const artistTracks = await prisma.cachedTrack.findMany({
      where: { artistId },
      select: { genre: true },
      take: 10,
    });
    const genres = [...new Set(artistTracks.map(t => t.genre).filter(Boolean))];
    if (genres.length > 0) {
      const sameGenre = await prisma.cachedArtist.findMany({
        where: {
          id: { not: artistId },
          cachedTracks: { some: { genre: { in: genres as string[] } } },
        },
        take: 10,
        orderBy: { name: 'asc' },
      });
      return NextResponse.json({ artists: sameGenre, source: 'genre' });
    }

    return NextResponse.json({ artists: [], source: 'none' });
  } catch (e: any) {
    console.error('Similar artists error:', e?.message);
    return NextResponse.json({ artists: [], error: 'Failed' }, { status: 500 });
  }
}
