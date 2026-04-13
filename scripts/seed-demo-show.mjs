import fs from "node:fs"
import path from "node:path"
import yaml from "js-yaml"

const seedPrompt = {
  de: "Sprich wie eine kluge, ruhige Museumsbegleitung: warm, klar, aufmerksam und nie effekthascherisch. Betone Atmosphäre, Materialität und räumliche Wahrnehmung, lasse kurze Pausen nach gedanklich dichten Sätzen und formuliere so, dass Besucherinnen und Besucher gern weiter zuhören.",
  en: "Speak like a thoughtful museum guide: warm, observant, calm, and never theatrical. Emphasize atmosphere, materiality, and spatial perception, leave short pauses after dense ideas, and phrase the narration so visitors want to keep listening.",
  es: ""
}

function withEmptySpanish(record) {
  return {
    ...record,
    es: record.es ?? ""
  }
}

function createAuthoritativeTitleRecord(title) {
  const normalized = `${title ?? ""}`.trim()
  return {
    de: normalized,
    en: normalized,
    es: normalized
  }
}

function createTitleSubtitleRecord(
  record,
  authoritativeTitle,
  titleLocale = "de"
) {
  const normalizedTitle = `${authoritativeTitle ?? ""}`.trim()
  const values = withEmptySpanish(record || {})

  return {
    de:
      titleLocale === "de" || `${values.de ?? ""}`.trim() === normalizedTitle
        ? ""
        : `${values.de ?? ""}`.trim(),
    en:
      titleLocale === "en" || `${values.en ?? ""}`.trim() === normalizedTitle
        ? ""
        : `${values.en ?? ""}`.trim(),
    es:
      titleLocale === "es" || `${values.es ?? ""}`.trim() === normalizedTitle
        ? ""
        : `${values.es ?? ""}`.trim()
  }
}

function withDefaultLocaleStatuses(
  record,
  defaultLocale = "de",
  fallback = "missing"
) {
  return {
    de: record.de ?? (defaultLocale === "de" ? "human" : fallback),
    en: record.en ?? (defaultLocale === "en" ? "human" : fallback),
    es: record.es ?? (defaultLocale === "es" ? "human" : fallback)
  }
}

