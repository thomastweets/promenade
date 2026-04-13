import fs from "node:fs"
import path from "node:path"
import { type Browser, chromium } from "@playwright/test"
import { localeMeta, type Locale } from "./schema"
import type {
  EntranceSignPayload,
  PrintSheetItem,
  SignagePdfVariant
} from "./studio"
import { entranceSignLabels } from "./ui"

const FONT_DIR = path.resolve("public/fonts")
const LABELS_PER_PAGE = 4

let browserPromise: Promise<Browser> | null = null

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function normalizeText(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u00D7]/g, "x")
    .replace(/[\u2026]/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function escapeHtml(text: string) {
  return normalizeText(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function inferMimeType(filePath: string) {
  const lower = filePath.toLowerCase()

  if (lower.endsWith(".svg")) return "image/svg+xml"
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"

  return "image/png"
}

function inferFontMimeType(filePath: string) {
  return filePath.toLowerCase().endsWith(".ttf") ? "font/ttf" : "font/woff2"
}

function fileToDataUrl(filePath: string) {
  const buffer = fs.readFileSync(filePath)
  const mimeType = inferMimeType(filePath)
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

function fontToDataUrl(fileName: string) {
  const filePath = path.join(FONT_DIR, fileName)
  const buffer = fs.readFileSync(filePath)
  const mimeType = inferFontMimeType(filePath)
  return `data:${mimeType};base64,${buffer.toString("base64")}`
}

function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
}

function normalizeColorToken(value: string, fallback: string) {
  const normalized = normalizeText(value)
  return /^#[0-9a-fA-F]{3,8}$/.test(normalized) ? normalized : fallback
}

function renderGuideLabel(locale: Locale) {
  return locale === "de"
    ? "Audioguide"
    : locale === "es"
      ? "Audioguía"
      : "Audio guide"
}

function renderGuideNumberLabel(locale: Locale) {
  return locale === "de" ? "Nr." : locale === "es" ? "Núm." : "No."
}

function resolveArtist(locale: Locale, artist: string) {
  const normalized = normalizeText(artist)
  return (
    normalized ||
    (locale === "de"
      ? "Kuenstler unbekannt"
      : locale === "es"
        ? "Artista desconocido"
        : "Unknown artist")
  )
}

function resolveTitle(locale: Locale, title: string) {
  const normalized = normalizeText(title)
  return (
    normalized ||
    (locale === "de"
      ? "Ohne Titel"
      : locale === "es"
        ? "Sin título"
        : "Untitled")
  )
}

function resolveTitleSubtitle(titleSubtitle: string) {
  return normalizeText(titleSubtitle)
}

function createMetadataLines(item: PrintSheetItem) {
  return [item.year, item.material, item.dimensions]
    .map((value) => normalizeText(value))
    .filter(Boolean)
}

function renderHeadphoneIcon() {
  return `<svg aria-hidden="true" class="signage-card__number-icon" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5.9 12.25V10.95a6.1 6.1 0 1 1 12.2 0v1.3" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.15"/><rect fill="currentColor" height="7.5" rx="1.7" width="3.6" x="4.2" y="11.55"/><rect fill="currentColor" height="7.5" rx="1.7" width="3.6" x="16.2" y="11.55"/></svg>`
}

function renderCropMarks() {
  return ["tl-h", "tl-v", "tr-h", "tr-v", "bl-h", "bl-v", "br-h", "br-v"]
    .map(
      (name) =>
        `<span aria-hidden="true" class="signage-card__crop signage-card__crop--${name}"></span>`
    )
    .join("")
}

function renderLabel({
  cutMarks,
  item,
  locale,
  logoDataUrl
}: {
  cutMarks: boolean
  item: PrintSheetItem
  locale: Locale
  logoDataUrl: string | null
}) {
  const artist = escapeHtml(resolveArtist(locale, item.artist))
  const title = escapeHtml(resolveTitle(locale, item.title))
  const titleSubtitle = escapeHtml(resolveTitleSubtitle(item.titleSubtitle))
  const titleLabel = titleSubtitle ? `${title} (${titleSubtitle})` : title
  const organization = escapeHtml(item.organizationName)
  const showTitle = escapeHtml(normalizeText(item.showTitle))
  const metadataLines = createMetadataLines(item)
    .map((line) => `<p class="signage-card__meta-line">${escapeHtml(line)}</p>`)
    .join("")
  const logo = logoDataUrl
    ? `<img alt="${organization}" class="signage-card__logo" src="${logoDataUrl}" />`
    : ""
  const hasGuide = item.guideMode === "guided"
  const frameClass = [
    "signage-card",
    cutMarks ? "signage-card--cutmarks" : "signage-card--framed",
    hasGuide ? "signage-card--guided" : "signage-card--signage-only"
  ].join(" ")
  const guideRail = hasGuide
    ? `<aside class="signage-card__rail"><div class="signage-card__rail-stack"><div class="signage-card__guide-group"><p class="signage-card__guide-label">${escapeHtml(renderGuideLabel(locale))}</p><div class="signage-card__qr"><img alt="QR code for ${titleLabel}" class="signage-card__qr-image" src="${svgToDataUrl(item.svg)}" /></div><div class="signage-card__number">${renderHeadphoneIcon()}<div class="signage-card__number-copy"><span class="signage-card__number-label">${escapeHtml(renderGuideNumberLabel(locale))}</span><span class="signage-card__number-value">${escapeHtml(item.guideNumber || item.id)}</span></div></div></div></div></aside>`
    : ""

  return `<article class="${frameClass}">${cutMarks ? renderCropMarks() : ""}<div class="signage-card__surface"><div class="signage-card__main"><div class="signage-card__brand">${logo}<div class="signage-card__brand-copy"><p class="signage-card__org">${organization}</p>${showTitle ? `<p class="signage-card__show">${showTitle}</p>` : ""}</div></div><div class="signage-card__copy"><p class="signage-card__artist">${artist}</p><h2 class="signage-card__title">${title}</h2>${titleSubtitle ? `<p class="signage-card__title-subtitle">${titleSubtitle}</p>` : ""}${metadataLines ? `<div class="signage-card__meta">${metadataLines}</div>` : ""}</div></div>${guideRail}</div></article>`
}

function renderPage({
  cutMarks,
  items,
  locale,
  logoDataUrl,
  variant
}: {
  cutMarks: boolean
  items: PrintSheetItem[]
  locale: Locale
  logoDataUrl: string | null
  variant: SignagePdfVariant
}) {
  const pageClass =
    variant === "single"
      ? "signage-page signage-page--single"
      : "signage-page signage-page--grid"

  return `<section class="${pageClass}">${items
    .map((item) => renderLabel({ cutMarks, item, locale, logoDataUrl }))
    .join("")}</section>`
}

function buildFontCss() {
  const sansDataUrl = fontToDataUrl("SourceSans3VF-Upright.woff2")
  const serifRomanDataUrl = fontToDataUrl("SourceSerif4Variable-Roman.woff2")
  const serifItalicDataUrl = fontToDataUrl("SourceSerif4Variable-Italic.woff2")

  return `
    @font-face {
      font-family: "Source Sans 3";
      font-style: normal;
      font-weight: 200 900;
      font-display: block;
      src: url("${sansDataUrl}") format("woff2-variations");
    }

    @font-face {
      font-family: "Source Serif 4";
      font-style: normal;
      font-weight: 200 900;
      font-display: block;
      src: url("${serifRomanDataUrl}") format("woff2-variations");
    }

    @font-face {
      font-family: "Source Serif 4";
      font-style: italic;
      font-weight: 200 900;
      font-display: block;
      src: url("${serifItalicDataUrl}") format("woff2-variations");
    }
  `
}

function buildStyles(cutMarks: boolean) {
  return `
    ${buildFontCss()}

    :root {
      --crop-gap: 1.8mm;
      --crop-length: 4.2mm;
      --crop-thickness: 0.22mm;
    }

    @page {
      size: 297mm 210mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #111111;
      font-family: "Source Sans 3", "Avenir Next", "Segoe UI", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      width: 297mm;
    }

    .signage-page {
      width: 297mm;
      min-height: 210mm;
      padding: 19mm 22.5mm;
      background: #ffffff;
      page-break-after: always;
    }

    .signage-page:last-child {
      page-break-after: auto;
    }

    .signage-page--grid {
      display: grid;
      grid-template-columns: repeat(2, 120mm);
      grid-auto-rows: 80mm;
      align-content: start;
      justify-content: start;
      gap: 12mm;
    }

    .signage-page--single {
      display: grid;
      place-items: center;
    }

    .signage-card {
      position: relative;
      width: 120mm;
      height: 80mm;
      overflow: visible;
    }

    .signage-card__surface {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 28.4mm;
      gap: 4.8mm;
      width: 100%;
      height: 100%;
      padding: 7.2mm 8mm 7mm;
      background: #ffffff;
    }

    .signage-card--signage-only .signage-card__surface {
      grid-template-columns: minmax(0, 1fr);
    }

    .signage-card--framed .signage-card__surface {
      box-shadow: inset 0 0 0 0.18mm rgba(0, 0, 0, 0.1);
    }

    .signage-card__main {
      display: grid;
      grid-template-rows: auto 1fr;
      min-width: 0;
    }

    .signage-card__brand {
      display: flex;
      align-items: center;
      gap: 2.1mm;
      min-width: 0;
      padding-bottom: 2.1mm;
      border-bottom: 0.18mm solid rgba(0, 0, 0, 0.08);
    }

    .signage-card__logo {
      flex: 0 0 auto;
      width: 7.2mm;
      height: 7.2mm;
      object-fit: contain;
    }

    .signage-card__brand-copy {
      min-width: 0;
    }

    .signage-card__org {
      margin: 0;
      color: #000000;
      font-size: 2.7mm;
      font-weight: 560;
      line-height: 1.14;
      letter-spacing: 0.035em;
    }

    .signage-card__show {
      margin: 0.7mm 0 0;
      color: #000000;
      font-size: 2.25mm;
      font-weight: 500;
      line-height: 1.18;
      letter-spacing: 0.02em;
    }

    .signage-card__copy {
      display: grid;
      align-content: start;
      gap: 3.15mm;
      min-width: 0;
      padding-top: 3.8mm;
    }

    .signage-card__artist {
      margin: 0;
      color: #000000;
      font-size: 5.05mm;
      font-weight: 620;
      line-height: 1.14;
      letter-spacing: 0.022em;
      overflow-wrap: anywhere;
    }

    .signage-card__title {
      display: -webkit-box;
      margin: 0;
      overflow: hidden;
      color: #000000;
      font-family: "Source Serif 4", "Iowan Old Style", "Palatino Linotype", serif;
      font-size: 6.85mm;
      font-style: italic;
      font-weight: 640;
      line-height: 1.12;
      letter-spacing: -0.012em;
      padding-bottom: 0.85mm;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 3;
      text-wrap: balance;
    }

    .signage-card__title-subtitle {
      margin: -0.3mm 0 0;
      color: rgba(0, 0, 0, 0.78);
      font-size: 3.2mm;
      font-weight: 560;
      line-height: 1.22;
      overflow-wrap: anywhere;
      text-wrap: balance;
    }

    .signage-card__meta {
      display: grid;
      gap: 1.35mm;
      padding-top: 1.1mm;
    }

    .signage-card__meta-line {
      margin: 0;
      color: #000000;
      font-size: 3.55mm;
      line-height: 1.32;
      overflow-wrap: anywhere;
    }

    .signage-card__rail {
      min-width: 0;
      padding-left: 3.7mm;
      border-left: 0.18mm solid rgba(0, 0, 0, 0.1);
    }

    .signage-card__rail-stack {
      display: grid;
      align-content: center;
      justify-items: center;
      width: 100%;
      height: 100%;
    }

    .signage-card__guide-group {
      display: grid;
      justify-items: center;
      gap: 1.9mm;
      width: 100%;
      margin-top: 0.8mm;
    }

    .signage-card__guide-label {
      margin: 0;
      color: #000000;
      font-size: 2.4mm;
      font-weight: 600;
      line-height: 1.1;
      letter-spacing: 0.08em;
      text-align: center;
      text-transform: uppercase;
    }

    .signage-card__qr {
      display: grid;
      place-items: center;
      width: 23.2mm;
      height: 23.2mm;
      margin-inline: auto;
    }

    .signage-card__qr-image {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .signage-card__number {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.45mm;
      width: 100%;
      min-height: 9.6mm;
      padding: 1.7mm 1.75mm 1.5mm;
      background: transparent;
      border: 0.2mm solid #000000;
      border-radius: 2.6mm;
    }

    .signage-card__number-icon {
      flex: 0 0 auto;
      width: 6.7mm;
      height: 6.7mm;
      color: #000000;
    }

    .signage-card__number-copy {
      display: flex;
      align-items: baseline;
      gap: 0.95mm;
      min-width: 0;
      white-space: nowrap;
    }

    .signage-card__number-label {
      color: #000000;
      font-size: 2.2mm;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.055em;
      text-transform: uppercase;
    }

    .signage-card__number-value {
      color: #000000;
      font-size: 6.1mm;
      font-weight: 650;
      line-height: 1;
      letter-spacing: 0.012em;
      font-variant-numeric: lining-nums tabular-nums;
    }

    .signage-card__crop {
      position: absolute;
      background: #000000;
      pointer-events: none;
      display: ${cutMarks ? "block" : "none"};
    }

    .signage-card__crop--tl-h,
    .signage-card__crop--tr-h,
    .signage-card__crop--bl-h,
    .signage-card__crop--br-h {
      width: var(--crop-length);
      height: var(--crop-thickness);
    }

    .signage-card__crop--tl-v,
    .signage-card__crop--tr-v,
    .signage-card__crop--bl-v,
    .signage-card__crop--br-v {
      width: var(--crop-thickness);
      height: var(--crop-length);
    }

    .signage-card__crop--tl-h {
      top: 0;
      left: calc(-1 * (var(--crop-gap) + var(--crop-length)));
    }

    .signage-card__crop--tl-v {
      top: calc(-1 * (var(--crop-gap) + var(--crop-length)));
      left: 0;
    }

    .signage-card__crop--tr-h {
      top: 0;
      right: calc(-1 * (var(--crop-gap) + var(--crop-length)));
    }

    .signage-card__crop--tr-v {
      top: calc(-1 * (var(--crop-gap) + var(--crop-length)));
      right: 0;
    }

    .signage-card__crop--bl-h {
      bottom: 0;
      left: calc(-1 * (var(--crop-gap) + var(--crop-length)));
    }

    .signage-card__crop--bl-v {
      bottom: calc(-1 * (var(--crop-gap) + var(--crop-length)));
      left: 0;
    }

    .signage-card__crop--br-h {
      bottom: 0;
      right: calc(-1 * (var(--crop-gap) + var(--crop-length)));
    }

    .signage-card__crop--br-v {
      bottom: calc(-1 * (var(--crop-gap) + var(--crop-length)));
      right: 0;
    }
  `
}

function buildHtml({
  cutMarks,
  items,
  locale,
  logoDataUrl,
  variant
}: {
  cutMarks: boolean
  items: PrintSheetItem[]
  locale: Locale
  logoDataUrl: string | null
  variant: SignagePdfVariant
}) {
  const pageGroups =
    variant === "single"
      ? items.slice(0, 1).map((item) => [item])
      : chunkItems(items, LABELS_PER_PAGE)

  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${buildStyles(cutMarks)}</style></head><body>${pageGroups
    .map((group) =>
      renderPage({ cutMarks, items: group, locale, logoDataUrl, variant })
    )
    .join("")}</body></html>`
}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = chromium
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      })
      .catch((error) => {
        browserPromise = null
        throw new Error(
          `Could not launch Chromium for signage PDF rendering: ${error instanceof Error ? error.message : String(error)}`
        )
      })
  }

  return browserPromise
}

export async function buildSignagePdf({
  cutMarks = true,
  items,
  locale,
  logoAssetPath,
  variant = "sheet"
}: {
  cutMarks?: boolean
  fileNameBase: string
  items: PrintSheetItem[]
  locale: Locale
  logoAssetPath?: string
  variant?: SignagePdfVariant
}) {
  if (!items.length) {
    throw new Error("At least one artwork is required for signage export.")
  }

  const logoDataUrl =
    logoAssetPath && fs.existsSync(logoAssetPath)
      ? fileToDataUrl(logoAssetPath)
      : null
  const html = buildHtml({
    cutMarks,
    items,
    locale,
    logoDataUrl,
    variant
  })
  const browser = await getBrowser()
  const page = await browser.newPage({ colorScheme: "light" })

  try {
    await page.setContent(html, { waitUntil: "load" })
    await page.emulateMedia({ media: "print" })

    const pdf = await page.pdf({
      width: "297mm",
      height: "210mm",
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0"
      },
      preferCSSPageSize: false,
      printBackground: true
    })

    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

function buildEntranceStyles(payload: EntranceSignPayload) {
  const accent = normalizeColorToken(payload.accent, "#111111")
  const accentSoft = normalizeColorToken(payload.accentSoft, "#f2efe9")
  const paper = normalizeColorToken(payload.paper, "#fffdf8")
  const ink = normalizeColorToken(payload.ink, "#111111")
  const frame = normalizeColorToken(accentSoft, "#e7e1d7")

  return `
    ${buildFontCss()}

    :root {
      --accent: ${accent};
      --accent-soft: ${accentSoft};
      --paper: ${paper};
      --ink: ${ink};
      --ink-soft: #4f4f4f;
      --frame: ${frame};
      --line: #d6d0c5;
      --surface: #ffffff;
    }

    @page {
      size: 210mm 297mm;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: "Source Sans 3", "Avenir Next", "Segoe UI", sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      width: 210mm;
    }

    .entrance-page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 14mm;
      background: var(--paper);
    }

    .entrance-sheet {
      position: relative;
      display: grid;
      gap: 9mm;
      min-height: calc(297mm - 30mm);
      padding: 12mm 11.5mm 11mm;
      overflow: hidden;
      background: var(--surface);
      border: 0.35mm solid var(--frame);
      border-radius: 5.5mm;
    }

    .entrance-sheet::before {
      content: "";
      position: absolute;
      inset: 0 auto auto 0;
      width: 100%;
      height: 6.5mm;
      background: var(--accent);
    }

    .entrance-brand,
    .entrance-brand-copy p,
    .entrance-qr-copy p,
    .entrance-footer-copy,
    .entrance-language-row p,
    .entrance-step-title,
    .entrance-step-copy,
    .entrance-show-note {
      margin: 0;
    }

    .entrance-brand {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8mm;
      padding-top: 3.2mm;
    }

    .entrance-brand-left {
      display: flex;
      align-items: center;
      gap: 4mm;
      min-width: 0;
    }

    .entrance-brand-logo {
      width: 13mm;
      height: 13mm;
      object-fit: contain;
    }

    .entrance-brand-org {
      font-size: 3.25mm;
      font-weight: 620;
      letter-spacing: 0.045em;
      line-height: 1.12;
    }

    .entrance-brand-show {
      margin-top: 0.8mm;
      color: var(--ink-soft);
      font-size: 2.7mm;
      line-height: 1.18;
      letter-spacing: 0.025em;
    }

    .entrance-eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 1.9mm;
      padding: 1.8mm 3.1mm 1.65mm;
      border: 0.22mm solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      font-size: 2.5mm;
      font-weight: 650;
      letter-spacing: 0.085em;
      line-height: 1;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .entrance-eyebrow-icon {
      width: 4.5mm;
      height: 4.5mm;
      color: var(--accent);
      display: inline-flex;
      flex: 0 0 auto;
    }

    .entrance-hero {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 3.3mm;
      max-width: 146mm;
    }

    .entrance-kicker {
      margin: 0;
      color: var(--accent);
      font-size: 3.1mm;
      font-weight: 680;
      letter-spacing: 0.12em;
      line-height: 1.05;
      text-transform: uppercase;
    }

    .entrance-title {
      margin: 0;
      color: var(--ink);
      font-family: "Source Serif 4", "Iowan Old Style", "Palatino Linotype", serif;
      font-size: 18.4mm;
      font-style: italic;
      font-weight: 640;
      line-height: 0.94;
      letter-spacing: -0.03em;
      text-wrap: balance;
    }

    .entrance-subtitle {
      margin: 0;
      color: var(--ink);
      font-size: 5.4mm;
      font-weight: 620;
      line-height: 1.12;
      max-width: 132mm;
      text-wrap: balance;
    }

    .entrance-show-note {
      color: var(--ink-soft);
      font-size: 3.55mm;
      line-height: 1.22;
      max-width: 132mm;
      text-wrap: balance;
    }

    .entrance-grid {
      position: relative;
      z-index: 1;
      display: grid;
      grid-template-columns: minmax(0, 1.03fr) 73mm;
      gap: 8mm;
      align-items: start;
    }

    .entrance-copy {
      display: grid;
      gap: 6mm;
      padding-top: 1.5mm;
    }

    .entrance-lead {
      margin: 0;
      color: var(--ink);
      font-size: 5.1mm;
      font-weight: 520;
      line-height: 1.24;
      text-wrap: pretty;
    }

    .entrance-steps {
      display: grid;
      gap: 3.1mm;
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .entrance-step {
      display: grid;
      grid-template-columns: 8.6mm minmax(0, 1fr);
      gap: 3.2mm;
      align-items: start;
      padding: 3.6mm 4mm 3.7mm 3.4mm;
      background: var(--accent-soft);
      border: 0.22mm solid var(--line);
      border-radius: 4mm;
    }

    .entrance-step-index {
      display: grid;
      place-items: center;
      width: 8.6mm;
      height: 8.6mm;
      background: var(--accent);
      border-radius: 999px;
      color: #ffffff;
      font-size: 4mm;
      font-weight: 700;
      line-height: 1;
      font-variant-numeric: lining-nums tabular-nums;
    }

    .entrance-step-title {
      color: var(--ink);
      font-size: 3.7mm;
      font-weight: 630;
      line-height: 1.2;
      text-wrap: pretty;
    }

    .entrance-qr-panel {
      display: grid;
      gap: 3.7mm;
      align-content: start;
      padding: 5.6mm 5.4mm 5.2mm;
      background: var(--surface);
      border: 0.3mm solid var(--line);
      border-radius: 5mm;
    }

    .entrance-qr-label {
      margin: 0;
      color: var(--accent);
      font-size: 2.85mm;
      font-weight: 700;
      letter-spacing: 0.1em;
      line-height: 1.05;
      text-align: center;
      text-transform: uppercase;
    }

    .entrance-qr-frame {
      display: grid;
      place-items: center;
      width: 100%;
      padding: 3.6mm;
      background: var(--surface);
      border: 0.24mm solid var(--line);
      border-radius: 3.8mm;
    }

    .entrance-qr-image {
      display: block;
      width: 57.5mm;
      height: 57.5mm;
      object-fit: contain;
    }

    .entrance-qr-copy {
      display: grid;
      gap: 1.4mm;
    }

    .entrance-url-label {
      color: var(--ink-soft);
      font-size: 2.45mm;
      font-weight: 650;
      letter-spacing: 0.08em;
      line-height: 1.05;
      text-align: center;
      text-transform: uppercase;
    }

    .entrance-url {
      color: var(--ink);
      font-size: 3.6mm;
      font-weight: 620;
      line-height: 1.24;
      text-align: center;
      overflow-wrap: anywhere;
    }

    .entrance-footer {
      position: relative;
      z-index: 1;
      display: grid;
      gap: 4.5mm;
      margin-top: auto;
      padding-top: 2mm;
      border-top: 0.22mm solid var(--line);
    }

    .entrance-footer-copy {
      color: var(--ink-soft);
      font-size: 3.15mm;
      line-height: 1.28;
      text-wrap: pretty;
    }

    .entrance-language-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 2.1mm;
    }

    .entrance-languages-label {
      color: var(--ink-soft);
      font-size: 2.45mm;
      font-weight: 650;
      letter-spacing: 0.08em;
      line-height: 1.05;
      text-transform: uppercase;
    }

    .entrance-language-chip {
      display: inline-flex;
      align-items: center;
      padding: 1.45mm 2.65mm 1.3mm;
      border: 0.22mm solid var(--line);
      border-radius: 999px;
      background: var(--surface);
      color: var(--ink);
      font-size: 2.75mm;
      font-weight: 560;
      line-height: 1;
      white-space: nowrap;
    }
  `
}

function buildEntranceHtml(
  payload: EntranceSignPayload,
  logoDataUrl: string | null
) {
  const copy = entranceSignLabels[payload.locale]
  const organizationName = escapeHtml(payload.organizationName)
  const showTitle = escapeHtml(payload.showTitle)
  const showSubtitle = escapeHtml(payload.showSubtitle)
  const humanUrl = escapeHtml(payload.humanUrl)
  const logo = logoDataUrl
    ? `<img alt="${organizationName}" class="entrance-brand-logo" src="${logoDataUrl}" />`
    : ""
  const steps = copy.steps
    .map(
      (step, index) =>
        `<li class="entrance-step"><span class="entrance-step-index">${index + 1}</span><p class="entrance-step-title">${escapeHtml(step)}</p></li>`
    )
    .join("")
  const languageChips = payload.publicLocales
    .map(
      (locale) =>
        `<span class="entrance-language-chip">${escapeHtml(localeMeta[locale].autonym)}</span>`
    )
    .join("")

  return `<!doctype html><html lang="${payload.locale}"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${buildEntranceStyles(payload)}</style></head><body><main class="entrance-page"><article class="entrance-sheet"><header class="entrance-brand"><div class="entrance-brand-left">${logo}<div class="entrance-brand-copy"><p class="entrance-brand-org">${organizationName}</p>${showTitle ? `<p class="entrance-brand-show">${showTitle}</p>` : ""}</div></div><div class="entrance-eyebrow"><span class="entrance-eyebrow-icon">${renderHeadphoneIcon()}</span><span>${escapeHtml(copy.eyebrow)}</span></div></header><section class="entrance-hero"><p class="entrance-kicker">${escapeHtml(copy.title)}</p><h1 class="entrance-title">${escapeHtml(copy.eyebrow)}</h1>${showTitle ? `<p class="entrance-subtitle">${showTitle}</p>` : ""}${showSubtitle ? `<p class="entrance-show-note">${showSubtitle}</p>` : ""}</section><section class="entrance-grid"><div class="entrance-copy"><p class="entrance-lead">${escapeHtml(copy.lead)}</p><ol class="entrance-steps">${steps}</ol></div><aside class="entrance-qr-panel"><p class="entrance-qr-label">${escapeHtml(copy.qrLabel)}</p><div class="entrance-qr-frame"><img alt="QR code for ${showTitle}" class="entrance-qr-image" src="${svgToDataUrl(payload.svg)}" /></div><div class="entrance-qr-copy"><p class="entrance-url-label">${escapeHtml(copy.urlLabel)}</p><p class="entrance-url">${humanUrl}</p></div></aside></section><footer class="entrance-footer"><p class="entrance-footer-copy">${escapeHtml(copy.footer)}</p><div class="entrance-language-row"><p class="entrance-languages-label">${escapeHtml(copy.languagesLabel)}</p>${languageChips}</div></footer></article></main></body></html>`
}

export async function buildEntranceSignPdf({
  payload,
  logoAssetPath
}: {
  payload: EntranceSignPayload
  logoAssetPath?: string
}) {
  const logoDataUrl =
    logoAssetPath && fs.existsSync(logoAssetPath)
      ? fileToDataUrl(logoAssetPath)
      : null
  const html = buildEntranceHtml(payload, logoDataUrl)
  const browser = await getBrowser()
  const page = await browser.newPage({ colorScheme: "light" })

  try {
    await page.setContent(html, { waitUntil: "load" })
    await page.emulateMedia({ media: "print" })

    const pdf = await page.pdf({
      width: "210mm",
      height: "297mm",
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0"
      },
      preferCSSPageSize: false,
      printBackground: true
    })

    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}
