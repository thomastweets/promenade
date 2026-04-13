// @ts-check

import react from "@astrojs/react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "astro/config"
import tsconfigPaths from "vite-tsconfig-paths"

const site = process.env.PUBLIC_SITE_URL || "http://localhost:4321"

export default defineConfig({
  site,
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), tsconfigPaths()],
    server: {
      host: "0.0.0.0",
      port: 4321
    }
  }
})
