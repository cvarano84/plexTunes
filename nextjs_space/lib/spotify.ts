// Multi-provider popularity API: Spotify, Last.fm, Deezer
// Priority order is configurable. Each provider normalizes to 0-100.

export type PopularityProvider = 'spotify' | 'lastfm' | 'deezer';

let cachedSpotifyToken: string | null = null;
let spotifyTokenExpiry: number = 0;
let spotifyDisabled: boolean = false;

async function getSpotifyToken(): Promise<string | null> {
  if (spotifyDisabled) return null;
  if (cachedSpotifyToken && Date.now() < spotifyTokenExpiry) {
    return cachedSpotifyToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
  if (!clientId || !clientSecret) {
    console.log('[Popularity] No Spotify credentials configured');
    spotifyDisabled = true;
    return null;
  }

  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!res?.ok) {
      console.warn(`[Popularity] Spotify token request failed: ${res.status}`);
      spotifyDisabled = true;
      return null;
    }

    const data = await res?.json?.();
    cachedSpotifyToken = data?.access_token ?? null;
    spotifyTokenExpiry = Date.now() + ((data?.expires_in ?? 3600) - 60) * 1000;
    return cachedSpotifyToken;
  } catch (e: any) {
    console.warn('[Popularity] Spotify token error:', e?.message);
    spotifyDisabled = true;
    return null;
  }
}

// Spotify: returns popularity 0-100 or null
export async function spotifySearch(artistName: string, trackTitle: string, token?: string): Promise<number | null> {
  try {
    const t = token ?? await getSpotifyToken();
    if (!t) return null;
    const query = encodeURIComponent(`track:${trackTitle} artist:${artistName}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      { headers: { 'Authorization': `Bearer ${t}` } }
    );

    if (res.status === 403) {
      const text = await res.text().catch(() => '');
      if (text.includes('premium') || text.includes('subscription')) {
        console.warn('[Popularity] Spotify requires Premium subscription for search. Disabling Spotify.');
        spotifyDisabled = true;
      }
      return null;
    }
    if (!res?.ok) return null;

    const data = await res?.json?.();
    const items = data?.tracks?.items ?? [];
    if (items?.length > 0) {
      return items[0]?.popularity ?? 0;
    }
    return null;
  } catch {
    return null;
  }
}

// Last.fm: returns popularity 0-100 derived from listener count
export async function lastfmSearch(artistName: string, trackTitle: string): Promise<number | null> {
  const apiKey = process.env.LASTFM_API_KEY ?? '';
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      method: 'track.getInfo',
      api_key: apiKey,
      artist: artistName,
      track: trackTitle,
      format: 'json',
    });
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`);
    if (!res?.ok) return null;

    const data = await res?.json?.();
    const listeners = parseInt(data?.track?.listeners ?? '0', 10);
    const playcount = parseInt(data?.track?.playcount ?? '0', 10);

    if (listeners === 0 && playcount === 0) return null;

    // Normalize to 0-100 using log scale. Top tracks ~50M+ listeners.
    const score = Math.min(100, Math.round(Math.log10(Math.max(1, listeners)) * 15));
    return Math.max(1, score);
  } catch {
    return null;
  }
}

// Deezer: free, no auth needed. rank field 0-1,000,000 normalized to 0-100
export async function deezerSearch(artistName: string, trackTitle: string): Promise<number | null> {
  try {
    const query = encodeURIComponent(`artist:"${artistName}" track:"${trackTitle}"`);
    const res = await fetch(`https://api.deezer.com/search/track?q=${query}&limit=1`, {
      headers: { 'User-Agent': 'PlexJukebox/1.0' },
    });
    if (!res?.ok) return null;

    const data = await res?.json?.();
    const items = data?.data ?? [];
    if (items.length > 0) {
      const rank = items[0]?.rank ?? 0;
      // Deezer rank: 0-1,000,000. Normalize to 0-100.
      // Rank 900k+ = top hits (~90-100), 500k = moderate (~50), <100k = obscure (<10)
      if (rank <= 0) return null;
      const score = Math.min(100, Math.round((rank / 1000000) * 100));
      return Math.max(1, score);
    }
    return null;
  } catch {
    return null;
  }
}

// Simple heuristic fallback
function heuristicPopularity(): number {
  return 30;
}

// Default provider order
const DEFAULT_PROVIDER_ORDER: PopularityProvider[] = ['deezer', 'lastfm', 'spotify'];

export async function getTrackPopularity(
  artistName: string,
  trackTitle: string,
  providerOrder?: PopularityProvider[],
  disabledProviders?: PopularityProvider[]
): Promise<number | null> {
  const order = providerOrder ?? DEFAULT_PROVIDER_ORDER;
  const disabled = new Set(disabledProviders ?? []);

  for (const provider of order) {
    if (disabled.has(provider)) continue;
    let pop: number | null = null;
    if (provider === 'spotify') {
      const token = await getSpotifyToken();
      if (token) pop = await spotifySearch(artistName, trackTitle, token);
    } else if (provider === 'lastfm') {
      pop = await lastfmSearch(artistName, trackTitle);
    } else if (provider === 'deezer') {
      pop = await deezerSearch(artistName, trackTitle);
    }
    if (pop !== null) return pop;
  }

  return heuristicPopularity();
}

