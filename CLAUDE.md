# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run the server (development and production use the same command)
npm start
# Server available at http://localhost:3000
```

No build step, no linter, no test suite configured.

## Architecture

Single-page app with a Node.js/Express backend and a no-framework frontend. No database — fully stateless. ES modules (`"type": "module"`).

### Key files

- `server.js` — all Express routes, Spotify OAuth, Anthropic API calls, iTunes chart fetch
- `index.html` — entire frontend: HTML, embedded CSS, inline JS. No separate files.
- `assets/ghostweave_logo.png` — Ghostweave Labs logo used in footer and share card
- `.env.example` — documents all required environment variables

Static files served from project root via `express.static('.')`.

### Request flows

**Spotify OAuth:**
1. `GET /auth/spotify` → returns Spotify OAuth URL
2. User authorizes → Spotify redirects to `GET /callback`
3. Backend exchanges code for access token, sets `HttpOnly` cookie (`spotify_token`), redirects to `/?connected=true`
4. Frontend detects `?connected=true`, calls `POST /api/recommendations` (cookie sent automatically)
5. Backend fetches up to 50 saved shows, computes iTunes chart stats, calls `getRecommendations()`, returns response

**OPML upload:**
1. User uploads `.opml`/`.xml` file — parsed client-side via browser `DOMParser`
2. Frontend extracts show names, posts `{ showNames }` to `POST /api/recommendations/opml`
3. Backend fetches iTunes charts, computes taste profile, calls `getRecommendations()`, returns response

**Shared recommendation logic (`getRecommendations(allShowNames, tasteProfile)`):**
- Top 15 show names used for taste analysis; full list passed as exclusion list
- Cache key: SHA-256(sorted show names + taste profile label), 24hr TTL
- Claude prompt speaks directly to user ("you/your"), flavoured by taste profile
- Taste profile must be computed before calling `getRecommendations` so it can bias the prompt

### Taste profiles (iTunes chart cross-reference)

Apple iTunes RSS: `https://itunes.apple.com/us/rss/toppodcasts/limit=100/json` (24hr cache)

| Profile | Threshold | Claude prompt bias |
|---|---|---|
| Tastemaker | 0–30% of shows in top 100 | Lean niche/independent |
| Balanced | 31–60% | Mix mainstream + hidden gems |
| Trendsetter | 61%+ | Popular picks are fine |

Note: Spotify does not populate `show.genres` for podcasts — genres were removed from the UI entirely.

### Environment variables

| Variable | Purpose |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `REDIRECT_URI` | Must match Spotify dashboard exactly (default: `http://localhost:3000/callback`) |
| `PORT` | Server port (default: 3000) |

### Cost controls

- `express-rate-limit`: 5 req/IP/hour on both recommendation routes
- In-memory cache (24hr TTL) — repeat users with same library skip Claude entirely
- Anthropic 402/429 → clean 503 to user; auto-reload disabled in Anthropic console
- `app.set('trust proxy', 1)` required — Railway sits behind a proxy

### Deployment

- Railway: push to GitHub, Railway auto-deploys. Live at `podcastify-production-e035.up.railway.app`
- `REDIRECT_URI` env var must be set to the Railway domain in Railway's Variables tab
- Spotify dashboard must whitelist the production callback URL
- `railway.json` and `netlify.toml` present for one-click deploys

### Share card

Canvas-drawn PNG (2× retina). Drawn entirely with the Canvas API — no extra libraries. Shows: waveform bars, taste profile, top 5 recommendations, stats, Ghostweave logo. Mobile uses Web Share API with file; desktop downloads PNG.

## Planned next features (priority order)

1. **Manual show entry** — Text input for 5–10 show names. No account needed. Should become the hero flow above OPML and Spotify.
2. **Provider card UI** — Branded source-picker cards when 3+ sources exist (currently using stacked layout).
3. **YouTube Data API** — OAuth, subscribed podcast channels. Medium effort.
4. **OPML drag-and-drop** — Currently click-to-upload only.

## Known constraints

- **Spotify dev mode limited to 25 users** without 250k MAU. Not worth pursuing quota extension — prefer no-auth sources (OPML, manual entry).
- **No-auth approaches preferred** for new sources — OPML covers Overcast, Pocket Casts, Castro, AntennaPod, Podcast Addict via their export features.
