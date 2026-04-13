import { generateSW } from "workbox-build"

const buildId = new Date()
  .toISOString()
  .replace(/[^0-9]/g, "")
  .slice(0, 14)

await generateSW({
  globDirectory: "dist",
  swDest: "dist/sw.js",
  globPatterns: [
    "**/*.{html,js,css,ico,woff2,webmanifest}",
    "favicon.svg",
    "icons/*.{png,svg}"
  ],
  cacheId: `promenade-${buildId}`,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      urlPattern: ({ request, sameOrigin }) =>
        sameOrigin && request.destination === "document",
      handler: "NetworkFirst",
      options: {
        cacheName: `pages-${buildId}`,
        networkTimeoutSeconds: 3
      }
    },
    {
      urlPattern: ({ request, sameOrigin, url }) =>
        sameOrigin &&
        url.pathname.startsWith("/shows/") &&
        ["image", "audio"].includes(request.destination),
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: `show-media-${buildId}`,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30
        }
      }
    }
  ]
})
