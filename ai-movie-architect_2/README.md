# AI Movie Architect

Turns a one-line story concept into a complete AI movie production package — logline & 3-act script, a timed Lao voiceover script, character profiles with image-consistency "anchor" prompts (and an optional real AI-generated portrait you can view and regenerate), a full scene-by-scene storyboard (image + camera-motion prompts, with optional real generated storyboard images), location/background prompts (with optional real generated images), 3 poster concepts (with optional real generated images), a social media/SEO package, and music/SFX prompts — generated live by the Claude API and shown in a modern red-black dashboard UI.

## What this is

- `public/index.html` — the dashboard UI: 9 tabs, sidebar generator form, copy buttons, JSON/Markdown export, and (optionally) real in-app image generation on the Character/Storyboard/Location/Poster cards.
- `server.js` — a small Express server that serves that UI and exposes `POST /api/generate` (calls the Claude API server-side — your Anthropic key never reaches the browser — and returns a structured JSON production package) plus `POST /api/generate-image` (calls Google's Gemini image API server-side, same never-reaches-the-browser handling, for the optional real-image feature below).

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
2. Click **"ປະມວນຜົນສ້າງ Package ໜັງ AI (Generate with Claude)."** The button shows a spinner while Claude writes the full package: roughly 15–40 seconds for 1–3 minutes (6–18 scenes), and up to several minutes for the longer 5/10-minute options (30/60 scenes) — the longer options also cost proportionally more per generation (see the usage banner). For 5/10 minutes, "ແບ່ງພາກ (Segmented)" mode below is the more reliable choice.
3. Browse all 9 tabs — story, voiceover, characters, storyboard, locations, posters, social, audio, and the edit sheet. Every prompt field has a one-click Copy button.
4. Use **Export JSON** or **Export MD** in the header to download the whole package for pasting into Midjourney, Flux, Google Flow, Kling, Runway, Suno, Udio, or ElevenLabs.
5. **"ໂຫຼດຕົວຢ່າງ (Sample)"** just refills the concept box with the demo example and re-renders the built-in sample package — it doesn't call the API, so it's free to click around with.
6. **"ປະຫວັດ (History)"** in the header lists every package you've generated (newest first) — closing the app, the browser tab, or your computer doesn't lose them. Click one to reload it into all 9 tabs (and refill the sidebar form to match) instead of generating — and paying for — it again. Each entry can be deleted individually (trash icon on hover), or all at once with "ລຶບທັງໝົດ".

**Scope note:** Duration tops out at 10 minutes (60 scenes) per generation — this is a short-form/social-video tool (TikTok, Shorts, Reels), not a feature-film generator. A single generation producing a full-length (60–120 minute) movie package isn't supported: it would mean hundreds of scenes, which is well beyond what one Claude API call can reliably produce, and would cost proportionally more per generation. If you have a longer story, describe it briefly as the concept and pick the longest duration that fits your platform — Claude will condense it into a short-form treatment rather than trying (and failing) to cover the whole thing scene-by-scene.

## How the generation works

`server.js` sends your brief to Claude with a forced tool call (`submit_movie_package`) whose JSON schema mirrors exactly what the dashboard renders. This is what makes the output reliably structured instead of free-form text you'd have to parse:

- Duration (`"2 Minutes (12 Scenes)"`) is parsed into an exact scene count, and the prompt requires that many storyboard scenes and voiceover segments, in contiguous 10-second timecodes.
- Aspect ratio (`9:16` / `16:9` / `1:1`) is extracted from your format choice and every image/poster prompt is required to end with the matching `--ar` tag.
- Lao is used for everything a human reads (script, voiceover, captions); English is used for everything an image/video/music AI reads (anchor prompts, scene prompts, motion prompts, poster prompts, audio prompts) — matching how Midjourney/Flux/Kling/Suno etc. expect their prompts.
- Character anchor descriptions are required to be reused inside each scene's image prompt, which is what keeps a character's look consistent across every generated frame.
- Every voiceover line is labeled with who says it — either "ຜູ້ບັນຍາຍ (Narrator)" for narration, or the exact name of whichever character is speaking that line as dialogue — so the Voiceover and Edit Sheet tabs can show a colored badge (one consistent color per character, gray for the narrator) instead of leaving you to guess from the wording alone. A package generated before this existed (an older History entry, say) just shows every line as the narrator by default rather than breaking.

## Configuration

Set these in `.env` (see `.env.example`):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | *(required)* | Your Anthropic API key. Never sent to the browser. |
| `ANTHROPIC_MODEL` | `claude-sonnet-5` | Swap to `claude-opus-5` for higher-quality (slower/pricier) output. |
| `GOOGLE_API_KEY` | *(optional)* | Your Google AI Studio API key, **only** needed if you want the real "ສ້າງຮູບ (Generate Image)" feature (see below). Everything else in the app works fully without it. Never sent to the browser. |
| `GOOGLE_IMAGE_MODEL` | `gemini-3.1-flash-image` | Which Gemini image model to call. |
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

## Editing menu (Edit Sheet)

A 9th tab, "ໃບສັ່ງຕັດຕໍ່ (Edit Sheet)", turns the generated storyboard into a scene-by-scene cutting order for you to follow in CapCut, Premiere, DaVinci Resolve, or any other video editor. For each scene it shows, side by side, the image prompt (for Midjourney/Flux), the motion prompt (for Kling/Runway), and the matching voiceover line (for ElevenLabs or similar) — in the exact order the final video should be assembled — followed by the music/SFX prompts to add last. An "Export ໃບຕັດຕໍ່ (.md)" button downloads the same thing as a checklist-style Markdown file you can keep open while you edit.

This is a cutting *order sheet*, not automatic video editing — the app only ever produces text prompts (see "Notes & limits" below); you still generate each image/clip/voice line yourself in the tools above and assemble them in your editor by following this order.

## Segmented generation (ແບ່ງພາກ) — for longer, more reliable movies

The sidebar has a **"ຮູບແບບການສ້າງ (Generation Mode)"** toggle: **ມາດຕະຖານ (Standard)** is the original one-call flow above; **ແບ່ງພາກ (Segmented)** builds a 10-minute, 60-scene movie as 3 separate parts of 20 scenes each — Beginning, Middle, End — generated one at a time instead of in one giant call.

Why: a single 30/60-scene generation asks Claude to write thousands of words of structured JSON in one response, which can take several minutes and occasionally run past the app's own timeout (you'd see a "timed out" error and nothing generated). Three 20-scene calls are each much smaller and faster, so they're far less likely to time out, and a failed part only costs you that one part instead of the whole movie.

