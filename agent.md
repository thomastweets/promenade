# Project Memory: Promenade

Last updated: 2026-03-18 UTC
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

- supported locales: `de`, `en`
- both locales are first-class
- locale preference order:
  1. URL locale
  2. saved user preference
  3. browser/system locale
  4. German fallback

## Studio

### Current workflows

- show metadata editing
- artwork creation and editing
- image upload
- translation draft generation
- artwork-specific cue generation for audio tone/pacing
- audio generation
- QR asset download
- A4 print-sheet layout
- export-readiness audit
- static build trigger

### AI behavior

- OpenAI: translation drafts, cue generation, narration shaping, OpenAI TTS fallback
- ElevenLabs: primary TTS provider
- mock fallbacks: deterministic outputs when `STUDIO_ALLOW_MOCK_AI=true`

### Export rules

- English translations must be approved before export
- referenced artwork images must exist
- DE and EN audio file references must exist and be marked ready

## Content Model

### Source files

- `shows/<show-id>/show.json`
- `shows/<show-id>/artworks/<artwork-id>.json`

### Public assets

- `public/shows/<show-id>/brand/...`
- `public/shows/<show-id>/media/images/...`
- `public/shows/<show-id>/media/audio/...`

### Demo show

The repository can recreate `demo-show` via:

- `node scripts/ensure-demo-show.mjs`
- `npm run seed:demo`

The Playwright harness seeds an isolated `.playwright-shows/` directory in `tests/e2e/global.setup.ts`.

## Deployment and Caching

### Deployment

- production artifact: `dist/`
- static hosting only
- no SSR requirement
- public/studio preview hostnames are environment-driven via `PUBLIC_HOSTNAME` and `STUDIO_HOSTNAME`
- `PUBLIC_SITE_URL` must match the externally reachable public guide URL

### Caching

- service worker is generated post-build in `scripts/postbuild-sw.mjs`
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
