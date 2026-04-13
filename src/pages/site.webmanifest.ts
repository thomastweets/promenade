import { loadShowBundleSync } from "@lib/content"
import { localize } from "@lib/i18n"

function inferIconType(src: string) {
  if (src.endsWith(".svg")) return "image/svg+xml"
  if (src.endsWith(".jpg") || src.endsWith(".jpeg")) return "image/jpeg"
  if (src.endsWith(".webp")) return "image/webp"
  return "image/png"
}

export async function GET() {
  const bundle = loadShowBundleSync()
  const iconSrc = bundle.show.branding.logoSrc

  return new Response(
    JSON.stringify({
      name: localize(bundle.show.defaultLocale, bundle.show.title),
      short_name: localize(bundle.show.defaultLocale, bundle.show.title).slice(
        0,
        32
      ),
      start_url: "/",
      display: "standalone",
      background_color: bundle.show.branding.paper,
      theme_color: bundle.show.branding.accent,
      icons: [
        {
          src: iconSrc,
          sizes: "any",
          type: inferIconType(iconSrc),
          purpose: "any"
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
