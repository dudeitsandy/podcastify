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

    // Extract show names and genres
    const showNames = shows.map(s => s.show.name).slice(0, 15);
    const genres = [...new Set(shows.flatMap(s => s.show.genres || []))].slice(0, 10);

    // Get user profile
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` }
    });

    const stats = {
      showsSaved: shows.length,
      genres: genres.length,
      topGenres: genres.slice(0, 6),
      userName: userResponse.data.display_name || 'Podcast Enthusiast'
    };

    // Return cached recommendations if available for this set of shows
    const cacheKey = buildCacheKey(showNames);
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ recommendations: cached, stats, cached: true });
    }

    // Call Claude API to generate recommendations
    let claudeResponse;
    try {
      claudeResponse = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [
            {
              role: 'user',
              content: `You're a podcast expert. Based on these shows someone listens to:
"${showNames.join('", "')}"

And these genres: ${genres.join(', ')}

Generate exactly 5 podcast recommendations they'll love. Format as JSON array with objects containing:
- name (string)
- host (string)
- description (1-2 sentences)
- why (why they'd like it based on their taste)

Return ONLY valid JSON, no markdown or other text.`
            }
          ]
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
        return res.status(503).json({
          error: 'Recommendations are temporarily unavailable due to high demand. Please try again later.'
        });
      }
      throw claudeError;
    }

    const content = claudeResponse.data.content[0].text;
    let recommendations;
    try {
      recommendations = JSON.parse(content);
    } catch {
      return res.status(500).json({ error: 'Failed to parse recommendations. Please try again.' });
    }

    setCache(cacheKey, recommendations);

    res.json({ recommendations, stats });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({
      error: error.message,
      details: error.response?.data
    });
  }
});

app.listen(PORT, () => {
  console.log(`🎙️ Podcastify server running on port ${PORT}`);
  console.log(`Make sure SPOTIFY_CLIENT_ID and ANTHROPIC_API_KEY are set in .env`);
});
