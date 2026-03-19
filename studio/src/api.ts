import type { Artwork, Show } from "@lib/schema"
import type { DashboardPayload, PrintSheetPayload } from "@lib/studio"

const API_ORIGIN = __STUDIO_API_ORIGIN__

async function request<T>(input: string, init?: RequestInit) {
  const response = await fetch(`${API_ORIGIN}${input}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  })

  const data = (await response.json()) as T & { message?: string }

  if (!response.ok) {
    throw new Error(data.message || "Studio request failed.")
  }

  return data
}

export function fetchBundle() {
  return request<DashboardPayload>("/api/bundle")
}

export function saveShow(show: Show) {
  return request<DashboardPayload>("/api/show", {
    method: "PUT",
    body: JSON.stringify(show)
  })
}

export function createArtwork() {
  return request<DashboardPayload>("/api/artworks", {
    method: "POST"
  })
}

export function saveArtwork(artwork: Artwork) {
  return request<DashboardPayload>(`/api/artworks/${artwork.id}`, {
    method: "PUT",
    body: JSON.stringify(artwork)
  })
}

export function translateArtwork(id: string) {
  return request<DashboardPayload>(`/api/artworks/${id}/translate`, {
    method: "POST"
  })
}

export function generateAudioCues(id: string, locale: "de" | "en" | "both") {
  return request<DashboardPayload>(`/api/artworks/${id}/audio-cues`, {
    method: "POST",
    body: JSON.stringify({ locale })
  })
}

export function generateAudio(id: string, locale: "de" | "en" | "both") {
  return request<DashboardPayload>(`/api/artworks/${id}/audio`, {
    method: "POST",
    body: JSON.stringify({ locale })
  })
}

export async function uploadArtworkImages(id: string, files: File[]) {
  const formData = new FormData()

  for (const file of files) {
    formData.append("files", file)
  }

  const response = await fetch(`${API_ORIGIN}/api/artworks/${id}/images`, {
    method: "POST",
    body: formData
  })
  const data = (await response.json()) as DashboardPayload & {
    message?: string
  }

  if (!response.ok) {
    throw new Error(data.message || "Image upload failed.")
  }

  return data
}

export function fetchPrintSheet(ids: string[], locale: "de" | "en") {
  const params = new URLSearchParams()

  if (ids.length) {
    params.set("ids", ids.join(","))
  }

  params.set("locale", locale)

  return request<PrintSheetPayload>(`/api/print-sheet?${params.toString()}`)
}

export async function exportShow() {
  return request<{
    logs: string
    ready: boolean
    issues: { message: string }[]
  }>("/api/export", {
    method: "POST"
  })
}

export function assetUrl(src: string) {
  return src.startsWith("http") ? src : `${API_ORIGIN}${src}`
}
