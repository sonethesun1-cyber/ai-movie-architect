require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const session = require('express-session');
const Anthropic = require('@anthropic-ai/sdk');

// Never let one bad request take the whole server down. Without these
// handlers, an error thrown outside a try/catch (e.g. inside an async
// Express 4 route handler) becomes an "unhandled rejection", and Node
// terminates the process by default — which is exactly what makes the
// browser see a hard "Failed to fetch" with no HTTP response at all.
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
const ENV_PATH = path.join(__dirname, '.env');
const USAGE_PATH = path.join(__dirname, 'usage-stats.json');

// ---------------------------------------------------------------------------
// Usage / cost tracker. The Anthropic API has no endpoint to read back your
// account's actual dollar balance, so this can't show a real "remaining
// credit" figure — instead it counts the input/output tokens this app itself
// has sent and received (each response carries a `usage` field) and prices
// them at the model's published per-token rate, purely as a running total of
// what this app has spent so far. Persisted to a small JSON file so it
// survives a restart; note this resets if a host wipes its disk on redeploy.
// ---------------------------------------------------------------------------
const MODEL_PRICING_PER_MTOK = { // { input: $ per 1M input tokens, output: $ per 1M output tokens }
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

let usageStats = { generations: 0, inputTokens: 0, outputTokens: 0 };
try {
  usageStats = Object.assign(usageStats, JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8')));
} catch (e) { /* no usage file yet — start from zero */ }

function saveUsageStats() {
  try {
    fs.writeFileSync(USAGE_PATH, JSON.stringify(usageStats, null, 2));
  } catch (e) {
    console.error('[usage] could not persist usage-stats.json:', e.message);
  }
}

function recordUsage(apiUsage) {
  if (!apiUsage) return;
  usageStats.generations += 1;
  usageStats.inputTokens += apiUsage.input_tokens || 0;
  usageStats.outputTokens += apiUsage.output_tokens || 0;
  // Prompt-caching token fields, if this app ever enables caching — counted
  // at input price so the running total doesn't silently under-report.
  usageStats.inputTokens += apiUsage.cache_creation_input_tokens || 0;
  usageStats.inputTokens += apiUsage.cache_read_input_tokens || 0;
  saveUsageStats();
}

function getUsageSummary() {
  const pricing = MODEL_PRICING_PER_MTOK[MODEL] || MODEL_PRICING_PER_MTOK['claude-sonnet-5'];
  const estimatedCostUsd =
    (usageStats.inputTokens / 1e6) * pricing.input +
    (usageStats.outputTokens / 1e6) * pricing.output;
  return {
    generations: usageStats.generations,
    inputTokens: usageStats.inputTokens,
    outputTokens: usageStats.outputTokens,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
    model: MODEL,
    pricingKnown: Boolean(MODEL_PRICING_PER_MTOK[MODEL]),
  };
}

// Trim defensively: a stray trailing newline/space in .env (common when a
// key is pasted from a browser or a Windows editor) can otherwise produce
// an invalid HTTP header and break every request to the Anthropic API.
// `let` (not `const`) because /api/set-key below lets the app save a key
// from the browser and start using it immediately, with no restart needed.
let apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
let anthropic = new Anthropic({
  apiKey, // stays server-side only, never sent to the browser
  timeout: 180000, // 3 minutes — fail with a clear error instead of hanging
});

// ---------------------------------------------------------------------------
// Optional access gate — matters once this app is deployed somewhere public.
// Locally, with SITE_PASSWORD unset, the app behaves exactly as before (no
// login screen at all). Set SITE_PASSWORD (in .env, or in your host's
// environment-variable dashboard) and every page/API call requires a
// matching session cookie first, so a stranger who finds the public URL
// can't spend your Anthropic credits.
// ---------------------------------------------------------------------------
const SITE_PASSWORD = (process.env.SITE_PASSWORD || '').trim();

app.set('trust proxy', 1); // most hosts (Render/Railway/etc.) sit behind a proxy; needed for correct secure cookies / client IPs
app.use(session({
  secret: crypto.createHash('sha256').update(SITE_PASSWORD || 'ai-movie-architect-local-default').digest('hex'),
  name: 'ama.sid',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 14, // 2 weeks
  },
}));

const LOGIN_PAGE_HTML = `<!DOCTYPE html>
<html lang="lo" class="dark"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Movie Architect — Login</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Noto+Sans+Lao:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0B0D14;color:#E2E8F0;font-family:'Inter','Noto Sans Lao',sans-serif;}
  .card{background:rgba(19,23,34,0.9);border:1px solid rgba(255,255,255,0.08);border-radius:20px;padding:32px;width:100%;max-width:360px;box-shadow:0 20px 60px rgba(0,0,0,0.5);}
  h1{font-size:17px;margin:0 0 4px;background:linear-gradient(90deg,#fff,#818CF8);-webkit-background-clip:text;background-clip:text;color:transparent;}
  p{font-size:12px;color:#94A3B8;margin:0 0 20px;}
  input{width:100%;box-sizing:border-box;background:rgba(30,35,51,0.6);border:1px solid rgba(255,255,255,0.12);color:#F8FAFC;border-radius:12px;padding:11px 12px;font-size:13px;margin-bottom:12px;}
  input:focus{outline:none;border-color:#6366F1;box-shadow:0 0 0 2px rgba(99,102,241,0.25);}
  button{width:100%;background:linear-gradient(90deg,#4F46E5,#7C3AED);color:#fff;border:none;border-radius:12px;padding:11px;font-size:13px;font-weight:600;cursor:pointer;}
  button:disabled{opacity:0.6;cursor:not-allowed;}
  #err{color:#FB7185;font-size:12px;min-height:16px;margin-top:8px;}
</style></head>
<body>
  <form class="card" id="loginForm">
    <h1>AI Movie Architect</h1>
    <p>ໃສ່ລະຫັດຜ່ານເພື່ອເຂົ້າໃຊ້ (Enter the access password)</p>
    <input type="password" id="pw" placeholder="Password" autofocus autocomplete="current-password">
    <button type="submit" id="btn">ເຂົ້າສູ່ລະບົບ (Log in)</button>
    <div id="err"></div>
  </form>
  <script>
    document.getElementById('loginForm').addEventListener('submit', async function (e) {
      e.preventDefault();
      const btn = document.getElementById('btn');
      const err = document.getElementById('err');
      err.innerText = '';
      btn.disabled = true;
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: document.getElementById('pw').value })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed.');
        window.location.href = '/';
      } catch (ex) {
        err.innerText = ex.message;
        btn.disabled = false;
      }
    });
  </script>
</body></html>`;

app.get('/login', (req, res) => {
  if (!SITE_PASSWORD) return res.redirect('/'); // no password configured — nothing to log in to
  res.type('html').send(LOGIN_PAGE_HTML);
});

app.post('/api/login', express.json(), (req, res) => {
  if (!SITE_PASSWORD) return res.json({ ok: true }); // protection disabled
  const submitted = ((req.body && req.body.password) || '').toString();
  if (submitted !== SITE_PASSWORD) {
    return res.status(401).json({ error: 'ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ (incorrect password).' });
  }
  req.session.authenticated = true;
  res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

// Gate everything else behind the password, when one is configured. Placed
// after /login and /api/login (registered above) so those two always stay
// reachable; everything registered below this line requires a session.
app.use((req, res, next) => {
  if (!SITE_PASSWORD) return next(); // local/no-password mode: unchanged behavior
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ error: 'Please log in first.', loginRequired: true });
  }
  return res.redirect('/login');
});

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// The duration <select> values are fixed strings like "2 Minutes (12 Scenes)".
function getSceneCount(duration) {
  const match = /\((\d+)\s*Scenes?\)/i.exec(duration || '');
  if (match) return parseInt(match[1], 10);
  return 6; // sensible fallback
}

