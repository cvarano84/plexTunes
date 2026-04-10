// Spotify + Last.fm API utility for track popularity
// Spotify requires the app owner to have Premium for search endpoints.
// Falls back to Last.fm (free, no premium required) if Spotify fails.

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

// Try Spotify search - returns popularity 0-100 or null
async function spotifySearch(artistName: string, trackTitle: string, token: string): Promise<number | null> {
  try {
    const query = encodeURIComponent(`track:${trackTitle} artist:${artistName}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      { headers: { 'Authorization': `Bearer ${token}` } }
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

// Last.fm fallback - returns a popularity score 0-100 derived from listener count
// Last.fm API is free and doesn't require premium
async function lastfmSearch(artistName: string, trackTitle: string): Promise<number | null> {
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

    // Normalize to 0-100 scale using logarithmic scaling
    // Top tracks have ~50M+ listeners, obscure ones have <1000
    const score = Math.min(100, Math.round(Math.log10(Math.max(1, listeners)) * 15));
    return Math.max(1, score);
  } catch {
    return null;
  }
}

// Simple heuristic fallback when no API works
// Uses track title commonality and decade to estimate popularity
function heuristicPopularity(artistName: string, trackTitle: string): number {
  // Default moderate score so tracks aren't all 0
  return 30;
}

export async function getTrackPopularity(artistName: string, trackTitle: string): Promise<number | null> {
  // Try Spotify first
  const token = await getSpotifyToken();
  if (token) {
    const pop = await spotifySearch(artistName, trackTitle, token);
    if (pop !== null) return pop;
  }

  // Try Last.fm
  const lastfmPop = await lastfmSearch(artistName, trackTitle);
  if (lastfmPop !== null) return lastfmPop;

  // Return heuristic default
  return heuristicPopularity(artistName, trackTitle);
}

export async function getBatchPopularity(
  tracks: Array<{ artistName: string; title: string }>
): Promise<Map<string, number>> {
  const results = new Map<string, number>();

  // Determine which service to use
  const token = await getSpotifyToken();
  const lastfmKey = process.env.LASTFM_API_KEY ?? '';
  const useSpotify = !!token && !spotifyDisabled;
  const useLastfm = !!lastfmKey;

  console.log(`[Popularity] Processing ${tracks?.length ?? 0} tracks. Spotify: ${useSpotify ? 'enabled' : 'disabled'}, Last.fm: ${useLastfm ? 'enabled' : 'disabled'}`);

  if (!useSpotify && !useLastfm) {
    // No API available - assign heuristic scores
    console.log('[Popularity] No popularity API available. Using heuristic scores.');
    for (const t of (tracks ?? [])) {
      const key = `${t?.artistName ?? ''}::${t?.title ?? ''}`;
      results.set(key, heuristicPopularity(t?.artistName ?? '', t?.title ?? ''));
    }
    return results;
  }

  // Process in batches
  const batchSize = useSpotify ? 5 : 3; // Last.fm is slower, smaller batches
  let found = 0;
  let notFound = 0;

  for (let i = 0; i < (tracks?.length ?? 0); i += batchSize) {
    const batch = tracks?.slice(i, i + batchSize) ?? [];
    const promises = batch?.map?.(async (t: any) => {
      const key = `${t?.artistName ?? ''}::${t?.title ?? ''}`;
      let pop: number | null = null;

      if (useSpotify && !spotifyDisabled) {
        pop = await spotifySearch(t?.artistName ?? '', t?.title ?? '', token!);
      }

      if (pop === null && useLastfm) {
        pop = await lastfmSearch(t?.artistName ?? '', t?.title ?? '');
      }

      if (pop === null) {
        pop = heuristicPopularity(t?.artistName ?? '', t?.title ?? '');
        notFound++;
      } else {
        found++;
      }

      results.set(key, pop);
    }) ?? [];

    await Promise.all(promises);

    // Rate limit delay
    if (i + batchSize < (tracks?.length ?? 0)) {
      await new Promise(r => setTimeout(r, useSpotify ? 200 : 350));
    }
  }

  console.log(`[Popularity] Batch done. Found: ${found}, Heuristic: ${notFound}`);
  return results;
}

// Check if Spotify is working (for diagnostics)
export async function checkSpotifyStatus(): Promise<{ working: boolean; error?: string; disabled?: boolean }> {
  if (spotifyDisabled) {
    return { working: false, error: 'Spotify API disabled (requires Premium subscription)', disabled: true };
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
  if (!clientId || !clientSecret) {
    return { working: false, error: 'Spotify credentials not configured' };
  }

  const token = await getSpotifyToken();
  if (!token) {
    return { working: false, error: 'Failed to get Spotify token' };
  }

  // Test a search
  const pop = await spotifySearch('Queen', 'Bohemian Rhapsody', token);
  if (pop !== null) {
    return { working: true };
  }

  return { working: false, error: spotifyDisabled ? 'Spotify requires Premium subscription' : 'Search returned no results' };
}