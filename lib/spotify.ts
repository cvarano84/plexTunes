// Spotify API utility for track popularity

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID ?? '';
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? '';
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
    throw new Error('Failed to get Spotify token');
  }

  const data = await res?.json?.();
  cachedToken = data?.access_token ?? '';
  tokenExpiry = Date.now() + ((data?.expires_in ?? 3600) - 60) * 1000;
  return cachedToken ?? '';
}

export async function getTrackPopularity(artistName: string, trackTitle: string): Promise<number | null> {
  try {
    const token = await getSpotifyToken();
    const query = encodeURIComponent(`track:${trackTitle} artist:${artistName}`);
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    if (!res?.ok) return null;

    const data = await res?.json?.();
    const tracks = data?.tracks?.items ?? [];
    if (tracks?.length > 0) {
      return tracks[0]?.popularity ?? null;
    }
    return null;
  } catch (e: any) {
    console.error('Spotify popularity error:', e?.message);
    return null;
  }
}

export async function getBatchPopularity(
  tracks: Array<{ artistName: string; title: string }>
): Promise<Map<string, number>> {
  const results = new Map<string, number>();
  const token = await getSpotifyToken();

  // Process in batches of 5 to avoid rate limits
  for (let i = 0; i < (tracks?.length ?? 0); i += 5) {
    const batch = tracks?.slice(i, i + 5) ?? [];
    const promises = batch?.map?.(async (t: any) => {
      try {
        const query = encodeURIComponent(`track:${t?.title} artist:${t?.artistName}`);
        const res = await fetch(
          `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
          {
            headers: { 'Authorization': `Bearer ${token}` },
          }
        );
        if (res?.ok) {
          const data = await res?.json?.();
          const items = data?.tracks?.items ?? [];
          if (items?.length > 0) {
            const key = `${t?.artistName}::${t?.title}`;
            results.set(key, items[0]?.popularity ?? 0);
          }
        }
      } catch {
        // skip
      }
    }) ?? [];
    await Promise.all(promises);
    // Small delay between batches
    if (i + 5 < (tracks?.length ?? 0)) {
      await new Promise(r => setTimeout(r, 200));
    }
  }

  return results;
}
