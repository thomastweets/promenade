import { expect, test } from "@playwright/test"

const studioBaseUrl = "http://127.0.0.1:4174"

test.describe("studio", () => {
  test.describe.configure({ mode: "serial" })

  test("studio loads dashboard, artwork editor, and print sheet", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio workflows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await expect(
      page.getByRole("heading", { name: /Beispielausstellung/i })
    ).toBeVisible()

    await page.getByRole("button", { name: /Die Sternennacht222/i }).click()
    await expect(
      page.getByRole("heading", { name: /Die Sternennacht222/i })
    ).toBeVisible()

    await page
      .getByRole("button", { name: /QR print sheets/i })
      .click({ force: true })
    await expect(
      page.getByRole("heading", { name: /A4-ready artwork labels/i })
    ).toBeVisible()

    const summary = await page.evaluate(() => {
      const pages = document.querySelectorAll('[data-testid="print-page"]')
      const cards = document.querySelectorAll(
        ".print-page .print-card:not(.print-card-placeholder)"
      )

      return {
        cards: cards.length,
        pages: pages.length
      }
    })

    expect(summary.pages).toBe(Math.ceil(summary.cards / 4))
  })

  test("studio shows export readiness in the dashboard", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio workflows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await expect(page.getByText(/Ready to export/i)).toBeVisible()
    await expect(page.getByText(/No blocking issues detected/i)).toBeVisible()
  })

  test("studio dashboard matches the desktop visual baseline", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio visual assertions run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await expect(page).toHaveScreenshot("studio-dashboard.png", {
      fullPage: true
    })
  })

  test("studio follows system theme and persists overrides", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio theme assertions run on desktop Chromium only."
    )

    await page.emulateMedia({ colorScheme: "dark" })
    await page.goto(studioBaseUrl)
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")

    await page.getByRole("button", { name: "Light" }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")

    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
  })

  test("studio creates a new draft artwork from the sidebar", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio mutation flows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await page.getByRole("button", { name: /New artwork/i }).click()

    await expect(page.getByText(/Artwork \d{2} created\./i)).toBeVisible()
    await expect(page.getByText(/^Artwork \d{2}$/)).toBeVisible()
    await expect(
      page.getByRole("heading", { name: /Untitled artwork/i })
    ).toBeVisible()
  })

  test("studio generates de cues from artwork text", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio mutation flows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await page.getByRole("button", { name: /Die Sternennacht222/i }).click()

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/artworks/01/audio-cues") &&
        response.request().method() === "POST"
    )

    await page.getByRole("button", { name: /Generate DE cues/i }).click()

    const response = await responsePromise
    expect(response.ok()).toBe(true)

    await expect(page.getByText(/Generating de cues finished\./i)).toBeVisible()
    await expect(page.locator('textarea[id="Audio cues-de"]')).toContainText(
      /Atmosphäre: warm, aufmerksam, leicht staunend\./i
    )
  })

  test("studio generates de audio from the artwork editor", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio mutation flows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await page.getByRole("button", { name: /Die Sternennacht222/i }).click()

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/artworks/01/audio") &&
        response.request().method() === "POST"
    )

    await page.getByRole("button", { name: /Generate DE audio/i }).click()

    const response = await responsePromise
    expect(response.ok()).toBe(true)

    await expect(
      page.getByText(/Generating de audio finished\./i)
    ).toBeVisible()
  })
})
