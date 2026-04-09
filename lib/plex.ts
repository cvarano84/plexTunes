// Plex API utility functions

export interface PlexMediaContainer {
  MediaContainer?: {
    size?: number;
    Metadata?: any[];
    Directory?: any[];
  };
}

export async function plexFetch(serverUrl: string, token: string, path: string): Promise<any> {
  const url = `${serverUrl}${path}`;
  const sep = url.includes('?') ? '&' : '?';
  const fullUrl = `${url}${sep}X-Plex-Token=${token}`;
  
  const res = await fetch(fullUrl, {
    headers: {
      'Accept': 'application/json',
      'X-Plex-Client-Identifier': 'plex-jukebox-app',
      'X-Plex-Product': 'Plex Jukebox',
      'X-Plex-Version': '1.0.0',
    },
  });
  
  if (!res?.ok) {
    throw new Error(`Plex API error: ${res?.status} ${res?.statusText}`);
  }
  
  return res?.json?.();
}

export async function getMusicLibrarySections(serverUrl: string, token: string): Promise<any[]> {
  try {
    const data = await plexFetch(serverUrl, token, '/library/sections');
    const directories = data?.MediaContainer?.Directory ?? [];
    return directories?.filter?.((d: any) => d?.type === 'artist') ?? [];
  } catch (e: any) {
    console.error('Error fetching music libraries:', e?.message);
    return [];
  }
}

export async function getLibraryArtists(serverUrl: string, token: string, sectionId: string): Promise<any[]> {
  try {
    const data = await plexFetch(serverUrl, token, `/library/sections/${sectionId}/all?type=8`);
    return data?.MediaContainer?.Metadata ?? [];
  } catch (e: any) {
    console.error('Error fetching artists:', e?.message);
    return [];
  }
}

export async function getArtistAlbums(serverUrl: string, token: string, artistRatingKey: string): Promise<any[]> {
  try {
    const data = await plexFetch(serverUrl, token, `/library/metadata/${artistRatingKey}/children`);
    return data?.MediaContainer?.Metadata ?? [];
  } catch (e: any) {
    console.error('Error fetching albums:', e?.message);
    return [];
  }
}

export async function getAlbumTracks(serverUrl: string, token: string, albumRatingKey: string): Promise<any[]> {
  try {
    const data = await plexFetch(serverUrl, token, `/library/metadata/${albumRatingKey}/children`);
    return data?.MediaContainer?.Metadata ?? [];
  } catch (e: any) {
    console.error('Error fetching tracks:', e?.message);
    return [];
  }
}

export async function getAllTracks(serverUrl: string, token: string, sectionId: string): Promise<any[]> {
  try {
    const data = await plexFetch(serverUrl, token, `/library/sections/${sectionId}/all?type=10`);
    return data?.MediaContainer?.Metadata ?? [];
  } catch (e: any) {
    console.error('Error fetching all tracks:', e?.message);
    return [];
  }
}

export function getPlexImageUrl(serverUrl: string, token: string, thumb: string | null | undefined): string {
  if (!thumb) return '';
  return `${serverUrl}/photo/:/transcode?width=600&height=600&minSize=1&upscale=1&url=${encodeURIComponent(thumb)}&X-Plex-Token=${token}`;
}

export function getPlexStreamUrl(serverUrl: string, token: string, mediaKey: string | null | undefined): string {
  if (!mediaKey) return '';
  return `${serverUrl}${mediaKey}?X-Plex-Token=${token}`;
}

export async function testPlexConnection(serverUrl: string, token: string): Promise<boolean> {
  try {
    const data = await plexFetch(serverUrl, token, '/');
    return !!data?.MediaContainer;
  } catch {
    return false;
  }
}