How it works:
1. Switch to **ແບ່ງພາກ (Segmented)** — the Duration dropdown is replaced by a **"ພາກທີ່ຈະສ້າງ (Which part)"** picker with three buttons: ຕົ້ນ (Beginning), ກາງ (Middle), ທ້າຍ (End).
2. Pick any one of the three and click Generate — **you can start with any part, in any order**, not just the beginning. Whichever part you generate first invents the whole movie's title, characters, art style, and all three act summaries (its "story bible"), even though it only writes detailed scenes for that one part — the other two parts are written later straight from those act summaries, so they stay consistent no matter what order you build them in.
3. Generate the other two parts whenever you like (✅ marks a part as done). Each one automatically reuses the established title/characters/art style — same character anchor prompts word-for-word — so the finished movie looks and sounds consistent across all 60 scenes.
4. Once all 3 parts are done, every tab (storyboard, voiceover, Edit Sheet, exports) works exactly like a standard 60-scene package — nothing else changes.
5. Regenerating an already-done part overwrites just that part's 20 scenes (after a confirmation), leaving the others untouched. **"ເລີ່ມໂຄງການໃໝ່"** clears the whole segmented project to start over (the old one is still in History if you want it back).

Like standard generations, every part you generate is saved automatically to History as a complete, playable-so-far package.

## Usage / cost tracker

