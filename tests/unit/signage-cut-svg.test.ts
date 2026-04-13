import { buildLightburnSignageCutSvg } from "@lib/signage-cut-svg"
import { describe, expect, it } from "vitest"

describe("signage cut svg", () => {
  it("creates an A3 portrait LightBurn cut template for up to eight signs", () => {
    const svg = buildLightburnSignageCutSvg({
      items: Array.from({ length: 8 }, (_, index) => ({
        id: `${index + 1}`.padStart(2, "0")
      })),
      showId: "demo-show"
    })

    expect(svg).toContain(`width="297mm"`)
    expect(svg).toContain(`height="420mm"`)
    expect(svg).toContain(`stroke="#ff0000"`)
    expect(svg.match(/<rect /g)?.length).toBe(8)
    expect(svg).toContain(`data-artwork-id="01" x="22.5" y="19"`)
    expect(svg).toContain(`data-artwork-id="05" x="22.5" y="229"`)
  })

  it("rejects more than eight signs on one A3 board", () => {
    expect(() =>
      buildLightburnSignageCutSvg({
        items: Array.from({ length: 9 }, (_, index) => ({
          id: `${index + 1}`.padStart(2, "0")
        })),
        showId: "demo-show"
      })
    ).toThrow(/Select up to 8 artworks/)
  })
})
