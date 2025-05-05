# Promenade

A lightweight, mobile-first web application for museum audio guides. This application allows visitors to access artwork information, images, and audio descriptions by entering numbers or scanning QR codes.

## Features

- Mobile-first responsive design
- Works offline (PWA)
- QR code scanning support
- Native audio playback
- No server required - runs entirely in the browser
- Easy to customize and deploy
- Modern asset and dependency management (npm, Vite, ES modules)

## Third-Party Libraries & Fonts

All third-party libraries and fonts are managed via npm and imported as ES modules or CSS imports. No CDN or manual copying is required.

| Library/Font      | Version   | npm Package                        | Usage                        |
|------------------|-----------|------------------------------------|------------------------------|
| Font Awesome     | 6.7.2     | @fortawesome/fontawesome-free       | Icon fonts for UI            |
| Swiper           | 11.2.6    | swiper                              | Image slider/gallery         |
| js-yaml          | 4.1.0     | js-yaml                             | YAML parsing for artwork data|
| QR Scanner       | 1.4.2     | qr-scanner                          | QR code scanning             |
| Playfair Display | latest    | @fontsource/playfair-display        | Headings, titles             |
| Inter            | latest    | @fontsource/inter                   | Body text                    |

> **Note:** All dependencies are bundled by Vite. No references to `public/vendor/` or CDN are used. Fonts are imported via `css/fonts.css` using @fontsource.

## Artwork Data & Content Management

All artwork data is managed as Markdown files with YAML front matter, located in `artworks/content/`. Each artwork has a corresponding Markdown file (e.g., `01.md`, `02.md`, etc.) with metadata and content. An index (`index.json`) is generated automatically for fast lookup.

### Artwork Markdown Example

```markdown
---
id: "01"
title:
  en: "Artwork Title in English"
  de: "Kunstwerktitel auf Deutsch"
description:
  en: "Description in English."
  de: "Beschreibung auf Deutsch."
artist: "Artist Name"
year: "2023"
image:
  - "01.jpg"
  - "01-detail1.jpg"
audio:
  en: "01-en.mp3"
  de: "01-de.mp3"
---
```

- **Images**: Place in `artworks/images/` (referenced by filename in YAML).
- **Audio**: Place in `artworks/audio/` (referenced by filename in YAML).
- **Add new artworks**: Create a new Markdown file in `artworks/content/` following the above format, and add corresponding images/audio.
- **Index generation**: Run `npm run generate-index` to update `index.json` after adding or editing artworks.

### Data Loading
- The app loads artwork data dynamically from the Markdown files and the generated `index.json`.
- No hardcoded artwork data is used in the JS code.

## Build Process

To produce a fully self-contained, deployable app:

- Run `npm run build`.
- The `public/` folder will contain all minified JS/CSS, assets, fonts, and artwork content, ready for deployment.

## Setup

1. Clone this repository
2. Add your artwork assets:
   - Place artwork images in `artworks/images/`
   - Place audio files in `artworks/audio/`
   - Add Markdown files to `artworks/content/` as described above

> **Tip:** If you ever need to reset your dependencies, run:
> ```bash
> npm run clean
> npm install
> ```

## Deployment

Since this is a static website, you can deploy it to any web hosting service that supports static sites:

- GitHub Pages
- Netlify
- Vercel
- Or any standard web server

## QR Code Generation

To generate QR codes for your artworks:

1. Create QR codes that contain just the artwork number (e.g., "1", "2", etc.)
2. Print and place the QR codes next to the corresponding artworks

## Development

To run locally during development:

1. Run the Vite dev server:
   ```bash
   npm run dev
   ```
2. Open the local server URL (e.g., `http://localhost:5173`) in your browser

> **Note:** Do not open HTML files directly in your browser; always use the Vite dev server for local development.

## Browser Support

This application uses modern web technologies and should work in all recent versions of:

- Chrome
- Firefox
- Safari
- Edge

## Customization

### Styling
Modify `css/styles.css` to match your institution's branding:

- Update the color scheme in the `:root` variables
- Modify the layout and components as needed

### Adding Features
The modular structure makes it easy to add new features:

1. Modify the HTML in `index.html`
2. Add corresponding styles in `css/styles.css`
3. Extend the `AudioGuideApp` class in `js/app.js`

## Build & Development Scripts

- `npm run build` — Bundles and prepares a deployable `public/` folder using Vite.
- `npm run build:all` — Clean, generate artwork images and audio files, then run the full build. Use this when you add or update artwork content.
- `npm run generate-artwork-images` — Generate artwork images from metadata (for development/content updates).
- `npm run generate-audio-files` — Generate audio files for artworks (requires OpenAI API key).
- `npm run dev` — Serve the app locally for development with hot reload (Vite).
- `npm run clean` — Remove the `public/` build output and reset for a fresh build.

> For most development, use `npm run dev`. When adding new artworks or updating content, use `npm run build:all` to ensure all generated assets are up to date.

## Favicons & App Icons

Favicons and app icons are included from the `assets/` folder and referenced in all HTML files:

- `assets/icon-192.png` (192x192)
- `assets/icon-512.png` (512x512)

These are used for browser tabs, bookmarks, and PWA installation.
