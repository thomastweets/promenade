import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

const showDir = path.join(process.cwd(), ".playwright-shows")
const sitePort = 4322
const studioPort = 4174
const apiPort = 8788

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global.setup.ts",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${sitePort}`,
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: `SHOW=demo-show SHOWS_DIR=${showDir} PUBLIC_SITE_URL=http://127.0.0.1:${sitePort} npx astro dev --host 0.0.0.0 --port ${sitePort}`,
      url: `http://127.0.0.1:${sitePort}`,
      reuseExistingServer: false
    },
    {
      command: `export SHOW=demo-show SHOWS_DIR=${showDir} PORT=${apiPort} STUDIO_API_ORIGIN=http://127.0.0.1:${apiPort} STUDIO_ALLOW_MOCK_AI=true && npx tsx watch studio/server/index.ts`,
      url: `http://127.0.0.1:${apiPort}/health`,
      reuseExistingServer: false
    },
    {
      command: `export SHOW=demo-show SHOWS_DIR=${showDir} STUDIO_API_ORIGIN=http://127.0.0.1:${apiPort} && npx vite --host 0.0.0.0 --port ${studioPort} --config studio/vite.config.ts`,
      url: `http://127.0.0.1:${studioPort}`,
      reuseExistingServer: false
    }
  ],
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium", ...devices["Desktop Chrome"] }
    },
    {
      name: "iphone",
      use: { browserName: "chromium", ...devices["iPhone 15"] }
    },
    {
      name: "android",
      use: { browserName: "chromium", ...devices["Pixel 8"] }
    }
  ]
})
