# AI Movie Architect

Turns a one-line story concept into a complete AI movie production package — logline & 3-act script, a timed Lao voiceover script, character profiles with image-consistency "anchor" prompts, a full scene-by-scene storyboard (image + camera-motion prompts), location/background prompts, 3 poster concepts, a social media/SEO package, and music/SFX prompts — generated live by the Claude API and shown in the dark "Cinema" dashboard UI.

## What this is

- `public/index.html` — the dashboard UI (unchanged in look/feel from the original mockup: 8 tabs, sidebar generator form, copy buttons, JSON/Markdown export).
- `server.js` — a small Express server that serves that UI and exposes `POST /api/generate`, which calls the Claude API server-side (your API key never reaches the browser) and returns a structured JSON production package that the UI renders.

## Setup (easy way — no terminal typing)

Requires [Node.js](https://nodejs.org) to already be installed (the launcher needs `node` on your machine, but you don't need to type any commands yourself).

1. Unzip the project anywhere.
2. Double-click the launcher for your operating system:
   - **macOS:** `start-mac.command`
     - First time only: right-click it → **Open** (macOS blocks unsigned scripts from a plain double-click the first time).
   - **Windows:** `start-windows.bat`
   - **Linux:** run `./start-linux.sh` in a terminal (or double-click it if your file manager offers "Run").
3. A console window opens (installs dependencies automatically on the very first run — this can take ~30s), then your browser opens the app at **http://localhost:3000** by itself.
4. The first time, a **"ຕັ້ງຄ່າ Anthropic API Key"** popup appears in the app itself — paste your key from [console.anthropic.com](https://console.anthropic.com) (Settings → API Keys) and click **Save**. No text editor, no `.env` file to touch — it's saved to disk for you and used immediately.
5. Keep that console window open while you use the app; closing it stops the server. To use the app again later, just double-click the launcher again (setup won't repeat).

You can reopen the API key popup anytime with the badge/button at the top-right of the page (useful if you want to switch keys).

## Setup (manual way — for developers)

If you'd rather use a terminal directly:

```bash
npm install
cp .env.example .env      # then edit .env and paste ANTHROPIC_API_KEY=sk-ant-...
npm start
```

Then open **http://localhost:3000**. This is equivalent to the launcher above minus the auto-install/auto-open/in-app key popup — either way works, and the in-app "API Key" popup works here too if you'd rather not hand-edit `.env`.

The header shows a small badge — green ("Claude API: Ready") once a key is set, red if it's missing. Click the badge anytime to open the key popup.

## Using it

1. Type your story concept (Lao or English) in the sidebar, pick genre, aspect ratio, audience, duration, and target platforms.
2. Click **"ປະມວນຜົນສ້າງ Package ໜັງ AI (Generate with Claude)."** The button shows a spinner while Claude writes the full package (usually 15–40 seconds depending on scene count).
3. Browse all 8 tabs — story, voiceover, characters, storyboard, locations, posters, social, audio. Every prompt field has a one-click Copy button.
4. Use **Export JSON** or **Export MD** in the header to download the whole package for pasting into Midjourney, Flux, Google Flow, Kling, Runway, Suno, Udio, or ElevenLabs.
5. **"ໂຫຼດຕົວຢ່າງ (Sample)"** just refills the concept box with the demo example and re-renders the built-in sample package — it doesn't call the API, so it's free to click around with.

## How the generation works

`server.js` sends your brief to Claude with a forced tool call (`submit_movie_package`) whose JSON schema mirrors exactly what the dashboard renders. This is what makes the output reliably structured instead of free-form text you'd have to parse:

- Duration (`"2 Minutes (12 Scenes)"`) is parsed into an exact scene count, and the prompt requires that many storyboard scenes and voiceover segments, in contiguous 10-second timecodes.
- Aspect ratio (`9:16` / `16:9` / `1:1`) is extracted from your format choice and every image/poster prompt is required to end with the matching `--ar` tag.
- Lao is used for everything a human reads (script, voiceover, captions); English is used for everything an image/video/music AI reads (anchor prompts, scene prompts, motion prompts, poster prompts, audio prompts) — matching how Midjourney/Flux/Kling/Suno etc. expect their prompts.
- Character anchor descriptions are required to be reused inside each scene's image prompt, which is what keeps a character's look consistent across every generated frame.

## Configuration

Set these in `.env` (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key. Never sent to the browser. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Swap to `claude-opus-5` for higher-quality (slower/pricier) output. |
| `PORT` | `3000` | Port the app runs on. |
| `SITE_PASSWORD` | *(blank)* | Optional. Leave blank for local/private use. Set this before putting the app anywhere public — see below. |
| `GENERATE_RATE_LIMIT_PER_HOUR` | `20` | Max "Generate" clicks allowed per visitor per hour, regardless of password — a second safety net against runaway API costs. |

## Putting it on the public internet (a real URL, not just your computer)

Everything above runs only on your own machine at `http://localhost:3000` — nobody else can reach it. To get a real URL anyone can open, you deploy `server.js` to a hosting service. Below is the simplest path if you don't already have a GitHub account or any hosting set up, using free tiers (Render's free web services sleep after 15 minutes of no traffic and take ~30–60s to wake back up on the next visit — normal, not a bug).

**⚠️ Before you do this:** a public URL means *anyone who has the link* can click "Generate" and spend *your* Anthropic credits, unless you protect it. This project supports a simple shared password for exactly that reason — set `SITE_PASSWORD` (step 4 below) before sharing the link with anyone.

1. **Create a free GitHub account** at [github.com/signup](https://github.com/signup), if you don't have one.
2. **Create a new repository** (no command line needed): on github.com click the **+** in the top-right → **New repository** → give it a name like `ai-movie-architect` → **Create repository**.
3. **Upload the project files** using GitHub's web uploader (no `git` required): on the new repo's page, click **"uploading an existing file"** (or Add file → Upload files), then drag in every file and folder from this project (`server.js`, `start.js`, `package.json`, `package-lock.json`, `.env.example`, `.gitignore`, `README.md`, and the whole `public/` folder — **do not** upload your local `.env` or `node_modules`, you don't need them). Click **Commit changes**.
4. **Sign up at [Render](https://render.com)** (you can sign up with your new GitHub account in one click) → **New +** → **Web Service** → pick the `ai-movie-architect` repo you just created.
5. Fill in:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** Free
6. Under **Environment Variables**, add:
   - `ANTHROPIC_API_KEY` = your key from console.anthropic.com
   - `SITE_PASSWORD` = a password you make up (this is what protects your credits — tell it only to people you want using the app)
   - (optional) `ANTHROPIC_MODEL`, `GENERATE_RATE_LIMIT_PER_HOUR` if you want non-default values
7. Click **Create Web Service**. After a couple of minutes you'll get a public URL like `https://ai-movie-architect-xxxx.onrender.com` — that's the link you can share.
8. Opening that URL will show a login screen asking for the password you set in `SITE_PASSWORD`. Anyone you give the password to can use the app; anyone without it can't spend your credits.

Notes specific to the hosted version:
- Set `ANTHROPIC_API_KEY` and `SITE_PASSWORD` through Render's **Environment Variables** dashboard (step 6), not the in-app "API Key" popup — most hosts reset the filesystem on every redeploy, so a key saved in-app there could be lost the next time you push an update. (The in-app popup still works meanwhile, it just isn't the durable place to keep it once it's hosted.)
- To update the live app later, re-upload changed files to the same GitHub repo (same "Upload files" button) — Render redeploys automatically.
- To change the password, just edit the `SITE_PASSWORD` environment variable in Render's dashboard and Render will restart the app with the new value.

## Notes & limits

- This app only generates **text** — the script, prompts, and captions. It does not call Midjourney/Kling/Suno/etc. itself; you paste the generated prompts into those tools yourself, per the copy buttons.
- Each generation is a single Claude API call and costs against your Anthropic account per its normal token pricing.
- The API key lives only in your local `.env` file (written there for you when you use the in-app popup) and is used only by `server.js`; it's excluded from git via `.gitignore` and never sent anywhere except directly to the Anthropic API.
- Running it locally (the launcher scripts) is completely private — only reachable from your own computer. Deploying it (previous section) makes it reachable by anyone with the URL, which is why `SITE_PASSWORD` exists; keep it set on any copy you don't want to pay for on strangers' behalf.
