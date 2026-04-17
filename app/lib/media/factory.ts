// Factory that loads the active MediaServerConfig from the database and returns
// the appropriate adapter. Used by every /api/plex/* route.

import { prisma } from '@/lib/db';
import { PlexAdapter } from './plex-adapter';
import { JellyfinAdapter } from './jellyfin-adapter';
import { SubsonicAdapter } from './subsonic-adapter';
import type { MediaServerAdapter } from './adapter';
import type { MediaServerConfig, MediaServerType } from './types';

export async function loadConfig(): Promise<MediaServerConfig | null> {
  const row = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
  if (!row) return null;
  const serverType = ((row as any).serverType ?? 'plex') as MediaServerType;
  return {
    serverType,
    serverUrl: row.serverUrl,
    token: row.token,
    username: (row as any).username ?? null,
    libraryId: (row as any).libraryId ?? null,
  };
}

export function buildAdapter(config: MediaServerConfig): MediaServerAdapter {
  switch (config.serverType) {
    case 'jellyfin':
      return new JellyfinAdapter(config);
    case 'subsonic':
      return new SubsonicAdapter(config);
    case 'plex':
    default:
      return new PlexAdapter(config);
  }
}

export async function getActiveAdapter(): Promise<{ adapter: MediaServerAdapter; config: MediaServerConfig } | null> {
  const config = await loadConfig();
  if (!config) return null;
  return { adapter: buildAdapter(config), config };
}
