# Promenade

Promenade is a static-first exhibition guide with a local authoring studio.

The repository now has two runtime surfaces:

- `site`: the public visitor guide built with Astro and exported to `dist/`
- `studio`: a React + Express authoring workflow for editing one active show, managing media, generating translations/audio, and exporting printable QR assets

Production stays simple: ship `dist/` behind any static web server. The studio remains a separate authoring surface and does not ship with the public build.

Public builds are pruned to the active show only. Backup archives, imported side-by-side shows, and other non-active show assets do not ship in `dist/`.

## Current Product State

### Visitor guide

- localized static routes for the show's configured public locales
- app-like mobile artwork view with a persistent bottom control dock
- browser-side QR scanning and manual artwork number entry
- smart previous/next artwork controls in the mobile dock
- image gallery, artwork metadata, and audio playback per artwork
- dark mode with `system`, `light`, and `dark` preferences
- offline-after-first-load behavior via Workbox

### Authoring studio

- show metadata editing
- artwork CRUD for the active show
- per-artwork `guided` vs `signage-only` visitor-guide presence
- media upload for artwork images
- authoritative source-description intake per artwork
- authoritative original artwork titles plus optional translated subtitle helpers
- internal show research notes for prompt context
- source-locale guide-copy sync without automated rewriting
- OpenAI-powered faithful translations from the authoritative source text into the show's enabled locales
- optional OpenAI-powered audio cue generation
- one-shot batch translation, cue, and audio generation actions
- ElevenLabs-first TTS generation with OpenAI/mock fallback
- QR code download plus A4 print-sheet layout
- direct PDF signage export for 12 x 8 cm artwork signs
  - exact-size `120 × 80 mm` labels
  - `4-up` on A4 landscape
  - show branding with gallery logo, institution name, and exhibition title
  - exports for all artworks, selected artworks, or a single-label test page
- localized A4 entrance-sign export with a large QR code and direct guide URL for exhibition entry
- export-readiness auditing before static build
- full-show backup export as `.tar.gz`
- side-by-side show import plus explicit activation

### Guided vs signage-only artworks

- `guided` artworks appear in the published visitor guide and can generate QR codes, cue sheets, and audio
- `signage-only` artworks stay inside Promenade Studio, still participate in signage / print exports, and are intentionally excluded from the public guide
- signage-only sign templates keep the same `120 × 80 mm` layout and typography, but omit the audioguide / QR rail
- raw `sourceDescription` text is stored separately from the public `description`, so artist- or curator-supplied copy remains the authoritative intake gate for all guide locales
- artwork titles are source-authoritative too: keep the original title spelling/language in `title`, store the original title language in `titleLocale`, and use `titleSubtitle` only for optional helper translations

### Guide-copy workflow

- keep raw intake or artist text in `sourceDescription`
- set `sourceLocale` explicitly per artwork so the authoritative language is unambiguous
- keep the authoritative artwork title unchanged across every locale view; if a translated helper title is useful, store it as a subtitle instead of replacing the original
- keep the source-locale guide text in `description` as a direct sync/copy from that authoritative source
- derive other locales with `Translate from source` or the batch `Fill all guide languages` action
- use cue generation only when you want extra delivery steering; cue sheets are optional editorial notes and are not injected into TTS requests
- audio generation reads the current guide description verbatim for each locale; cue sheets do not alter the spoken text
- for live show work, do not regenerate audio implicitly after import or metadata/title changes; make that an explicit operator decision first
- each generated audio file stores a per-locale narration snapshot with the exact spoken text, provider, model, voice, timestamp, and output path

## Architecture

### Public app

- Astro 6 static output
- TypeScript strict mode
- only `guided` artworks are published into the visitor-facing guide
- React islands for interactive pieces:
  - QR scanning
  - image gallery state
  - audio playback
  - theme switching

### Studio

- Vite + React UI under `studio/src/`
- Express API under `studio/server/index.ts`
- shared Zod schemas and file-backed content under `lib/` and `shows/`
- Studio manages the full exhibition inventory, including signage-only artworks that never ship to the public site

### Deployment model

- one active show per deployment
- static production artifact: `dist/`
- no SSR, database, or mandatory server compute in production
- optional reverse-proxy routing for the public guide and studio
- optional active-show state file under `SHOWS_DIR/.active-show`

