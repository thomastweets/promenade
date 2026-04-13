import { type Locale } from "@lib/schema"
import { homeCopy } from "@lib/ui"
import { useArtworkEntry } from "./useArtworkEntry"

type Props = {
  locale: Locale
  showId: string
}

export function EntryPanel({ locale, showId }: Props) {
  const copy = homeCopy[locale]
  const {
    copy: scannerText,
    error,
    isScanning,
    setValue,
    submitNumber,
    toggleScanning,
    value,
    videoRef
  } = useArtworkEntry({
    locale,
    showId
  })

  return (
    <div className="surface-card ring-brand space-y-4 rounded-[2rem] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
        {copy.entryHint}
      </p>
      <form className="grid gap-3" onSubmit={submitNumber}>
        <input
          className="min-w-0 rounded-full border border-slate-200 bg-white px-5 py-4 text-base text-slate-900 outline-none ring-0 placeholder:text-slate-400 focus:border-[color:var(--brand-accent)] dark:border-white/12 dark:bg-slate-900/85 dark:text-white dark:placeholder:text-slate-500"
          inputMode="numeric"
          onChange={(event) => setValue(event.target.value)}
          placeholder={copy.enterPlaceholder}
          value={value}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            className="rounded-full bg-[color:var(--brand-accent)] px-5 py-3 text-sm font-semibold text-white shadow-lg"
            type="submit"
          >
            {copy.enterButton}
          </button>
          <button
            className="rounded-full border border-[color:var(--brand-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--brand-accent)]"
            onClick={toggleScanning}
            type="button"
          >
            {copy.scanButton}
          </button>
        </div>
      </form>
      {error ? (
        <p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
      ) : null}
      {isScanning ? (
        <div className="overflow-hidden rounded-[1.6rem] border border-white/60 bg-slate-950 text-white dark:border-white/10">
          <video
            className="aspect-video w-full object-cover"
            muted
            playsInline
            ref={videoRef}
          ></video>
          <p className="px-4 py-3 text-sm text-slate-200">
            {scannerText.cameraHint}
          </p>
        </div>
      ) : null}
    </div>
  )
}
