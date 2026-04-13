import { buildEntranceSignPdf } from "@lib/signage-pdf"
import type { EntranceSignPayload } from "@lib/studio"
import { PDFDocument, type PDFPage } from "pdf-lib"
import { describe, expect, it } from "vitest"

function createPayload(
  locale: EntranceSignPayload["locale"]
): EntranceSignPayload {
  return {
    locale,
    organizationName: "Promenade",
    showTitle: "Demo Exhibition",
    showSubtitle: "Audio guide for the exhibition",
    logoSrc: "/shows/demo/logo.png",
    publicLocales: ["de", "en", "es"],
    url: `https://example.com/${locale}/`,
    humanUrl: `example.com/${locale}/`,
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="white"/><rect x="10" y="10" width="80" height="80" fill="black"/></svg>',
    accent: "#184f5d",
    accentSoft: "#eef3f4",
    paper: "#fffdf8",
    ink: "#111111"
  }
}

function expectA4Portrait(page: PDFPage) {
  expect(Math.abs(page.getWidth() - 595.28)).toBeLessThan(1)
  expect(Math.abs(page.getHeight() - 841.89)).toBeLessThan(1)
}

describe("entrance sign pdf", () => {
  it("creates a single-page A4 portrait entrance poster", async () => {
    const pdfBuffer = await buildEntranceSignPdf({
      payload: createPayload("de")
    })

    const pdf = await PDFDocument.load(Uint8Array.from(pdfBuffer))

    expect(pdf.getPageCount()).toBe(1)
    expectA4Portrait(pdf.getPage(0))
  }, 30_000)
})
