import fs from "node:fs"
import { expect, test } from "@playwright/test"

const studioBaseUrl = "http://127.0.0.1:4174"
const studioApiUrl = "http://127.0.0.1:8788"

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

    await page.getByRole("button", { name: /Artwork signs/i }).click()
    await expect(
      page.getByRole("heading", { name: /12 × 8 cm exhibition signs/i })
    ).toBeVisible()
    await expect(page.locator(".print-sign-show-title").first()).toContainText(
      /Beispielausstellung/i
    )

    const signSummary = await page.evaluate(() => {
      const pages = document.querySelectorAll('[data-testid="print-page-sign"]')
      const cards = document.querySelectorAll(
        ".print-page-sign .print-sign:not(.print-card-placeholder)"
      )

      return {
        cards: cards.length,
        pages: pages.length
      }
    })

    expect(signSummary.pages).toBe(Math.ceil(signSummary.cards / 4))

    await page.getByRole("button", { name: /Entrance sign/i }).click()
    await expect(
      page.getByRole("heading", { name: /A4 entrance sign/i })
    ).toBeVisible()
    await expect(page.locator(".print-entrance-title")).toContainText(
      /Audioguide|Audio guide/i
    )
    await expect(page.locator(".print-entrance-subtitle")).toContainText(
      /Beispielausstellung/i
    )
    await expect(page.locator(".print-entrance-qr-image")).toHaveCount(1)
  })

  test("studio filters artworks by visitor-guide mode", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio workflows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)

    const sidebar = page.locator("aside")

    await expect(sidebar.getByText("14 of 14 entries")).toBeVisible()
    await sidebar.getByRole("button", { name: /^Signage only$/i }).click()
    await expect(sidebar.getByText("3 of 14 entries")).toBeVisible()
    await expect(
      sidebar.getByRole("button", { name: /Stillleben in Ocker/i })
    ).toBeVisible()
    await expect(
      sidebar.getByRole("button", { name: /Archiv der Spuren/i })
    ).toBeVisible()
    await expect(
      sidebar.getByRole("button", { name: /Ohne Titel \(Blaue Studie\)/i })
    ).toBeVisible()
    await expect(
      sidebar.getByRole("button", { name: /Die Sternennacht222/i })
    ).toHaveCount(0)

    await sidebar.getByRole("button", { name: /^Audioguide$/i }).click()
    await expect(sidebar.getByText("11 of 14 entries")).toBeVisible()
    await expect(
      sidebar.getByRole("button", { name: /Die Sternennacht222/i })
    ).toBeVisible()
    await expect(
      sidebar.getByRole("button", { name: /Archiv der Spuren/i })
    ).toHaveCount(0)
  })

  test("studio serves signage pdf output", async ({ request }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio PDF checks run on desktop Chromium only."
    )

    const allResponse = await request.get(
      `${studioApiUrl}/api/signage.pdf?locale=de&variant=sheet&cutMarks=true`
    )
    const selectedResponse = await request.get(
      `${studioApiUrl}/api/signage.pdf?locale=de&ids=01,02&variant=sheet&cutMarks=false`
    )
    const singleResponse = await request.get(
      `${studioApiUrl}/api/signage.pdf?locale=de&ids=01&variant=single&cutMarks=false`
    )

    for (const response of [allResponse, selectedResponse, singleResponse]) {
      expect(response.ok()).toBe(true)
      expect(response.headers()["content-type"]).toContain("application/pdf")
      expect((await response.body()).byteLength).toBeGreaterThan(5_000)
    }
  })

  test("studio serves entrance sign pdf output", async ({
    request
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio PDF checks run on desktop Chromium only."
    )

    const response = await request.get(
      `${studioApiUrl}/api/entrance-sign.pdf?locale=de`
    )

    expect(response.ok()).toBe(true)
    expect(response.headers()["content-type"]).toContain("application/pdf")
    expect((await response.body()).byteLength).toBeGreaterThan(5_000)
  })

  test("studio serves LightBurn cut svg output", async ({ request }) => {
    const okResponse = await request.get(
      `${studioApiUrl}/api/signage-cut.svg?ids=01,02,03,04,05,06,07,08`
    )
    const tooManyResponse = await request.get(
      `${studioApiUrl}/api/signage-cut.svg?ids=01,02,03,04,05,06,07,08,09`
    )

    expect(okResponse.ok()).toBe(true)
    expect(okResponse.headers()["content-type"]).toContain("image/svg+xml")
    expect(await okResponse.text()).toContain(`stroke="#ff0000"`)

    expect(tooManyResponse.status()).toBe(400)
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
      fullPage: true,
      maxDiffPixels: 20
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

  test("studio supports signage-only artworks without QR or audio flows", async ({
    page,
    request
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio mutation flows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await page.getByRole("button", { name: /New artwork/i }).click()

    const createdArtworkMessage = page.getByText(/Artwork \d{2} created\./i)
    await expect(createdArtworkMessage).toBeVisible()

    const artworkId = (await createdArtworkMessage.textContent())?.match(
      /\d{2}/
    )?.[0]

    expect(artworkId).toBeTruthy()

    await page.getByLabel(/Authoritative title/i).fill("Nur Beschriftung")
    await page.locator('input[id="Material-de"]').fill("Acryl auf Leinwand")
    await page
      .getByLabel(/Visitor guide presence/i)
      .selectOption("signage-only")

    await expect(
      page.getByText(/This entry stays behind the scenes/i).first()
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /^Generate cues$/i })
    ).toHaveCount(0)
    await expect(
      page.getByRole("button", { name: /^Generate audio$/i })
    ).toHaveCount(0)
    await expect(page.getByText(/No images uploaded yet\./i)).toHaveCount(0)

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/artworks/${artworkId}`) &&
        response.request().method() === "PUT"
    )

    await page.getByRole("button", { name: /Save artwork/i }).click()

    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok()).toBe(true)
    await expect(
      page.getByText(new RegExp(`Saving artwork ${artworkId} finished\\.`, "i"))
    ).toBeVisible()

    const audioResponse = await request.post(
      `${studioApiUrl}/api/artworks/${artworkId}/audio`,
      {
        data: { locale: "de" }
      }
    )

    expect(audioResponse.status()).toBe(409)
    const audioBody = await audioResponse.json()
    expect(audioBody.message).toMatch(
      /signage-only artworks do not generate audio/i
    )

    await page.getByRole("button", { name: /QR print sheets/i }).click()
    await page.getByRole("button", { name: /Artwork signs/i }).click()
    await expect(
      page.getByRole("heading", { name: /12 × 8 cm exhibition signs/i })
    ).toBeVisible()

    const printSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: /12 × 8 cm exhibition signs/i })
    })

    const clearResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/print-sheet") &&
        response.request().method() === "GET"
    )
    await printSection.getByRole("button", { name: /^Clear$/i }).click()
    const clearResponse = await clearResponsePromise
    expect(clearResponse.ok()).toBe(true)

    const printResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/print-sheet") &&
        response.request().method() === "GET"
    )

    await printSection
      .getByRole("button", {
        name: new RegExp(`${artworkId}.*Nur Beschriftung`, "i")
      })
      .click()

    const printResponse = await printResponsePromise
    expect(printResponse.ok()).toBe(true)

    const signageCard = page
      .locator(".print-page-sign .print-sign:not(.print-card-placeholder)")
      .first()

    await expect(
      page.locator(".print-page-sign .print-sign:not(.print-card-placeholder)")
    ).toHaveCount(1)
    await expect(signageCard).toBeVisible()
    await expect(signageCard).toContainText("Nur Beschriftung")
    await expect(signageCard).not.toContainText(/Audioguide|Audio guide/i)
    await expect(signageCard.locator(".print-sign-qr-panel")).toHaveCount(0)
  })

  test("studio syncs source-locale guide copy from the authoritative source text", async ({
    page
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio mutation flows run on desktop Chromium only."
    )

    await page.goto(studioBaseUrl)
    await page.getByRole("button", { name: /Die Sternennacht222/i }).click()
    await page
      .locator('textarea[id="Source description-de"]')
      .fill("Ein neu gesetzter Quelltext für den Test.")

    const saveResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/artworks/01") &&
        response.request().method() === "PUT"
    )

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/artworks/01/translate") &&
        response.request().method() === "POST"
    )

    await page.getByRole("button", { name: /Sync source copy/i }).click()

    const saveResponse = await saveResponsePromise
    const response = await responsePromise
    expect(saveResponse.ok()).toBe(true)
    expect(response.ok()).toBe(true)

    await expect(
      page.getByText(/Syncing de source copy for 01 finished\./i)
    ).toBeVisible()
    await expect(
      page.locator('textarea[id="Guide description-de"]')
    ).toHaveValue("Ein neu gesetzter Quelltext für den Test.")
  })

  test("studio generates a single explicit locale translation draft", async ({
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
        response.url().includes("/api/artworks/01/translate") &&
        response.request().method() === "POST"
    )

    await page.getByRole("button", { name: /Translate from source/i }).click()

    const response = await responsePromise
    expect(response.ok()).toBe(true)

    await expect(
      page.getByText(/Translating en guide copy for 01 finished\./i)
    ).toBeVisible()
    await expect(
      page.locator('textarea[id="Guide description-en"]')
    ).toHaveValue(/An iconic painting/i)
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

    await page
      .locator(".studio-panel")
      .filter({ hasText: "Optional cues" })
      .getByRole("button", { name: /^Generate cues$/i })
      .first()
      .click()

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
    const cueField = page.locator('textarea[id="Audio cues-de"]')
    const existingCueText = await cueField.inputValue()
    const currentGuideText = await page
      .locator('textarea[id="Guide description-de"]')
      .inputValue()

    const responsePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/api/artworks/01/audio") &&
        response.request().method() === "POST"
    )

    await page
      .locator(".studio-panel")
      .filter({ hasText: "Audio readiness" })
      .getByRole("button", { name: /^Generate audio$/i })
      .first()
      .click()

    const response = await responsePromise
    expect(response.ok()).toBe(true)

    await expect(
      page.getByText(/Generating de audio finished\./i)
    ).toBeVisible()
    await expect(cueField).toHaveValue(existingCueText)
    await expect(
      page.getByText("Narration snapshot", { exact: true })
    ).toBeVisible()
    await expect(page.getByText(/mock · mock-tone/i)).toBeVisible()
    await expect(
      page.getByText("Exact spoken text", { exact: true })
    ).toBeVisible()
    await expect(
      page
        .locator(".studio-panel")
        .filter({ hasText: "Audio readiness" })
        .getByText(currentGuideText)
        .last()
    ).toBeVisible()
  })

  test("studio downloads, imports, and activates a show backup", async ({
    page,
    request
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== "chromium",
      "Studio backup flows run on desktop Chromium only."
    )

    const importedShowId = `demo-show-archive-${Date.now()}`

    await page.goto(studioBaseUrl)

    await expect(
      page.getByRole("button", { name: /Backup active show/i })
    ).toBeVisible()

    const backupResponse = await request.get(
      `${studioApiUrl}/api/shows/demo-show/backup`
    )
    expect(backupResponse.ok()).toBe(true)

    const backupPath = testInfo.outputPath("demo-show-backup.tar.gz")
    fs.writeFileSync(backupPath, Buffer.from(await backupResponse.body()))

    await page.getByLabel(/Import as show id/i).fill(importedShowId)
    await page.getByLabel(/Import backup archive/i).setInputFiles(backupPath)

    await expect(
      page.getByText(new RegExp(`Backup imported as ${importedShowId}`, "i"))
    ).toBeVisible()

    const importedCard = page.getByTestId(`show-card-${importedShowId}`)
    await expect(importedCard).toBeVisible()

    await importedCard.getByRole("button", { name: /Activate/i }).click()
    await expect(
      page.getByText(new RegExp(`Show ${importedShowId} activated\\.`, "i"))
    ).toBeVisible()
    await expect(importedCard.getByText(/active/i)).toBeVisible()

    const resetResponse = await request.post(
      `${studioApiUrl}/api/shows/demo-show/activate`
    )
    expect(resetResponse.ok()).toBe(true)
  })
})
