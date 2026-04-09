export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { searchGeniusSong, fetchLyricsFromGenius } from '@/lib/genius';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req?.nextUrl?.searchParams;
    const title = searchParams?.get?.('title') ?? '';
    const artist = searchParams?.get?.('artist') ?? '';

    if (!title || !artist) {
      return NextResponse.json({ error: 'Title and artist required' }, { status: 400 });
    }

    const song = await searchGeniusSong(title, artist);
    if (!song) {
      return NextResponse.json({ lyrics: null, message: 'Song not found on Genius' });
    }

    const lyrics = await fetchLyricsFromGenius(song?.url ?? '');
    
    return NextResponse.json({
      lyrics: lyrics ?? null,
      songInfo: {
        title: song?.title ?? title,
        artist: song?.primary_artist?.name ?? artist,
        imageUrl: song?.song_art_image_url ?? null,
        geniusUrl: song?.url ?? null,
      },
    });
  } catch (e: any) {
    console.error('Lyrics error:', e?.message);
    return NextResponse.json({ lyrics: null, error: 'Failed to fetch lyrics' });
  }
}
