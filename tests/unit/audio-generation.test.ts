import {
  buildAudioInstructions,
  buildNarrationPlan
} from "@lib/audio-generation"
import { createLocaleRecord } from "@lib/schema"
import { describe, expect, it } from "vitest"

describe("audio generation helpers", () => {
  it("uses the visible description text as the exact narration source", () => {
    const show = {
      audioGuideStyle: createLocaleRecord("")
    }
    const artwork = {
      description: {
        de: "  Erste Zeile.\n\nZweite Zeile.  ",
        en: "",
        es: ""
      }
    }

    const plan = buildNarrationPlan(show, artwork, "de")

    expect(plan.baseText).toBe("Erste Zeile.\n\nZweite Zeile.")
    expect(plan.speechText).toBe("Erste Zeile.\n\nZweite Zeile.")
    expect(plan.cueTextUsed).toBe("")
  })

  it("keeps only show-level tone context in fallback instructions", () => {
    const instructions = buildAudioInstructions(
      {
        audioGuideStyle: {
          de: "Ruhig und wuerdevoll.",
          en: "",
          es: ""
        }
      },
      "de"
    )

    expect(instructions).toContain("Lies ihn wortgetreu vor.")
    expect(instructions).toContain("Ruhig und wuerdevoll.")
    expect(instructions).not.toContain("Sprechhinweise")
  })
})
