import express from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(cookieParser());
app.use(express.static('.'));

// Rate limiter: 5 recommendation requests per IP per hour
const recommendationsLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: 'Too many requests. Please try again in an hour.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// In-memory cache: cacheKey -> { data, expiresAt }
const cache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function buildCacheKey(showNames) {
  return crypto.createHash('sha256').update([...showNames].sort().join('|')).digest('hex');
}

// iTunes top podcasts chart cache (24hr TTL)
const itunesCache = { data: null, expiresAt: 0 };

async function getItunesCharts() {
  if (itunesCache.data && Date.now() < itunesCache.expiresAt) {
    return itunesCache.data;
  }
  const response = await axios.get(
    'https://itunes.apple.com/us/rss/toppodcasts/limit=100/json',
    { timeout: 5000 }
  );
  const charts = response.data.feed.entry.map((r, i) => ({ name: r['im:name'].label, position: i + 1 }));
  itunesCache.data = charts;
  itunesCache.expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  return charts;
}

function normalizeShowName(name) {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
}

function calculateChartStats(allShowNames, charts) {
  const matches = [];
  for (const showName of allShowNames) {
    const normalizedShow = normalizeShowName(showName);
    const chart = charts.find(c => {
      const normalizedChart = normalizeShowName(c.name);
      return normalizedShow === normalizedChart ||
             normalizedShow.includes(normalizedChart) ||
             normalizedChart.includes(normalizedShow);
    });
    if (chart) matches.push({ name: showName, position: chart.position });
  }
  matches.sort((a, b) => a.position - b.position);

  const score = Math.round((matches.length / allShowNames.length) * 100);
  let tasteProfile;
  if (score <= 30) tasteProfile = { label: 'Tastemaker', emoji: '🎯', desc: 'Your picks fly under the radar' };
  else if (score <= 60) tasteProfile = { label: 'Balanced', emoji: '🎧', desc: 'A mix of mainstream and hidden gems' };
  else tasteProfile = { label: 'Trendsetter', emoji: '📈', desc: "You're on top of the biggest shows" };

  return { inTopCharts: matches.length, topChartMatches: matches.slice(0, 3), tasteProfile };
}

// Spotify API credentials from environment
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI || 'http://localhost:3000/callback';

// Generate authorization URL
app.get('/auth/spotify', (req, res) => {
  const scopes = ['user-library-read', 'user-read-private'];
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', CLIENT_ID);
  authUrl.searchParams.append('response_type', 'code');
  authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.append('scope', scopes.join(' '));
  
  res.json({ url: authUrl.toString() });
});

// Handle Spotify callback
app.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  
  if (error) {
    return res.redirect(`/?error=${error}`);
  }

  try {
    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token } = tokenResponse.data;

    res.cookie('spotify_token', access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: REDIRECT_URI.startsWith('https'),
      maxAge: 60 * 60 * 1000, // 1 hour, matching Spotify token expiry
    });
    res.redirect('/?connected=true');
  } catch (error) {
    console.error('Token exchange error:', error.message);
    res.redirect('/?error=token_exchange_failed');
  }
});

// Get user's saved podcasts and generate recommendations
app.post('/api/recommendations', recommendationsLimiter, async (req, res) => {
  const token = req.cookies.spotify_token;

  if (!token) {
    return res.status(401).json({ error: 'Not connected to Spotify. Please reconnect.' });
  }

  try {
    // Fetch saved shows
    let showsResponse;
    try {
      showsResponse = await axios.get('https://api.spotify.com/v1/me/shows', {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 50 }
      });
    } catch (spotifyError) {
      if (spotifyError.response?.status === 401) {
        res.clearCookie('spotify_token');
        return res.status(401).json({ error: 'Spotify session expired. Please reconnect.' });
      }
      throw spotifyError;
    }

    const shows = showsResponse.data.items;

    if (shows.length === 0) {
      return res.status(400).json({ error: 'No saved podcasts found' });
    }

    // Extract show names — all for exclusion, subset for taste analysis
    const allShowNames = shows.map(s => s.show.name);
    const showNames = allShowNames.slice(0, 15);

    // Fetch user profile and iTunes charts in parallel
    const [userResponse, charts] = await Promise.all([
      axios.get('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${token}` } }),
      getItunesCharts().catch(e => { console.error('iTunes chart fetch failed:', e.message); return null; })
    ]);

    const chartStats = charts ? calculateChartStats(allShowNames, charts) : null;

    const stats = {
      showsSaved: shows.length,
      userName: userResponse.data.display_name || 'Podcast Enthusiast',
      ...(chartStats && { chartStats })
    };

    const recommendations = await getRecommendations(allShowNames);
    res.json({ recommendations, stats });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message, details: error.response?.data });
  }
});

async function getRecommendations(allShowNames) {
  const showNames = allShowNames.slice(0, 15);
  const cacheKey = buildCacheKey(showNames);
  const cached = getCached(cacheKey);
  if (cached) return cached;

  let claudeResponse;
  try {
    claudeResponse = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: `You're a podcast expert. Based on these shows someone listens to:
"${showNames.join('", "')}"

Generate exactly 5 podcast recommendations they'll love. Do NOT recommend any of the following shows they already follow:
"${allShowNames.join('", "')}"

Format as JSON array with objects containing:
- name (string)
- host (string)
- description (1-2 sentences)
- why (why they'd like it based on their taste)

Return ONLY valid JSON, no markdown or other text.`
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
  } catch (claudeError) {
    const status = claudeError.response?.status;
    if (status === 429 || status === 402) {
      const err = new Error('Recommendations are temporarily unavailable due to high demand. Please try again later.');
      err.statusCode = 503;
      throw err;
    }
    throw claudeError;
  }

  const content = claudeResponse.data.content[0].text;
  let recommendations;
  try {
    recommendations = JSON.parse(content);
  } catch {
    const err = new Error('Failed to parse recommendations. Please try again.');
    err.statusCode = 500;
    throw err;
  }

  setCache(cacheKey, recommendations);
  return recommendations;
}

// Generate recommendations from an OPML-parsed show list
app.post('/api/recommendations/opml', recommendationsLimiter, async (req, res) => {
  const { showNames } = req.body;

  if (!Array.isArray(showNames) || showNames.length === 0) {
    return res.status(400).json({ error: 'No shows provided.' });
  }

  const allShowNames = showNames.slice(0, 50).map(s => String(s).trim()).filter(Boolean);

  if (allShowNames.length === 0) {
    return res.status(400).json({ error: 'No valid shows found in your OPML file.' });
  }

  try {
    const [charts, recommendations] = await Promise.all([
      getItunesCharts().catch(e => { console.error('iTunes chart fetch failed:', e.message); return null; }),
      getRecommendations(allShowNames)
    ]);

    const chartStats = charts ? calculateChartStats(allShowNames, charts) : null;
    const stats = {
      showsSaved: allShowNames.length,
      userName: 'Podcast Fan',
      ...(chartStats && { chartStats })
    };

    res.json({ recommendations, stats });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    console.error('OPML recommendations error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🎙️ Podcastify server running on port ${PORT}`);
  console.log(`Make sure SPOTIFY_CLIENT_ID and ANTHROPIC_API_KEY are set in .env`);
});
