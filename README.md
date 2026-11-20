# audio-visualizer

Generator of audio visualizer videos. Import a WAV, tune the bars, export a silent 2K video.

Vue Vapor app (Vue 3.6 RC) + Vite + TypeScript. Rendering runs in a **local Node script**, not in the browser.

## Run

```sh
npm install     # also downloads the ffmpeg binary (ffmpeg-static)
npm run dev     # http://127.0.0.1:5173
npm run build   # type-check + production build
```

The render API lives in the Vite server, so use `npm run dev` (or `npm run preview` after a build).

## Features

- **Visualizer types**:
  - **Bars** — grow from bottom / grow from center.
  - **Vinyl** — a record spinning at 33⅓ rpm. Each groove is one frequency band (bass outermost):
    it lights up in the groove color, thickens and shakes with its level. The two-color label shows the spin.
    Drawn per pixel by `scripts/visualizer/vinyl.mjs`, shared by export and preview.
- **Demo sound**: on page open a 15 s lo-fi loop (chords, keys, soft drums, vinyl crackle) is loaded,
  synthesized locally by `scripts/visualizer/demo-sound.mjs` — preview only, it can't be exported.
- **Controls**: bar color (solid or two-color gradient), background color or transparent,
  bars count (8–256), sensitivity (0.2–3×), smoothing (0–100%).
- **Smoothing without delay**: since rendering is offline, each frame is a centered Gaussian average of its
  neighbours (past *and* future, up to ±200 ms), so bars stop twitching but still hit on the beat.
  Sensitivity sets the height; smoothing only calms the motion.
- **Live preview**: play the track on the page and watch the bars move, frame-exact with the export (30 fps).
  The page plays the audio and draws bar levels from the local analyzer with the same layout code as the export.
  Style, colors and background apply instantly, even while playing. Space toggles play / pause.

### Preview performance

- **Only the viewed zone is analyzed**: levels stream in 5 s chunks — the one under the playhead first,
  then 10 s ahead. Seeking loads that zone; requests for zones you scrolled past are cancelled.
- **Partial WAV reads**: a chunk reads only its slice of the file (+0.5 s warm-up so results are
  byte-identical to the export's analysis).
- **One persistent analyzer process** (`render.mjs serve`) answers chunks in ~15–40 ms (no Node startup per request).
- **Cache**: chunks are kept (≈4 min, farthest evicted). Changing bars / sensitivity re-analyzes only
  the current zone; old bars stay visible until the new ones arrive.
- **Draw on demand**: nothing runs while paused; while playing it repaints only when the 30 fps frame changes;
  no painting when the preview is offscreen; canvas size follows its on-screen size.
- **Export**: 2560×1440, 30 fps, no sound.
  - Solid background → `.mp4` (H.264), plays everywhere.
  - Transparent → `.mov` (ProRes 4444 with alpha), drops into Premiere / Resolve / After Effects.
- Never blocks the UI: upload, preview and export show progress; export runs in the background and can be cancelled.

## How it works

```
browser ──HTTP──▶ server/visualizer-api.ts (Vite plugin) ──spawn──▶ scripts/visualizer/render.mjs ──pipe──▶ ffmpeg
```

`render.mjs` reads the WAV, runs an FFT per frame, draws frames (in parallel worker threads, one per core)
into raw RGBA and pipes them to ffmpeg in order.
Bar geometry and colors live in `scripts/visualizer/layout.mjs`, shared with the page's preview.
The script also works on its own from the command line:

```sh
node scripts/visualizer/render.mjs info    --input song.wav
node scripts/visualizer/render.mjs levels  --input song.wav --bars 64 [--start 300 --count 150] > levels.bin
node scripts/visualizer/render.mjs preview --input song.wav --time 12 > frame.png
node scripts/visualizer/render.mjs render  --input song.wav --output out.mp4 \
  --type bars|vinyl --mode bottom|center --bars 64 --sensitivity 1 --smoothing 0.3 --background "#0b0b14"|transparent \
  --colors "#8b7bff,#3dd6ff"
```

Uploads and rendered videos are kept in `.cache/visualizer/` and cleaned after 24 h.

## Structure

Layered: each layer may import only from layers **below** it.

```
src/
  app/       entry point, root component, routing, global styles
  pages/     full screens composed from widgets          (generator, ui-library)
  widgets/   self-contained UI blocks composed from modules
  modules/   features / business logic                   (audio-import, visualizer-settings, bars-preview, video-export)
  shared/    reusable code with no business logic        (ui kit, api client, lib, styles)
server/      Vite plugin: HTTP bridge to the render script
scripts/     local render script (WAV → FFT → frames → ffmpeg)
```

`app → pages → widgets → modules → shared`

- Modules don't import each other — share through `shared`.
- Each slice exposes a public API via `index.ts`; import from it, not from internal files.
- Import with the `@/` alias, e.g. `import { x } from '@/shared/lib'`.

## Design rules

- **Dark theme only.** Deep near-black background with soft colored glows.
- **Glass for all UI and windows**: translucent fill, blur, thin light border, top highlight.
  Use the `.glass` class (`shared/styles/glass.css`) or `UiPanel` / `UiWindow`.
- **Use tokens, not raw values** — colors, radii, spacing, motion live in `shared/styles/tokens.css`.
- **Accent** is the violet→cyan gradient (`--accent-gradient`), for primary actions and active states.
- **Never leave the user waiting blind**: anything that takes time shows a spinner or progress.
- **Build from `@/shared/ui`**. All components are listed on the UI library page (`#/ui`).
- Components are Vapor (`<script setup vapor>`).