export async function getBatchPopularity(
  tracks: Array<{ artistName: string; title: string }>,
  providerOrder?: PopularityProvider[],
  disabledProviders?: PopularityProvider[]
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const order = providerOrder ?? DEFAULT_PROVIDER_ORDER;
  const disabled = new Set(disabledProviders ?? []);

  // Check which providers are available
  const token = await getSpotifyToken();
  const lastfmKey = process.env.LASTFM_API_KEY ?? '';
  const useSpotify = !!token && !spotifyDisabled && !disabled.has('spotify');
  const useLastfm = !!lastfmKey && !disabled.has('lastfm');
  const useDeezer = !disabled.has('deezer');

  console.log(`[Popularity] Processing ${tracks?.length ?? 0} tracks. Order: ${order.filter(p => !disabled.has(p)).join(' > ')}. Spotify: ${useSpotify ? 'on' : 'off'}, Last.fm: ${useLastfm ? 'on' : 'off'}, Deezer: ${useDeezer ? 'on' : 'off'}`);

  if (!useSpotify && !useLastfm && !useDeezer) {
    console.log('[Popularity] No popularity API available. Using heuristic scores.');
    for (const t of (tracks ?? [])) {
      const key = `${t?.artistName ?? ''}::${t?.title ?? ''}`;
      results.set(key, heuristicPopularity());
    }
    return results;
  }

  const batchSize = useDeezer ? 3 : useSpotify ? 5 : 3;
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < (tracks?.length ?? 0); i += batchSize) {
    const batch = tracks?.slice(i, i + batchSize) ?? [];
    const promises = batch?.map?.(async (t: any) => {
      const key = `${t?.artistName ?? ''}::${t?.title ?? ''}`;
      let pop: number | null = null;

      for (const provider of order) {
        if (pop !== null) break;
        if (disabled.has(provider)) continue;
        if (provider === 'spotify' && useSpotify) {
          pop = await spotifySearch(t?.artistName ?? '', t?.title ?? '', token!);
        } else if (provider === 'lastfm' && useLastfm) {
          pop = await lastfmSearch(t?.artistName ?? '', t?.title ?? '');
        } else if (provider === 'deezer' && useDeezer) {
          pop = await deezerSearch(t?.artistName ?? '', t?.title ?? '');
        }
      }

      if (pop === null) {
        pop = heuristicPopularity();
        notFound++;
      } else {
        found++;
      }
      results.set(key, pop);
    }) ?? [];

    await Promise.all(promises);

    if (i + batchSize < (tracks?.length ?? 0)) {
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`[Popularity] Batch done. Found: ${found}, Heuristic: ${notFound}`);
  return results;
}

// Test a specific provider with a known track
export async function testProvider(provider: PopularityProvider): Promise<{
  working: boolean;
  score: number | null;
  error?: string;
  configured: boolean;
}> {
  if (provider === 'spotify') {
    const clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
    if (!clientId || !clientSecret) return { working: false, score: null, error: 'No Spotify credentials configured', configured: false };
    if (spotifyDisabled) return { working: false, score: null, error: 'Spotify disabled (requires Premium)', configured: true };
    const token = await getSpotifyToken();
    if (!token) return { working: false, score: null, error: 'Failed to get token', configured: true };
    const pop = await spotifySearch('Queen', 'Bohemian Rhapsody', token);
    return { working: pop !== null, score: pop, error: pop === null ? (spotifyDisabled ? 'Requires Premium' : 'Search failed') : undefined, configured: true };
  }
  if (provider === 'lastfm') {
    const apiKey = process.env.LASTFM_API_KEY ?? '';
    if (!apiKey) return { working: false, score: null, error: 'No LASTFM_API_KEY configured', configured: false };
    const pop = await lastfmSearch('Queen', 'Bohemian Rhapsody');
    return { working: pop !== null, score: pop, error: pop === null ? 'Search returned no results' : undefined, configured: true };
  }
  if (provider === 'deezer') {
    const pop = await deezerSearch('Queen', 'Bohemian Rhapsody');
    return { working: pop !== null, score: pop, error: pop === null ? 'Search returned no results' : undefined, configured: true };
  }
  return { working: false, score: null, error: 'Unknown provider', configured: false };
}

// Check if Spotify is working (for diagnostics - backwards compat)
export async function checkSpotifyStatus(): Promise<{ working: boolean; error?: string; disabled?: boolean }> {
  const result = await testProvider('spotify');
  return { working: result.working, error: result.error, disabled: spotifyDisabled };
}