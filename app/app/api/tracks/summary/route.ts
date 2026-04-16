export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Search Wikipedia and return the intro extract
async function wikiSearch(query: string): Promise<string | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=3&format=json`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'PlexJukebox/1.0' } });
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!results?.length) return null;

    // Use the first result's title
    const pageTitle = results[0]?.title;
    if (!pageTitle) return null;

    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(pageTitle)}&format=json`;
    const extractRes = await fetch(extractUrl, { headers: { 'User-Agent': 'PlexJukebox/1.0' } });
    if (!extractRes.ok) return null;
    const extractData = await extractRes.json();
    const pages = extractData?.query?.pages;
    if (!pages) return null;

    const page = Object.values(pages)[0] as any;
    const extract = page?.extract?.trim();
    if (!extract || extract.length < 20) return null;

    // Truncate to ~3 sentences or 500 chars, whichever is shorter
    const sentences = extract.split(/(?<=[.!?])\s+/);
    const brief = sentences.slice(0, 3).join(' ');
    return brief.length > 500 ? brief.slice(0, 497) + '...' : brief;
  } catch {
    return null;
  }
}

// Try multiple Wikipedia search strategies: song, album, artist
async function fetchSummary(title: string, artist: string, album?: string): Promise<string | null> {
  // 1. Song-specific: "Title (song)" or "Title artist song"
  let summary = await wikiSearch(`${title} ${artist} song`);
  if (summary) return summary;

  summary = await wikiSearch(`"${title}" song ${artist}`);
  if (summary) return summary;

  // 2. Album-specific
  if (album) {
    summary = await wikiSearch(`${album} ${artist} album`);
    if (summary) return summary;
  }

  // 3. Artist page
  summary = await wikiSearch(`${artist} musician`);
  if (summary) return summary;

  summary = await wikiSearch(`${artist} band`);
  if (summary) return summary;

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const trackId = searchParams.get('trackId');

  if (!trackId) {
    return NextResponse.json({ error: 'trackId required' }, { status: 400 });
  }

  try {
    // Check if we already have a cached summary
    const track = await prisma.cachedTrack.findUnique({
      where: { id: trackId },
      select: { summary: true, title: true, artistName: true, albumTitle: true },
    });

    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }

    // Return cached summary if available
    if (track.summary !== null) {
      return NextResponse.json({ summary: track.summary });
    }

    // Fetch from Wikipedia
    const summary = await fetchSummary(
      track.title,
      track.artistName ?? '',
      track.albumTitle ?? undefined
    );

    // Store in DB (even empty string so we don't re-fetch)
    const stored = summary ?? '';
    await prisma.cachedTrack.update({
      where: { id: trackId },
      data: { summary: stored },
    });

    return NextResponse.json({ summary: stored });
  } catch (err: any) {
    console.error('Summary fetch error:', err?.message);
    return NextResponse.json({ summary: '' });
  }
}