## Repository Layout

```text
.
├── lib/                 # shared schemas, routing, export audit logic
├── public/shows/        # public show media assets
├── shows/               # file-backed show source data
├── src/                 # Astro visitor app
├── studio/              # local authoring UI + API
├── tests/               # unit + Playwright coverage
└── legacy/vite-app/     # archived pre-rewrite implementation
```

## Environment

Copy `.env.example` to `.env`.

Important variables:

- `SHOW`: active show id
- `ACTIVE_SHOW_FILE`: optional override file inside `SHOWS_DIR` that stores the currently activated show id
- `SHOWS_DIR`: source directory for show JSON
- `DEFAULT_LOCALE`: locale fallback, normally `de`
- `SHOW` data itself defines `locales`, `publicLocales`, and the per-show `defaultLocale`
- `PUBLIC_SITE_URL`: canonical site URL used for QR generation
- `STUDIO_API_ORIGIN`: externally reachable studio base URL, used for fallback URL generation
- `STUDIO_BASE_PATH`: relative mount path for the studio UI and API, for example `/studio`
- `STUDIO_USERNAME`: HTTP Basic Auth username for `/studio`
- `STUDIO_PASSWORD_HASH`: bcrypt hash for the studio Basic Auth password
- `STUDIO_SESSION_TOKEN`: random session token used to skip repeating the bcrypt check on every Studio asset/API request
- `OPENAI_API_KEY`: translation, cue generation, and OpenAI TTS fallback
- `ELEVENLABS_API_KEY`: primary TTS provider
- `ELEVENLABS_VOICE_IDS`: optional JSON object keyed by locale, for example `{"de":"...","en":"...","es":"..."}`
- `ELEVENLABS_DE_VOICE_ID`
- `ELEVENLABS_EN_VOICE_ID`
- `ELEVENLABS_ES_VOICE_ID`
- `STUDIO_ALLOW_MOCK_AI=true`: enables deterministic local fallbacks when real provider credentials are absent
- `PUBLIC_ANALYTICS_PROVIDER`: `none`, `plausible`, or `goatcounter`
- `PUBLIC_ANALYTICS_DOMAIN`

The public guide does not require secret keys at runtime. Secrets are only used by the studio/API layer.

## Local Intake Workflow

For real-world exhibition intake, keep raw source material in an ignored project folder under `import/`.
That workspace can hold:

- source PDFs and flyer scans
- intermediate markdown intake notes
- locally downloaded artist images
- temporary extraction artifacts

These folders are intentionally local-only and should not be committed.

## Local Development

Install dependencies:

```bash
npm install
```

Run all local services together:

```bash
npm run dev
```

This starts:

- public site: `http://localhost:4321`
- studio UI: `http://localhost:4173`
- studio API: `http://localhost:8787`

Individual surfaces:

```bash
npm run dev:site
npm run dev:studio
npm run dev:api
```

## Demo Show

The repository ships with a seeded `demo-show`.

If the active show data is missing, the helper scripts recreate:

- `shows/demo-show/show.json`
- `shows/demo-show/artworks/*.json`
- `public/shows/demo-show/media/*`

Manual reseed:

```bash
npm run seed:demo
```

## Build and Preview

Create the public static artifact:

```bash
npm run build
```

Preview the Astro output locally:

```bash
npm run preview
```

Production artifact:

- `dist/`

## Show Backups and Activation

The studio and CLI now support full-show backup and restore.

What a backup includes:

- `shows/<show-id>/show.json`
- `shows/<show-id>/artworks/*.json`
- generated QR assets under `shows/<show-id>/generated/qrs/`
- public binary assets under `public/shows/<show-id>/`
  - logo
  - images
  - audio
- a manifest with file checksums

Backup imports preserve both guided and signage-only artworks, including already generated audio files and signage assets.

CLI commands:

```bash
npm run show:backup -- demo-show
npm run show:import -- /path/to/demo-show.tar.gz --show-id demo-show-copy
npm run show:activate -- demo-show-copy
```

Studio behavior:

- `Backup active show` downloads a full `.tar.gz` archive
- `Import backup` restores a show side by side
- `Activate` switches the active show by writing `SHOWS_DIR/.active-show`

