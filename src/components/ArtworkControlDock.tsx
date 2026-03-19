import type { Locale } from "@lib/schema"
import { audioCopy, artworkDockCopy, homeCopy } from "@lib/ui"
import { useEffect, useRef, useState } from "react"
import { useArtworkEntry } from "./useArtworkEntry"

type DockTarget = {
  href: string
  id: string
  title: string
}

type Props = {
  autoStart?: boolean
  autoStartMedia?: string
  artist: string
  artworkId: string
  locale: Locale
  nextArtwork?: DockTarget
  previousArtwork?: DockTarget
  showId: string
  src?: string
  title: string
  year?: string
}

type Panel = "number" | "scan" | null

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${`${remainder}`.padStart(2, "0")}`
}

export function ArtworkControlDock({
  autoStart = false,
  autoStartMedia,
  artist,
  artworkId,
  locale,
  nextArtwork,
  previousArtwork,
  showId,
  src,
  title,
  year
}: Props) {
  const audioLabels = audioCopy[locale]
  const homeLabels = homeCopy[locale]
  const dockLabels = artworkDockCopy[locale]
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const attemptedAutoStartRef = useRef<string | null>(null)
  const numberInputRef = useRef<HTMLInputElement | null>(null)
  const [activePanel, setActivePanel] = useState<Panel>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const {
    copy: entryLabels,
    closeScanning,
    error,
    isScanning,
    openScanning,
    setError,
    setValue,
    submitNumber,
    value,
    videoRef
  } = useArtworkEntry({
    locale,
    showId
  })

  useEffect(() => {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const updateProgress = () => {
      setProgress(audio.currentTime)
      setDuration(audio.duration || 0)
    }
    const onPause = () => setIsPlaying(false)
    const onPlay = () => setIsPlaying(true)

    audio.addEventListener("timeupdate", updateProgress)
    audio.addEventListener("loadedmetadata", updateProgress)
    audio.addEventListener("pause", onPause)
    audio.addEventListener("play", onPlay)

    return () => {
      audio.removeEventListener("timeupdate", updateProgress)
      audio.removeEventListener("loadedmetadata", updateProgress)
      audio.removeEventListener("pause", onPause)
      audio.removeEventListener("play", onPlay)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current

    if (
      !audio ||
      !src ||
      !autoStart ||
      attemptedAutoStartRef.current === src ||
      (autoStartMedia && !window.matchMedia(autoStartMedia).matches)
    ) {
      return
    }

    attemptedAutoStartRef.current = src

    const attemptPlayback = () => {
      void (async () => {
        try {
          await audio.play()
          return
        } catch {}

        const wasMuted = audio.muted
        audio.muted = true

        try {
          await audio.play()
        } catch {
          audio.muted = wasMuted
          return
        }

        window.setTimeout(() => {
          audio.muted = wasMuted
        }, 180)
      })()
    }

    if (audio.readyState >= 2) {
      attemptPlayback()
      return
    }

    audio.addEventListener("canplay", attemptPlayback, { once: true })

    return () => {
      audio.removeEventListener("canplay", attemptPlayback)
    }
  }, [autoStart, autoStartMedia, src])

  useEffect(() => {
    if (activePanel !== "number") {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      numberInputRef.current?.focus()
      numberInputRef.current?.select()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activePanel])

  async function togglePlayback() {
    const audio = audioRef.current

    if (!audio || !src) {
      return
    }

    if (audio.paused) {
      await audio.play()
      return
    }

    audio.pause()
  }

  function setPanel(nextPanel: Panel) {
    setError("")

    if (nextPanel === activePanel) {
      setActivePanel(null)
      closeScanning()
      return
    }

    setActivePanel(nextPanel)

    if (nextPanel === "number") {
      setValue("")
    }

    if (nextPanel === "scan") {
      openScanning()
      return
    }

    closeScanning()
  }

  function scrubTo(nextValue: string) {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    const nextTime = Number.parseFloat(nextValue)
    audio.currentTime = nextTime
    setProgress(nextTime)
  }

  function goToArtwork(href?: string) {
    if (!href) {
      return
    }

    window.location.assign(href)
  }

  const metaLine = [artist, year].filter(Boolean).join(" · ")

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:hidden">
      {activePanel ? (
        <div className="pointer-events-auto mb-3 overflow-hidden rounded-[1.6rem] border border-white/80 bg-white/92 p-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/92">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[color:var(--brand-accent)]">
                {dockLabels.findAnother}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {activePanel === "scan"
                  ? dockLabels.scanSheetTitle
                  : dockLabels.numberSheetTitle}
              </p>
            </div>
            <button
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"
              onClick={() => setPanel(null)}
              type="button"
            >
              {dockLabels.closeAction}
            </button>
          </div>

          {activePanel === "number" ? (
            <form className="space-y-3" onSubmit={submitNumber}>
              <input
                aria-label={dockLabels.numberLabel}
                className="w-full rounded-[1.2rem] border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 outline-none placeholder:text-slate-400 focus:border-[color:var(--brand-accent)] dark:border-white/12 dark:bg-slate-900/85 dark:text-white dark:placeholder:text-slate-500"
                enterKeyHint="go"
                inputMode="numeric"
                onChange={(event) => setValue(event.target.value)}
                placeholder={homeLabels.enterPlaceholder}
                ref={numberInputRef}
                value={value}
              />
              <button
                className="w-full rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
                type="submit"
              >
                {homeLabels.enterButton}
              </button>
            </form>
          ) : null}

          {activePanel === "scan" ? (
            <div className="overflow-hidden rounded-[1.4rem] border border-white/60 bg-slate-950 text-white dark:border-white/10">
              {isScanning ? (
                <video
                  className="aspect-video w-full object-cover"
                  muted
                  playsInline
                  ref={videoRef}
                ></video>
              ) : null}
              <p className="px-4 py-3 text-sm text-slate-200">
                {isScanning ? entryLabels.cameraHint : entryLabels.cameraError}
              </p>
            </div>
          ) : null}

          {error ? (
            <p className="mt-3 text-sm text-rose-600 dark:text-rose-300">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      <div
        className="pointer-events-auto overflow-hidden rounded-[1.7rem] border border-white/80 bg-white/88 px-4 py-3 shadow-2xl backdrop-blur-2xl dark:border-white/10 dark:bg-slate-950/88"
        data-testid="artwork-mobile-dock"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-[color:var(--brand-accent-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-[color:var(--brand-accent)] dark:bg-white/10 dark:text-white">
            {artworkId}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">
              {title}
            </p>
            <p className="truncate text-[12px] text-slate-600 dark:text-slate-300">
              {metaLine || dockLabels.currentArtwork}
            </p>
          </div>
          <button
            className="ring-brand min-w-[7.5rem] shrink-0 rounded-full bg-[color:var(--brand-accent)] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_16px_36px_-18px_var(--brand-accent)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-18px_var(--brand-accent)] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0"
            disabled={!src}
            onClick={() => void togglePlayback()}
            type="button"
          >
            {isPlaying ? audioLabels.pause : audioLabels.play}
          </button>
        </div>

        {src ? (
          <div className="mt-3 flex items-center gap-2">
            <span className="w-9 shrink-0 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {formatClock(progress)}
            </span>
            <input
              aria-label={dockLabels.seekLabel}
              className="min-w-0 flex-1 accent-[color:var(--brand-accent)]"
              max={duration || 0}
              min={0}
              onChange={(event) => scrubTo(event.target.value)}
              step="0.1"
              type="range"
              value={Math.min(progress, duration || progress)}
            />
            <span className="w-9 shrink-0 text-right text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {duration ? formatClock(duration) : "0:00"}
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {audioLabels.audioMissing}
          </p>
        )}

        <div className="mt-3 grid grid-cols-[3.75rem_minmax(0,1fr)_minmax(0,1fr)_3.75rem] gap-2">
          <button
            aria-label={
              previousArtwork
                ? `${dockLabels.previousAction}: ${previousArtwork.title}`
                : dockLabels.previousAction
            }
            className="rounded-full border border-slate-200 bg-white px-2 py-2.5 text-xs font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:border-slate-200/80 disabled:bg-slate-50 disabled:text-slate-300 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200 dark:disabled:border-white/10 dark:disabled:bg-slate-900/55 dark:disabled:text-slate-500"
            disabled={!previousArtwork}
            onClick={() => goToArtwork(previousArtwork?.href)}
            type="button"
          >
            {previousArtwork ? `← ${previousArtwork.id}` : "←"}
          </button>
          <button
            aria-expanded={activePanel === "scan"}
            className={`rounded-full px-4 py-2.5 text-xs font-semibold transition ${
              activePanel === "scan"
                ? "bg-[color:var(--brand-accent)] text-white"
                : "border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"
            }`}
            onClick={() => setPanel("scan")}
            type="button"
          >
            {dockLabels.scanAction}
          </button>
          <button
            aria-expanded={activePanel === "number"}
            className={`rounded-full px-4 py-2.5 text-xs font-semibold transition ${
              activePanel === "number"
                ? "bg-[color:var(--brand-accent)] text-white"
                : "border border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200"
            }`}
            onClick={() => setPanel("number")}
            type="button"
          >
            {dockLabels.numberAction}
          </button>
          <button
            aria-label={
              nextArtwork
                ? `${dockLabels.nextAction}: ${nextArtwork.title}`
                : dockLabels.nextAction
            }
            className="rounded-full border border-slate-200 bg-white px-2 py-2.5 text-xs font-semibold text-slate-700 transition disabled:cursor-not-allowed disabled:border-slate-200/80 disabled:bg-slate-50 disabled:text-slate-300 dark:border-white/10 dark:bg-slate-900/80 dark:text-slate-200 dark:disabled:border-white/10 dark:disabled:bg-slate-900/55 dark:disabled:text-slate-500"
            disabled={!nextArtwork}
            onClick={() => goToArtwork(nextArtwork?.href)}
            type="button"
          >
            {nextArtwork ? `${nextArtwork.id} →` : "→"}
          </button>
        </div>

        {src ? <audio ref={audioRef} preload="metadata" src={src}></audio> : null}
      </div>
    </div>
  )
}
