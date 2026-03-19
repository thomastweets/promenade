import type { Locale } from "@lib/schema"
import { audioCopy } from "@lib/ui"
import { useEffect, useMemo, useRef, useState } from "react"

type Props = {
  autoStart?: boolean
  autoStartMedia?: string
  locale: Locale
  src: string
  title: string
}

function formatClock(seconds: number) {
  const minutes = Math.floor(seconds / 60)
  const remainder = Math.floor(seconds % 60)
  return `${minutes}:${`${remainder}`.padStart(2, "0")}`
}

export function ArtworkAudioPlayer({
  autoStart = false,
  autoStartMedia,
  locale,
  src,
  title
}: Props) {
  const copy = audioCopy[locale]
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const attemptedAutoStartRef = useRef<string | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

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

  const progressPercent = useMemo(() => {
    if (!duration) {
      return 0
    }

    return (progress / duration) * 100
  }, [duration, progress])

  async function togglePlayback() {
    const audio = audioRef.current

    if (!audio) {
      return
    }

    if (audio.paused) {
      await audio.play()
      return
    }

    audio.pause()
  }

  return (
    <div className="surface-card ring-brand sticky bottom-4 rounded-[2rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
            {copy.duration}
          </p>
          <h3 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
        </div>
        <button
          className="ring-brand min-w-[7.5rem] rounded-full bg-[color:var(--brand-accent)] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_16px_36px_-18px_var(--brand-accent)] transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-18px_var(--brand-accent)]"
          onClick={() => void togglePlayback()}
          type="button"
        >
          {isPlaying ? copy.pause : copy.play}
        </button>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-white/12">
        <div
          className="h-2 rounded-full bg-[color:var(--brand-accent)] transition-all"
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>
      <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{formatClock(progress)}</span>
        <span>{formatClock(duration)}</span>
      </div>
      <audio ref={audioRef} preload="metadata" src={src}></audio>
    </div>
  )
}