// The format <select> values are fixed strings like "9:16 Vertical (...)".
function getAspectRatio(format) {
  if (!format) return '9:16';
  if (format.includes('9:16')) return '9:16';
  if (format.includes('16:9')) return '16:9';
  if (format.includes('1:1')) return '1:1';
  return '9:16';
}

function formatTimeRange(startSeconds, endSeconds) {
  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0');
  };
  return `${fmt(startSeconds)} - ${fmt(endSeconds)}`;
}

// ---------------------------------------------------------------------------
// Tool schema Claude must fill in — this is what guarantees structured,
// render-ready JSON instead of free-form prose we'd have to parse ourselves.
// ---------------------------------------------------------------------------

function buildToolDefinition(sceneCount) {
  return {
    name: 'submit_movie_package',
    description:
      'Submit one complete, internally-consistent AI movie production package for the AI Movie Architect app.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Movie title, Lao with an English translation in parentheses.' },
        logline: { type: 'string', description: '1-2 sentence Lao-language logline summarizing the story.' },
        theme: { type: 'string', description: 'Emotional theme / tone, in Lao.' },
        artStyle: { type: 'string', description: 'Short English description of the overall visual art style (for consistent image generation), e.g. "3D Pixar render, vibrant lighting...".' },
        act1: { type: 'string', description: 'Act 1 (Beginning) summary, in Lao.' },
        act2: { type: 'string', description: 'Act 2 (Middle / climax build) summary, in Lao.' },
        act3: { type: 'string', description: 'Act 3 (Ending / resolution) summary, in Lao.' },
        voiceover: {
          type: 'array',
          description: `Exactly ${sceneCount} narration segments, one per 10-second scene, covering the full runtime in order.`,
          minItems: sceneCount,
          maxItems: sceneCount,
          items: {
            type: 'object',
            properties: {
              time: { type: 'string', description: 'Timecode range like "00:00 - 00:10".' },
              emotion: { type: 'string', description: 'Emotional tone tag in Lao, e.g. "ຕື່ນເຕັ້ນ".' },
              text: { type: 'string', description: 'Natural, modern spoken Lao narration for this segment.' },
            },
            required: ['time', 'emotion', 'text'],
          },
        },
        characters: {
          type: 'array',
          description: '2 to 4 main characters.',
          minItems: 2,
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Character name in Lao with English transliteration in parentheses.' },
              age: { type: 'string', description: 'Age, in Lao (e.g. "10 ປີ").' },
              role: { type: 'string', description: 'Role in the story, in Lao.' },
              visual: { type: 'string', description: 'Detailed visual description (face, hair, eyes, body, outfit) in Lao.' },
              anchor: { type: 'string', description: 'Standardized ENGLISH character-anchor prompt string, richly descriptive, to append to every image prompt featuring this character for visual consistency, ending with an --ar aspect ratio tag.' },
            },
            required: ['name', 'age', 'role', 'visual', 'anchor'],
          },
        },
        storyboard: {
          type: 'array',
          description: `Exactly ${sceneCount} scenes, 10 seconds each, covering the full runtime in order.`,
          minItems: sceneCount,
          maxItems: sceneCount,
          items: {
            type: 'object',
            properties: {
              scene: { type: 'integer', description: 'Scene number starting at 1.' },
              time: { type: 'string', description: 'Timecode range like "00:00 - 00:10".' },
              desc: { type: 'string', description: 'Short scene description in Lao.' },
              imagePrompt: { type: 'string', description: 'ENGLISH text-to-image prompt optimized for Midjourney/Flux/Google Flow: subject, camera angle, lighting, style. Must reuse the relevant character anchor prompt wording for consistency and end with an --ar aspect ratio tag.' },
              motionPrompt: { type: 'string', description: 'ENGLISH image-to-video camera motion prompt for Kling/Runway (e.g. panning right, slow zoom in, dynamic camera angle).' },
            },
            required: ['scene', 'time', 'desc', 'imagePrompt', 'motionPrompt'],
          },
        },
        locations: {
          type: 'array',
          description: '2 to 4 main settings/environments.',
          minItems: 2,
          maxItems: 4,
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Location name in Lao with English translation in parentheses.' },
              desc: { type: 'string', description: 'Short description in Lao.' },
              prompt: { type: 'string', description: 'ENGLISH environment-only background prompt (no characters) for generating a background plate, ending with an --ar aspect ratio tag.' },
            },
            required: ['name', 'desc', 'prompt'],
          },
        },
        posters: {
          type: 'array',
          description: 'Exactly 3 distinct movie poster/thumbnail concepts.',
          minItems: 3,
          maxItems: 3,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string', description: 'Concept label, e.g. "Poster Concept 1: Vertical TikTok/Shorts (9:16)".' },
              prompt: { type: 'string', description: 'ENGLISH text-to-image prompt for generating the poster art, ending with an --ar aspect ratio tag.' },
              textOverlay: { type: 'string', description: 'Text overlay recommendation (title placement + catchphrase), Lao title with English where relevant.' },
            },
            required: ['title', 'prompt', 'textOverlay'],
          },
        },
        social: {
          type: 'object',
          description: 'Social media & upload package.',
          properties: {
            titles: {
              type: 'array',
              description: 'Exactly 3 click-worthy title options mixing Lao and English keywords.',
              minItems: 3,
              maxItems: 3,
              items: { type: 'string' },
            },
            description: { type: 'string', description: 'Engaging Lao video description including a timestamp/chapter list, suitable for YouTube/TikTok.' },
            hashtags: { type: 'string', description: 'Space-separated hashtags recommended for the selected platforms.' },
            keywords: { type: 'string', description: 'Comma-separated SEO keywords for platform discovery.' },
          },
          required: ['titles', 'description', 'hashtags', 'keywords'],
        },
        audio: {
          type: 'array',
          description: 'Audio prompts: at least one background music prompt (Suno/Udio) and one time-coded SFX list.',
          minItems: 2,
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', description: 'e.g. "Background Music (Suno / Udio Prompt)" or "Sound Effects (SFX List)".' },
              prompt: { type: 'string', description: 'ENGLISH prompt text (mood/tempo/instruments for music, or time-coded ambient sounds for SFX).' },
            },
            required: ['type', 'prompt'],
          },
        },
      },
      required: [
        'title', 'logline', 'theme', 'artStyle', 'act1', 'act2', 'act3',
        'voiceover', 'characters', 'storyboard', 'locations', 'posters', 'social', 'audio',
      ],
    },
  };
}

