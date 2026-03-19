# Promenade

Promenade is a static-first exhibition guide with a local authoring studio.

The repository now has two runtime surfaces:

- `site`: the public visitor guide built with Astro and exported to `dist/`
- `studio`: a React + Express authoring workflow for editing one active show, managing media, generating translations/audio, and exporting printable QR assets

Production stays simple: ship `dist/` behind any static web server. The studio remains a separate authoring surface and does not ship with the public build.

## Current Product State

### Visitor guide

- localized static routes for `de` and `en`
- app-like mobile artwork view with a persistent bottom control dock
- browser-side QR scanning and manual artwork number entry
- smart previous/next artwork controls in the mobile dock
- image gallery, artwork metadata, and audio playback per artwork
- dark mode with `system`, `light`, and `dark` preferences
- offline-after-first-load behavior via Workbox

### Authoring studio

- show metadata editing
- artwork CRUD for the active show
- media upload for artwork images
- OpenAI-powered English translation drafts
- OpenAI-powered audio cue generation
- ElevenLabs-first TTS generation with OpenAI/mock fallback
- QR code download plus A4 print-sheet layout
- export-readiness auditing before static build

## Architecture

### Public app

- Astro 6 static output
- TypeScript strict mode
- React islands for interactive pieces:
  - QR scanning
  - image gallery state
  - audio playback
  - theme switching

### Studio

- Vite + React UI under `studio/src/`
- Express API under `studio/server/index.ts`
- shared Zod schemas and file-backed content under `lib/` and `shows/`

### Deployment model

- one active show per deployment
- static production artifact: `dist/`
- no SSR, database, or mandatory server compute in production
- optional VM preview routing via Traefik for the public guide and studio

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
- `SHOWS_DIR`: source directory for show JSON
- `DEFAULT_LOCALE`: locale fallback, normally `de`
- `PUBLIC_SITE_URL`: canonical site URL used for QR generation
- `STUDIO_API_ORIGIN`: origin used by the studio UI
- `OPENAI_API_KEY`: translation, cue generation, and OpenAI TTS fallback
- `ELEVENLABS_API_KEY`: primary TTS provider
- `ELEVENLABS_DE_VOICE_ID`
- `ELEVENLABS_EN_VOICE_ID`
- `STUDIO_ALLOW_MOCK_AI=true`: enables deterministic local fallbacks when real provider credentials are absent
- `PUBLIC_ANALYTICS_PROVIDER`: `none`, `plausible`, or `goatcounter`
- `PUBLIC_ANALYTICS_DOMAIN`

The public guide does not require secret keys at runtime. Secrets are only used by the studio/API layer.

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

## Offline and Cache Strategy

Promenade uses a Workbox-generated service worker plus conservative HTTP caching headers.

Current strategy:

- HTML routes: `no-cache, must-revalidate`
- `sw.js`: `no-cache, no-store, must-revalidate`
- hashed `/_astro/*` assets: long-lived immutable caching
- show media under `/shows/*`: revalidated caching, not year-long immutable caching
- runtime service-worker caches are versioned per build and cleaned up automatically

This is intentionally tuned to prevent visitors from getting stuck on old deployments while still supporting offline use after the first load.

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

Compose starts two services:

- `promenade-dev`: local Astro site, studio UI, and studio API
- `promenade-web`: static Caddy container for the public guide

Bring everything up:

```bash
docker compose up -d --build
```

Local endpoints:

- public site: `http://localhost:4321`
- studio UI: `http://localhost:4173`
- studio API: `http://localhost:8787`

Optional Traefik preview routes:

- public guide host is driven by `PUBLIC_HOSTNAME`
- studio host is driven by `STUDIO_HOSTNAME`
- set `PUBLIC_SITE_URL` to the externally reachable public guide URL

Static image build:

```bash
docker build --target static -t promenade-static .
docker run --rm -p 8080:80 promenade-static
```

## Notes and Caveats

- German and English are first-class locales. German is only the fallback when no stronger locale signal exists.
- AI-generated English translations must be explicitly approved before export is considered ready.
- Artwork pages attempt autoplay on entry. This works reliably in mobile-style contexts and is still subject to desktop browser autoplay policy.
- The archived Vite/vanilla implementation lives in `legacy/vite-app/` and is reference-only.