const signageOnlyFixtures = [
  {
    id: "12",
    number: 12,
    slug: "still-life-study-in-ochre",
    guideMode: "signage-only",
    artist: "Eva Schneider",
    year: "2026",
    sourceLocale: "de",
    titleLocale: "de",
    title: createAuthoritativeTitleRecord("Stillleben in Ocker"),
    titleSubtitle: createTitleSubtitleRecord(
      {
        de: "Stillleben in Ocker",
        en: "Still Life in Ochre",
        es: ""
      },
      "Stillleben in Ocker"
    ),
    sourceDescription: {
      de: "",
      en: "",
      es: ""
    },
    description: {
      de: "",
      en: "",
      es: ""
    },
    material: {
      de: "Eitempera und Kreide auf Holz",
      en: "Egg tempera and chalk on panel",
      es: ""
    },
    dimensions: "120 × 90 cm",
    images: [],
    audioCues: {
      de: "",
      en: "",
      es: ""
    },
    audio: {
      de: "",
      en: "",
      es: ""
    },
    translationStatus: {
      de: "human",
      en: "approved",
      es: "missing"
    },
    audioCueStatus: {
      de: "missing",
      en: "missing",
      es: "missing"
    },
    audioStatus: {
      de: "missing",
      en: "missing",
      es: "missing"
    }
  },
  {
    id: "13",
    number: 13,
    slug: "archive-of-traces",
    guideMode: "signage-only",
    artist: "Murat Kaya",
    year: "",
    sourceLocale: "de",
    titleLocale: "de",
    title: createAuthoritativeTitleRecord("Archiv der Spuren"),
    titleSubtitle: createTitleSubtitleRecord(
      {
        de: "Archiv der Spuren",
        en: "Archive of Traces",
        es: ""
      },
      "Archiv der Spuren"
    ),
    sourceDescription: {
      de: "",
      en: "",
      es: ""
    },
    description: {
      de: "",
      en: "",
      es: ""
    },
    material: {
      de: "Pigment, Wachs und Papier",
      en: "Pigment, wax, and paper",
      es: ""
    },
    dimensions: "180 × 60 cm",
    images: [],
    audioCues: {
      de: "",
      en: "",
      es: ""
    },
    audio: {
      de: "",
      en: "",
      es: ""
    },
    translationStatus: {
      de: "human",
      en: "approved",
      es: "missing"
    },
    audioCueStatus: {
      de: "missing",
      en: "missing",
      es: "missing"
    },
    audioStatus: {
      de: "missing",
      en: "missing",
      es: "missing"
    }
  },
  {
    id: "14",
    number: 14,
    slug: "untitled-blue-study",
    guideMode: "signage-only",
    artist: "Leonie Hartmann",
    year: "2025",
    sourceLocale: "de",
    titleLocale: "de",
    title: createAuthoritativeTitleRecord("Ohne Titel (Blaue Studie)"),
    titleSubtitle: createTitleSubtitleRecord(
      {
        de: "Ohne Titel (Blaue Studie)",
        en: "Untitled (Blue Study)",
        es: ""
      },
      "Ohne Titel (Blaue Studie)"
    ),
    sourceDescription: {
      de: "",
      en: "",
      es: ""
    },
    description: {
      de: "",
      en: "",
      es: ""
    },
    material: {
      de: "",
      en: "",
      es: ""
    },
    dimensions: "",
    images: [],
    audioCues: {
      de: "",
      en: "",
      es: ""
    },
    audio: {
      de: "",
      en: "",
      es: ""
    },
    translationStatus: {
      de: "human",
      en: "approved",
      es: "missing"
    },
    audioCueStatus: {
      de: "missing",
      en: "missing",
      es: "missing"
    },
    audioStatus: {
      de: "missing",
      en: "missing",
      es: "missing"
    }
  }
]

function parseFrontmatter(filePath) {
  const raw = fs.readFileSync(filePath, "utf8")
  const match = raw.match(/^---\n([\s\S]*?)\n---/)

  if (!match) {
    throw new Error(`Missing frontmatter in ${filePath}`)
  }

  return yaml.load(match[1])
}

function ensureDir(target) {
  fs.mkdirSync(target, { recursive: true })
}

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
}