const SYSTEM_PROMPT = `You are the generation engine behind "AI Movie Architect," a tool that turns a one-line concept into a complete short-film production package for creators who build AI-generated movies with tools like Midjourney, Flux, Kling, Runway, Google Flow, Suno, Udio, and ElevenLabs.

You always respond by calling the \`submit_movie_package\` tool exactly once with one complete, internally consistent production package. Never leave placeholder text, never truncate an array short of the requested length, and never break the requested JSON shape.

Language rules (follow exactly):
- Write all narrative/creative, human-facing Lao content in natural, modern, fluent Lao script: logline, theme, act summaries, character name/age/role/visual description, voiceover text, scene descriptions, poster text overlays, social titles/description/keywords.
- Write all fields destined for English-only AI image/video/music generation tools entirely in English, richly descriptive, comma-separated keyword style typical of Midjourney/Flux/Google Flow prompts: character anchor prompts, image prompts, motion prompts, location background prompts, poster image prompts, and audio/SFX prompts. Always end every image-generation prompt (character anchor is an exception if you prefer, but scene/location/poster image prompts especially) with the exact aspect ratio tag provided in the user message (e.g. "--ar 9:16").
- Keep every character's name spelling and visual identity identical everywhere it appears, and make sure each scene's imagePrompt actually incorporates the relevant character's anchor description so images stay visually consistent across the whole short film — this consistency is the entire point of the anchor prompt.
- Timecodes must be contiguous and non-overlapping across the full runtime, formatted as "MM:SS - MM:SS".
- Tailor the hashtags and keywords to the specific platforms the user selected.`;