A banner between the header and the main dashboard shows a running total of what this app itself has spent: a big dollar figure, the number of generations, and total tokens used, updated automatically every time you click Generate. It's built from the token counts the Claude API returns with every response, priced at that model's published rate — **this is an estimate of what this app has used, not a live read of your real Anthropic account balance** (Anthropic's API has no endpoint that reports your actual remaining credit). Click **Reset** on the banner any time — e.g. right after you top up credits at console.anthropic.com — to zero the counter and start tracking fresh. The total is saved to a small `usage-stats.json` file next to `server.js` so it survives a restart (note: most free hosts, including Render's free tier, wipe the filesystem on every redeploy, so the counter resets then too).

## Generation history

Every time you click Generate, the resulting package is saved automatically — no extra click needed. Open it later from the **"ປະຫວັດ (History)"** button in the header: it lists your past generations (title, concept snippet, genre, duration, date/time), newest first. Clicking one restores it into all 9 tabs and refills the sidebar form fields, exactly as if you'd just generated it. Only the most recent 20 generations are kept (the oldest drops off automatically) to stay well within quota; delete one entry with its trash icon or everything at once with "ລຶບທັງໝົດ".

This is saved in **your browser's own storage (localStorage)**, not on the server — a host like Render wipes its filesystem on every restart/redeploy/spin-down-and-wake, which used to silently erase history saved there. Browser storage survives that, at the cost of being tied to the one browser/device you're using — it won't show up if you open the app in a different browser or computer.

## Your current project is kept automatically

Separately from History above (which only snapshots a finished package the moment Generate completes), the app also continuously saves whichever project is currently open — including anything you've changed since: a prompt revised from a reference image, a scene added or removed, or which of the standard/segmented modes you were using and how far a segmented project had gotten. This also lives in your browser's localStorage, so closing the tab, closing the browser, or the server spinning down and the page reloading will all bring you right back to exactly what you had open, instead of the built-in sample movie. You'll see a small confirmation toast ("ໂຫຼດວຽກທີ່ເຮັດຄ້າງໄວ້ລ່າສຸດກັບມາແລ້ວ") the next time you open the app if there was anything to restore. As with History, this is tied to the one browser/device you're using.

## Revising a prompt from a reference image (or a description, for audio)

Any time a generated prompt doesn't match what you pictured — a character's look, a location's background, a poster's composition, or an audio/SFX cue's mood — you can revise just that one prompt without re-running the whole generation. This works on five different cards:

- **"ຕົວລະຄອນ (Cast)"** tab — revise a character's visual description + anchor prompt, from a reference **image**
- **"Shot-by-Shot Storyboard Matrix"** — revise a scene's Image Prompt, from a reference **image**
- **"ສະຖານທີ່ & ສາກຫຼັງ (Set Environments)"** — revise a location's Background Prompt, from a reference **image**
- **"ຂໍ້ກຳນົດສ້າງໜ້າປົກໜັງ (Movie Poster Specs)"** — revise a poster's Image Prompt, from a reference **image**
- **"ດົນຕີປະກອບ & ສຽງ Effect Prompts (Suno / Udio / SFX)"** — revise an audio/SFX prompt, from a typed **description**

On the four image-based cards, click **"ອັບໂຫລດຮູບ"**, pick a reference image (a test render that came out wrong, or a mood/style/location photo you want to match), optionally add a short note (e.g. "shorter hair" / "ຜົມສັ້ນກວ່ານີ້"), then click **"ແກ້ໄຂ Prompt ຕາມຮູບນີ້"**. Claude looks at the image and rewrites just that one prompt to match it — keeping the same purpose and level of detail, and the same `--ar` aspect-ratio tag — without touching anything else in the package. The image is resized in your browser before upload (to keep it fast and cheap) and is not saved anywhere; only the resulting text is kept.

The Audio/SFX card works differently on purpose: Claude's API can look at a picture but has no way to listen to an uploaded sound file or a voice recording, so instead of an upload button, that card has a text box — just type what you want changed (e.g. "ໃຫ້ຈັງຫວະໄວຂຶ້ນ, ມືດ/ໜັກຂຶ້ນ" / "make it faster-paced and darker") and click **"ແກ້ໄຂ Prompt ຕາມຄຳອະທິບາຍ"**. Claude rewrites the music/SFX prompt based on your written description.