Backups are intentionally broader than export bundles: they preserve draft and in-progress authoring state as well as already-generated audio binaries, so moving a show between servers does not force regeneration or require the show to be export-ready first.

## Offline and Cache Strategy

Promenade uses a Workbox-generated service worker plus conservative HTTP caching headers.

Current strategy:

- HTML routes: `no-cache, must-revalidate`
- `sw.js`: `no-cache, no-store, must-revalidate`
- hashed `/_astro/*` assets: long-lived immutable caching
- show media under `/shows/*`: revalidated caching, not year-long immutable caching
- runtime service-worker caches are versioned per build and cleaned up automatically
- localhost / `127.0.0.1` do not register a service worker; existing Promenade caches are actively cleared there to prevent sticky development builds

This is intentionally tuned to prevent visitors from getting stuck on old deployments while still supporting offline use after the first load.

Audio generation writes compressed `mp3` assets for both ElevenLabs and OpenAI output paths. Regenerating an artwork track also removes older sibling files for the same artwork/locale so stale `wav` files do not accumulate in the active show media directory. Because regeneration is destructive to the narration snapshot for that locale, treat it as an explicit step rather than something tied automatically to import or title-copy changes.

## Testing and Quality Gates

Type and Astro diagnostics:

```bash
npm run check
```

Lint:

```bash
npm run lint
```

Format:

```bash
npm run format
```

Unit tests:

```bash
npm run test:unit
```

E2E tests:

```bash
npm run test:e2e
```

Useful targeted runs:

```bash
npx playwright test tests/e2e/site.spec.ts --project=android
npx playwright test tests/e2e/studio.spec.ts --project=chromium
```

Playwright notes:

- E2E tests use a seeded `.playwright-shows/` sandbox created in `tests/e2e/global.setup.ts`
- desktop Chromium is the canonical visual baseline target
- Android and iPhone projects are Chromium-based viewport/device emulations
- studio tests intentionally run on desktop Chromium only

## Docker

Compose starts three services:

- `promenade`: front Caddy on port `80` serving the public guide and routing `/studio`
- `studio-ui`: static Vite build served behind `/studio`
- `studio-api`: Express API for authoring, media, export, and print endpoints

Bring everything up:

```bash
docker compose up -d --build
```

Local endpoints:

- public site: `http://localhost`
- studio UI: `http://localhost/studio`
- studio API: `http://localhost/studio/api`

Set `PUBLIC_SITE_URL` and `STUDIO_API_ORIGIN` in your local `.env` to the externally reachable visitor-guide URL and studio base URL for the deployment you are standing up. The committed examples stay generic on purpose.
Set `STUDIO_USERNAME` and `STUDIO_PASSWORD_HASH` as well; the Docker-hosted `/studio` route is protected with HTTP Basic Auth.

Static image build:

```bash
docker build --target static -t promenade-static .
docker run --rm -p 8080:80 promenade-static
```

## Ops Bundles

The repo now ships two deployment bundles under `ops/`:

- `ops/public/`: the default production path for the visitor guide
- `ops/studio/`: optional protected hosted studio stack

Recommended public deployment flow:

```bash
npm run bundle:public
```

This creates `.deploy/public/` with:

- `dist/`
- `Caddyfile`
- `docker-compose.yml`
- `.env.example`

Then on the target host:

1. copy `.deploy/public/`
2. create `.env` from `.env.example`
3. set `SITE_HOST`
4. run `docker compose up -d`

The optional hosted studio stack lives in `ops/studio/` and expects:

- a checked-out repository
- the root `.env` with studio/API secrets
- HTTP Basic Auth settings in `ops/studio/.env`

## Notes and Caveats

- Promenade currently supports `de`, `en`, and `es`, and each show chooses its own enabled `locales`, published `publicLocales`, and `defaultLocale`.
- Locale resolution prefers URL locale, then a saved preference, then browser/system locale, and only then falls back to the show's default locale.
- AI-generated translations must be explicitly approved for every published locale before export is considered ready.
- Artwork pages attempt autoplay on entry. This works reliably in mobile-style contexts and is still subject to desktop browser autoplay policy.
- The archived Vite/vanilla implementation lives in `legacy/vite-app/` and is reference-only.
- The visitor guide remains deployable as static files only; the studio is separate and optional.
