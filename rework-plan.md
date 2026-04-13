# Promenade Rework Plan

Last updated: 2026-04-07 UTC
Status: implemented baseline on `feature/astro-static-rebuild`

## Implemented Baseline

The clean-break rewrite is no longer just planned. The baseline system now exists and is usable.

Implemented:

- static Astro visitor guide
- local React + Express authoring studio
- file-backed show model
- side-by-side show backup/import/activate lifecycle
- QR parsing plus printable QR sheets
- show-defined locale routing and locale resolution
- cue-generation and TTS pipeline
- translation approval gating before export
- Docker-first development workflow
- static export to `dist/`
- Vitest, Playwright, Biome, and typed shared schemas

## What Works Today

### Visitor guide

- localized guide routes
- mobile-first artwork pages with a persistent dock
- QR scanning and manual number entry
- autoplay attempt on artwork entry
- previous/next artwork controls inside the mobile dock
- offline-after-first-load caching strategy

### Studio

- show editing
- artwork editing
- media uploads
- translation draft generation
- cue generation between text authoring and TTS
- deterministic audio generation from canonical per-locale guide descriptions
- persisted narration snapshots for each generated audio file
- ElevenLabs/OpenAI/mock audio generation
- QR download and A4 print preview
- export-readiness auditing

### Tooling

- strict TypeScript
- shared Zod validation
- deterministic Playwright sandbox seeding
- Docker compose for local and VM preview workflows

## Remaining Follow-Ups

These are refinements, not blockers for the rewritten baseline.

1. Add real WebKit Playwright coverage when the VM has the missing browser libraries.
2. Improve unit coverage for the studio server extraction points if that API grows further.
3. Add richer authoring affordances:
   - artwork deletion
   - drag-and-drop ordering
   - show duplication/bootstrap
4. Add accessibility upgrades such as captions or VTT if the exhibition requirements tighten.
5. Revisit autoplay expectations per platform if product policy changes; current implementation already attempts autoplay, but desktop browsers may still block audible start.

## Constraints Still In Force

- one active show per deployment
- static `dist/` output for production
- local-first authoring workflow
- supported locale set currently includes `de`, `en`, and `es`, while each show chooses its own enabled and published locales
- explicit approval required for AI-generated translations in every published locale before export
- the public bundle must never depend on secret keys
