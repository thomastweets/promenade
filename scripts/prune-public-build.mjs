import fs from "node:fs"
import path from "node:path"

function resolveShowsDir() {
  return path.resolve(process.cwd(), process.env.SHOWS_DIR || "shows")
}

function resolveActiveShowId() {
  const fallbackShowId = process.env.SHOW || "demo-show"
  const showsDir = resolveShowsDir()
  const configuredActiveFile = process.env.ACTIVE_SHOW_FILE || ".active-show"
  const activeShowFile = path.isAbsolute(configuredActiveFile)
    ? configuredActiveFile
    : path.join(showsDir, configuredActiveFile)

  if (!fs.existsSync(activeShowFile)) {
    return fallbackShowId
  }

  const nextShowId = fs.readFileSync(activeShowFile, "utf8").trim()

  if (!nextShowId) {
    return fallbackShowId
  }

  return fs.existsSync(path.join(showsDir, nextShowId, "show.json"))
    ? nextShowId
    : fallbackShowId
}

function prunePublicBuild() {
  const distShowsDir = path.resolve(process.cwd(), "dist", "shows")

  if (!fs.existsSync(distShowsDir)) {
    return
  }

  const activeShowId = resolveActiveShowId()
  let removedCount = 0

  for (const entry of fs.readdirSync(distShowsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === activeShowId) {
      continue
    }

    fs.rmSync(path.join(distShowsDir, entry.name), {
      recursive: true,
      force: true
    })
    removedCount += 1
  }

  console.log(
    `Public build pruned to active show "${activeShowId}" (${removedCount} extra show directories removed).`
  )
}

prunePublicBuild()