function createSvgMarkup(artwork, variantIndex) {
  const palettes = [
    ["#1f4b63", "#d9efe7"],
    ["#5a2d7c", "#fdeed2"],
    ["#8b3a2d", "#f7dccc"],
    ["#274d37", "#e5f4d6"]
  ]
  const [ink, paper] = palettes[variantIndex % palettes.length]
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="960" viewBox="0 0 1280 960">
  <defs>
    <linearGradient id="bg" x1="0%" x2="100%" y1="0%" y2="100%">
      <stop offset="0%" stop-color="${paper}" />
      <stop offset="100%" stop-color="#ffffff" />
    </linearGradient>
  </defs>
  <rect width="1280" height="960" fill="url(#bg)" />
  <circle cx="${220 + variantIndex * 120}" cy="${220 + variantIndex * 70}" r="${180 + variantIndex * 20}" fill="${ink}" opacity="0.14" />
  <circle cx="${1020 - variantIndex * 90}" cy="${720 - variantIndex * 45}" r="${210 - variantIndex * 15}" fill="${ink}" opacity="0.10" />
  <rect x="96" y="120" width="1088" height="720" rx="42" fill="none" stroke="${ink}" stroke-width="8" opacity="0.72" />
  <text x="130" y="240" fill="${ink}" font-family="Georgia, serif" font-size="38" letter-spacing="3">PROMENADE</text>
  <text x="130" y="360" fill="${ink}" font-family="Georgia, serif" font-size="84" font-weight="700">${artwork.titleSubtitle.en || artwork.title.en}</text>
  <text x="130" y="440" fill="${ink}" font-family="Arial, sans-serif" font-size="34">${artwork.artist} · ${artwork.year}</text>
  <text x="130" y="620" fill="${ink}" font-family="Arial, sans-serif" font-size="30">${artwork.description.en.slice(0, 120)}</text>
  <text x="130" y="760" fill="${ink}" font-family="Arial, sans-serif" font-size="28" opacity="0.78">Sample placeholder image ${variantIndex + 1}</text>
</svg>`
}

function createToneWavBuffer(seed) {
  const sampleRate = 22050
  const seconds = 2.6
  const samples = Math.floor(sampleRate * seconds)
  const dataSize = samples * 2
  const buffer = Buffer.alloc(44 + dataSize)
  const frequency = 220 + (seed % 7) * 35

  buffer.write("RIFF", 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write("WAVE", 8)
  buffer.write("fmt ", 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write("data", 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < samples; index += 1) {
    const time = index / sampleRate
    const envelope = Math.min(1, index / 3000) * (1 - index / samples)
    const sample =
      Math.sin(2 * Math.PI * frequency * time) * envelope * 0.3 +
      Math.sin(2 * Math.PI * (frequency / 2) * time) * envelope * 0.12
    buffer.writeInt16LE(
      Math.max(-1, Math.min(1, sample)) * 32767,
      44 + index * 2
    )
  }

  return buffer
}

function copyIfPresent(source, target) {
  if (fs.existsSync(source)) {
    ensureDir(path.dirname(target))
    fs.copyFileSync(source, target)
  }
}

export async function seedDemoShow({
  showsDir = process.env.SHOWS_DIR || "shows"
} = {}) {
  const legacyRoot = path.resolve("legacy/vite-app")
  const fixturesRoot = path.join(legacyRoot, "fixtures")
  const legacyPublicRoot = path.join(legacyRoot, "public")
  const showId = "demo-show"
  const showRoot = path.resolve(showsDir, showId)
  const artworkRoot = path.join(showRoot, "artworks")
  const publicShowRoot = path.resolve("public", "shows", showId)
  const imageRoot = path.join(publicShowRoot, "media", "images")
  const audioRoot = path.join(publicShowRoot, "media", "audio")
  const brandRoot = path.join(publicShowRoot, "brand")
  const iconRoot = path.resolve("public", "icons")

  ensureDir(artworkRoot)
  ensureDir(imageRoot)
  ensureDir(audioRoot)
  ensureDir(brandRoot)
  ensureDir(iconRoot)

  copyIfPresent(
    path.join(legacyPublicRoot, "assets", "promenade_logo.png"),
    path.join(brandRoot, "promenade-logo.png")
  )
  copyIfPresent(
    path.join(legacyPublicRoot, "assets", "icon-192.png"),
    path.join(iconRoot, "icon-192.png")
  )
  copyIfPresent(
    path.join(legacyPublicRoot, "assets", "icon-512.png"),
    path.join(iconRoot, "icon-512.png")
  )

  const exhibition = parseFrontmatter(path.join(fixturesRoot, "exhibition.md"))

  const show = {
    id: showId,
    slug: "promenade-demo-show",
    locales: ["de", "en"],
    publicLocales: ["de", "en"],
    defaultLocale: "de",
    title: withEmptySpanish(exhibition.title),
    subtitle: withEmptySpanish(exhibition.subtitle),
    intro: withEmptySpanish(exhibition.start_page.text),
    about: withEmptySpanish(exhibition.vita.text),
    researchNotes: {
      de: "",
      en: "",
      es: ""
    },
    help: {
      de: "Scannen Sie den QR-Code am Werk oder geben Sie die Werknummer ein. Bilder und Audio werden nach dem ersten Aufruf lokal zwischengespeichert, damit der Rundgang stabil weiterläuft.",
      en: "Scan the QR code next to an artwork or enter the work number manually. Images and audio are cached after the first request so the tour remains usable with unstable connectivity.",
      es: ""
    },
    footer: withEmptySpanish(exhibition.footer.text),
    organization: {
      name: "Promenade Gallery",
      website: exhibition.organisation.homepage,
      email: exhibition.organisation.contact.email,
      instagram: exhibition.organisation.social.instagram_handle
    },
    branding: {
      logoSrc: `/shows/${showId}/brand/promenade-logo.png`,
      accent: "#184f5d",
      accentSoft: "#d9efe7",
      paper: "#f6efe4",
      ink: "#17211d",
      qrLabelPrefix: "promenade"
    },
    analytics: {
      provider: "none",
      domain: ""
    },
    translationStatus: {
      de: "human",
      en: "approved",
      es: "missing"
    },
    audioGuideStyle: seedPrompt
  }

  fs.writeFileSync(
    path.join(showRoot, "show.json"),
    JSON.stringify(show, null, 2)
  )

  const artworkFiles = fs
    .readdirSync(path.join(fixturesRoot, "artworks", "content"))
    .filter((file) => file.endsWith(".md"))
    .sort()

  for (const file of artworkFiles) {
    const rawArtwork = parseFrontmatter(
      path.join(fixturesRoot, "artworks", "content", file)
    )
    const id = rawArtwork.id
    const number = Number.parseInt(id, 10)
    const authoritativeTitle =
      rawArtwork.title.de || rawArtwork.title.en || rawArtwork.title.es || ""
    const imageFiles = [
      `${id}-main.svg`,
      `${id}-detail-1.svg`,
      `${id}-detail-2.svg`
    ]
    const audioFiles = {
      de: `/shows/${showId}/media/audio/${id}-de.wav`,
      en: `/shows/${showId}/media/audio/${id}-en.wav`
    }
    const artwork = {
      id,
      number,
      slug: slugify(authoritativeTitle || `artwork-${id}`),
      artist: rawArtwork.artist,
      year: `${rawArtwork.year || ""}`,
      sourceLocale: "de",
      titleLocale: "de",
      title: createAuthoritativeTitleRecord(authoritativeTitle),
      titleSubtitle: createTitleSubtitleRecord(
        rawArtwork.title,
        authoritativeTitle
      ),
      sourceDescription: withEmptySpanish(rawArtwork.description),
      description: withEmptySpanish(rawArtwork.description),
      material: withEmptySpanish(rawArtwork.material || { de: "", en: "" }),
      dimensions: rawArtwork.dimensions || "",
      images: imageFiles.map((imageFile, variantIndex) => ({
        src: `/shows/${showId}/media/images/${imageFile}`,
        alt: {
          de: `${authoritativeTitle} – Ansicht ${variantIndex + 1}`,
          en: `${rawArtwork.title.en || authoritativeTitle} – View ${variantIndex + 1}`,
          es: ""
        },
        kind: variantIndex === 0 ? "hero" : "detail"
      })),
      audioCues: {
        de: "",
        en: "",
        es: ""
      },
      audio: {
        ...audioFiles,
        es: ""
      },
      translationStatus: withDefaultLocaleStatuses(
        {
          de: "human",
          en: "approved"
        },
        "de",
        "missing"
      ),
      audioCueStatus: {
        de: "missing",
        en: "missing",
        es: "missing"
      },
      audioStatus: {
        de: "ready",
        en: "ready",
        es: "missing"
      }
    }

    fs.writeFileSync(
      path.join(artworkRoot, `${id}.json`),
      JSON.stringify(artwork, null, 2)
    )

    for (const [variantIndex, imageFile] of imageFiles.entries()) {
      fs.writeFileSync(
        path.join(imageRoot, imageFile),
        createSvgMarkup(
          {
            ...artwork,
            description: rawArtwork.description
          },
          variantIndex
        )
      )
    }

    fs.writeFileSync(
      path.join(audioRoot, `${id}-de.wav`),
      createToneWavBuffer(number)
    )
    fs.writeFileSync(
      path.join(audioRoot, `${id}-en.wav`),
      createToneWavBuffer(number + 12)
    )
  }

  for (const artwork of signageOnlyFixtures) {
    fs.writeFileSync(
      path.join(artworkRoot, `${artwork.id}.json`),
      JSON.stringify(artwork, null, 2)
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedDemoShow()
}
