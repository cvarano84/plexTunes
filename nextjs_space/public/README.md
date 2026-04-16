# 🎵 HomeBarr Tunes

A self-hosted, TouchTunes-style jukebox interface for your Plex music library. Part of the *arr family of self-hosted apps. Beautiful cover art, synchronized lyrics, smart stations, animated backgrounds, and touch-optimized navigation — all in a Docker container.

![HomeBarr Tunes](https://img.shields.io/docker/pulls/gilligan5000/plextunes?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

## ✨ Features

- **🎨 TouchTunes-Style Interface** — Dark theme with neon accents, optimized for large touchscreens and kiosks
- **🎤 Synchronized Lyrics** — Real-time karaoke-style lyrics via LRCLIB with Genius fallback
- **📻 Smart Stations** — Auto-generated stations by decade & genre from your Plex library
- **🎛️ Custom Mixes** — Combine stations and artists into personalized mix playlists
- **🎵 Party Beat** — Auto-detects song BPM (via Deezer) and adjusts tempo to keep the party at 120–130 BPM
- **🌊 Sweet Fades** — Gapless crossfade transitions between tracks with dual-deck audio engine
- **🌌 Animated Backgrounds** — Canvas-based visual effects (aurora, particles, waves, nebula, gradient) with optional music reactivity
- **🔊 10-Band Equalizer** — Built-in Web Audio EQ with visual LED bars
- **📱 Mobile Remote** — Phone-friendly remote control page at `/mobile`
- **📺 TV Display** — Dedicated read-only display page at `/tv` for casting "Now Playing" to a TV browser
- **🔍 Full-Text Search** — Search across artists, albums, and tracks instantly
- **🅰️ A–Z Quick Jump** — Alphabet navigation bar for fast artist browsing
- **📊 Top Played** — Track play statistics and billboard chart data
- **⌨️ Touch Keyboard** — On-screen keyboard for kiosk setups without a physical keyboard

## 📸 Screenshots

### Now Playing
Synchronized lyrics, album art with spinning vinyl, track history, and queue management.

![Now Playing](screenshots/now-playing.png)

### Smart Stations
Auto-generated stations from your library — browse by decade, genre, or popularity.

![Stations](screenshots/stations.png)

### Artists
A–Z quick-jump navigation with circular artist portraits and album counts.

![Artists](screenshots/artists.png)

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- A Plex Media Server with music libraries

### 1. Create your docker-compose.yml

All configuration is done directly in the YAML — no `.env` file needed.

```yaml
version: '3.8'

services:
  homebarr:
    image: gilligan5000/plextunes:latest
    container_name: homebarr-tunes
    ports:
      - "30071:3000"
    environment:
      - DATABASE_URL=postgresql://jukebox:jukebox@homebarr-db:5432/jukebox
      # Optional: Add API keys for enhanced features
      # - GENIUS_ACCESS_TOKEN=your_genius_token_here      # Enhanced lyrics
      # - SPOTIFY_CLIENT_ID=your_spotify_client_id         # Popularity data
      # - SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
      # - LASTFM_API_KEY=your_lastfm_key                  # Popularity fallback
    depends_on:
      homebarr-db:
        condition: service_healthy
    restart: unless-stopped

  homebarr-db:
    image: postgres:15-alpine
    container_name: homebarr-db
    environment:
      - POSTGRES_USER=jukebox
      - POSTGRES_PASSWORD=jukebox
      - POSTGRES_DB=jukebox
    volumes:
      - homebarr-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jukebox"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  homebarr-pgdata:
```

### 2. Launch

```bash
docker compose up -d
```

Open `http://your-server-ip:30071` and complete the setup wizard:
1. Enter your Plex server URL (e.g., `http://192.168.1.100:32400`)
2. Enter your [Plex authentication token](https://support.plex.tv/articles/204059436-finding-an-authentication-token-x-plex-token/)
3. Select your music library and sync

## 🔄 Updating

```bash
docker compose pull
docker compose up -d
```

Your Plex credentials and library cache are stored in the PostgreSQL volume and persist across updates.

## 🏗️ Portainer Stack

In Portainer, create a new Stack and paste the `docker-compose.yml` contents above. API keys can be added directly in the environment section of the YAML.

## 🛠️ Building from Source

```bash
git clone https://github.com/gilligan5000/plexTunes.git
cd plexTunes
docker compose -f docker-compose.build.yml up -d --build
```

## 📺 Remote Viewing

HomeBarr Tunes includes two companion pages:

| Page | URL | Purpose |
|------|-----|--------|
| **Mobile Remote** | `/mobile` | Phone-friendly queue management and browsing |
| **TV Display** | `/tv` | Read-only "Now Playing" view for casting to a TV browser |

To display on a TV: open `http://your-server-ip:30071/tv` in any browser on your TV (smart TV, Fire Stick, Chromecast with browser, etc.). The page auto-refreshes and shows album art, synced lyrics, and track info — no interaction needed.

## 🔧 Optional API Keys

HomeBarr Tunes works out of the box with no API keys. These optional services enhance specific features:

| Variable | Required | Description |
|----------|----------|-------------|
| `GENIUS_ACCESS_TOKEN` | No | [Genius API](https://genius.com/api-clients) — fallback lyrics when LRCLIB doesn't have synced lyrics |
| `SPOTIFY_CLIENT_ID` | No | [Spotify API](https://developer.spotify.com/dashboard) — enhanced popularity scoring for smart stations |
| `SPOTIFY_CLIENT_SECRET` | No | Spotify API client secret |
| `LASTFM_API_KEY` | No | [Last.fm API](https://www.last.fm/api) — alternative popularity provider |

**Note:** Lyrics primarily come from LRCLIB (free, no key needed). BPM data comes from Deezer (free, no key needed). Popularity defaults to Deezer if no Spotify/Last.fm keys are configured.

## 📄 License

MIT
