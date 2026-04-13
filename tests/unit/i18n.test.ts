import {
  bestLocalizedValue,
  getAlternateLocales,
  normalizeLocale,
  resolvePreferredLocale
} from "@lib/i18n"
import { describe, expect, it } from "vitest"

describe("locale helpers", () => {
  it("normalizes regional locale variants", () => {
    expect(normalizeLocale("de-DE")).toBe("de")
    expect(normalizeLocale("en-US")).toBe("en")
    expect(normalizeLocale("fr-FR")).toBeNull()
  })

  it("prefers explicit locale, then saved locale, then browser locale", () => {
    expect(
      resolvePreferredLocale({
        urlLocale: "en",
        savedLocale: "de",
        browserLocales: ["de-DE"]
      })
    ).toBe("en")

    expect(
      resolvePreferredLocale({
        savedLocale: "en",
        browserLocales: ["de-DE"]
      })
    ).toBe("en")

    expect(
      resolvePreferredLocale({
        browserLocales: ["en-GB"]
      })
    ).toBe("en")
  })

  it("uses show-scoped locales for alternates and content fallback", () => {
    expect(
      getAlternateLocales("de", {
        locales: ["de", "en", "es"],
        publicLocales: ["de", "es"],
        defaultLocale: "de"
      })
    ).toEqual(["es"])

    expect(
      bestLocalizedValue(
        {
          de: "",
          en: "",
          es: "Sueño celeste"
        },
        ["es", "de"]
      )
    ).toBe("Sueño celeste")
  })
})
