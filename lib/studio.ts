import type { ExportIssue } from "./export"
import type { Locale, ShowBundle } from "./schema"

export type DashboardPayload = {
  bundle: ShowBundle
  audit: {
    ready: boolean
    issues: ExportIssue[]
  }
  showId: string
  siteUrl: string
  studioOrigin: string
}

export type PrintSheetItem = {
  id: string
  artist: string
  title: string
  logoSrc: string
  locale: Locale
  url: string
  humanUrl: string
  svg: string
  downloadUrl: string
}

export type PrintSheetPayload = {
  locale: Locale
  items: PrintSheetItem[]
}
