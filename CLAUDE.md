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

Single-page app with a Node.js/Express backend and a no-framework frontend. No database — fully stateless.

### Request flow

1. Frontend (`index.html`) calls `GET /auth/spotify` → backend returns Spotify OAuth URL
2. User authorizes → Spotify redirects to `GET /callback` with a code
3. Backend exchanges code for an access token and redirects to `/?token=<token>`
4. Frontend detects the token in the URL (then strips it from history), calls `POST /api/recommendations`
5. Backend fetches up to 50 saved shows from Spotify, extracts names/genres, sends them to the Claude API (`claude-sonnet-4-20250514`), and returns 5 JSON recommendations plus stats
6. Frontend renders recommendations and stats; share button uses the Web Share API with a Twitter fallback

### Key files

- `server.js` — Express server with all three API routes; Spotify OAuth and Anthropic API calls live here
- `index.html` — entire frontend: HTML, embedded CSS, and inline `<script>` with all client-side logic (no separate JS/CSS files)
- `.env.example` — documents all required environment variables

### Environment variables

| Variable | Purpose |
|---|---|
| `SPOTIFY_CLIENT_ID` | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify app client secret |
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `REDIRECT_URI` | Must match the redirect URI registered in the Spotify dashboard (default: `http://localhost:3000/callback`) |
| `PORT` | Server port (default: 3000) |

### Deployment

- `railway.json` and `netlify.toml` are present for one-click deploys; update `REDIRECT_URI` to the production domain when deploying.
- The Spotify dashboard must have the production `REDIRECT_URI` whitelisted, or OAuth will fail with a "Redirect URI mismatch" error.
