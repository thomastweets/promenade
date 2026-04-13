import { buildSignagePdf } from "@lib/signage-pdf"
import type { PrintSheetItem } from "@lib/studio"
import { PDFDocument, type PDFPage } from "pdf-lib"
import { describe, expect, it } from "vitest"

function createItem(id: string): PrintSheetItem {
  return {
    id,
    guideNumber: id,
    number: Number.parseInt(id, 10),
    guideMode: "guided",
    artist: `Artist ${id}`,
    title: `Artwork ${id}`,
    titleSubtitle: "",
    showTitle: "Dream Worlds",
    year: "2024",
    material: "Ink on paper",
    dimensions: "",
    organizationName: "Promenade",
    logoSrc: "/shows/demo/logo.png",
    locale: "de",
    url: `https://example.com/de/guide/${id}/`,
    humanUrl: `example.com/de/guide/${id}/`,
    svg: "<svg></svg>",
    downloadUrl: `https://example.com/${id}.svg`,
    accent: "#000000",
    accentSoft: "#f5f5f5",
    paper: "#ffffff",
    ink: "#000000"
  }
}

function expectA4Landscape(page: PDFPage) {
  expect(Math.abs(page.getWidth() - 841.89)).toBeLessThan(1)
  expect(Math.abs(page.getHeight() - 595.28)).toBeLessThan(1)
}

describe("signage pdf", () => {
  it("creates a four-up A4 sheet with true label sizing", async () => {
    const pdfBuffer = await buildSignagePdf({
      fileNameBase: "demo-show-de",
      items: Array.from({ length: 5 }, (_, index) =>
        createItem(`${index + 1}`.padStart(2, "0"))
      ),
      locale: "de",
      variant: "sheet"
    })

    const pdf = await PDFDocument.load(Uint8Array.from(pdfBuffer))

    expect(pdf.getPageCount()).toBe(2)
    expectA4Landscape(pdf.getPage(0))
  }, 30_000)

  it("creates a centered single-label export on one page", async () => {
    const pdfBuffer = await buildSignagePdf({
      cutMarks: false,
      fileNameBase: "demo-show-en",
      items: [createItem("01"), createItem("02")],
      locale: "en",
      variant: "single"
    })

    const pdf = await PDFDocument.load(Uint8Array.from(pdfBuffer))

    expect(pdf.getPageCount()).toBe(1)
    expectA4Landscape(pdf.getPage(0))
  }, 30_000)

  it("renders signage-only artworks without requiring a QR rail", async () => {
    const pdfBuffer = await buildSignagePdf({
      cutMarks: false,
      fileNameBase: "demo-show-de",
      items: [
        {
          ...createItem("01"),
          guideMode: "signage-only",
          svg: "",
          url: "",
          humanUrl: "",
          downloadUrl: ""
        }
      ],
      locale: "de",
      variant: "single"
    })

    const pdf = await PDFDocument.load(Uint8Array.from(pdfBuffer))

    expect(pdf.getPageCount()).toBe(1)
    expectA4Landscape(pdf.getPage(0))
  }, 30_000)
})
