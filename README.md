# Promenade

A lightweight, mobile-first web application for museum audio guides. This application allows visitors to access artwork information, images, and audio descriptions by entering numbers or scanning QR codes.

## Features

- Mobile-first responsive design
- Works offline (PWA)
- QR code scanning support
- Native audio playback
- No server required - runs entirely in the browser
- Easy to customize and deploy

## Third-Party Libraries

The following third-party libraries are managed via npm and copied to `public/vendor/` during the build process:

| Library         | Version   | npm Package                          | Public Path(s)                        | Usage                        |
|----------------|-----------|--------------------------------------|---------------------------------------|------------------------------|
| Font Awesome   | 6.7.2     | @fortawesome/fontawesome-free         | `vendor/all.min.css`, `vendor/webfonts/*` | Icon fonts for UI            |
| Swiper         | 11.2.6    | swiper                                | `vendor/swiper-bundle.min.js`, `vendor/swiper-bundle.min.css` | Image slider/gallery         |
| js-yaml        | 4.1.0     | js-yaml                               | `vendor/js-yaml.min.js`                | YAML parsing for artwork data|
| QR Scanner     | 1.4.2     | qr-scanner                            | `vendor/qr-scanner.min.js`, `vendor/qr-scanner-worker.min.js` | QR code scanning            |

> **Note:** All references in HTML, CSS, and JS point to these local files in `public/vendor/`. No remote CDN loads are required for any dependencies.

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
- The `public/` folder will contain all minified JS/CSS, assets, fonts, vendor libraries, and artwork content, ready for deployment.

## Setup

1. Clone this repository
2. Add your artwork assets:
   - Place artwork images in `assets/` directory
   - Place audio files in `assets/` directory
   - Update the `artworkData` object in `js/app.js` with your content

### Artwork Data Structure

Add your artwork information to the `artworkData` object in `js/app.js`:

```javascript
const artworkData = {
    1: {
        title: "Artwork Title",
        description: "Artwork description",
        image: "assets/artwork-1.jpg",
        audio: "assets/audio-1.mp3"
    },
    // Add more artwork entries...
};
```

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

1. Use a local web server (e.g., Python's built-in server):
   ```bash
   python -m http.server 8000
   ```
2. Open `http://localhost:8000` in your browser

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
3. Extend the `AudioGuide` class in `js/app.js`

## Build & Development Scripts

- `npm run build` — Clean, generate index, copy and minify all assets, and prepare a deployable `public/` folder.
- `npm run build:all` — Clean, generate artwork images and audio files, then run the full build. Use this when you add or update artwork content.
- `npm run generate-artwork-images` — Generate artwork images from metadata (for development/content updates).
- `npm run generate-audio-files` — Generate audio files for artworks (requires OpenAI API key).
- `npm run dev` — Build and serve the app locally for development.
- `npm run watch` — Watch for changes in source/content files and automatically rebuild the app (use with `npm run serve` for live development).
- `npm run browsersync` — Serve the app from the public folder with live reload on file changes (use with `npm run watch` for full live-reload development).

> For most development, use `npm run dev`. When adding new artworks or updating content, use `npm run build:all` to ensure all generated assets are up to date. For live-rebuilds, run `npm run watch` and `npm run browsersync` in parallel.
