// Genius API for lyrics

const GENIUS_BASE = 'https://api.genius.com';

export async function searchGeniusSong(title: string, artist: string): Promise<any | null> {
  try {
    const token = process.env.GENIUS_ACCESS_TOKEN ?? '';
    if (!token) return null;

    const query = encodeURIComponent(`${title} ${artist}`);
    const res = await fetch(`${GENIUS_BASE}/search?q=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res?.ok) return null;

    const data = await res?.json?.();
    const hits = data?.response?.hits ?? [];
    if (hits?.length > 0) {
      return hits[0]?.result ?? null;
    }
    return null;
  } catch (e: any) {
    console.error('Genius search error:', e?.message);
    return null;
  }
}

export async function fetchLyricsFromGenius(songUrl: string): Promise<string | null> {
  try {
    // Genius doesn't have a direct lyrics API endpoint that returns plain text
    // We need to scrape from the web page
    const res = await fetch(songUrl);
    if (!res?.ok) return null;

    const html = await res?.text?.() ?? '';
    // Extract lyrics from the page HTML
    const lyricsMatch = html?.match?.(/data-lyrics-container="true"[^>]*>(.*?)<\/div>/gs);
    if (lyricsMatch && lyricsMatch?.length > 0) {
      let lyrics = lyricsMatch
        ?.map?.((m: string) => m?.replace?.(/<br\s*\/?>/gi, '\n')?.replace?.(/<[^>]+>/g, '') ?? '')
        ?.join?.('\n') ?? '';
      // Decode HTML entities
      lyrics = lyrics?.replace?.(/&amp;/g, '&')
        ?.replace?.(/&lt;/g, '<')
        ?.replace?.(/&gt;/g, '>')
        ?.replace?.(/&#x27;/g, "'")
        ?.replace?.(/&quot;/g, '"') ?? '';
      return lyrics?.trim?.() ?? null;
    }
    return null;
  } catch (e: any) {
    console.error('Lyrics fetch error:', e?.message);
    return null;
  }
}
