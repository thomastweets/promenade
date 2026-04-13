import type { ShowSummary } from "./content"
import type { ExportIssue } from "./export"
import type { ArtworkGuideMode, Locale, ShowBundle } from "./schema"

export type PrintLayoutMode = "labels" | "signs" | "entrance"
export type SignagePdfVariant = "sheet" | "single"

export type DashboardPayload = {
  bundle: ShowBundle
  audit: {
    ready: boolean
    issues: ExportIssue[]
  }
  showId: string
  shows: ShowSummary[]
  siteUrl: string
  studioOrigin: string
}

export type PrintSheetItem = {
  id: string
  guideNumber: string
  number: number
  guideMode: ArtworkGuideMode
  artist: string
  title: string
  titleSubtitle: string
  showTitle: string
  year: string
  material: string
  dimensions: string
  organizationName: string
  logoSrc: string
  locale: Locale
  url: string
  humanUrl: string
  svg: string
  downloadUrl: string
  accent: string
  accentSoft: string
  paper: string
  ink: string
}

export type PrintSheetPayload = {
  locale: Locale
  mode: PrintLayoutMode
  items: PrintSheetItem[]
}

export type EntranceSignPayload = {
  locale: Locale
  organizationName: string
  showTitle: string
  showSubtitle: string
  logoSrc: string
  publicLocales: Locale[]
  url: string
  humanUrl: string
  svg: string
  accent: string
  accentSoft: string
  paper: string
  ink: string
}
