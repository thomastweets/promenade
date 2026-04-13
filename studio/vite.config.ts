import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import tsconfigPaths from "vite-tsconfig-paths"

const apiOrigin = process.env.STUDIO_API_ORIGIN || "http://localhost:8787"
const studioHostname = process.env.STUDIO_HOSTNAME
const studioBasePath = normalizeBasePath(process.env.STUDIO_BASE_PATH)
const studioApiPrefix = studioBasePath === "/" ? "" : stripTrailingSlash(studioBasePath)

function normalizeBasePath(value: string | undefined) {
  const trimmed = value?.trim()

  if (!trimmed || trimmed === "/") {
    return "/"
  }

  return `/${trimmed.replace(/^\/+|\/+$/g, "")}/`
}

function stripTrailingSlash(value: string) {
  return value.endsWith("/") && value !== "/" ? value.slice(0, -1) : value
}

export default defineConfig({
  root: path.resolve("studio"),
  base: studioBasePath,
  define: {
    __STUDIO_API_ORIGIN__: JSON.stringify(studioApiPrefix)
  },
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    host: "0.0.0.0",
    port: 4173,
    allowedHosts: studioHostname ? [studioHostname] : true,
    proxy: {
      [`${studioApiPrefix}/api`]: apiOrigin,
      [`${studioApiPrefix}/shows`]: apiOrigin,
      [`${studioApiPrefix}/icons`]: apiOrigin
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