function buildUserPrompt({ concept, genre, format, audience, duration, platforms }) {
  const sceneCount = getSceneCount(duration);
  const aspectRatio = getAspectRatio(format);
  const totalSeconds = sceneCount * 10;
  const platformList = (platforms && platforms.length ? platforms : ['TikTok', 'YouTube']).join(', ');

  return `Generate a full AI movie production package for the following brief:

- Story concept (from the creator, may be in Lao or English): "${concept}"
- Genre / visual style: ${genre}
- Aspect ratio / target format: ${format} (use the tag "--ar ${aspectRatio}" at the end of every image-generation prompt)
- Target audience: ${audience}
- Duration: ${duration} → exactly ${sceneCount} scenes of 10 seconds each, total runtime ${totalSeconds} seconds
- Target platforms: ${platformList}

Requirements:
1. Produce exactly ${sceneCount} storyboard scenes and exactly ${sceneCount} voiceover segments, both covering 00:00 to ${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')} in contiguous 10-second increments, in the same order.
2. Every scene's image prompt must read as a standalone, richly detailed Midjourney/Flux/Google Flow prompt (subject, action, camera angle, lighting, art style) and must incorporate the relevant character anchor description(s) so the character looks the same across every scene.
3. Every scene's motion prompt must describe camera movement only, suitable for an image-to-video tool (Kling/Runway/Google Flow), one or two sentences.
4. Give 2-4 locations with English, character-free environment prompts.
5. Give exactly 3 distinct poster/thumbnail concepts with prompts and text overlay recommendations, covering the requested aspect ratio.
6. Give a social package (3 titles, a Lao description with timestamps, hashtags, SEO keywords) tailored to: ${platformList}.
7. Give at least one background-music prompt (Suno/Udio style: mood, tempo, instruments) and one time-coded SFX list.

Call the submit_movie_package tool now with the complete package.`;
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({
    configured: Boolean(apiKey),
    model: MODEL,
    authRequired: Boolean(SITE_PASSWORD),
  });
});

