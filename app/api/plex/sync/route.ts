export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { plexFetch } from '@/lib/plex';
import { mapGenreToStation, getDecadeFromYear, STATION_TEMPLATES } from '@/lib/stations';

const PAGE_SIZE = 100;

async function fetchAllPaged(serverUrl: string, token: string, sectionId: string, type: number): Promise<any[]> {
  const all: any[] = [];
  let start = 0;
  let total = Infinity;
  
  while (start < total) {
    const data = await plexFetch(serverUrl, token, `/library/sections/${sectionId}/all?type=${type}&X-Plex-Container-Start=${start}&X-Plex-Container-Size=${PAGE_SIZE}`);
    const container = data?.MediaContainer;
    total = container?.totalSize ?? container?.size ?? 0;
    const items = container?.Metadata ?? [];
    all.push(...items);
    start += PAGE_SIZE;
    if (items?.length === 0) break;
  }
  return all;
}

export async function POST(req: NextRequest) {
  try {
    const config = await prisma.plexConfig.findUnique({ where: { id: 'default' } });
    if (!config) {
      return NextResponse.json({ error: 'Plex not configured' }, { status: 400 });
    }

    const body = await req?.json?.().catch(() => ({}));
    const sectionId = body?.sectionId ?? '';
    if (!sectionId) {
      return NextResponse.json({ error: 'Section ID required' }, { status: 400 });
    }

    // Mark sync in progress
    await prisma.librarySyncStatus.upsert({
      where: { id: 'default' },
      update: { syncInProgress: true, syncProgress: 0, syncMessage: 'Fetching artists...' },
      create: { id: 'default', syncInProgress: true, syncProgress: 0, syncMessage: 'Fetching artists...' },
    });

    // Fetch all artists
    const artists = await fetchAllPaged(config.serverUrl, config.token, sectionId, 8);
    
    await prisma.librarySyncStatus.update({
      where: { id: 'default' },
      data: { syncProgress: 20, syncMessage: `Found ${artists?.length ?? 0} artists. Fetching albums...` },
    });

    // Fetch all albums
    const albums = await fetchAllPaged(config.serverUrl, config.token, sectionId, 9);
    
    await prisma.librarySyncStatus.update({
      where: { id: 'default' },
      data: { syncProgress: 40, syncMessage: `Found ${albums?.length ?? 0} albums. Fetching tracks...` },
    });

    // Fetch all tracks
    const tracks = await fetchAllPaged(config.serverUrl, config.token, sectionId, 10);
    
    await prisma.librarySyncStatus.update({
      where: { id: 'default' },
      data: { syncProgress: 60, syncMessage: `Found ${tracks?.length ?? 0} tracks. Saving to database...` },
    });

    // Build artist map
    const artistMap = new Map<string, any>();
    for (const a of (artists ?? [])) {
      const key = a?.ratingKey?.toString?.() ?? '';
      if (key) artistMap.set(key, a);
    }

    // Save artists
    for (const a of (artists ?? [])) {
      const rk = a?.ratingKey?.toString?.() ?? '';
      if (!rk) continue;
      await prisma.cachedArtist.upsert({
        where: { ratingKey: rk },
        update: {
          name: a?.title ?? 'Unknown Artist',
          thumb: a?.thumb ?? null,
          addedAt: a?.addedAt ?? null,
        },
        create: {
          id: `artist-${rk}`,
          ratingKey: rk,
          name: a?.title ?? 'Unknown Artist',
          thumb: a?.thumb ?? null,
          addedAt: a?.addedAt ?? null,
        },
      });
    }

    // Build album map
    const albumMap = new Map<string, any>();
    for (const al of (albums ?? [])) {
      const key = al?.ratingKey?.toString?.() ?? '';
      if (key) albumMap.set(key, al);
    }

    // Save albums 
    for (const al of (albums ?? [])) {
      const rk = al?.ratingKey?.toString?.() ?? '';
      if (!rk) continue;
      const parentRk = al?.parentRatingKey?.toString?.() ?? '';
      const artistExists = parentRk ? artistMap.has(parentRk) : false;
      const artistId = artistExists ? `artist-${parentRk}` : null;
      if (!artistId) continue;
      
      const genre = al?.Genre?.[0]?.tag ?? null;
      
      await prisma.cachedAlbum.upsert({
        where: { ratingKey: rk },
        update: {
          title: al?.title ?? 'Unknown Album',
          year: al?.year ?? null,
          thumb: al?.thumb ?? null,
          genre,
        },
        create: {
          id: `album-${rk}`,
          ratingKey: rk,
          title: al?.title ?? 'Unknown Album',
          year: al?.year ?? null,
          thumb: al?.thumb ?? null,
          artistId,
          genre,
        },
      });
    }

    await prisma.librarySyncStatus.update({
      where: { id: 'default' },
      data: { syncProgress: 75, syncMessage: 'Saving tracks...' },
    });

    // Save tracks
    for (const t of (tracks ?? [])) {
      const rk = t?.ratingKey?.toString?.() ?? '';
      if (!rk) continue;
      
      const albumRk = t?.parentRatingKey?.toString?.() ?? '';
      const grandparentRk = t?.grandparentRatingKey?.toString?.() ?? '';
      const albumId = albumRk && albumMap.has(albumRk) ? `album-${albumRk}` : null;
      const artistId = grandparentRk && artistMap.has(grandparentRk) ? `artist-${grandparentRk}` : null;
      if (!albumId || !artistId) continue;

      const genre = t?.Genre?.[0]?.tag ?? null;
      const mediaKey = t?.Media?.[0]?.Part?.[0]?.key ?? null;
      
      await prisma.cachedTrack.upsert({
        where: { ratingKey: rk },
        update: {
          title: t?.title ?? 'Unknown Track',
          duration: t?.duration ?? null,
          trackNumber: t?.index ?? null,
          year: t?.year ?? t?.parentYear ?? null,
          genre,
          artistName: t?.grandparentTitle ?? null,
          albumTitle: t?.parentTitle ?? null,
          thumb: t?.thumb ?? t?.parentThumb ?? null,
          mediaKey,
        },
        create: {
          id: `track-${rk}`,
          ratingKey: rk,
          title: t?.title ?? 'Unknown Track',
          duration: t?.duration ?? null,
          trackNumber: t?.index ?? null,
          year: t?.year ?? t?.parentYear ?? null,
          genre,
          artistId,
          artistName: t?.grandparentTitle ?? null,
          albumId,
          albumTitle: t?.parentTitle ?? null,
          thumb: t?.thumb ?? t?.parentThumb ?? null,
          mediaKey,
        },
      });
    }

    await prisma.librarySyncStatus.update({
      where: { id: 'default' },
      data: { syncProgress: 90, syncMessage: 'Generating stations...' },
    });

    // Generate stations based on what's in the library (with album genre fallback)
    const allCachedTracks = await prisma.cachedTrack.findMany({
      select: { year: true, genre: true, popularity: true, album: { select: { genre: true } } },
    });

    for (const template of STATION_TEMPLATES) {
      const matchingTracks = allCachedTracks?.filter?.((t: any) => {
        const trackDecade = getDecadeFromYear(t?.year);
        if (trackDecade !== template.decade) return false;
        const trackGenres = mapGenreToStation(t?.genre, t?.album?.genre);
        return trackGenres?.includes?.(template.genre) ?? false;
      }) ?? [];

      if (matchingTracks.length >= 5) {
        await prisma.station.upsert({
          where: { decade_genre: { decade: template.decade, genre: template.genre } },
          update: {
            name: template.name,
            description: template.description,
            trackCount: matchingTracks.length,
            isActive: true,
          },
          create: {
            name: template.name,
            description: template.description,
            decade: template.decade,
            genre: template.genre,
            trackCount: matchingTracks.length,
            isActive: true,
          },
        });
      }
    }

    // Auto-create genre hits stations (cross-decade)
    const HITS_STATIONS = [
      { name: 'Country Hits', genre: 'Country', description: 'The biggest country hits across all decades' },
      { name: 'Hip-Hop Hits', genre: 'Hip-Hop', description: 'Top hip-hop and rap tracks from every era' },
      { name: 'Rock Hits', genre: 'Rock', description: 'The greatest rock anthems of all time' },
      { name: 'Pop Hits', genre: 'Pop', description: 'Chart-topping pop from every decade' },
      { name: 'R&B Hits', genre: 'R&B', description: 'The smoothest R&B jams across the years' },
      { name: 'Dance Hits', genre: 'Dance', description: 'The hottest dance and electronic tracks' },
    ];
    for (const hits of HITS_STATIONS) {
      const genreTracks = allCachedTracks.filter((t: any) => {
        const mapped = mapGenreToStation(t?.genre, t?.album?.genre);
        return mapped.includes(hits.genre);
      });
      if (genreTracks.length >= 10) {
        const existing = await prisma.station.findFirst({
          where: { stationType: 'hits', genre: hits.genre, decade: null },
        });
        if (!existing) {
          await prisma.station.create({
            data: {
              name: hits.name,
              description: hits.description,
              genre: hits.genre,
              decade: null,
              stationType: 'hits',
              minPopularity: 40,
              trackCount: genreTracks.length,
              isActive: true,
            },
          });
        } else {
          await prisma.station.update({
            where: { id: existing.id },
            data: { trackCount: genreTracks.length },
          });
        }
      }
    }

    // Auto-create "All the Hits" station (cross-genre, cross-decade)
    const allHitsExisting = await prisma.station.findFirst({
      where: { stationType: 'hits', genre: null, decade: null },
    });
    if (!allHitsExisting) {
      await prisma.station.create({
        data: {
          name: 'All the Hits',
          description: 'The most popular tracks from your entire library',
          genre: null,
          decade: null,
          stationType: 'hits',
          minPopularity: 50,
          isActive: true,
        },
      });
    }

    // Auto-create "Most Played" station
    const mostPlayedExisting = await prisma.station.findFirst({
      where: { stationType: 'most-played' },
    });
    if (!mostPlayedExisting) {
      await prisma.station.create({
        data: {
          name: 'Most Played',
          description: 'Your personal favorites based on play history',
          stationType: 'most-played',
          isActive: true,
        },
      });
    }

    await prisma.librarySyncStatus.update({
      where: { id: 'default' },
      data: {
        syncInProgress: false,
        syncProgress: 100,
        syncMessage: 'Sync complete!',
        lastSyncAt: new Date(),
        totalArtists: artists?.length ?? 0,
        totalAlbums: albums?.length ?? 0,
        totalTracks: tracks?.length ?? 0,
      },
    });

    // Auto-trigger Spotify popularity check in the background
    try {
      const uncheckedCount = await prisma.cachedTrack.count({ where: { spotifyChecked: false } });
      if (uncheckedCount > 0) {
        // Fire off popularity check in background (don't await)
        (async () => {
          try {
            const { getBatchPopularity } = await import('@/lib/spotify');
            let processed = 0;
            let done = false;
            while (!done && processed < 5000) {
              const unchecked = await prisma.cachedTrack.findMany({
                where: { spotifyChecked: false },
                take: 50,
                select: { id: true, title: true, artistName: true },
              });
              if (unchecked.length === 0) { done = true; break; }
              const trackInputs = unchecked.map((t: any) => ({
                artistName: t?.artistName ?? '',
                title: t?.title ?? '',
              }));
              const popularityMap = await getBatchPopularity(trackInputs);
              for (const t of unchecked) {
                const key = `${t?.artistName ?? ''}::${t?.title ?? ''}`;
                const pop = popularityMap?.get?.(key) ?? null;
                await prisma.cachedTrack.update({
                  where: { id: t.id },
                  data: { popularity: pop, spotifyChecked: true },
                });
              }
              processed += unchecked.length;
            }
            console.log(`Auto-popularity: checked ${processed} tracks after sync`);
          } catch (popErr: any) {
            console.error('Auto-popularity error:', popErr?.message);
          }
        })();
      }
    } catch { /* ignore popularity trigger errors */ }

    return NextResponse.json({
      success: true,
      artists: artists?.length ?? 0,
      albums: albums?.length ?? 0,
      tracks: tracks?.length ?? 0,
    });
  } catch (e: any) {
    console.error('Sync error:', e?.message);
    await prisma.librarySyncStatus.update({
      where: { id: 'default' },
      data: { syncInProgress: false, syncMessage: `Error: ${e?.message ?? 'Unknown'}` },
    }).catch(() => {});
    return NextResponse.json({ error: e?.message ?? 'Sync failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const status = await prisma.librarySyncStatus.findUnique({ where: { id: 'default' } });
    return NextResponse.json(status ?? { syncInProgress: false, syncProgress: 0 });
  } catch {
    return NextResponse.json({ syncInProgress: false, syncProgress: 0 });
  }
}
