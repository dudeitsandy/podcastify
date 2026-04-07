# 🎙️ Podcastify Deployment Guide

A full-stack podcast recommendation app powered by Spotify API + Claude AI. Deploy to Netlify or Railway in 15 minutes.

## Quick Setup

### Step 1: Get Your API Keys

#### Spotify API Credentials
1. Go to https://developer.spotify.com/dashboard
2. Log in (create account if needed)
3. Click "Create an App"
4. Accept terms and create
5. Copy your **Client ID** and **Client Secret**
6. Go to app settings and set Redirect URI to:
   - **Localhost**: `http://localhost:3000/callback`
   - **Railway**: `https://your-app.railway.app/callback`
   - **Netlify**: `https://your-app.netlify.app/callback`

#### Anthropic API Key
1. Go to https://console.anthropic.com
2. Sign up or log in
3. Navigate to API keys
4. Create a new API key
5. Copy it (you won't see it again!)

---

## Deployment Option A: Railway.app (Recommended - Easiest)

Railway is the simplest option. Your app runs on their servers with automatic deployments.

### Setup:
1. Go to https://railway.app
2. Sign up with GitHub account
3. Click "New Project" → "Deploy from GitHub"
4. Connect your GitHub repo with this code
5. Add environment variables:
   - `SPOTIFY_CLIENT_ID` = your client id
   - `SPOTIFY_CLIENT_SECRET` = your client secret
   - `ANTHROPIC_API_KEY` = your api key
   - `REDIRECT_URI` = https://your-app.railway.app/callback (get domain from Railway)
   - `PORT` = 3000
6. Railway auto-deploys on push to main

**Your URL**: Railway gives you a free domain automatically

---

## Deployment Option B: Netlify (Alternative)

Netlify works but requires converting to Netlify Functions for serverless backend.

### Setup:
1. Push code to GitHub
2. Go to https://netlify.com
3. Click "New site from Git" → Connect GitHub
4. Select your repo
5. Set build command to: `npm install`
6. Set publish directory to: `public` (create this folder first)
7. Add environment variables in Site Settings → Build & Deploy:
   - `SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
   - `ANTHROPIC_API_KEY`
   - `REDIRECT_URI` = https://your-app.netlify.app/callback

⚠️ Note: Netlify's free tier doesn't support full Node.js servers easily. Railway is recommended.

---

## Local Development

### Install dependencies:
```bash
npm install
```

### Create .env file:
```bash
cp .env.example .env
# Edit .env with your actual keys
```

### Run locally:
```bash
npm start
# Visit http://localhost:3000
```

---

## File Structure

```
podcastify/
├── server.js              # Node.js backend
├── index.html             # Frontend (served as public)
├── package.json           # Dependencies
├── railway.json           # Railway config
├── netlify.toml           # Netlify config
├── .env.example           # Environment template
└── .gitignore             # Git ignore file
```

---

## Troubleshooting

### "Redirect URI mismatch" error
- Make sure REDIRECT_URI in your .env matches exactly what you set in Spotify dashboard
- Include the full URL: `https://your-domain.app/callback`

### "Invalid API key" error
- Check your ANTHROPIC_API_KEY is correctly copied
- Make sure there are no extra spaces

### "No saved podcasts found"
- User needs to have at least 1 podcast saved in their Spotify library
- Have them save a show first, then try again

### Recommendations not generating
- Check your Anthropic API quota isn't exceeded
- Ensure ANTHROPIC_API_KEY is valid

---

## What This App Does

1. **User logs in** with Spotify
2. **We fetch** their saved podcasts (up to 50)
3. **Extract** show names and genres
4. **Send to Claude AI** with context about their taste
5. **Generate** 5 personalized podcast recommendations
6. **Display** with explanation of why each is recommended
7. **Allow sharing** their "podcast DNA"

---

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `SPOTIFY_CLIENT_ID` | From Spotify Dashboard | `abc123def456` |
| `SPOTIFY_CLIENT_SECRET` | From Spotify Dashboard | `xyz789abc123` |
| `ANTHROPIC_API_KEY` | From Anthropic Console | `sk-ant-v7-...` |
| `REDIRECT_URI` | OAuth callback URL | `https://myapp.railway.app/callback` |
| `PORT` | Server port | `3000` |

---

## Next Steps

- [x] Deploy to Railway/Netlify
- [ ] Share with friends
- [ ] Get feedback
- [ ] Add podcast search/launch links
- [ ] Add ability to save recommendations
- [ ] Mobile app version

---

## Support

Having issues? Check:
1. Are all environment variables set correctly?
2. Is your Spotify redirect URI exact match?
3. Do you have API quota remaining?
4. Try local dev first: `npm start`

---

Made with 🎙️ and Claude