// Running total of what this app has spent, tracked from the `usage` field
// Anthropic returns on every successful /api/generate call (see the tracker
// near the top of this file). Not a real account balance — Anthropic's API
// has no endpoint for that — just this app's own running total.
app.get('/api/usage', (req, res) => {
  res.json(getUsageSummary());
});

// Lets the user zero the counter out themselves — e.g. right after topping
// up credits at console.anthropic.com, so the big display on screen starts
// counting fresh from that top-up instead of showing everything ever spent.
app.post('/api/usage/reset', (req, res) => {
  usageStats = { generations: 0, inputTokens: 0, outputTokens: 0 };
  saveUsageStats();
  res.json(getUsageSummary());
});

// ---------------------------------------------------------------------------
// Lightweight per-IP rate limit on the expensive endpoint. This is a second
// line of defense behind SITE_PASSWORD (or the only defense, if this app is
// run without a password): it caps how many Anthropic API calls any single
// visitor can trigger, so one leaked password or one enthusiastic user can't
// silently run up the bill. In-memory only — resets on restart, which is
// fine for a small app like this.
// ---------------------------------------------------------------------------
const RATE_LIMIT_MAX = parseInt(process.env.GENERATE_RATE_LIMIT_PER_HOUR, 10) || 20;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const rateLimitHits = new Map(); // ip -> array of timestamps

