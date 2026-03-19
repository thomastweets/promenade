import type { Artwork, Locale, Show } from "@lib/schema"
import type { DashboardPayload, PrintSheetPayload } from "@lib/studio"
import { ThemeToggle } from "@lib/ThemeToggle"
import type { ChangeEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  assetUrl,
  createArtwork,
  exportShow,
  fetchBundle,
  fetchPrintSheet,
  generateAudio,
  generateAudioCues,
  saveArtwork,
  saveShow,
  translateArtwork,
  uploadArtworkImages
} from "./api"

type View = "dashboard" | "print" | "artwork"
const PRINT_CARDS_PER_PAGE = 4

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

export function App() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [showDraft, setShowDraft] = useState<Show | null>(null)
  const [artworkDraft, setArtworkDraft] = useState<Artwork | null>(null)
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(
    null
  )
  const [view, setView] = useState<View>("dashboard")
  const [printSheet, setPrintSheet] = useState<PrintSheetPayload | null>(null)
  const [printLocale, setPrintLocale] = useState<Locale>("de")
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string>("Loading studio…")
  const [exportLog, setExportLog] = useState<string>("")

  const refresh = useCallback(async () => {
    const next = await fetchBundle()
    setData(next)
    setMessage("Studio data refreshed.")
    return next
  }, [])

  useEffect(() => {
    refresh().catch((error: Error) => setMessage(error.message))
  }, [refresh])

  useEffect(() => {
    if (!data) {
      return
    }

    setShowDraft(structuredClone(data.bundle.show))

    if (!selectedArtworkId && data.bundle.artworks.length) {
      setSelectedArtworkId(data.bundle.artworks[0].id)
    }
  }, [data, selectedArtworkId])

  const selectedArtwork = useMemo(
    () =>
      data?.bundle.artworks.find(
        (artwork) => artwork.id === selectedArtworkId
      ) ?? null,
    [data, selectedArtworkId]
  )

  useEffect(() => {
    setArtworkDraft(selectedArtwork ? structuredClone(selectedArtwork) : null)
  }, [selectedArtwork])

  useEffect(() => {
    if (view !== "print" || !data) {
      return
    }

    fetchPrintSheet(
      data.bundle.artworks.map((artwork) => artwork.id),
      printLocale
    )
      .then((payload) => setPrintSheet(payload))
      .catch((error: Error) => setMessage(error.message))
  }, [data, printLocale, view])

  async function runTask(label: string, task: () => Promise<DashboardPayload>) {
    setBusy(label)

    try {
      const next = await task()
      setData(next)
      setMessage(`${label} finished.`)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function onCreateArtwork() {
    setBusy("Creating artwork")

    try {
      const next = await createArtwork()
      setData(next)
      const newest = next.bundle.artworks[next.bundle.artworks.length - 1]
      setSelectedArtworkId(newest.id)
      setView("artwork")
      setMessage(`Artwork ${newest.id} created.`)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function onUploadImages(event: ChangeEvent<HTMLInputElement>) {
    if (!artworkDraft || !event.target.files?.length) {
      return
    }

    setBusy("Uploading images")

    try {
      const next = await uploadArtworkImages(
        artworkDraft.id,
        Array.from(event.target.files)
      )
      setData(next)
      setMessage("Images uploaded.")
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(null)
      event.target.value = ""
    }
  }

  if (!data || !showDraft) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-300">
        {message}
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-white/70 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between gap-6 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Promenade Studio
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">
              {showDraft.title.de}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
              onClick={() => setView("dashboard")}
              type="button"
            >
              Show settings
            </button>
            <button
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
              onClick={() => setView("print")}
              type="button"
            >
              QR print sheets
            </button>
            <button
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              disabled={Boolean(busy)}
              onClick={async () => {
                setBusy("Exporting show")
                setExportLog("")

                try {
                  const result = await exportShow()
                  setExportLog(result.logs)
                  setMessage("Static export finished.")
                  await refresh()
                } catch (error) {
                  setMessage((error as Error).message)
                } finally {
                  setBusy(null)
                }
              }}
              type="button"
            >
              Export static site
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1800px] gap-6 px-5 py-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="studio-panel rounded-[2rem] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Artworks
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {data.bundle.artworks.length} entries
              </p>
            </div>
            <button
              className="rounded-full bg-[color:var(--brand-accent,#184f5d)] px-3 py-2 text-xs font-semibold text-white"
              disabled={Boolean(busy)}
              onClick={() => void onCreateArtwork()}
              type="button"
            >
              New artwork
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {data.bundle.artworks.map((artwork) => (
              <button
                className={`w-full rounded-[1.4rem] px-4 py-3 text-left transition ${
                  artwork.id === selectedArtworkId
                    ? "bg-slate-950 text-white"
                    : "bg-slate-100 text-slate-800 hover:bg-slate-200 dark:bg-white/6 dark:text-slate-100 dark:hover:bg-white/10"
                }`}
                key={artwork.id}
                onClick={() => {
                  setSelectedArtworkId(artwork.id)
                  setView("artwork")
                }}
                type="button"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] opacity-65">
                      {artwork.id}
                    </p>
                    <p className="mt-2 font-semibold">
                      {artwork.title.de || "Untitled"}
                    </p>
                    <p className="mt-1 text-sm opacity-75">
                      {artwork.artist || "Artist missing"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${
                      artwork.translationStatus.en === "approved" ||
                      artwork.translationStatus.en === "human"
                        ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200"
                        : "bg-amber-500/15 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200"
                    }`}
                  >
                    {artwork.translationStatus.en}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="space-y-6">
          <div className="studio-panel rounded-[2rem] p-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {message}
            </p>
            {busy ? (
              <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">
                {busy}…
              </p>
            ) : null}
          </div>

          {view === "dashboard" ? (
            <DashboardView
              data={data}
              exportLog={exportLog}
              onChange={setShowDraft}
              onSave={() => runTask("Saving show", () => saveShow(showDraft))}
              showDraft={showDraft}
            />
          ) : null}

          {view === "artwork" && artworkDraft ? (
            <ArtworkEditor
              artwork={artworkDraft}
              busy={busy}
              onAudio={(locale) =>
                runTask(`Generating ${locale} audio`, () =>
                  generateAudio(artworkDraft.id, locale)
                )
              }
              onCues={(locale) =>
                runTask(`Generating ${locale} cues`, () =>
                  generateAudioCues(artworkDraft.id, locale)
                )
              }
              onChange={setArtworkDraft}
              onSave={() =>
                runTask(`Saving artwork ${artworkDraft.id}`, () =>
                  saveArtwork(artworkDraft)
                )
              }
              onTranslate={() =>
                runTask(`Generating English draft for ${artworkDraft.id}`, () =>
                  translateArtwork(artworkDraft.id)
                )
              }
              onUpload={onUploadImages}
              studioOrigin={data.studioOrigin}
            />
          ) : null}

          {view === "print" ? (
            <PrintSheetView
              locale={printLocale}
              onLocaleChange={setPrintLocale}
              payload={printSheet}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function DashboardView({
  data,
  exportLog,
  onChange,
  onSave,
  showDraft
}: {
  data: DashboardPayload
  exportLog: string
  onChange: (show: Show) => void
  onSave: () => void
  showDraft: Show
}) {
  function updateLocalizedField(
    field:
      | "title"
      | "subtitle"
      | "intro"
      | "about"
      | "help"
      | "footer"
      | "audioGuideStyle",
    locale: Locale,
    value: string
  ) {
    onChange({
      ...showDraft,
      [field]: {
        ...showDraft[field],
        [locale]: value
      }
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="studio-panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Show metadata
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              Edit curatorial framing
            </h2>
          </div>
          <button
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            onClick={onSave}
            type="button"
          >
            Save show
          </button>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <LocalizedField
            label="Title"
            onChange={(locale, value) =>
              updateLocalizedField("title", locale, value)
            }
            value={showDraft.title}
          />
          <LocalizedField
            label="Subtitle"
            onChange={(locale, value) =>
              updateLocalizedField("subtitle", locale, value)
            }
            value={showDraft.subtitle}
          />
          <LocalizedField
            label="Intro"
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("intro", locale, value)
            }
            value={showDraft.intro}
          />
          <LocalizedField
            label="About"
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("about", locale, value)
            }
            value={showDraft.about}
          />
          <LocalizedField
            label="Help"
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("help", locale, value)
            }
            value={showDraft.help}
          />
          <LocalizedField
            label="Footer"
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("footer", locale, value)
            }
            value={showDraft.footer}
          />
          <LocalizedField
            label="Audio guide voice direction"
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("audioGuideStyle", locale, value)
            }
            value={showDraft.audioGuideStyle}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TextField
            label="Organization name"
            onChange={(value) =>
              onChange({
                ...showDraft,
                organization: {
                  ...showDraft.organization,
                  name: value
                }
              })
            }
            value={showDraft.organization.name}
          />
          <TextField
            label="Organization website"
            onChange={(value) =>
              onChange({
                ...showDraft,
                organization: {
                  ...showDraft.organization,
                  website: value
                }
              })
            }
            value={showDraft.organization.website ?? ""}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <label className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:bg-white/8 dark:text-slate-100">
            <input
              checked={showDraft.translationStatus.en === "approved"}
              onChange={(event) =>
                onChange({
                  ...showDraft,
                  translationStatus: {
                    ...showDraft.translationStatus,
                    en: event.target.checked ? "approved" : "draft"
                  }
                })
              }
              type="checkbox"
            />
            English copy approved for export
          </label>
        </div>
      </section>

      <section className="space-y-6">
        <div className="studio-panel rounded-[2rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Export readiness
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-950 dark:text-white">
            {data.audit.ready ? "Ready to export" : "Blocked"}
          </p>
          <ul className="mt-5 space-y-3">
            {data.audit.issues.length ? (
              data.audit.issues.map((issue) => (
                <li
                  className="rounded-[1.2rem] bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-white/6 dark:text-slate-200"
                  key={`${issue.entity}-${issue.id}-${issue.message}`}
                >
                  <span className="mr-2 font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    {issue.id}
                  </span>
                  {issue.message}
                </li>
              ))
            ) : (
              <li className="rounded-[1.2rem] bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                No blocking issues detected.
              </li>
            )}
          </ul>
        </div>

        <div className="studio-panel rounded-[2rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Last export log
          </p>
          <pre className="mt-4 max-h-[28rem] overflow-auto rounded-[1.4rem] bg-slate-950 p-4 text-xs leading-6 text-emerald-200">
            {exportLog ||
              "Run “Export static site” to capture a build log here."}
          </pre>
        </div>
      </section>
    </div>
  )
}

function ArtworkEditor({
  artwork,
  busy,
  onAudio,
  onCues,
  onChange,
  onSave,
  onTranslate,
  onUpload,
  studioOrigin
}: {
  artwork: Artwork
  busy: string | null
  onAudio: (locale: "de" | "en" | "both") => void
  onCues: (locale: "de" | "en" | "both") => void
  onChange: (artwork: Artwork) => void
  onSave: () => void
  onTranslate: () => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  studioOrigin: string
}) {
  function updateLocalizedField(
    field: "title" | "description" | "material",
    locale: Locale,
    value: string
  ) {
    onChange({
      ...artwork,
      [field]: {
        ...artwork[field],
        [locale]: value
      }
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="studio-panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Artwork {artwork.id}
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
              {artwork.title.de || "Untitled artwork"}
            </h2>
          </div>
          <button
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            onClick={onSave}
            type="button"
          >
            Save artwork
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <TextField
            label="Number"
            onChange={(value) =>
              onChange({
                ...artwork,
                number: Number.parseInt(value, 10) || artwork.number,
                id: `${Number.parseInt(value, 10) || artwork.number}`.padStart(
                  2,
                  "0"
                )
              })
            }
            value={`${artwork.number}`}
          />
          <TextField
            label="Artist"
            onChange={(value) => onChange({ ...artwork, artist: value })}
            value={artwork.artist}
          />
          <TextField
            label="Year"
            onChange={(value) => onChange({ ...artwork, year: value })}
            value={artwork.year}
          />
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <LocalizedField
            label="Title"
            onChange={(locale, value) =>
              updateLocalizedField("title", locale, value)
            }
            value={artwork.title}
          />
          <LocalizedField
            label="Description"
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("description", locale, value)
            }
            value={artwork.description}
          />
          <LocalizedField
            label="Material"
            onChange={(locale, value) =>
              updateLocalizedField("material", locale, value)
            }
            value={artwork.material}
          />
          <LocalizedField
            label="Audio cues"
            multiline
            onChange={(locale, value) =>
              onChange({
                ...artwork,
                audioCues: {
                  ...artwork.audioCues,
                  [locale]: value
                }
              })
            }
            value={artwork.audioCues}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TextField
            label="Dimensions"
            onChange={(value) => onChange({ ...artwork, dimensions: value })}
            value={artwork.dimensions}
          />
          <TextField
            label="Slug"
            onChange={(value) => onChange({ ...artwork, slug: value })}
            value={artwork.slug}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={onTranslate}
            type="button"
          >
            Generate EN draft
          </button>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={() => onCues("de")}
            type="button"
          >
            Generate DE cues
          </button>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={() => onCues("en")}
            type="button"
          >
            Generate EN cues
          </button>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={() => onCues("both")}
            type="button"
          >
            Generate both cue sets
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={() => onAudio("de")}
            type="button"
          >
            Generate DE audio
          </button>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={() => onAudio("en")}
            type="button"
          >
            Generate EN audio
          </button>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={() => onAudio("both")}
            type="button"
          >
            Generate both audio tracks
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <label className="inline-flex items-center gap-3 rounded-full bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800 dark:bg-white/8 dark:text-slate-100">
            <input
              checked={artwork.translationStatus.en === "approved"}
              onChange={(event) =>
                onChange({
                  ...artwork,
                  translationStatus: {
                    ...artwork.translationStatus,
                    en: event.target.checked ? "approved" : "draft"
                  }
                })
              }
              type="checkbox"
            />
            English translation approved
          </label>
        </div>
      </section>

      <section className="space-y-6">
        <div className="studio-panel rounded-[2rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Narration cues
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            These per-language cue sheets steer script shaping and audio
            delivery before text-to-speech runs.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(["de", "en"] as const).map((locale) => (
              <div
                className="rounded-[1.4rem] bg-slate-100 px-4 py-4 dark:bg-white/6"
                key={locale}
              >
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  {locale}
                </p>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                  {artwork.audioCueStatus[locale]}
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {artwork.audioCues[locale] || "No cues generated yet."}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="studio-panel rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Media
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Upload multiple images. The first image becomes the hero slot.
              </p>
            </div>
            <label className="rounded-full bg-[color:var(--brand-accent,#184f5d)] px-4 py-2 text-sm font-semibold text-white">
              Upload images
              <input
                className="hidden"
                multiple
                onChange={onUpload}
                type="file"
              />
            </label>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {artwork.images.map((image) => (
              <div
                className="overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-white/10"
                key={image.src}
              >
                <img
                  alt={image.alt.de}
                  className="aspect-[4/3] w-full object-cover"
                  src={assetUrl(image.src)}
                />
                <div className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                  {image.src.replace(studioOrigin, "")}
                </div>
              </div>
            ))}
            {!artwork.images.length ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-300 p-6 text-sm text-slate-500 dark:border-white/14 dark:text-slate-400">
                No images uploaded yet.
              </div>
            ) : null}
          </div>
        </div>

        <div className="studio-panel rounded-[2rem] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Audio readiness
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(["de", "en"] as const).map((locale) => (
              <div
                className="rounded-[1.4rem] bg-slate-100 px-4 py-4 dark:bg-white/6"
                key={locale}
              >
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  {locale}
                </p>
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                  {artwork.audioStatus[locale]}
                </p>
                {artwork.audio[locale] ? (
                  <a
                    className="mt-3 inline-flex text-sm font-semibold text-[color:var(--brand-accent,#184f5d)]"
                    href={assetUrl(artwork.audio[locale])}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open audio file
                  </a>
                ) : (
                  <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                    Generate audio to create the file.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function PrintSheetView({
  locale,
  onLocaleChange,
  payload
}: {
  locale: Locale
  onLocaleChange: (locale: Locale) => void
  payload: PrintSheetPayload | null
}) {
  const items = payload?.items ?? []
  const pages = chunkItems(items, PRINT_CARDS_PER_PAGE)

  return (
    <section className="studio-panel rounded-[2rem] p-6">
      <div className="no-print flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            QR print sheets
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            A4-ready artwork labels
          </h2>
        </div>
        <div className="flex items-center gap-3">
          <select
            className="studio-select max-w-[8rem]"
            onChange={(event) => onLocaleChange(event.target.value as Locale)}
            value={locale}
          >
            <option value="de">Deutsch</option>
            <option value="en">English</option>
          </select>
          <button
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
            onClick={() => window.print()}
            type="button"
          >
            Print sheet
          </button>
        </div>
      </div>

      <div className="print-sheet-stack mt-6">
        {pages.map((pageItems, pageIndex) => {
          const pageKey =
            pageItems.map((item) => `${item.locale}-${item.id}`).join("__") ||
            `empty-page-${pageIndex + 1}`
          const placeholderSlots = [
            "slot-a",
            "slot-b",
            "slot-c",
            "slot-d"
          ].slice(0, PRINT_CARDS_PER_PAGE - pageItems.length)

          return (
            <section className="print-page-preview" key={pageKey}>
              <div className="no-print flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Page {pageIndex + 1} / {pages.length}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {pageItems.length} labels on this page
                </p>
              </div>

              <div className="print-page" data-testid="print-page">
                <div className="print-page-grid">
                  {pageItems.map((item) => (
                    <article
                      className="print-card"
                      key={`${item.locale}-${item.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <img
                          alt="Promenade"
                          className="h-14 w-14 rounded-2xl object-cover"
                          src={item.logoSrc}
                        />
                        <div className="text-right text-xs uppercase tracking-[0.3em] text-slate-500">
                          {item.id}
                        </div>
                      </div>
                      <div className="mt-4 min-h-0 flex-1">
                        <h3 className="print-card-title text-xl font-semibold text-slate-950">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">
                          {item.artist}
                        </p>
                        <div className="print-card-qr mt-5 rounded-[1.5rem] border border-slate-200 p-4">
                          <img
                            alt={`QR code for ${item.title}`}
                            className="mx-auto w-full max-w-[18rem]"
                            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`}
                          />
                        </div>
                      </div>
                      <p className="print-card-url mt-4 text-sm font-medium text-slate-700">
                        {item.humanUrl}
                      </p>
                      <div className="no-print mt-4 flex gap-3">
                        <a
                          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                          href={item.downloadUrl}
                        >
                          Download QR
                        </a>
                        <a
                          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                          href={item.url}
                          rel="noreferrer"
                          target="_blank"
                        >
                          Open target
                        </a>
                      </div>
                    </article>
                  ))}

                  {placeholderSlots.map((slot) => (
                    <div
                      aria-hidden="true"
                      className="print-card print-card-placeholder"
                      key={`${pageKey}-${slot}`}
                    ></div>
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </section>
  )
}

function TextField({
  label,
  onChange,
  value
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label>
      <span className="studio-label">{label}</span>
      <input
        className="studio-input"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  )
}

function LocalizedField({
  label,
  multiline = false,
  onChange,
  value
}: {
  label: string
  multiline?: boolean
  onChange: (locale: Locale, value: string) => void
  value: Record<Locale, string>
}) {
  return (
    <div className="grid gap-4">
      <p className="studio-label mb-0">{label}</p>
      <div className="grid gap-4">
        {(["de", "en"] as const).map((locale) => (
          <div key={locale}>
            <label className="studio-label" htmlFor={`${label}-${locale}`}>
              {locale}
            </label>
            {multiline ? (
              <textarea
                id={`${label}-${locale}`}
                className="studio-textarea"
                onChange={(event) => onChange(locale, event.target.value)}
                value={value[locale]}
              ></textarea>
            ) : (
              <input
                id={`${label}-${locale}`}
                className="studio-input"
                onChange={(event) => onChange(locale, event.target.value)}
                value={value[locale]}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
