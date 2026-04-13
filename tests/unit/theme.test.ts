import { resolveTheme } from "@lib/theme"
import { describe, expect, it } from "vitest"

describe("theme helpers", () => {
  it("resolves system preference against browser color scheme", () => {
    expect(resolveTheme("system", true)).toBe("dark")
    expect(resolveTheme("system", false)).toBe("light")
  })

  it("preserves explicit theme overrides", () => {
    expect(resolveTheme("light", true)).toBe("light")
    expect(resolveTheme("dark", false)).toBe("dark")
  })
})
