# 🎵 Plex Jukebox (PlexTunes)

A self-hosted, TouchTunes-style jukebox interface for your Plex music library. Beautiful cover art, synchronized lyrics, smart stations, and touch-optimized navigation — all in a Docker container.

![PlexTunes](https://img.shields.io/docker/pulls/gilligan5000/plextunes?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)

## ✨ Features

- **🎨 TouchTunes-Style Interface** — Dark theme with neon accents, optimized for large touchscreens
- **🎤 Synchronized Lyrics** — Real-time lyrics displayed during playback via Genius API
- **📻 Smart Stations** — Auto-generated stations by decade & genre, featuring only popular mainstream hits
- **🔍 Smart Navigation** — Highlights popular songs, with easy deep-dive into full artist catalogs
- **🖼️ Beautiful Visuals** — Cover art prominently displayed with vinyl animations
- **📱 Touch-Friendly** — Large buttons, smooth gestures, designed for touchscreen kiosks

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- A Plex Media Server with music libraries
- API keys for [Genius](https://genius.com/api-clients) and [Spotify](https://developer.spotify.com/dashboard)

### 1. Create your environment file

```bash
mkdir plextunes && cd plextunes

cat > .env << EOF
GENIUS_ACCESS_TOKEN=your_genius_token_here
SPOTIFY_CLIENT_ID=your_spotify_client_id_here
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret_here
EOF
```

### 2. Create your docker-compose.yml

```yaml
version: '3.8'

services:
  plextunes:
    image: gilligan5000/plextunes:latest
    container_name: plexTunes
    ports:
      - "30071:3000"
    environment:
      - DATABASE_URL=postgresql://jukebox:jukebox@plextunes-db:5432/jukebox
      - GENIUS_ACCESS_TOKEN=${GENIUS_ACCESS_TOKEN}
      - SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
      - SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
    depends_on:
      plextunes-db:
        condition: service_healthy
    restart: unless-stopped

  plextunes-db:
    image: postgres:15-alpine
    container_name: plexTunes-db
    environment:
      - POSTGRES_USER=jukebox
      - POSTGRES_PASSWORD=jukebox
      - POSTGRES_DB=jukebox
    volumes:
      - plextunes-pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jukebox"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  plextunes-pgdata:
```

### 3. Launch

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

In Portainer, create a new Stack and paste the `docker-compose.yml` contents above. Add your environment variables (GENIUS_ACCESS_TOKEN, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET) in the Environment section.

## 🛠️ Building from Source

```bash
git clone https://github.com/gilligan5000/plexTunes.git
cd plexTunes
docker compose -f docker-compose.build.yml up -d --build
```

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string (auto-configured in compose) |
| `GENIUS_ACCESS_TOKEN` | Yes | [Genius API](https://genius.com/api-clients) token for lyrics |
| `SPOTIFY_CLIENT_ID` | Yes | [Spotify API](https://developer.spotify.com/dashboard) client ID for popularity data |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify API client secret |

## 📄 License

MIT