For a character specifically, revising its card also updates its Lao visual description and English anchor prompt together (since those two are meant to describe the same look). If the anchor prompt changes, the app automatically finds and replaces the old anchor text everywhere it was already embedded in storyboard Image Prompts and poster prompts (per the schema's "word-for-word" consistency rule), so already-generated scenes stay visually consistent with the revised character — you'll see a toast confirming how many scenes were updated. Every tab that displays a prompt always reads it fresh from the same underlying project data, so this propagation reaches everywhere that prompt shows up (including the Edit Sheet tab), not just the tab you revised it from.

## Generating real images in-app (ສ້າງຮູບ / Generate Image)

Every Character, Storyboard scene, Location, and Poster card has a **"ສ້າງຮູບ (Generate Image)"** button that calls Google's Gemini image model (`gemini-3.1-flash-image`, aka "Nano Banana 2") directly from the app and shows you an actual picture — not just the text prompt — so you can see what a character/scene/location/poster looks like without copying anything into another website. Click **"ສ້າງຮູບໃໝ່"** under an existing image any time to regenerate it (e.g. after editing the prompt).

This feature is **entirely optional and off by default**:

- It requires its own **Google API key** (separate from your Anthropic key), because Google's Gemini image generation is a different service with no free tier — pricing is roughly **$0.03–0.07 per image** depending on size/quality, billed to your own Google account. Get one at [aistudio.google.com](https://aistudio.google.com), enable billing, then paste it into the same **"API Key"** popup used for your Anthropic key (it now has a second, clearly-marked, optional field for the Google key — you can fill in either field independently, e.g. to add a Google key later without re-entering your Anthropic key).
- If you skip it, every other part of the app works exactly as before — you just won't see the "ສ້າງຮູບ" button do anything until a Google key is set (it'll tell you to add one).
- If you've already uploaded a reference photo on that card (the "ແກ້ໄຂ Prompt ຈາກຮູບຕົວຢ່າງ" upload just below the image box), that same photo is sent along as a reference so the generated image can match it, instead of generating from the text prompt alone.
- The aspect ratio is read automatically from the `--ar` tag already at the end of each prompt (the same tag meant for pasting into Midjourney/Flux), so a 9:16 vertical prompt generates a 9:16 vertical image, a 1:1 poster prompt generates a square image, and so on — no extra setting to configure.
- Generated images are stored in your browser (IndexedDB, not the server), namespaced to the specific project they belong to, so they survive closing/reopening the app and don't mix up between different movies or History entries. Like History and your current-project autosave, this means they're tied to the one browser/device you generated them in.

**Video and audio stay manual on purpose.** Video generation was deliberately *not* automated: Google Flow's free daily credits (the common free workflow for turning these prompts into video) are only usable on Flow's own website and have no API access at any price, and a true automated alternative (Google's Veo API) charges per second of video with no free tier — so the Motion Prompt stays a copy-paste into Google Flow (or Kling/Runway) exactly as before. Audio/music prompts are also still text-only, unchanged.

## Notes & limits

- This app generates the full **text** production package itself (script, prompts, captions) plus, optionally, real **images** for characters/scenes/locations/posters via Google's Gemini API (see above, requires its own Google API key and billing). It does not call Flow/Kling/Suno/etc. itself for video or audio — you paste those generated prompts into those tools yourself, per the copy buttons.
- Each generation is a single Claude API call and costs against your Anthropic account per its normal token pricing.
- Both API keys (Anthropic, and Google if you set one) live only in your local `.env` file (written there for you when you use the in-app popup) and are used only by `server.js`; `.env` is excluded from git via `.gitignore`, and each key is sent only to its own provider's API (Anthropic key → Anthropic, Google key → Google) — never to the browser or anywhere else.
- Running it locally (the launcher scripts) is completely private — only reachable from your own computer. Deploying it (previous section) makes it reachable by anyone with the URL, which is why `SITE_PASSWORD` exists; keep it set on any copy you don't want to pay for on strangers' behalf.
