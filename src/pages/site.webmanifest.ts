import { loadShowBundleSync } from "@lib/content"

export async function GET() {
  const bundle = loadShowBundleSync()

  return new Response(
    JSON.stringify({
      name: bundle.show.title.de,
      short_name: "Promenade",
      start_url: "/",
      display: "standalone",
      background_color: bundle.show.branding.paper,
      theme_color: bundle.show.branding.accent,
      icons: [
        {
          src: "/icons/icon-192.png",
          sizes: "192x192",
          type: "image/png"
        },
        {
          src: "/icons/icon-512.png",
          sizes: "512x512",
          type: "image/png"
        }
      ]
    }),
    {
      headers: {
        "Content-Type": "application/manifest+json"
      }
    }
  )
}
