import {
  buildArtworkPath,
  formatArtworkId,
  parseArtworkTargetFromQrInput
} from "@lib/routing"
import type { Locale } from "@lib/schema"
import { entryCopy } from "@lib/ui"
import { useEffect, useRef, useState } from "react"

type Options = {
  locale: Locale
  showId: string
}

type ScannerHandle = {
  destroy: () => void
  stop: () => void
}

export function useArtworkEntry({ locale, showId }: Options) {
  const copy = entryCopy[locale]
  const [value, setValue] = useState("")
  const [error, setError] = useState("")
  const [isScanning, setIsScanning] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const scannerRef = useRef<ScannerHandle | null>(null)

  useEffect(() => {
    const video = videoRef.current

    if (!isScanning || !video) {
      return
    }

    let mounted = true

    void (async () => {
      const module = await import("qr-scanner")
      const QrScanner = module.default
      const scanner = new QrScanner(
        video,
        (result: { data: string }) => {
          const raw = result.data
          const nextPath = parseArtworkTargetFromQrInput(raw, locale, {
            id: showId
          })

          if (!nextPath) {
            setError(copy.invalidResult)
            return
          }

          window.location.assign(nextPath)
        },
        {
          preferredCamera: "environment",
          highlightScanRegion: true,
          highlightCodeOutline: true,
          returnDetailedScanResult: true
        }
      )

      scannerRef.current = scanner

      try {
        await scanner.start()
      } catch {
        if (!mounted) {
          return
        }

        setError(copy.cameraError)
        setIsScanning(false)
      }
    })()

    return () => {
      mounted = false

      if (scannerRef.current) {
        void scannerRef.current.stop()
        scannerRef.current.destroy()
        scannerRef.current = null
      }
    }
  }, [copy.cameraError, copy.invalidResult, isScanning, locale, showId])

  function submitNumber(event?: { preventDefault: () => void }) {
    event?.preventDefault()

    if (!value.trim() || Number.isNaN(Number.parseInt(value, 10))) {
      setError(copy.invalidNumber)
      return
    }

    setError("")
    window.location.assign(
      buildArtworkPath(locale, { id: formatArtworkId(value) })
    )
  }

  function toggleScanning() {
    setError("")
    setIsScanning((current) => !current)
  }

  function openScanning() {
    setError("")
    setIsScanning(true)
  }

  function closeScanning() {
    setIsScanning(false)
  }

  return {
    copy,
    error,
    isScanning,
    openScanning,
    closeScanning,
    setError,
    setValue,
    submitNumber,
    toggleScanning,
    value,
    videoRef
  }
}
