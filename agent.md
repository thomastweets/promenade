# Project Memory: Promenade

Last updated: 2026-04-10 UTC
Repository: `promenade`
Active branch: `feature/astro-static-rebuild`
Plan reference: `rework-plan.md`

## Current State

Promenade is now a clean-break rewrite. The old root-level Vite/vanilla app is archived in `legacy/vite-app/` and no longer drives the product.

The active codebase contains:

- static Astro visitor guide in `src/`
- local authoring studio in `studio/`
- shared content/schema logic in `lib/`
- file-backed show data in `shows/`
- public show media in `public/shows/`

## Public Guide

### Runtime shape

- static Astro output to `dist/`
- one active show per build, selected by `SHOW`
- localized routes:
  - `/`
  - `/{locale}/`
  - `/{locale}/artworks/`
  - `/{locale}/artworks/{id}/`
  - `/{locale}/help/`
  - `/{locale}/about/`

### Current UX

- mobile artwork pages use a persistent bottom dock
- dock keeps artwork metadata, play/pause, seek bar, QR scan, manual number entry, and previous/next artwork controls on screen
- manual number entry auto-focuses on open
- artwork pages attempt autoplay on entry
- dark mode is supported with `system`, `light`, and `dark`

### Locale rules

- supported locales in code: `de`, `en`, `es`
- each show defines its own enabled `locales`, published `publicLocales`, and `defaultLocale`
- locale preference order:
  1. URL locale
  2. saved user preference
  3. browser/system locale
  4. show default locale fallback

## Studio

### Current workflows

- show metadata editing
- artwork creation and editing
- per-artwork `guided` vs `signage-only` publication mode
- image upload
- authoritative source-description intake per artwork
- explicit `sourceLocale` per artwork
- authoritative original artwork titles plus per-locale optional `titleSubtitle` helper translations
- source-locale guide-copy sync without automated rewriting
- translation draft generation from the authoritative source text
- optional artwork-specific cue generation for audio tone/pacing
- audio generation from current guide descriptions
- one-shot batch translation, cue, and audio actions with controlled concurrency
- QR asset download
- A4 print-sheet layout
- export-readiness audit
- static build trigger

### AI behavior

- OpenAI: faithful translation drafts, cue generation, OpenAI TTS fallback
- OpenAI prompt context can include show-level internal `researchNotes` plus per-locale `audioGuideStyle`
- ElevenLabs: primary TTS provider
- mock fallbacks: deterministic outputs when `STUDIO_ALLOW_MOCK_AI=true`
- spoken audio content is now anchored in `description[locale]`
- `sourceDescription[locale]` remains the authoritative intake text; the source-locale guide copy should normally be a direct sync/copy of it
- artwork titles remain authoritative in their original language/spelling; translated title help belongs in `titleSubtitle[locale]`, not in `title`
- audio cues remain optional and are ignored for TTS unless an editor explicitly enables cue usage
- ask before regenerating audio after import, metadata, or title changes; do not assume regeneration is desired
- each locale stores a persisted narration snapshot with exact spoken text plus provider/model/voice metadata for the current audio file

### Export rules

- translations for every published locale must be approved before export
- only `guided` artworks are audited for public-guide readiness
- guided artworks still require referenced images plus audio readiness for every published locale
- signage-only artworks remain valid with minimal metadata and no public-guide assets

## Content Model

### Source files

- `shows/<show-id>/show.json`
- `shows/<show-id>/artworks/<artwork-id>.json`

### Artwork modes

- `guideMode: "guided"`: published into the visitor guide, included in QR/audio flows, and rendered with the audioguide rail on signage
- `guideMode: "signage-only"`: managed only in Studio, omitted from public routes and QR/audio generation, and rendered as a full-width signage card without the QR rail
- artworks store `sourceDescription` separately from public `description`, so intake copy and visitor-facing guide copy can diverge deliberately
- artworks also store `titleLocale` and `titleSubtitle`, so signage and the public guide can keep the original title stable while optionally showing faithful subtitle translations

### Public assets

- `public/shows/<show-id>/brand/...`
- `public/shows/<show-id>/media/images/...`
- `public/shows/<show-id>/media/audio/...`

### Demo show

The repository can recreate `demo-show` via:

- `node scripts/ensure-demo-show.mjs`
- `npm run seed:demo`

The Playwright harness seeds an isolated `.playwright-shows/` directory in `tests/e2e/global.setup.ts`.

### Local intake workspace

- ignored local source folders under `import/` can store raw PDFs, intake notes, extracted text, and downloaded artwork images during show onboarding
- keep show-specific research material and artist assets there rather than in tracked repository paths

## Deployment and Caching

### Deployment

- production artifact: `dist/`
- static hosting only
- no SSR requirement
- public/studio preview hostnames are environment-driven via `PUBLIC_HOSTNAME` and `STUDIO_HOSTNAME`
- `PUBLIC_SITE_URL` must match the externally reachable public guide URL
- public deployment bundle lives in `ops/public/`
- optional protected hosted studio bundle lives in `ops/studio/`
- active show resolution prefers `SHOWS_DIR/.active-show` when present, then falls back to `SHOW`

### Show lifecycle

- full-show backup export is available via studio and CLI as `.tar.gz`
- imports restore JSON, images, audio, logo assets, and generated QR files
- imports are side-by-side by default and do not overwrite existing shows
- activation is explicit and updates `SHOWS_DIR/.active-show`

### Caching

- service worker is generated post-build in `scripts/postbuild-sw.mjs`
- localhost / `127.0.0.1` skip service-worker registration and clear Promenade caches to avoid sticky development builds
- public builds are pruned to the active show only via `scripts/prune-public-build.mjs`
- regenerated audio now writes `mp3` and removes older same-artwork same-locale `wav` / `mp3` siblings
- build-specific runtime cache names prevent stale cross-build reuse
- Caddy serves:
  - HTML with `no-cache, must-revalidate`
  - `sw.js` with `no-cache, no-store, must-revalidate`
  - hashed Astro assets as immutable
  - show media with revalidation-friendly caching

## Commands

Primary commands:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run check`
- `npm run lint`
- `npm run test:unit`
- `npm run test:e2e`

Useful focused test commands:

- `npx playwright test tests/e2e/site.spec.ts --project=android`
- `npx playwright test tests/e2e/studio.spec.ts --project=chromium`

Docker:

- `docker compose up -d --build`
- `docker build --target static -t promenade-static .`

## Verified Status

Verified on 2026-03-18:

- `npm run lint` succeeds
- `npm run check` succeeds
- `npm run build` succeeds
- `npm run test:unit` succeeds
- targeted Playwright suites succeed:
  - mobile visitor flow on Android emulation
  - studio flow on desktop Chromium

## Known Caveats

- Artwork pages attempt autoplay, but desktop audible autoplay still depends on browser policy.
- iPhone coverage is Chromium viewport emulation, not real WebKit/Safari.
- The studio is still local-first; the preview route exists for convenience, not as a hardened multi-user admin deployment.
