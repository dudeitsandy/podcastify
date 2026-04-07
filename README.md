# 🎙️ Podcastify

Discover your podcast DNA with AI-powered recommendations. Connect your Spotify, get personalized podcast suggestions, and share your listening profile.

![Status](https://img.shields.io/badge/status-active-brightgreen) ![Node](https://img.shields.io/badge/node-18%2B-blue) ![License](https://img.shields.io/badge/license-MIT-green)

## Features

✨ **AI-Powered Recommendations** - Claude analyzes your podcast taste and suggests 5 shows you'll love  
🎵 **Spotify Integration** - Securely connect and analyze your saved podcasts  
📊 **Listening Stats** - See your top genres and how many shows you follow  
📱 **Share Your DNA** - Generate a shareable card with your podcast profile  
⚡ **One-Click Deploy** - Deploy to Railway or Netlify in minutes  

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/yourusername/podcastify.git
cd podcastify
npm install
```

### 2. Get API Keys
- **Spotify**: https://developer.spotify.com/dashboard
- **Anthropic**: https://console.anthropic.com

### 3. Setup Environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

### 4. Run Locally
```bash
npm start
# Open http://localhost:3000
```

## Deployment

### Railway (Recommended)
```bash
# 1. Push to GitHub
git push origin main

# 2. Go to railway.app
# 3. New Project → Deploy from GitHub
# 4. Add environment variables
# 5. Done! Your app deploys automatically
```

**[Full deployment guide →](./DEPLOYMENT.md)**

## How It Works

```
User connects Spotify
    ↓
We fetch their saved shows
    ↓
Extract themes & genres
    ↓
Send to Claude AI
    ↓
AI generates 5 recommendations
    ↓
Display with reasons why
    ↓
Share with friends 🎉
```

## Tech Stack

- **Frontend**: Vanilla HTML/CSS/JS (no build step!)
- **Backend**: Node.js + Express
- **APIs**: Spotify Web API, Anthropic Claude API
- **Hosting**: Railway / Netlify
- **Database**: None (stateless)

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/auth/spotify` | Get Spotify auth URL |
| `GET` | `/callback` | Spotify OAuth callback |
| `POST` | `/api/recommendations` | Generate recommendations |

## Environment Variables

```env
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
ANTHROPIC_API_KEY=your_api_key
REDIRECT_URI=http://localhost:3000/callback
PORT=3000
```

## Troubleshooting

**"Redirect URI mismatch"** → Make sure REDIRECT_URI in .env matches Spotify dashboard exactly

**"No saved podcasts"** → User needs at least 1 saved show in Spotify first

**"Invalid API key"** → Check ANTHROPIC_API_KEY is correctly copied

[More help →](./DEPLOYMENT.md#troubleshooting)

## Future Ideas

- Search podcasts and launch in Spotify
- Save recommendations to a list
- Trending podcasts by genre
- Share recommendations with friends
- Mobile app

## Contributing

Contributions welcome! Feel free to:
- Report bugs
- Suggest features
- Submit PRs

## License

MIT - Build on this freely!

## Made With

- 🤖 Claude AI
- 🎵 Spotify API
- ⚡ Express.js
- 🚀 Railway/Netlify

---

**[Deploy Now](./DEPLOYMENT.md)** | **[Report Issue](https://github.com/yourusername/podcastify/issues)** | **[Feedback](https://twitter.com)**
