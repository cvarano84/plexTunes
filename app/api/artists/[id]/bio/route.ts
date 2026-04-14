export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Fetch artist bio from Plex, Wikipedia via LLM, or cache
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const artistId = params?.id ?? '';
    const artist = await prisma.cachedArtist.findUnique({
      where: { id: artistId },
      select: { id: true, name: true, summary: true, ratingKey: true },
    });
    if (!artist) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Return cached bio if available
    if (artist.summary) {
      return NextResponse.json({ bio: artist.summary, cached: true });
    }

    // Try fetching from Plex first (artists have a summary field)
    try {
      const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
      if (config) {
        const res = await fetch(`${config.serverUrl}/library/metadata/${artist.ratingKey}?X-Plex-Token=${config.token}`, {
          headers: { Accept: 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const plexSummary = data?.MediaContainer?.Metadata?.[0]?.summary ?? '';
          if (plexSummary && plexSummary.length > 20) {
            await prisma.cachedArtist.update({ where: { id: artistId }, data: { summary: plexSummary } });
            return NextResponse.json({ bio: plexSummary, source: 'plex', cached: false });
          }
        }
      }
    } catch { /* Plex fetch failed, try LLM */ }

    // Fallback: use LLM for a brief bio
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
              content: `Write a brief 2-3 sentence biography for the musical artist "${artist.name}". Focus on their genre, career highlights, and notable achievements. If you don't know this artist, say "No biography available."`,
            }],
            max_tokens: 300,
          }),
        });
        if (llmRes.ok) {
          const data = await llmRes.json();
          const bio = data?.choices?.[0]?.message?.content?.trim() ?? '';
          if (bio && !bio.toLowerCase().includes('no biography available')) {
            await prisma.cachedArtist.update({ where: { id: artistId }, data: { summary: bio } });
            return NextResponse.json({ bio, source: 'llm', cached: false });
          }
        }
      } catch { /* LLM failed */ }
    }

    return NextResponse.json({ bio: null });
  } catch (e: any) {
    console.error('Artist bio error:', e?.message);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
