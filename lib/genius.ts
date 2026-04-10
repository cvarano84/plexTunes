// Genius API for lyrics - uses client_credentials OAuth flow

const GENIUS_BASE = 'https://api.genius.com';
const GENIUS_TOKEN_URL = 'https://api.genius.com/oauth/token';

let cachedGeniusToken: string | null = null;
let geniusTokenExpiry: number = 0;

async function getGeniusToken(): Promise<string> {
  // If we have a cached token that's still valid, use it
  if (cachedGeniusToken && Date.now() < geniusTokenExpiry) {
    return cachedGeniusToken;
  }

  // Try client_credentials flow first (preferred)
  const clientId = process.env.GENIUS_CLIENT_ID ?? '';
  const clientSecret = process.env.GENIUS_CLIENT_SECRET ?? '';

  if (clientId && clientSecret) {
    try {
      const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const res = await fetch(GENIUS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basic}`,
        },
        body: 'grant_type=client_credentials',
      });
      if (res.ok) {
        const data = await res.json();
        cachedGeniusToken = data?.access_token ?? '';
        // Cache for 50 minutes (tokens usually last 1 hour)
        geniusTokenExpiry = Date.now() + 50 * 60 * 1000;
        return cachedGeniusToken ?? '';
      }
      console.error('Genius client_credentials failed:', res.status);
    } catch (e: any) {
      console.error('Genius token fetch error:', e?.message);
    }
  }

  // Fallback to static access token
  const staticToken = process.env.GENIUS_ACCESS_TOKEN ?? '';
  if (staticToken) return staticToken;

  return '';
}

export interface GeniusSearchResult {
  song: any | null;
  searchWorked: boolean;
  tokenValid: boolean;
  error?: string;
}

export async function searchGeniusSong(title: string, artist: string): Promise<GeniusSearchResult> {
  try {
    const token = await getGeniusToken();
    if (!token) {
      return { song: null, searchWorked: false, tokenValid: false, error: 'No Genius credentials configured (need GENIUS_CLIENT_ID + GENIUS_CLIENT_SECRET)' };
    }

    // Clean up title - remove feat., remaster notes, etc.
    const cleanTitle = title
      .replace(/\s*\(feat\..*?\)/gi, '')
      .replace(/\s*\[.*?\]/gi, '')
      .replace(/\s*-\s*remaster(ed)?/gi, '')
      .replace(/\s*\(remaster(ed)?\)/gi, '')
      .replace(/\s*\(live\)/gi, '')
      .replace(/\s*\(bonus track\)/gi, '')
      .trim();

    const query = encodeURIComponent(`${cleanTitle} ${artist}`);
    const res = await fetch(`${GENIUS_BASE}/search?q=${query}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (res?.status === 401 || res?.status === 403) {
      // Invalidate cached token
      cachedGeniusToken = null;
      geniusTokenExpiry = 0;
      return { song: null, searchWorked: true, tokenValid: false, error: `Genius API returned ${res.status} - credentials may be invalid` };
    }

    if (!res?.ok) {
      return { song: null, searchWorked: false, tokenValid: true, error: `Genius API returned ${res.status}` };
    }

    const data = await res?.json?.();
    const hits = data?.response?.hits ?? [];

    if (hits?.length > 0) {
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
    const lyricsMatch = html?.match?.(/data-lyrics-container="true"[^>]*>[\s\S]*?<\/div>/g);
    if (lyricsMatch && lyricsMatch.length > 0) {
      let lyrics = lyricsMatch
        .map((m: string) => {
          let content = m.replace(/^data-lyrics-container="true"[^>]*>/, '').replace(/<\/div>$/, '');
          content = content.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
          return content;
        })
        .join('\n');
      lyrics = decodeHtmlEntities(lyrics);
      if (lyrics.trim()) return { lyrics: lyrics.trim() };
    }

    // Method 2: Lyrics__Container class
    const containerMatch = html?.match?.(/class="Lyrics__Container[^"]*"[^>]*>[\s\S]*?<\/div>/g);
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
  authMethod: string;
  error?: string;
}> {
  const hasClientCreds = !!(process.env.GENIUS_CLIENT_ID && process.env.GENIUS_CLIENT_SECRET);
  const hasStaticToken = !!process.env.GENIUS_ACCESS_TOKEN;

  if (!hasClientCreds && !hasStaticToken) {
    return { connected: false, tokenSet: false, authMethod: 'none', error: 'No Genius credentials configured' };
  }

  try {
    const token = await getGeniusToken();
    if (!token) {
      return { connected: false, tokenSet: true, authMethod: hasClientCreds ? 'client_credentials' : 'access_token', error: 'Failed to obtain token' };
    }

    const res = await fetch(`${GENIUS_BASE}/search?q=test`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      return { connected: true, tokenSet: true, authMethod: hasClientCreds ? 'client_credentials' : 'access_token' };
    }
    return { connected: false, tokenSet: true, authMethod: hasClientCreds ? 'client_credentials' : 'access_token', error: `API returned ${res.status}` };
  } catch (e: any) {
    return { connected: false, tokenSet: true, authMethod: hasClientCreds ? 'client_credentials' : 'access_token', error: e?.message ?? 'Connection failed' };
  }
}
