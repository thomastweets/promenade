import { expect, test } from "@playwright/test"

test("public guide renders home, details, and locale switch", async ({
  page
}) => {
  await page.goto("/de/")
  await expect(
    page.getByRole("heading", { name: /Beispielausstellung/i })
  ).toBeVisible()
  await page.locator('a[href="/en/"]:visible').first().click()
  await expect(page).toHaveURL(/\/en\/$/)
  await expect(
    page.getByRole("heading", { name: /Sample Exhibition/i })
  ).toBeVisible()

  await page.goto("/de/artworks/01/")
  await expect(page.locator("main h1").first()).toContainText(
    "Die Sternennacht222"
  )
})

test("public guide home matches the desktop visual baseline", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Visual baseline is captured once on the desktop Chromium project."
  )

  await page.goto("/de/")
  await expect(page).toHaveScreenshot("public-home.png", {
    fullPage: true,
    maxDiffPixelRatio: 0.02
  })
})

test("public guide follows system theme and persists overrides", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Theme assertions are validated on the desktop Chromium project."
  )

  await page.emulateMedia({ colorScheme: "dark" })
  await page.goto("/de/")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")

  await page.getByRole("button", { name: "Hell" }).click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")

  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
})

test("mobile artwork view keeps the guide dock on screen", async ({
  page
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "android",
    "The persistent guide dock is asserted on the Android mobile-emulation project."
  )

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/de/artworks/01/")
  await page.addStyleTag({
    content: "astro-dev-toolbar { display: none !important; }"
  })

  const dock = page.getByTestId("artwork-mobile-dock")
  await expect(dock).toBeVisible()
  await expect(dock).toContainText("Die Sternennacht222")
  await expect
    .poll(async () => {
      const control = dock.getByRole("button", { name: /Wiedergabe|Pause/ })
      return control.innerText()
    })
    .toBe("Pause")
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1
    )
  ).toBe(true)
  await expect(
    dock.getByRole("button", { name: "Nummer eingeben" })
  ).toBeVisible()
  await expect(dock.getByRole("button", { name: "QR scannen" })).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect(dock).toBeVisible()

  await dock.getByRole("button", { name: "Nummer eingeben" }).click()
  const artworkInput = page.getByRole("textbox", {
    name: "Werknummer eingeben"
  })
  await expect(artworkInput).toBeVisible()
  await expect(artworkInput).toBeFocused()

  await dock.getByRole("button", { name: /^Nächstes Werk:/ }).click()
  await expect(page).toHaveURL(/\/de\/artworks\/02\/$/)
})
