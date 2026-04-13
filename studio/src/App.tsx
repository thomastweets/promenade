import {
  createAuthoritativeTitleRecord,
  getArtworkDisplayTitle,
  getArtworkTitleParts,
  getAuthoritativeArtworkTitle,
  resolveArtworkTitleLocale
} from "@lib/artwork-title"
import { bestLocalizedValue } from "@lib/i18n"
import type {
  Artwork,
  ArtworkTitleLocale,
  Locale,
  Show,
  TranslationState
} from "@lib/schema"
import {
  artworkTitleLocaleValues,
  isApprovedState,
  isGuidedArtwork,
  localeMeta,
  supportedLocales
} from "@lib/schema"
import type {
  DashboardPayload,
  EntranceSignPayload,
  PrintLayoutMode,
  PrintSheetPayload
} from "@lib/studio"
import { ThemeToggle } from "@lib/ThemeToggle"
import { entranceSignLabels } from "@lib/ui"
import type { CSSProperties, ChangeEvent } from "react"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  activateShow,
  assetUrl,
  buildEntranceSignPdfUrl,
  buildShowBackupUrl,
  buildSignageCutSvgUrl,
  buildSignagePdfUrl,
  createArtwork,
  exportShow,
  fetchBundle,
  fetchEntranceSign,
  fetchPrintSheet,
  generateAllArtworkAudio,
  generateAllArtworkCues,
  generateAudio,
  generateAudioCues,
  importShowBackup,
  saveArtwork,
  saveShow,
  translateAllArtworks,
  translateArtwork,
  uploadArtworkImages,
  uploadShowLogo
} from "./api"

type View = "dashboard" | "print" | "artwork"
type ArtworkListFilter = "all" | "guided" | "signage-only"
const PRINT_CARDS_PER_PAGE = 4

function chunkItems<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function resolveLocalizedLabel(
  values: Record<Locale, string>,
  fallback: string
) {
  return bestLocalizedValue(values) || fallback
}

const artworkTitleLocaleLabels: Record<ArtworkTitleLocale, string> = {
  de: "Deutsch",
  en: "English",
  es: "Español",
  other: "Other original language"
}

function getArtworkTitleLocaleLabel(locale: ArtworkTitleLocale) {
  return artworkTitleLocaleLabels[locale]
}

function resolveArtworkTitleSummary(
  artwork: Artwork,
  locale: Locale,
  fallback: string
) {
  const { title, subtitle } = getArtworkTitleParts(artwork, locale)

  return {
    title: title || fallback,
    subtitle
  }
}

function getPendingLocales(
  statuses: Record<Locale, TranslationState>,
  requiredLocales: readonly Locale[]
) {
  return requiredLocales.filter((locale) => !isApprovedState(statuses[locale]))
}

function resolveArtworkSourceLocale(artwork: Artwork, show: Show) {
  if (show.locales.includes(artwork.sourceLocale)) {
    return artwork.sourceLocale
  }

  for (const locale of [show.defaultLocale, ...show.locales]) {
    if (artwork.sourceDescription[locale].trim()) {
      return locale
    }
  }

  for (const locale of [show.defaultLocale, ...show.locales]) {
    if (artwork.description[locale].trim()) {
      return locale
    }
  }

  return show.defaultLocale
}

function resolveArtworkTitleLanguage(artwork: Artwork, show: Show) {
  return artworkTitleLocaleValues.includes(artwork.titleLocale)
    ? artwork.titleLocale
    : resolveArtworkTitleLocale(artwork, show.defaultLocale)
}

function HeadphoneMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5.9 12.25V10.95a6.1 6.1 0 1 1 12.2 0v1.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.15"
      />
      <rect
        fill="currentColor"
        height="7.5"
        rx="1.7"
        width="3.6"
        x="4.2"
        y="11.55"
      />
      <rect
        fill="currentColor"
        height="7.5"
        rx="1.7"
        width="3.6"
        x="16.2"
        y="11.55"
      />
    </svg>
  )
}

