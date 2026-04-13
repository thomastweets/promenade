import { createShowBackup } from "@lib/show-backup"

const showId = process.argv[2] || process.env.SHOW || "demo-show"
const outputDirArgument = process.argv.find((value) =>
  value.startsWith("--output-dir=")
)

const { archivePath, manifest } = await createShowBackup({
  showId,
  outputDir: outputDirArgument
    ? outputDirArgument.slice("--output-dir=".length)
    : undefined
})

console.log(
  JSON.stringify(
    {
      archivePath,
      showId: manifest.showId,
      exportedAt: manifest.exportedAt,
      fileCount: manifest.fileCount
    },
    null,
    2
  )
)
