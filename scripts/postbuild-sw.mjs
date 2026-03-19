import { generateSW } from "workbox-build"

const buildId = new Date()
  .toISOString()
  .replace(/[^0-9]/g, "")
  .slice(0, 14)

await generateSW({
  globDirectory: "dist",
  swDest: "dist/sw.js",
  globPatterns: ["**/*.{html,js,css,png,svg,ico,woff2,wav,webmanifest,json}"],
  cacheId: `promenade-${buildId}`,
  skipWaiting: true,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  navigateFallback: "/index.html",
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
      urlPattern: ({ request, sameOrigin }) =>
        sameOrigin &&
        ["style", "script", "worker"].includes(request.destination),
      handler: "NetworkFirst",
      options: {
        cacheName: `shell-assets-${buildId}`,
        networkTimeoutSeconds: 3
      }
    },
    {
      urlPattern: ({ request, sameOrigin }) =>
        sameOrigin && ["image", "font", "audio"].includes(request.destination),
      handler: "NetworkFirst",
      options: {
        cacheName: `show-media-${buildId}`,
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 60 * 60 * 24 * 30
        }
      }
    }
  ]
})
