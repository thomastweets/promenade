import type { Locale } from "@lib/schema"
import { useState } from "react"

type GalleryItem = {
  src: string
  alt: Record<Locale, string>
}

type Props = {
  locale: Locale
  items: GalleryItem[]
}

export function ArtworkGallery({ locale, items }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const activeItem = items[activeIndex]
  const showThumbnails = items.length > 1

  if (!activeItem) {
    return (
      <div className="surface-card flex min-h-[20rem] items-center justify-center rounded-[2rem] border border-dashed border-slate-300/80 px-6 py-10 text-center dark:border-white/12">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500 dark:text-slate-400">
            Artwork media
          </p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300">
            Images are still missing for this artwork draft. Add at least one
            image in the studio before export.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={showThumbnails ? "space-y-4" : undefined}>
      <div className="surface-card overflow-hidden rounded-[2rem] border border-white/60 dark:border-white/10">
        <img
          alt={activeItem.alt?.[locale] || ""}
          className="artwork-image"
          decoding="async"
          fetchPriority="high"
          loading="eager"
          src={activeItem.src}
        />
      </div>
      {showThumbnails ? (
        <div className="grid grid-cols-3 gap-3">
          {items.map((item, index) => (
            <button
              className={`overflow-hidden rounded-[1.3rem] border transition ${
                index === activeIndex
                  ? "border-[color:var(--brand-accent)] shadow-lg"
                  : "border-white/60 opacity-75 hover:opacity-100 dark:border-white/10"
              }`}
              key={item.src}
              onClick={() => setActiveIndex(index)}
              type="button"
            >
              <img
                alt={item.alt?.[locale] || ""}
                className="artwork-image"
                decoding="async"
                loading="lazy"
                src={item.src}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