function checkRateLimit(ip) {
  const now = Date.now();
  const hits = (rateLimitHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitHits.set(ip, hits);
  return hits.length <= RATE_LIMIT_MAX;
}

// Lets the browser save an Anthropic API key without anyone touching a
// terminal or a text editor: paste it once in the app, and it's written to
// the local .env file and used immediately. The key never leaves this
// machine — it's saved to disk here and used only for server-side calls to
// the Anthropic API.
app.post('/api/set-key', (req, res) => {
  try {
    const submittedKey = ((req.body && req.body.apiKey) || '').trim();
    if (!submittedKey) {
      return res.status(400).json({ error: 'Please paste an API key.' });
    }
    if (!/^sk-ant-/.test(submittedKey)) {
      return res.status(400).json({ error: 'That doesn\'t look like an Anthropic API key (it should start with "sk-ant-"). Double-check you copied the whole thing from console.anthropic.com.' });
    }

    let envContents = '';
    try {
      envContents = fs.readFileSync(ENV_PATH, 'utf8');
    } catch (readErr) {
      envContents = ''; // .env doesn't exist yet — we'll create it below
    }

    const line = `ANTHROPIC_API_KEY=${submittedKey}`;
    if (/^ANTHROPIC_API_KEY=.*$/m.test(envContents)) {
      envContents = envContents.replace(/^ANTHROPIC_API_KEY=.*$/m, line);
    } else {
      envContents = envContents.trim().length ? `${envContents.trim()}\n${line}\n` : `${line}\n`;
    }
    fs.writeFileSync(ENV_PATH, envContents, 'utf8');

    // Apply immediately — no server restart required.
    apiKey = submittedKey;
    anthropic = new Anthropic({ apiKey, timeout: 180000 });

    console.log('[set-key] API key saved to .env and applied.');
    res.json({ ok: true, model: MODEL });
  } catch (err) {
    console.error('[set-key] error:', err);
    res.status(500).json({ error: 'Could not save the key to .env: ' + (err && err.message ? err.message : String(err)) });
  }
});

// Turns any Anthropic SDK error into a short, human-readable message instead
// of a generic "fetch failed" / stack dump — this is what actually shows up
// in the browser's error toast.
function describeAnthropicError(err) {
  if (!err) return 'Generation failed for an unknown reason.';

  // APIError instances from the SDK carry `status` and a structured `error` body.
  const status = err.status;
  const apiMessage = err.error && err.error.error && err.error.error.message;

  if (status === 401) {
    return 'Anthropic rejected the API key (401 Unauthorized). Click the "API Key" button at the top of the page to paste in a valid one.';
  }
  if (status === 429) {
    return 'Rate limited by the Anthropic API (429). Wait a moment and try again.';
  }
  if (status === 404 && /model/i.test(apiMessage || err.message || '')) {
    return `The model "${MODEL}" was not found or is not available to your account (404). Try setting ANTHROPIC_MODEL in .env to a model you have access to.`;
  }
  if (status) {
    return `Anthropic API error ${status}: ${apiMessage || err.message}`;
  }
  // Network-level failures (DNS, proxy, TLS, connection refused) surface here
  // with messages like "fetch failed" / "ENOTFOUND" / "ECONNREFUSED".
  if (err.cause && err.cause.message) {
    return `Could not reach the Anthropic API: ${err.message} (${err.cause.message}). Check your internet connection / proxy settings.`;
  }
  return err.message || 'Generation failed for an unknown reason.';
}

app.post('/api/generate', async (req, res) => {
  // Everything lives inside this one try/catch so nothing in this handler
  // can ever throw without producing a proper JSON response — Express 4
  // does not automatically catch errors thrown by an async route handler,
  // and an uncaught one turns into a connection reset the browser reports
  // as a bare "Failed to fetch".
  try {
    if (!checkRateLimit(req.ip)) {
      return res.status(429).json({
        error: `Rate limit reached (max ${RATE_LIMIT_MAX} generations/hour per visitor). Try again later.`,
      });
    }

    if (!apiKey) {
      return res.status(500).json({
        error: 'No Anthropic API key is set yet. Use the "API Key" button at the top of the page to paste one in — no restart needed.',
      });
    }

    const { concept, genre, format, audience, duration, platforms } = req.body || {};
    if (!concept || typeof concept !== 'string' || !concept.trim()) {
      return res.status(400).json({ error: 'A story concept is required.' });
    }

    const sceneCount = getSceneCount(duration);
    const tool = buildToolDefinition(sceneCount);
    const userPrompt = buildUserPrompt({ concept, genre, format, audience, duration, platforms });

    console.log(`[generate] concept="${concept.slice(0, 60)}..." scenes=${sceneCount} model=${MODEL}`);
    const started = Date.now();

    // A fixed 8192-token ceiling was too tight once real users pasted long,
    // detailed concepts (a full character list / treatment) alongside a high
    // scene count: Claude would hit the limit mid-way through writing the
    // tool call's JSON, so the response arrived with entire fields (locations,
    // posters, social, audio, or the tail of storyboard/voiceover) silently
    // missing. The frontend then crashed on the first `.map()` over an
    // undefined field, which also stopped every tab after that from
    // rendering — that's the "some pages don't work" bug. Scaling the budget
    // with scene count, and hard-failing below if we still get cut off
    // instead of shipping a half-built package, fixes both.
    // Now also covers the longer 30/60-scene Duration options — the 30000
    // ceiling comfortably fits a 60-scene package (~15k tokens in practice)
    // with headroom; if a request still runs out, the stop_reason check
    // below turns that into a clear error instead of a broken package.
    const maxTokens = Math.min(30000, 3000 + sceneCount * 450);

    // Longer packages take Claude noticeably longer to write. The SDK-level
    // default (set on the `anthropic` client below) is a safety net for
    // small requests; this per-request override gives big ones (30/60
    // scenes) enough time instead of failing right as they're about to finish.
    const requestTimeoutMs = Math.min(9 * 60 * 1000, 90 * 1000 + sceneCount * 8000);

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'submit_movie_package' },
      messages: [{ role: 'user', content: userPrompt }],
    }, { timeout: requestTimeoutMs });

    console.log(`[generate] Claude responded in ${((Date.now() - started) / 1000).toFixed(1)}s (stop_reason=${response.stop_reason}, max_tokens=${maxTokens})`);

    // If Claude ran out of room before finishing the tool call, the JSON it
    // produced is necessarily incomplete (missing trailing fields). Refuse
    // it here with a clear, actionable message instead of forwarding a
    // package that will crash the dashboard.
    if (response.stop_reason === 'max_tokens') {
      return res.status(502).json({
        error: `Claude ໃຊ້ພື້ນທີ່ຄຳຕອບໝົດກ່ອນຈະສ້າງ Package ສຳເລັດ (output length limit reached) — ມັກເກີດເມື່ອ "ໄອເດຍ/ເນື້ອເລື່ອງ" ທີ່ພິມໃສ່ຍາວ ແລະ ລະອຽດຫຼາຍ, ຫຼືເລືອກຄວາມຍາວ (scenes) ສູງ. ລອງຫຍໍ້ຄວາມຍາວຂອງໄອເດຍທີ່ພິມໃສ່ໃຫ້ສັ້ນລົງ (ສະຫຼຸບໄອເດຍພຽງ 2-4 ປະໂຫຍກກໍ່ພໍ), ຫຼືເລືອກ Duration ໃຫ້ສັ້ນລົງ, ແລ້ວລອງໃໝ່.`,
      });
    }

    const toolUse = response.content.find((block) => block.type === 'tool_use' && block.name === 'submit_movie_package');
    if (!toolUse) {
      return res.status(502).json({ error: 'Claude did not return a structured package. Please try again.' });
    }

    const pkg = toolUse.input;

    // Defensive validation: even without hitting max_tokens, make sure every
    // field the dashboard's renderer unconditionally calls .map()/.forEach()
    // on actually came back as an array, so a malformed response is caught
    // here (as a clear error) instead of crashing the frontend.
    const requiredArrayFields = ['voiceover', 'characters', 'storyboard', 'locations', 'posters', 'audio'];
    const missingOrInvalid = requiredArrayFields.filter((f) => !Array.isArray(pkg[f]) || pkg[f].length === 0);
    if (missingOrInvalid.length > 0 || !pkg.social || !Array.isArray(pkg.social.titles)) {
      console.error('[generate] incomplete package from Claude, missing/invalid:', missingOrInvalid);
      return res.status(502).json({
        error: `Claude ສົ່ງ Package ກັບມາບໍ່ຄົບ (ຂາດສ່ວນ: ${missingOrInvalid.join(', ') || 'social'}). ລອງກົດ Generate ໃໝ່ອີກຄັ້ງ, ຫຼືຫຍໍ້ຄວາມຍາວ/ຄວາມສັບຊ້ອນຂອງໄອເດຍລົງ.`,
      });
    }

    // Re-number scenes defensively in case the model's numbering drifted.
    pkg.storyboard.forEach((s, i) => { s.scene = i + 1; });

    recordUsage(response.usage);
    pkg._usage = getUsageSummary(); // lets the frontend update the big usage display without a second round trip

    res.json(pkg);
  } catch (err) {
    console.error('[generate] error:', err);
    res.status(err && err.status ? err.status : 500).json({ error: describeAnthropicError(err) });
  }
});

// Backstop: catches anything that still slips past a route's own try/catch
// (e.g. a synchronous throw in middleware) and always answers with JSON
// instead of Express's default HTML error page or a dropped connection.
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('[express error handler]', err);
  if (res.headersSent) return next(err);
  const status = (err && (err.status || err.statusCode)) || 500;
  res.status(status).json({ error: (err && err.message) || 'Internal server error.' });
});

const server = app.listen(PORT, () => {
  console.log(`AI Movie Architect running at http://localhost:${PORT}`);
  console.log(`Using model: ${MODEL}`);
  console.log(apiKey ? 'ANTHROPIC_API_KEY: found' : 'No API key saved yet — paste one in the app when it opens.');
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} is already in use — is AI Movie Architect (or something else) already running?`);
    console.error(`Either close that other process, or set a different PORT in your .env file and try again.\n`);
    process.exit(1);
  }
  console.error('[server error]', err);
  process.exit(1);
});
