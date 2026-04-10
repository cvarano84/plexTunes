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

    const searchResult = await searchGeniusSong(title, artist);
    
    if (!searchResult.song) {
      return NextResponse.json({ 
        lyrics: null, 
        message: searchResult.error ?? 'Song not found on Genius',
        debug: {
          tokenValid: searchResult.tokenValid,
          searchWorked: searchResult.searchWorked,
          error: searchResult.error,
        }
      });
    }

    const lyricsResult = await fetchLyricsFromGenius(searchResult.song?.url ?? '');
    
    return NextResponse.json({
      lyrics: lyricsResult.lyrics ?? null,
      songInfo: {
        title: searchResult.song?.title ?? title,
        artist: searchResult.song?.primary_artist?.name ?? artist,
        imageUrl: searchResult.song?.song_art_image_url ?? null,
        geniusUrl: searchResult.song?.url ?? null,
      },
      debug: {
        tokenValid: searchResult.tokenValid,
        searchWorked: searchResult.searchWorked,
        geniusUrl: searchResult.song?.url,
        scrapeError: lyricsResult.error,
      }
    });
  } catch (e: any) {
    console.error('Lyrics error:', e?.message);
    return NextResponse.json({ lyrics: null, error: 'Failed to fetch lyrics', debug: { error: e?.message } });
  }
}