function GuideNumberBadge({
  compact = false,
  id,
  locale,
  signage = false
}: {
  compact?: boolean
  id: string
  locale: Locale
  signage?: boolean
}) {
  const label = signage
    ? locale === "de"
      ? "Nr."
      : locale === "es"
        ? "Núm."
        : "No."
    : compact
      ? locale === "de"
        ? "Nr."
        : locale === "es"
          ? "Núm."
          : "No."
      : locale === "de"
        ? "Audioguide-Nr."
        : locale === "es"
          ? "Núm. audioguía"
          : "Guide no."

  return (
    <div
      className={[
        "print-guide-badge",
        compact ? "print-guide-badge-compact" : "",
        signage ? "print-guide-badge-signage" : ""
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="print-guide-badge-icon">
        <HeadphoneMark className="h-full w-full" />
      </span>
      <div className={signage ? "print-guide-badge-copy-inline" : "min-w-0"}>
        <p className="print-guide-badge-label">{label}</p>
        <p className="print-guide-badge-id">{id}</p>
      </div>
    </div>
  )
}

export function App() {
  const [data, setData] = useState<DashboardPayload | null>(null)
  const [showDraft, setShowDraft] = useState<Show | null>(null)
  const [artworkDraft, setArtworkDraft] = useState<Artwork | null>(null)
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(
    null
  )
  const [artworkListFilter, setArtworkListFilter] =
    useState<ArtworkListFilter>("all")
  const [view, setView] = useState<View>("dashboard")
  const [printSheet, setPrintSheet] = useState<PrintSheetPayload | null>(null)
  const [entranceSign, setEntranceSign] = useState<EntranceSignPayload | null>(
    null
  )
  const [printLocale, setPrintLocale] = useState<Locale>("de")
  const [printMode, setPrintMode] = useState<PrintLayoutMode>("labels")
  const [selectedPrintArtworkIds, setSelectedPrintArtworkIds] = useState<
    string[]
  >([])
  const [signageCutMarks, setSignageCutMarks] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string>("Loading studio…")
  const [exportLog, setExportLog] = useState<string>("")
  const [importTargetShowId, setImportTargetShowId] = useState<string>("")
  const [useCuesForAudio, setUseCuesForAudio] = useState(false)
  const showLocales = data?.bundle.show.locales ?? [...supportedLocales]
  const publicLocales = data?.bundle.show.publicLocales ?? showLocales
  const filteredArtworks = useMemo(() => {
    const artworks = data?.bundle.artworks ?? []

    if (artworkListFilter === "guided") {
      return artworks.filter(isGuidedArtwork)
    }

    if (artworkListFilter === "signage-only") {
      return artworks.filter((artwork) => artwork.guideMode === "signage-only")
    }

    return artworks
  }, [artworkListFilter, data])

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

    setSelectedPrintArtworkIds((current) => {
      const validIds = current.filter((id) =>
        data.bundle.artworks.some((artwork) => artwork.id === id)
      )

      if (validIds.length) {
        return validIds
      }

      return data.bundle.artworks.map((artwork) => artwork.id)
    })
  }, [data])

  useEffect(() => {
    if (!filteredArtworks.length) {
      setSelectedArtworkId(null)
      return
    }

    const hasSelectedArtwork = filteredArtworks.some(
      (artwork) => artwork.id === selectedArtworkId
    )

    if (!selectedArtworkId || !hasSelectedArtwork) {
      setSelectedArtworkId(filteredArtworks[0].id)
    }
  }, [filteredArtworks, selectedArtworkId])

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

    if (printMode === "entrance") {
      setPrintSheet(null)
      fetchEntranceSign(printLocale)
        .then((payload) => setEntranceSign(payload))
        .catch((error: Error) => setMessage(error.message))
      return
    }

    setEntranceSign(null)
    const ids =
      printMode === "signs"
        ? selectedPrintArtworkIds.length
          ? selectedPrintArtworkIds
          : ["__none__"]
        : data.bundle.artworks.map((artwork) => artwork.id)

    fetchPrintSheet(ids, printLocale, printMode)
      .then((payload) => setPrintSheet(payload))
      .catch((error: Error) => setMessage(error.message))
  }, [data, printLocale, printMode, selectedPrintArtworkIds, view])

  useEffect(() => {
    if (!data) {
      return
    }

    if (!publicLocales.includes(printLocale)) {
      setPrintLocale(data.bundle.show.defaultLocale)
    }
  }, [data, printLocale, publicLocales])

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

  async function onUploadShowLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setBusy("Uploading show logo")

    try {
      const next = await uploadShowLogo(file)
      setData(next)
      setMessage("Show logo uploaded.")
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(null)
      event.target.value = ""
    }
  }

  async function onActivateShow(showId: string) {
    setBusy(`Activating ${showId}`)

    try {
      const next = await activateShow(showId)
      setData(next)
      setSelectedArtworkId(null)
      setView("dashboard")
      setMessage(`Show ${showId} activated.`)
    } catch (error) {
      setMessage((error as Error).message)
    } finally {
      setBusy(null)
    }
  }

  async function onImportBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    setBusy("Importing backup")

    try {
      const next = await importShowBackup(file, importTargetShowId)
      setData(next)
      setImportTargetShowId("")
      setMessage(
        next.importedShowId
          ? `Backup imported as ${next.importedShowId}. Activate it from the library when you want to switch.`
          : "Backup imported."
      )
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
          <div className="flex min-w-0 items-center gap-4">
            <img
              alt={showDraft.organization.name}
              className="h-12 w-12 rounded-2xl object-cover shadow-lg"
              src={assetUrl(showDraft.branding.logoSrc)}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                {showDraft.organization.name} studio
              </p>
              <h1 className="mt-2 truncate text-3xl font-semibold text-slate-950 dark:text-white">
                {resolveLocalizedLabel(showDraft.title, showDraft.id)}
              </h1>
            </div>
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
                {filteredArtworks.length} of {data.bundle.artworks.length}{" "}
                entries
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
          <div className="mt-4 inline-flex w-full rounded-full border border-slate-300 p-1 dark:border-white/12">
            {(
              [
                ["all", "All"],
                ["guided", "Audioguide"],
                ["signage-only", "Signage only"]
              ] as const
            ).map(([value, label]) => (
              <button
                className={`flex-1 rounded-full px-3 py-2 text-xs font-semibold transition ${
                  artworkListFilter === value
                    ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                    : "text-slate-600 dark:text-slate-300"
                }`}
                key={value}
                onClick={() => setArtworkListFilter(value)}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            {filteredArtworks.map((artwork) =>
              (() => {
                const pendingLocales = getPendingLocales(
                  artwork.translationStatus,
                  publicLocales
                )
                const ready = !pendingLocales.length
                const titleSummary = resolveArtworkTitleSummary(
                  artwork,
                  data.bundle.show.defaultLocale,
                  "Untitled"
                )

                return (
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
                          {titleSummary.title}
                        </p>
                        {titleSummary.subtitle ? (
                          <p className="mt-1 text-xs italic opacity-70">
                            {titleSummary.subtitle}
                          </p>
                        ) : null}
                        <p className="mt-1 text-sm opacity-75">
                          {artwork.artist || "Artist missing"}
                        </p>
                        {artwork.guideMode === "signage-only" ? (
                          <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.22em] opacity-75">
                            Signage only
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${
                          artwork.guideMode === "signage-only"
                            ? "bg-slate-500/15 text-slate-700 dark:bg-white/10 dark:text-slate-200"
                            : ready
                              ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200"
                              : "bg-amber-500/15 text-amber-700 dark:bg-amber-400/12 dark:text-amber-200"
                        }`}
                      >
                        {artwork.guideMode === "signage-only"
                          ? "studio"
                          : ready
                            ? "ready"
                            : `${pendingLocales[0]} pending`}
                      </span>
                    </div>
                  </button>
                )
              })()
            )}
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

          {view === "artwork" ? (
            <GuidedBatchBar
              busy={busy}
              count={data.bundle.artworks.filter(isGuidedArtwork).length}
              onAudio={() =>
                runTask(
                  "Generating audio for all guided artworks",
                  async () => {
                    if (artworkDraft) {
                      await saveArtwork(artworkDraft)
                    }

                    return generateAllArtworkAudio("all", {
                      useCues: useCuesForAudio
                    })
                  }
                )
              }
              onCues={() =>
                runTask(
                  "Generating cue sheets for all guided artworks",
                  async () => {
                    if (artworkDraft) {
                      await saveArtwork(artworkDraft)
                    }

                    return generateAllArtworkCues("all")
                  }
                )
              }
              onTranslate={() =>
                runTask(
                  "Filling guide copy for all guided artworks",
                  async () => {
                    if (artworkDraft) {
                      await saveArtwork(artworkDraft)
                    }

                    return translateAllArtworks("all")
                  }
                )
              }
              onUseCuesForAudioChange={setUseCuesForAudio}
              useCuesForAudio={useCuesForAudio}
            />
          ) : null}

          {view === "dashboard" ? (
            <DashboardView
              busy={busy}
              data={data}
              exportLog={exportLog}
              importTargetShowId={importTargetShowId}
              onChange={setShowDraft}
              onActivateShow={onActivateShow}
              onImportTargetShowIdChange={setImportTargetShowId}
              onSave={() => runTask("Saving show", () => saveShow(showDraft))}
              onShowBackupDownload={(showId) => {
                window.location.assign(buildShowBackupUrl(showId))
                setMessage(`Backup download started for ${showId}.`)
              }}
              onShowBackupImport={onImportBackup}
              onUploadShowLogo={onUploadShowLogo}
              showDraft={showDraft}
              supportedLocaleOptions={supportedLocales}
            />
          ) : null}

          {view === "artwork" && artworkDraft ? (
            <ArtworkEditor
              artwork={artworkDraft}
              busy={busy}
              show={showDraft}
              onAudio={(locale) =>
                runTask(`Generating ${locale} audio`, async () => {
                  await saveArtwork(artworkDraft)
                  return generateAudio(artworkDraft.id, locale, {
                    useCues: useCuesForAudio
                  })
                })
              }
              onCues={(locale) =>
                runTask(`Generating ${locale} cues`, async () => {
                  await saveArtwork(artworkDraft)
                  return generateAudioCues(artworkDraft.id, locale)
                })
              }
              onChange={setArtworkDraft}
              onSave={() =>
                runTask(`Saving artwork ${artworkDraft.id}`, () =>
                  saveArtwork(artworkDraft)
                )
              }
              onTranslate={(locale) =>
                runTask(
                  locale === "all"
                    ? `Filling guide copy for ${artworkDraft.id}`
                    : locale ===
                        resolveArtworkSourceLocale(artworkDraft, showDraft)
                      ? `Syncing ${locale} source copy for ${artworkDraft.id}`
                      : `Translating ${locale} guide copy for ${artworkDraft.id}`,
                  async () => {
                    await saveArtwork(artworkDraft)
                    return translateArtwork(artworkDraft.id, locale)
                  }
                )
              }
              onUpload={onUploadImages}
              onUseCuesForAudioChange={setUseCuesForAudio}
              studioOrigin={data.studioOrigin}
              useCuesForAudio={useCuesForAudio}
            />
          ) : null}

          {view === "print" ? (
            <PrintSheetView
              artworks={data.bundle.artworks}
              currentArtworkId={selectedArtworkId}
              cutMarks={signageCutMarks}
              availableLocales={publicLocales}
              locale={printLocale}
              mode={printMode}
              onCutMarksChange={setSignageCutMarks}
              onModeChange={setPrintMode}
              onLocaleChange={setPrintLocale}
              onSelectedArtworkIdsChange={setSelectedPrintArtworkIds}
              entranceSign={entranceSign}
              entranceSignPdfUrl={buildEntranceSignPdfUrl(printLocale)}
              payload={printSheet}
              selectedArtworkIds={selectedPrintArtworkIds}
              signagePdfUrlAll={buildSignagePdfUrl(
                data.bundle.artworks.map((artwork) => artwork.id),
                printLocale,
                {
                  cutMarks: signageCutMarks,
                  variant: "sheet"
                }
              )}
              signagePdfUrlSelected={buildSignagePdfUrl(
                selectedPrintArtworkIds,
                printLocale,
                {
                  cutMarks: signageCutMarks,
                  variant: "sheet"
                }
              )}
              signagePdfUrlSingle={buildSignagePdfUrl(
                [
                  selectedArtworkId ??
                    selectedPrintArtworkIds[0] ??
                    data.bundle.artworks[0]?.id
                ].filter(Boolean) as string[],
                printLocale,
                {
                  cutMarks: signageCutMarks,
                  variant: "single"
                }
              )}
              signageCutSvgUrlSelected={buildSignageCutSvgUrl(
                selectedPrintArtworkIds
              )}
            />
          ) : null}
        </main>
      </div>
    </div>
  )
}

function GuidedBatchBar({
  busy,
  count,
  onAudio,
  onCues,
  onTranslate,
  onUseCuesForAudioChange,
  useCuesForAudio
}: {
  busy: string | null
  count: number
  onAudio: () => void
  onCues: () => void
  onTranslate: () => void
  onUseCuesForAudioChange: (value: boolean) => void
  useCuesForAudio: boolean
}) {
  if (!count) {
    return null
  }

  return (
    <section className="studio-panel rounded-[2rem] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            Guided batch actions
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Run source-first translation or audio generation across all {count}{" "}
            guided artworks in the active show. Translation fills guide copy and
            optional title subtitles without replacing the original artwork
            titles.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-white/8 dark:text-slate-200">
            <input
              checked={useCuesForAudio}
              onChange={(event) =>
                onUseCuesForAudioChange(event.target.checked)
              }
              type="checkbox"
            />
            Use cues for audio
          </label>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={onTranslate}
            type="button"
          >
            Fill all guide languages
          </button>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={onCues}
            type="button"
          >
            Generate all cue sheets
          </button>
          <button
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
            disabled={Boolean(busy)}
            onClick={onAudio}
            type="button"
          >
            Generate all audio tracks
          </button>
        </div>
      </div>
    </section>
  )
}

function DashboardView({
  busy,
  data,
  exportLog,
  importTargetShowId,
  onChange,
  onActivateShow,
  onImportTargetShowIdChange,
  onSave,
  onShowBackupDownload,
  onShowBackupImport,
  onUploadShowLogo,
  showDraft,
  supportedLocaleOptions
}: {
  busy: string | null
  data: DashboardPayload
  exportLog: string
  importTargetShowId: string
  onChange: (show: Show) => void
  onActivateShow: (showId: string) => void
  onImportTargetShowIdChange: (value: string) => void
  onSave: () => void
  onShowBackupDownload: (showId: string) => void
  onShowBackupImport: (event: ChangeEvent<HTMLInputElement>) => void
  onUploadShowLogo: (event: ChangeEvent<HTMLInputElement>) => void
  showDraft: Show
  supportedLocaleOptions: readonly Locale[]
}) {
  function updateLocalizedField(
    field:
      | "title"
      | "subtitle"
      | "intro"
      | "about"
      | "help"
      | "footer"
      | "researchNotes"
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

  function toggleShowLocale(locale: Locale, enabled: boolean) {
    const nextLocales = enabled
      ? Array.from(new Set([...showDraft.locales, locale]))
      : showDraft.locales.filter((entry) => entry !== locale)

    if (!nextLocales.length) {
      return
    }

    const nextDefaultLocale = nextLocales.includes(showDraft.defaultLocale)
      ? showDraft.defaultLocale
      : nextLocales[0]
    const nextPublicLocales = showDraft.publicLocales.filter((entry) =>
      nextLocales.includes(entry)
    )

    onChange({
      ...showDraft,
      locales: nextLocales,
      defaultLocale: nextDefaultLocale,
      publicLocales: nextPublicLocales.includes(nextDefaultLocale)
        ? nextPublicLocales
        : Array.from(new Set([nextDefaultLocale, ...nextPublicLocales]))
    })
  }

  function togglePublicLocale(locale: Locale, enabled: boolean) {
    const nextPublicLocales = enabled
      ? Array.from(new Set([...showDraft.publicLocales, locale]))
      : showDraft.publicLocales.filter((entry) => entry !== locale)

    onChange({
      ...showDraft,
      publicLocales: nextPublicLocales.includes(showDraft.defaultLocale)
        ? nextPublicLocales
        : Array.from(new Set([showDraft.defaultLocale, ...nextPublicLocales]))
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
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/4">
            <p className="studio-label mb-3">Enabled locales</p>
            <div className="flex flex-wrap gap-3">
              {supportedLocaleOptions.map((locale) => (
                <label
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 dark:bg-white/8 dark:text-slate-100"
                  key={locale}
                >
                  <input
                    checked={showDraft.locales.includes(locale)}
                    onChange={(event) =>
                      toggleShowLocale(locale, event.target.checked)
                    }
                    type="checkbox"
                  />
                  {localeMeta[locale].autonym}
                </label>
              ))}
            </div>
          </div>
          <div className="rounded-[1.4rem] border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/4">
            <p className="studio-label mb-3">Published visitor locales</p>
            <div className="flex flex-wrap gap-3">
              {showDraft.locales.map((locale) => (
                <label
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 dark:bg-white/8 dark:text-slate-100"
                  key={locale}
                >
                  <input
                    checked={showDraft.publicLocales.includes(locale)}
                    disabled={locale === showDraft.defaultLocale}
                    onChange={(event) =>
                      togglePublicLocale(locale, event.target.checked)
                    }
                    type="checkbox"
                  />
                  {localeMeta[locale].autonym}
                </label>
              ))}
            </div>
            <label className="mt-4 block">
              <span className="studio-label">Default locale</span>
              <select
                className="studio-select"
                onChange={(event) =>
                  onChange({
                    ...showDraft,
                    defaultLocale: event.target.value as Locale,
                    publicLocales: Array.from(
                      new Set([
                        event.target.value as Locale,
                        ...showDraft.publicLocales
                      ])
                    )
                  })
                }
                value={showDraft.defaultLocale}
              >
                {showDraft.locales.map((locale) => (
                  <option key={locale} value={locale}>
                    {localeMeta[locale].autonym}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <LocalizedField
            label="Title"
            locales={showDraft.locales}
            onChange={(locale, value) =>
              updateLocalizedField("title", locale, value)
            }
            value={showDraft.title}
          />
          <LocalizedField
            label="Subtitle"
            locales={showDraft.locales}
            onChange={(locale, value) =>
              updateLocalizedField("subtitle", locale, value)
            }
            value={showDraft.subtitle}
          />
          <LocalizedField
            label="Intro"
            locales={showDraft.locales}
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("intro", locale, value)
            }
            value={showDraft.intro}
          />
          <LocalizedField
            label="About"
            locales={showDraft.locales}
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("about", locale, value)
            }
            value={showDraft.about}
          />
          <LocalizedField
            label="Help"
            locales={showDraft.locales}
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("help", locale, value)
            }
            value={showDraft.help}
          />
          <LocalizedField
            label="Footer"
            locales={showDraft.locales}
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("footer", locale, value)
            }
            value={showDraft.footer}
          />
          <LocalizedField
            label="Internal research notes"
            locales={showDraft.locales}
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("researchNotes", locale, value)
            }
            value={showDraft.researchNotes}
          />
          <LocalizedField
            label="Audio guide voice direction"
            locales={showDraft.locales}
            multiline
            onChange={(locale, value) =>
              updateLocalizedField("audioGuideStyle", locale, value)
            }
            value={showDraft.audioGuideStyle}
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
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
          <TextField
            label="Logo asset path"
            onChange={(value) =>
              onChange({
                ...showDraft,
                branding: {
                  ...showDraft.branding,
                  logoSrc: value
                }
              })
            }
            value={showDraft.branding.logoSrc}
          />
        </div>

        <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-white/70 px-4 py-4 dark:border-white/10 dark:bg-white/4">
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
            <img
              alt={showDraft.organization.name}
              className="h-12 w-12 rounded-lg border border-slate-200 object-cover dark:border-white/10"
              src={assetUrl(showDraft.branding.logoSrc)}
            />
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
                Print branding
              </p>
              <p className="mt-1">
                The same logo, organization name, and exhibition title are used
                on artwork signs and QR print sheets.
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[color:var(--brand-accent,#184f5d)] px-4 py-3 text-sm font-semibold text-white">
              Upload gallery logo
              <input
                accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                className="sr-only"
                onChange={onUploadShowLogo}
                type="file"
              />
            </label>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Use a clear PNG or JPG. It appears on signage PDFs and QR print
              sheets, including color output when the logo asset itself is
              colorful.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <div className="grid w-full gap-3 md:grid-cols-3">
            {showDraft.locales.map((locale) => (
              <label
                className="rounded-[1.2rem] bg-slate-100 px-4 py-3 text-sm text-slate-800 dark:bg-white/8 dark:text-slate-100"
                key={locale}
              >
                <span className="studio-label">
                  Show copy status · {localeMeta[locale].autonym}
                </span>
                <select
                  className="studio-select mt-2"
                  onChange={(event) =>
                    onChange({
                      ...showDraft,
                      translationStatus: {
                        ...showDraft.translationStatus,
                        [locale]: event.target
                          .value as Show["translationStatus"][Locale]
                      }
                    })
                  }
                  value={showDraft.translationStatus[locale]}
                >
                  <option value="missing">missing</option>
                  <option value="draft">draft</option>
                  <option value="approved">approved</option>
                  <option value="human">human</option>
                </select>
              </label>
            ))}
          </div>
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
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Show library
              </p>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                Import full-show backups side by side, keep generated audio, and
                activate the next show only when ready.
              </p>
            </div>
            <button
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
              onClick={() => onShowBackupDownload(data.showId)}
              type="button"
            >
              Backup active show
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {data.shows.map((show) => (
              <article
                className="rounded-[1.4rem] bg-slate-100 px-4 py-4 dark:bg-white/6"
                data-testid={`show-card-${show.id}`}
                key={show.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
                      {show.id}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                      {resolveLocalizedLabel(show.title, show.id)}
                    </p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {show.artworkCount} artworks ·{" "}
                      {new Date(show.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] ${
                      show.active
                        ? "bg-emerald-500/15 text-emerald-700 dark:bg-emerald-400/12 dark:text-emerald-200"
                        : "bg-slate-200 text-slate-600 dark:bg-white/8 dark:text-slate-300"
                    }`}
                  >
                    {show.active ? "active" : "available"}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {!show.active ? (
                    <button
                      aria-label={`Activate ${show.id}`}
                      className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                      disabled={Boolean(busy)}
                      onClick={() => onActivateShow(show.id)}
                      type="button"
                    >
                      Activate
                    </button>
                  ) : null}
                  <button
                    aria-label={`Download backup for ${show.id}`}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                    onClick={() => onShowBackupDownload(show.id)}
                    type="button"
                  >
                    Download backup
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-4 dark:border-white/12">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Import backup archive
            </p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Import a `.tar.gz` show package into a new show id. If the id
              field stays empty, the backup keeps its original show id.
            </p>
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <input
                aria-label="Import as show id"
                className="studio-input"
                onChange={(event) =>
                  onImportTargetShowIdChange(event.target.value)
                }
                placeholder="optional target show id"
                value={importTargetShowId}
              />
              <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-[color:var(--brand-accent,#184f5d)] px-4 py-3 text-sm font-semibold text-white">
                Import backup
                <input
                  accept=".tar.gz"
                  aria-label="Import backup archive"
                  className="hidden"
                  disabled={Boolean(busy)}
                  onChange={onShowBackupImport}
                  type="file"
                />
              </label>
            </div>
          </div>
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
  onUseCuesForAudioChange,
  show,
  studioOrigin,
  useCuesForAudio
}: {
  artwork: Artwork
  busy: string | null
  onAudio: (locale: Locale | "all") => void
  onCues: (locale: Locale | "all") => void
  onChange: (artwork: Artwork) => void
  onSave: () => void
  onTranslate: (locale: Locale | "all") => void
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void
  onUseCuesForAudioChange: (value: boolean) => void
  show: Show
  studioOrigin: string
  useCuesForAudio: boolean
}) {
  const isGuided = artwork.guideMode === "guided"
  const editorLocales = show.locales
  const publicLocales = show.publicLocales
  const sourceLocale = resolveArtworkSourceLocale(artwork, show)
  const titleLocale = resolveArtworkTitleLanguage(artwork, show)
  const titleSummary = resolveArtworkTitleSummary(
    artwork,
    show.defaultLocale,
    "Untitled artwork"
  )
  const authoritativeTitle = getAuthoritativeArtworkTitle(
    artwork,
    show.defaultLocale
  )

  function updateLocalizedField(
    field: "sourceDescription" | "description" | "material" | "titleSubtitle",
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

  function updateAuthoritativeTitle(value: string) {
    onChange({
      ...artwork,
      title: createAuthoritativeTitleRecord(value)
    })
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="space-y-6">
        <div className="studio-panel rounded-[2rem] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Artwork {artwork.id}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
                {titleSummary.title}
              </h2>
              {titleSummary.subtitle ? (
                <p className="mt-2 text-sm italic text-slate-500 dark:text-slate-400">
                  {titleSummary.subtitle}
                </p>
              ) : null}
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

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <label>
              <span className="studio-label">Visitor guide presence</span>
              <select
                className="studio-select"
                onChange={(event) =>
                  onChange({
                    ...artwork,
                    guideMode: event.target.value as Artwork["guideMode"]
                  })
                }
                value={artwork.guideMode}
              >
                <option value="guided">Audioguide + signage</option>
                <option value="signage-only">Signage only</option>
              </select>
            </label>
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600 dark:border-white/12 dark:text-slate-300">
              {isGuided
                ? "This artwork appears in the published visitor guide and can generate QR, translations, optional cues, audio, and mobile artwork pages."
                : "This artwork stays in Studio only. It is excluded from the published visitor guide, and its exhibition sign omits the QR / audioguide rail."}
            </div>
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
        </div>

        <div className="studio-panel rounded-[2rem] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Authoritative source
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                Keep the original title and the intake text here. The title is
                authoritative for signage, QR sheets, and the public guide;
                translations may only appear as optional subtitles. The selected
                source locale copies directly into guide copy for that same
                language, and every description translation starts from this
                source text.
              </p>
            </div>
            {isGuided ? (
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                disabled={Boolean(busy)}
                onClick={() => onTranslate("all")}
                type="button"
              >
                Fill all guide languages
              </button>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <label>
              <span className="studio-label">Source locale</span>
              <select
                className="studio-select"
                onChange={(event) =>
                  onChange({
                    ...artwork,
                    sourceLocale: event.target.value as Locale
                  })
                }
                value={sourceLocale}
              >
                {editorLocales.map((locale) => (
                  <option key={locale} value={locale}>
                    {localeMeta[locale].autonym}
                  </option>
                ))}
              </select>
            </label>
            <div className="rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600 dark:border-white/12 dark:text-slate-300">
              {localeMeta[sourceLocale].label} is the current source of truth
              for translations. Any target locale button below translates from
              that source, and the source locale button simply syncs source into
              guide copy without rewriting.
            </div>
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
            <label>
              <span className="studio-label">Title language</span>
              <select
                className="studio-select"
                onChange={(event) =>
                  onChange({
                    ...artwork,
                    titleLocale: event.target.value as ArtworkTitleLocale,
                    titleSubtitle: {
                      ...artwork.titleSubtitle,
                      de:
                        event.target.value === "de"
                          ? ""
                          : artwork.titleSubtitle.de,
                      en:
                        event.target.value === "en"
                          ? ""
                          : artwork.titleSubtitle.en,
                      es:
                        event.target.value === "es"
                          ? ""
                          : artwork.titleSubtitle.es
                    }
                  })
                }
                value={titleLocale}
              >
                {artworkTitleLocaleValues.map((locale) => (
                  <option key={locale} value={locale}>
                    {getArtworkTitleLocaleLabel(locale)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="studio-label">Authoritative title</span>
              <input
                className="studio-input"
                onChange={(event) =>
                  updateAuthoritativeTitle(event.target.value)
                }
                value={authoritativeTitle}
              />
            </label>
          </div>

          <div className="mt-4 rounded-[1.4rem] border border-dashed border-slate-300 px-4 py-4 text-sm text-slate-600 dark:border-white/12 dark:text-slate-300">
            {getArtworkTitleLocaleLabel(titleLocale)} is the authoritative title
            language. Promenade keeps this exact title in every locale view and
            only adds helper subtitles where useful.
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <LocalizedField
              label="Material"
              locales={editorLocales}
              onChange={(locale, value) =>
                updateLocalizedField("material", locale, value)
              }
              value={artwork.material}
            />
            <LocalizedField
              label="Title subtitle"
              locales={editorLocales}
              onChange={(locale, value) =>
                updateLocalizedField("titleSubtitle", locale, value)
              }
              value={{
                ...artwork.titleSubtitle,
                ...(titleLocale === "de" ? { de: "" } : {}),
                ...(titleLocale === "en" ? { en: "" } : {}),
                ...(titleLocale === "es" ? { es: "" } : {})
              }}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Keep title subtitles short. Leave them empty when the original title
            should stand on its own.
          </p>

          <div className="mt-6 grid gap-4">
            <p className="studio-label mb-0">Source description</p>
            {editorLocales.map((locale) => (
              <div
                className={`rounded-[1.4rem] border px-4 py-4 ${
                  locale === sourceLocale
                    ? "border-[color:var(--brand-accent,#184f5d)] bg-[color:var(--brand-accent,#184f5d)]/6"
                    : "border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/4"
                }`}
                key={locale}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label
                    className="studio-label mb-0"
                    htmlFor={`Source description-${locale}`}
                  >
                    {localeMeta[locale].autonym}
                  </label>
                  <span className="rounded-full bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
                    {locale === sourceLocale
                      ? "authoritative source"
                      : artwork.sourceDescription[locale].trim()
                        ? "reference copy"
                        : "optional reference"}
                  </span>
                </div>
                <textarea
                  id={`Source description-${locale}`}
                  className="studio-textarea mt-3"
                  onChange={(event) =>
                    updateLocalizedField(
                      "sourceDescription",
                      locale,
                      event.target.value
                    )
                  }
                  value={artwork.sourceDescription[locale]}
                ></textarea>
              </div>
            ))}
          </div>
        </div>

        {isGuided ? (
          <div className="studio-panel rounded-[2rem] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Guide copy & translations
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 dark:text-slate-300">
                  Each guide description stays close to the authoritative source
                  text. The source locale is copied directly; the other locales
                  are faithful translations intended for spoken audio-guide use.
                  The original artwork title never changes here; optional title
                  subtitles can help visitors understand it in other languages.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                disabled={Boolean(busy)}
                onClick={() => onTranslate("all")}
                type="button"
              >
                Fill all guide languages
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              {editorLocales.map((locale) => (
                <div
                  className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/4"
                  key={locale}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <label
                        className="studio-label mb-0"
                        htmlFor={`Guide description-${locale}`}
                      >
                        {localeMeta[locale].autonym}
                      </label>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        {locale === sourceLocale
                          ? `Copies directly from the ${localeMeta[sourceLocale].label} source text.`
                          : `Translate faithfully from the ${localeMeta[sourceLocale].label} source text.`}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-3">
                      <button
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                        disabled={Boolean(busy)}
                        onClick={() => onTranslate(locale)}
                        type="button"
                      >
                        {locale === sourceLocale
                          ? "Sync source copy"
                          : "Translate from source"}
                      </button>
                      <div className="w-[11rem]">
                        <label
                          className="studio-label mb-2"
                          htmlFor={`Translation status-${locale}`}
                        >
                          Copy status
                        </label>
                        <select
                          className="studio-select"
                          id={`Translation status-${locale}`}
                          onChange={(event) =>
                            onChange({
                              ...artwork,
                              translationStatus: {
                                ...artwork.translationStatus,
                                [locale]: event.target
                                  .value as Artwork["translationStatus"][Locale]
                              }
                            })
                          }
                          value={artwork.translationStatus[locale]}
                        >
                          <option value="missing">missing</option>
                          <option value="draft">draft</option>
                          <option value="approved">approved</option>
                          <option value="human">human</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <textarea
                    id={`Guide description-${locale}`}
                    className="studio-textarea mt-4"
                    onChange={(event) =>
                      updateLocalizedField(
                        "description",
                        locale,
                        event.target.value
                      )
                    }
                    value={artwork.description[locale]}
                  ></textarea>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="studio-panel rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Signage-only artwork
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              This entry stays behind the scenes in Promenade Studio. It can be
              selected for exhibition signage, print exports, and cut templates,
              but it will not appear in the published visitor guide or receive
              translation, cue, or audio treatment.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-6">
        {isGuided ? (
          <div className="studio-panel rounded-[2rem] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Audio readiness
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Audio is generated from the current guide description in each
                  public locale. Cue sheets remain optional and are ignored
                  unless you explicitly enable them for generation.
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 sm:items-end">
                <label className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 dark:bg-white/8 dark:text-slate-200">
                  <input
                    checked={useCuesForAudio}
                    onChange={(event) =>
                      onUseCuesForAudioChange(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Use cue sheets for audio
                </label>
                <button
                  className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                  disabled={Boolean(busy)}
                  onClick={() => onAudio("all")}
                  type="button"
                >
                  Generate all audio tracks
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {publicLocales.map((locale) => (
                <div
                  className="rounded-[1.4rem] bg-slate-100 px-4 py-4 dark:bg-white/6"
                  key={locale}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                        {localeMeta[locale].autonym}
                      </p>
                      <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                        {artwork.audioStatus[locale]}
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                      disabled={Boolean(busy)}
                      onClick={() => onAudio(locale)}
                      type="button"
                    >
                      Generate audio
                    </button>
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    Spoken source
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
                    {artwork.description[locale] ||
                      "No guide description available yet."}
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
                  {artwork.narrationRecord[locale].generatedAt ? (
                    <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white/70 px-3 py-3 text-sm text-slate-700 dark:border-white/10 dark:bg-slate-950/50 dark:text-slate-200">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Narration snapshot
                      </p>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        {artwork.narrationRecord[locale].provider} ·{" "}
                        {artwork.narrationRecord[locale].model}
                        {artwork.narrationRecord[locale].voiceId
                          ? ` · ${artwork.narrationRecord[locale].voiceId}`
                          : ""}
                        {artwork.narrationRecord[locale].seed
                          ? ` · seed ${artwork.narrationRecord[locale].seed}`
                          : ""}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(
                          artwork.narrationRecord[locale].generatedAt
                        ).toLocaleString()}
                      </p>
                      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                        Exact spoken text
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">
                        {artwork.narrationRecord[locale].speechText}
                      </p>
                      {artwork.audioStatus[locale] === "draft" ? (
                        <p className="mt-3 text-xs font-medium text-amber-700 dark:text-amber-300">
                          The stored audio file is older than the current guide
                          description. Regenerate audio to refresh it.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="studio-panel rounded-[2rem] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              Signage-only artwork
            </p>
            <p className="mt-2 text-sm leading-7 text-slate-600 dark:text-slate-300">
              This entry stays behind the scenes in Promenade Studio. It can be
              selected for exhibition signage, print exports, and cut templates,
              but it will not appear in the published visitor guide or receive
              QR / audio treatment.
            </p>
          </div>
        )}

        {isGuided ? (
          <div className="studio-panel rounded-[2rem] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                  Optional cues
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Cue sheets are optional and exist only to refine pacing,
                  emphasis, and pronunciation. Audio generation ignores them by
                  default until you enable cue usage above.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                disabled={Boolean(busy)}
                onClick={() => onCues("all")}
                type="button"
              >
                Generate all cue sheets
              </button>
            </div>
            <div className="mt-4 grid gap-3">
              {publicLocales.map((locale) => (
                <div
                  className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/4"
                  key={locale}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <label
                        className="studio-label mb-0"
                        htmlFor={`Audio cues-${locale}`}
                      >
                        {localeMeta[locale].autonym}
                      </label>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Status: {artwork.audioCueStatus[locale]}
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                      disabled={Boolean(busy)}
                      onClick={() => onCues(locale)}
                      type="button"
                    >
                      Generate cues
                    </button>
                  </div>
                  <textarea
                    id={`Audio cues-${locale}`}
                    className="studio-textarea mt-4"
                    onChange={(event) =>
                      onChange({
                        ...artwork,
                        audioCues: {
                          ...artwork.audioCues,
                          [locale]: event.target.value
                        }
                      })
                    }
                    value={artwork.audioCues[locale]}
                  ></textarea>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isGuided ? (
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
        ) : null}
      </section>
    </div>
  )
}

function EntranceSignPreview({ payload }: { payload: EntranceSignPayload }) {
  const copy = entranceSignLabels[payload.locale]
  const style = {
    "--print-accent": payload.accent,
    "--print-accent-soft": payload.accentSoft,
    "--print-paper": payload.paper,
    "--print-ink": payload.ink
  } as CSSProperties

  return (
    <article
      className="print-entrance"
      data-testid="print-page-entrance"
      style={style}
    >
      <div className="print-entrance-brand">
        <div className="print-entrance-brand-left">
          <img
            alt={payload.organizationName}
            className="print-entrance-logo"
            src={assetUrl(payload.logoSrc)}
          />
          <div className="min-w-0">
            <p className="print-entrance-org">{payload.organizationName}</p>
            {payload.showTitle ? (
              <p className="print-entrance-show">{payload.showTitle}</p>
            ) : null}
          </div>
        </div>
        <div className="print-entrance-eyebrow">
          <HeadphoneMark className="print-entrance-eyebrow-icon" />
          <span>{copy.eyebrow}</span>
        </div>
      </div>

      <section className="print-entrance-hero">
        <p className="print-entrance-kicker">{copy.title}</p>
        <h3 className="print-entrance-title">{copy.eyebrow}</h3>
        {payload.showTitle ? (
          <p className="print-entrance-subtitle">{payload.showTitle}</p>
        ) : null}
        {payload.showSubtitle ? (
          <p className="print-entrance-show-note">{payload.showSubtitle}</p>
        ) : null}
      </section>

      <section className="print-entrance-grid">
        <div className="print-entrance-copy">
          <p className="print-entrance-lead">{copy.lead}</p>
          <ol className="print-entrance-steps">
            {copy.steps.map((step, index) => (
              <li className="print-entrance-step" key={step}>
                <span className="print-entrance-step-index">{index + 1}</span>
                <p className="print-entrance-step-title">{step}</p>
              </li>
            ))}
          </ol>
        </div>

        <aside className="print-entrance-qr-panel">
          <p className="print-entrance-qr-label">{copy.qrLabel}</p>
          <div className="print-entrance-qr-frame">
            <img
              alt={`QR code for ${payload.showTitle || payload.organizationName}`}
              className="print-entrance-qr-image"
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(payload.svg)}`}
            />
          </div>
          <div className="print-entrance-qr-copy">
            <p className="print-entrance-url-label">{copy.urlLabel}</p>
            <p className="print-entrance-url">{payload.humanUrl}</p>
          </div>
        </aside>
      </section>

      <footer className="print-entrance-footer">
        <p className="print-entrance-footer-copy">{copy.footer}</p>
        <div className="print-entrance-languages">
          <p className="print-entrance-languages-label">
            {copy.languagesLabel}
          </p>
          <div className="print-entrance-language-list">
            {payload.publicLocales.map((entry) => (
              <span className="print-entrance-language-chip" key={entry}>
                {localeMeta[entry].autonym}
              </span>
            ))}
          </div>
        </div>
      </footer>
    </article>
  )
}

function PrintSheetView({
  availableLocales,
  artworks,
  currentArtworkId,
  cutMarks,
  entranceSign,
  entranceSignPdfUrl,
  locale,
  mode,
  onCutMarksChange,
  onModeChange,
  onLocaleChange,
  onSelectedArtworkIdsChange,
  payload,
  selectedArtworkIds,
  signagePdfUrlAll,
  signagePdfUrlSelected,
  signagePdfUrlSingle,
  signageCutSvgUrlSelected
}: {
  availableLocales: Locale[]
  artworks: Artwork[]
  currentArtworkId: string | null
  cutMarks: boolean
  entranceSign: EntranceSignPayload | null
  entranceSignPdfUrl: string
  locale: Locale
  mode: PrintLayoutMode
  onCutMarksChange: (enabled: boolean) => void
  onModeChange: (mode: PrintLayoutMode) => void
  onLocaleChange: (locale: Locale) => void
  onSelectedArtworkIdsChange: (ids: string[]) => void
  payload: PrintSheetPayload | null
  selectedArtworkIds: string[]
  signagePdfUrlAll: string
  signagePdfUrlSelected: string
  signagePdfUrlSingle: string
  signageCutSvgUrlSelected: string
}) {
  const items = payload?.items ?? []
  const pages = chunkItems(items, PRINT_CARDS_PER_PAGE)
  const isEntranceMode = mode === "entrance"
  const isSignMode = mode === "signs"
  const isLabelMode = mode === "labels"
  const selectedCount = selectedArtworkIds.length
  const cutSvgReady = selectedCount > 0 && selectedCount <= 8
  const singleTestArtwork = artworks.find(
    (artwork) => artwork.id === currentArtworkId
  )

  function toggleArtworkSelection(artworkId: string) {
    onSelectedArtworkIdsChange(
      selectedArtworkIds.includes(artworkId)
        ? selectedArtworkIds.filter((id) => id !== artworkId)
        : [...selectedArtworkIds, artworkId]
    )
  }

  return (
    <section className="studio-panel rounded-[2rem] p-6">
      <style media="print">{`@page { size: A4 ${isSignMode ? "landscape" : "portrait"}; margin: 0; }`}</style>
      <div className="no-print flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {isEntranceMode
              ? "Entrance signage"
              : isSignMode
                ? "Artwork signage"
                : "QR print sheets"}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">
            {isEntranceMode
              ? "A4 entrance sign"
              : isSignMode
                ? "12 × 8 cm exhibition signs"
                : "A4-ready artwork labels"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="inline-flex rounded-full border border-slate-300 p-1 dark:border-white/12">
            <button
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                isLabelMode
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              onClick={() => onModeChange("labels")}
              type="button"
            >
              QR labels
            </button>
            <button
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                isSignMode
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              onClick={() => onModeChange("signs")}
              type="button"
            >
              Artwork signs
            </button>
            <button
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                isEntranceMode
                  ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950"
                  : "text-slate-600 dark:text-slate-300"
              }`}
              onClick={() => onModeChange("entrance")}
              type="button"
            >
              Entrance sign
            </button>
          </div>
          <select
            className="studio-select max-w-[8rem]"
            onChange={(event) => onLocaleChange(event.target.value as Locale)}
            value={locale}
          >
            {availableLocales.map((entry) => (
              <option key={entry} value={entry}>
                {localeMeta[entry].autonym}
              </option>
            ))}
          </select>
          {!isSignMode ? (
            <button
              className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
              onClick={() => window.print()}
              type="button"
            >
              {isEntranceMode ? "Print poster" : "Print sheet"}
            </button>
          ) : null}
        </div>
      </div>

      {isEntranceMode ? (
        <div className="no-print mt-6 grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
                  Export set
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  A4 portrait entrance poster with a large QR code and a direct
                  guide URL. It matches the exhibition signage typography while
                  giving visitors a clear first step into the audioguide.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                href={entranceSignPdfUrl}
                rel="noreferrer"
                target="_blank"
              >
                Download A4 PDF
              </a>
              <button
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 dark:border-white/12 dark:text-slate-100"
                onClick={() => window.print()}
                type="button"
              >
                Print from browser
              </button>
              <a
                aria-disabled={!entranceSign?.url}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  entranceSign?.url
                    ? "border border-slate-300 text-slate-800 dark:border-white/12 dark:text-slate-100"
                    : "pointer-events-none border border-slate-200 text-slate-400 dark:border-white/8 dark:text-slate-500"
                }`}
                href={entranceSign?.url || undefined}
                rel="noreferrer"
                target={entranceSign?.url ? "_blank" : undefined}
              >
                Open guide start
              </a>
            </div>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/4">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
              Current poster
            </p>
            {entranceSign ? (
              <div className="mt-3 grid gap-3 text-sm text-slate-600 dark:text-slate-300">
                <p>
                  The QR code opens the public guide start page in{" "}
                  {localeMeta[entranceSign.locale].autonym}.
                </p>
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  {entranceSign.humanUrl}
                </p>
                <p>
                  Available languages:{" "}
                  {entranceSign.publicLocales
                    .map((entry) => localeMeta[entry].autonym)
                    .join(", ")}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                Loading poster preview…
              </p>
            )}
          </div>
        </div>
      ) : isSignMode ? (
        <div className="no-print mt-6 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.6rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
                  Export set
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  Exact 120 × 80 mm exhibition labels, 4-up on A4. The LightBurn
                  cut template matches two A4 landscape sheets stacked on A3
                  portrait.
                </p>
              </div>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                <input
                  checked={cutMarks}
                  onChange={(event) => onCutMarksChange(event.target.checked)}
                  type="checkbox"
                />
                Cut marks
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                href={signagePdfUrlAll}
                rel="noreferrer"
                target="_blank"
              >
                PDF for all artworks
              </a>
              <a
                aria-disabled={selectedCount === 0}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  selectedCount
                    ? "border border-slate-300 text-slate-800 dark:border-white/12 dark:text-slate-100"
                    : "pointer-events-none border border-slate-200 text-slate-400 dark:border-white/8 dark:text-slate-500"
                }`}
                href={selectedCount ? signagePdfUrlSelected : undefined}
                rel="noreferrer"
                target={selectedCount ? "_blank" : undefined}
              >
                PDF for selected artworks
              </a>
              <a
                aria-disabled={!singleTestArtwork}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  singleTestArtwork
                    ? "border border-slate-300 text-slate-800 dark:border-white/12 dark:text-slate-100"
                    : "pointer-events-none border border-slate-200 text-slate-400 dark:border-white/8 dark:text-slate-500"
                }`}
                href={singleTestArtwork ? signagePdfUrlSingle : undefined}
                rel="noreferrer"
                target={singleTestArtwork ? "_blank" : undefined}
              >
                Single-label test export
              </a>
              <a
                aria-disabled={!cutSvgReady}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  cutSvgReady
                    ? "border border-slate-300 text-slate-800 dark:border-white/12 dark:text-slate-100"
                    : "pointer-events-none border border-slate-200 text-slate-400 dark:border-white/8 dark:text-slate-500"
                }`}
                href={cutSvgReady ? signageCutSvgUrlSelected : undefined}
                rel="noreferrer"
                target={cutSvgReady ? "_blank" : undefined}
              >
                A3 LightBurn cut SVG
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Select up to 8 artworks. The cut SVG uses one red vector layer for
              through-cuts and matches two A4 landscape signage sheets stacked
              on A3 portrait.
            </p>
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white/80 p-5 dark:border-white/10 dark:bg-white/4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-slate-500 dark:text-slate-400">
                  Selection
                </p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {selectedCount} of {artworks.length} artworks selected
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                  onClick={() =>
                    onSelectedArtworkIdsChange(
                      artworks.map((artwork) => artwork.id)
                    )
                  }
                  type="button"
                >
                  Select all
                </button>
                <button
                  className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/12 dark:text-slate-200"
                  onClick={() => onSelectedArtworkIdsChange([])}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {artworks.map((artwork) => {
                const selected = selectedArtworkIds.includes(artwork.id)

                return (
                  <button
                    className={`rounded-full border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-slate-950 bg-slate-950 text-white dark:border-white dark:bg-white dark:text-slate-950"
                        : "border-slate-300 text-slate-700 dark:border-white/12 dark:text-slate-200"
                    }`}
                    key={artwork.id}
                    onClick={() => toggleArtworkSelection(artwork.id)}
                    type="button"
                  >
                    <span className="mr-2 font-semibold">{artwork.id}</span>
                    {getArtworkDisplayTitle(artwork, locale) || "Untitled"}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="print-sheet-stack mt-6">
        {isEntranceMode ? (
          <section className="print-page-preview">
            <div className="no-print flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Poster preview
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Single A4 portrait sheet
              </p>
            </div>

            <div className="print-page print-page-entrance">
              {entranceSign ? (
                <EntranceSignPreview payload={entranceSign} />
              ) : (
                <div className="print-entrance-loading">
                  Loading entrance sign…
                </div>
              )}
            </div>
          </section>
        ) : (
          pages.map((pageItems, pageIndex) => {
            const pageKey =
              pageItems
                .map(
                  (item) => `${payload?.mode ?? mode}-${item.locale}-${item.id}`
                )
                .join("__") || `empty-page-${pageIndex + 1}`
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
                    {pageItems.length} {isSignMode ? "signs" : "labels"} on this
                    page
                  </p>
                </div>

                <div
                  className={`print-page ${isSignMode ? "print-page-sign" : "print-page-label"}`}
                  data-testid={isSignMode ? "print-page-sign" : "print-page"}
                >
                  <div
                    className={`print-page-grid ${isSignMode ? "print-page-grid-sign" : "print-page-grid-label"}`}
                  >
                    {pageItems.map((item) =>
                      isSignMode ? (
                        <article
                          className="print-sign"
                          key={`${item.locale}-${item.id}`}
                        >
                          <div
                            className={`print-sign-shell ${item.guideMode === "guided" ? "" : "print-sign-shell-signage-only"}`}
                          >
                            <div className="print-sign-main">
                              <div className="print-sign-brand">
                                <img
                                  alt={item.organizationName}
                                  className="print-sign-logo"
                                  src={item.logoSrc}
                                />
                                <div className="print-sign-brand-copy">
                                  <p className="print-sign-brand-name">
                                    {item.organizationName}
                                  </p>
                                  {item.showTitle ? (
                                    <p className="print-sign-show-title">
                                      {item.showTitle}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="print-sign-copy">
                                <p className="print-sign-artist">
                                  {item.artist ||
                                    (locale === "de"
                                      ? "Kuenstler unbekannt"
                                      : locale === "es"
                                        ? "Artista desconocido"
                                        : "Unknown artist")}
                                </p>
                                <h3 className="print-sign-title">
                                  {item.title ||
                                    (locale === "de"
                                      ? "Ohne Titel"
                                      : locale === "es"
                                        ? "Sin título"
                                        : "Untitled")}
                                </h3>
                                {item.titleSubtitle ? (
                                  <p className="print-sign-title-subtitle">
                                    {item.titleSubtitle}
                                  </p>
                                ) : null}
                                <div className="print-sign-meta">
                                  {item.year ? <p>{item.year}</p> : null}
                                  {item.material ? (
                                    <p>{item.material}</p>
                                  ) : null}
                                  {item.dimensions ? (
                                    <p>{item.dimensions}</p>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            {item.guideMode === "guided" ? (
                              <aside className="print-sign-qr-panel">
                                <div className="print-sign-qr-stack">
                                  <div className="print-sign-guide-group">
                                    <p className="print-sign-guide-label">
                                      {locale === "de"
                                        ? "Audioguide"
                                        : locale === "es"
                                          ? "Audioguía"
                                          : "Audio guide"}
                                    </p>
                                    <div className="print-sign-qr-frame">
                                      <img
                                        alt={`QR code for ${item.title}${item.titleSubtitle ? ` (${item.titleSubtitle})` : ""}`}
                                        className="print-sign-qr-image"
                                        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.svg)}`}
                                      />
                                    </div>
                                    <GuideNumberBadge
                                      id={item.guideNumber}
                                      locale={locale}
                                      signage
                                    />
                                  </div>
                                </div>
                              </aside>
                            ) : null}
                          </div>
                        </article>
                      ) : (
                        <article
                          className="print-card"
                          key={`${item.locale}-${item.id}`}
                        >
                          <div className="print-card-head">
                            <div className="print-card-brand">
                              <img
                                alt={item.organizationName}
                                className="print-card-logo"
                                src={item.logoSrc}
                              />
                              <div className="min-w-0">
                                <p className="print-card-kind">
                                  {locale === "de"
                                    ? "Audioguide"
                                    : locale === "es"
                                      ? "Audioguía"
                                      : "Audio guide"}
                                </p>
                                <p className="print-card-org">
                                  {item.organizationName}
                                </p>
                              </div>
                            </div>
                            <GuideNumberBadge
                              compact
                              id={item.guideNumber}
                              locale={locale}
                            />
                          </div>
                          <div className="mt-4 min-h-0 flex-1">
                            <h3 className="print-card-title">{item.title}</h3>
                            {item.titleSubtitle ? (
                              <p className="print-card-title-subtitle">
                                {item.titleSubtitle}
                              </p>
                            ) : null}
                            <p className="print-card-artist mt-2">
                              {item.artist}
                            </p>
                            <div className="print-card-qr mt-5 border border-slate-200 p-4">
                              <img
                                alt={`QR code for ${item.title}${item.titleSubtitle ? ` (${item.titleSubtitle})` : ""}`}
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
                      )
                    )}

                    {placeholderSlots.map((slot) => (
                      <div
                        aria-hidden="true"
                        className={
                          isSignMode
                            ? "print-sign print-card-placeholder"
                            : "print-card print-card-placeholder"
                        }
                        key={`${pageKey}-${slot}`}
                      ></div>
                    ))}
                  </div>
                </div>
              </section>
            )
          })
        )}
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
  locales,
  multiline = false,
  onChange,
  value
}: {
  label: string
  locales: Locale[]
  multiline?: boolean
  onChange: (locale: Locale, value: string) => void
  value: Record<Locale, string>
}) {
  return (
    <div className="grid gap-4">
      <p className="studio-label mb-0">{label}</p>
      <div className="grid gap-4">
        {locales.map((locale) => (
          <div key={locale}>
            <label className="studio-label" htmlFor={`${label}-${locale}`}>
              {localeMeta[locale].autonym}
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
