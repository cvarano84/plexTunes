// Station generation logic

export interface StationConfig {
  name: string;
  description: string;
  decade: string;
  genre: string;
  minPopularity: number;
}

export const STATION_TEMPLATES: StationConfig[] = [
  // Rock stations
  { name: "70's Classic Rock", description: "Legendary rock anthems from the 1970s", decade: "1970s", genre: "Rock", minPopularity: 40 },
  { name: "80's Rock Hits", description: "Big hair, bigger riffs – the best of 80s rock", decade: "1980s", genre: "Rock", minPopularity: 40 },
  { name: "90's Rock", description: "Grunge, alternative, and everything in between", decade: "1990s", genre: "Rock", minPopularity: 40 },
  { name: "2000's Rock", description: "Modern rock hits from the new millennium", decade: "2000s", genre: "Rock", minPopularity: 35 },
  
  // Pop stations
  { name: "80's Pop Classics", description: "The biggest pop hits of the 1980s", decade: "1980s", genre: "Pop", minPopularity: 45 },
  { name: "90's Pop Hits", description: "Iconic pop from the 90s era", decade: "1990s", genre: "Pop", minPopularity: 45 },
  { name: "2000's Pop", description: "Pop perfection from the 2000s", decade: "2000s", genre: "Pop", minPopularity: 40 },
  { name: "2010's Pop", description: "Chart-topping pop from the 2010s", decade: "2010s", genre: "Pop", minPopularity: 40 },
  
  // Party / Dance
  { name: "90's Party Mix", description: "Get the party started with 90s bangers", decade: "1990s", genre: "Dance", minPopularity: 40 },
  { name: "2000's Party Music", description: "Club anthems and party starters", decade: "2000s", genre: "Dance", minPopularity: 35 },
  { name: "2010's Party Hits", description: "The decade's biggest party tracks", decade: "2010s", genre: "Dance", minPopularity: 35 },
  
  // Hip-Hop / R&B
  { name: "90's Hip-Hop", description: "Golden era hip-hop classics", decade: "1990s", genre: "Hip-Hop", minPopularity: 40 },
  { name: "2000's Hip-Hop", description: "Iconic rap and hip-hop from the 2000s", decade: "2000s", genre: "Hip-Hop", minPopularity: 35 },
  { name: "2010's Hip-Hop", description: "Modern hip-hop hits", decade: "2010s", genre: "Hip-Hop", minPopularity: 35 },
  { name: "90's R&B", description: "Smooth R&B vibes from the 90s", decade: "1990s", genre: "R&B", minPopularity: 40 },
  { name: "2000's R&B", description: "The best R&B of the new millennium", decade: "2000s", genre: "R&B", minPopularity: 35 },
  
  // Country
  { name: "90's Country", description: "Country classics from the 1990s", decade: "1990s", genre: "Country", minPopularity: 35 },
  { name: "2000's Country", description: "Modern country hits", decade: "2000s", genre: "Country", minPopularity: 35 },
  
  // Other
  { name: "80's New Wave", description: "Synth-pop and new wave essentials", decade: "1980s", genre: "New Wave", minPopularity: 40 },
  { name: "Classic Soul", description: "Timeless soul and Motown", decade: "1970s", genre: "Soul", minPopularity: 35 },
  { name: "2020's Hits", description: "The hottest tracks of the 2020s", decade: "2020s", genre: "Pop", minPopularity: 35 },
];

export function getDecadeFromYear(year: number | null | undefined): string | null {
  if (!year || year < 1950 || year > 2029) return null;
  const decade = Math.floor(year / 10) * 10;
  return `${decade}s`;
}

// Map Plex genres to our station genres
export const GENRE_MAP: Record<string, string[]> = {
  'Rock': ['Rock', 'Alternative', 'Indie Rock', 'Hard Rock', 'Classic Rock', 'Punk', 'Metal', 'Grunge', 'Progressive Rock'],
  'Pop': ['Pop', 'Synthpop', 'Indie Pop', 'Electropop', 'Teen Pop', 'Power Pop', 'Art Pop'],
  'Dance': ['Dance', 'Electronic', 'EDM', 'House', 'Techno', 'Trance', 'Disco', 'Funk', 'Club'],
  'Hip-Hop': ['Hip-Hop', 'Rap', 'Hip Hop', 'Trap', 'Gangsta Rap', 'Conscious Hip Hop'],
  'R&B': ['R&B', 'Soul', 'Neo-Soul', 'Contemporary R&B', 'Rhythm and Blues'],
  'Country': ['Country', 'Country Rock', 'Americana', 'Outlaw Country'],
  'New Wave': ['New Wave', 'Post-Punk', 'Synth-Pop', 'Synthwave'],
  'Soul': ['Soul', 'Motown', 'Funk', 'Blues'],
};

export function mapGenreToStation(plexGenre: string | null | undefined, albumGenre?: string | null): string[] {
  // Try track genre first, then fall back to album genre
  const genreToCheck = plexGenre || albumGenre;
  if (!genreToCheck) return [];
  const results: string[] = [];
  for (const [stationGenre, plexGenres] of Object.entries(GENRE_MAP)) {
    if (plexGenres?.some?.((g: string) => genreToCheck?.toLowerCase?.()?.includes?.(g?.toLowerCase?.() ?? '') ?? false)) {
      results.push(stationGenre);
    }
  }
  return results;
}
