import type { PrintSheetItem } from "./studio"

const A4_LANDSCAPE_HEIGHT_MM = 210
const A3_PORTRAIT_WIDTH_MM = 297
const A3_PORTRAIT_HEIGHT_MM = 420
const SIGN_WIDTH_MM = 120
const SIGN_HEIGHT_MM = 80
const PAGE_PADDING_X_MM = 22.5
const PAGE_PADDING_Y_MM = 19
const SIGN_GAP_MM = 12
const MAX_SIGNS_PER_BOARD = 8
const CUT_STROKE = "#ff0000"
const CUT_STROKE_WIDTH_MM = 0.2

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function buildRectPosition(index: number) {
  const pageIndex = Math.floor(index / 4)
  const indexWithinPage = index % 4
  const column = indexWithinPage % 2
  const row = Math.floor(indexWithinPage / 2)

  return {
    x: PAGE_PADDING_X_MM + column * (SIGN_WIDTH_MM + SIGN_GAP_MM),
    y:
      pageIndex * A4_LANDSCAPE_HEIGHT_MM +
      PAGE_PADDING_Y_MM +
      row * (SIGN_HEIGHT_MM + SIGN_GAP_MM)
  }
}

export function buildLightburnSignageCutSvg({
  items,
  showId
}: {
  items: Pick<PrintSheetItem, "id">[]
  showId: string
}) {
  if (!items.length) {
    throw new Error(
      "At least one artwork is required for LightBurn cut export."
    )
  }

  if (items.length > MAX_SIGNS_PER_BOARD) {
    throw new Error(
      `Select up to ${MAX_SIGNS_PER_BOARD} artworks for one A3 LightBurn cut template.`
    )
  }

  const rects = items
    .map((item, index) => {
      const position = buildRectPosition(index)
      return `<rect data-artwork-id="${escapeXml(item.id)}" x="${position.x}" y="${position.y}" width="${SIGN_WIDTH_MM}" height="${SIGN_HEIGHT_MM}" rx="0" ry="0" />`
    })
    .join("")

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${A3_PORTRAIT_WIDTH_MM}mm" height="${A3_PORTRAIT_HEIGHT_MM}mm" viewBox="0 0 ${A3_PORTRAIT_WIDTH_MM} ${A3_PORTRAIT_HEIGHT_MM}">
  <title>${escapeXml(showId)} signage cut template</title>
  <desc>LightBurn cut template for up to eight 120 x 80 mm signage boards. Layout matches two A4 landscape signage sheets stacked vertically on A3 portrait.</desc>
  <g id="cut-layer" fill="none" stroke="${CUT_STROKE}" stroke-width="${CUT_STROKE_WIDTH_MM}" vector-effect="non-scaling-stroke">
    ${rects}
  </g>
</svg>`
}
