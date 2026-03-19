import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

const apiOrigin = process.env.STUDIO_API_ORIGIN || "http://localhost:8787"
const studioHostname = process.env.STUDIO_HOSTNAME

export default defineConfig({
  root: path.resolve("studio"),
  define: {
    __STUDIO_API_ORIGIN__: JSON.stringify("")
  },
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: studioHostname ? [studioHostname] : true,
    proxy: {
      "/api": apiOrigin,
      "/shows": apiOrigin,
      "/icons": apiOrigin
    }
  },
  preview: {
    host: "0.0.0.0",
    port: 4173
  },
  resolve: {
    alias: {
      "@lib": path.resolve("lib"),
      "@studio": path.resolve("studio/src")
    }
  },
  build: {
    outDir: path.resolve("studio/dist"),
    emptyOutDir: true
  }
})
