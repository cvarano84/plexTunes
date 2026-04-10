// Genius API for lyrics

const GENIUS_BASE = 'https://api.genius.com';

export interface GeniusSearchResult {
  song: any | null;
  searchWorked: boolean;
  tokenValid: boolean;
  error?: string;
}

export async function searchGeniusSong(title: string, artist: string): Promise<GeniusSearchResult> {
  try {
    const token = process.env.GENIUS_ACCESS_TOKEN ?? '';
    if (!token) {
      return { song: null, searchWorked: false, tokenValid: false, error: 'GENIUS_ACCESS_TOKEN not set' };
    }

    // Clean up title - remove feat., remaster notes, etc.
    const cleanTitle = title
      .replace(/\s*\(feat\..*?\)/gi, '')
      .replace(/\s*\[.*?\]/gi, '')
      .replace(/\s*-\s*remaster(ed)?/gi, '')
      .replace(/\s*\(remaster(ed)?\)/gi, '')
      .trim();

    const query = encodeURIComponent(`${cleanTitle} ${artist}`);
    const res = await fetch(`${GENIUS_BASE}/search?q=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res?.status === 401 || res?.status === 403) {
      return { song: null, searchWorked: true, tokenValid: false, error: `Genius API returned ${res.status} - token may be invalid` };
    }

    if (!res?.ok) {
      return { song: null, searchWorked: false, tokenValid: true, error: `Genius API returned ${res.status}` };
    }

    const data = await res?.json?.();
    const hits = data?.response?.hits ?? [];
    
    if (hits?.length > 0) {
      // Try to find best match - prefer results that match artist
      const artistLower = artist.toLowerCase();
      const bestMatch = hits.find((h: any) => 
        h?.result?.primary_artist?.name?.toLowerCase?.()?.includes?.(artistLower) ||
        artistLower.includes(h?.result?.primary_artist?.name?.toLowerCase?.() ?? '')
      );
      return { 
        song: bestMatch?.result ?? hits[0]?.result ?? null, 
        searchWorked: true, 
        tokenValid: true 
      };
    }
    return { song: null, searchWorked: true, tokenValid: true, error: 'No results found on Genius' };
  } catch (e: any) {
    console.error('Genius search error:', e?.message);
    return { song: null, searchWorked: false, tokenValid: true, error: e?.message ?? 'Unknown error' };
  }
}

export async function fetchLyricsFromGenius(songUrl: string): Promise<{ lyrics: string | null; error?: string }> {
  try {
    const res = await fetch(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    if (!res?.ok) {
      return { lyrics: null, error: `Failed to fetch Genius page: ${res.status}` };
    }

    const html = await res?.text?.() ?? '';
    
    // Method 1: data-lyrics-container attribute
    const lyricsMatch = html?.match?.(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g);
    if (lyricsMatch && lyricsMatch.length > 0) {
      let lyrics = lyricsMatch
        .map((m: string) => {
          // Remove the opening tag
          let content = m.replace(/^data-lyrics-container="true"[^>]*>/, '').replace(/<\/div>$/, '');
          content = content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
          return content;
        })
        .join('\n');
      lyrics = decodeHtmlEntities(lyrics);
      if (lyrics.trim()) return { lyrics: lyrics.trim() };
    }

    // Method 2: Look for Lyrics__Container class
    const containerMatch = html?.match?.(/class="Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/g);
    if (containerMatch && containerMatch.length > 0) {
      let lyrics = containerMatch
        .map((m: string) => m.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
        .join('\n');
      lyrics = decodeHtmlEntities(lyrics);
      if (lyrics.trim()) return { lyrics: lyrics.trim() };
    }

    // Method 3: JSON-LD structured data
    const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g);
    if (jsonLdMatch) {
      for (const match of jsonLdMatch) {
        try {
          const json = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
          const data = JSON.parse(json);
          if (data?.lyrics?.text) {
            return { lyrics: data.lyrics.text };
          }
        } catch { /* skip */ }
      }
    }

    return { lyrics: null, error: 'Could not parse lyrics from Genius page' };
  } catch (e: any) {
    console.error('Lyrics fetch error:', e?.message);
    return { lyrics: null, error: e?.message ?? 'Unknown error' };
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_: string, n: string) => String.fromCharCode(parseInt(n, 16)));
}

export async function testGeniusConnection(): Promise<{
  connected: boolean;
  tokenSet: boolean;
  error?: string;
}> {
  const token = process.env.GENIUS_ACCESS_TOKEN ?? '';
  if (!token) {
    return { connected: false, tokenSet: false, error: 'GENIUS_ACCESS_TOKEN not configured' };
  }

  try {
    const res = await fetch(`${GENIUS_BASE}/search?q=test`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      return { connected: true, tokenSet: true };
    }
    return { connected: false, tokenSet: true, error: `API returned ${res.status}` };
  } catch (e: any) {
    return { connected: false, tokenSet: true, error: e?.message ?? 'Connection failed' };
  }
}
