import { importShowBackup } from "@lib/show-backup"

function readFlag(name: string) {
  return process.argv.includes(name)
}

function readOption(name: string) {
  const inline = process.argv.find((value) => value.startsWith(`${name}=`))

  if (inline) {
    return inline.slice(name.length + 1)
  }

  const index = process.argv.indexOf(name)

  if (index === -1) {
    return undefined
  }

  return process.argv[index + 1]
}

const archivePath = process.argv[2]

if (!archivePath || archivePath.startsWith("--")) {
  throw new Error(
    "Usage: npm run show:import -- <archive.tar.gz> [--show-id restored-show] [--activate]"
  )
}

const result = await importShowBackup({
  archivePath,
  targetShowId: readOption("--show-id"),
  activate: readFlag("--activate")
})

console.log(
  JSON.stringify(
    {
      importedShowId: result.importedShowId,
      ready: result.audit.ready,
      issueCount: result.audit.issues.length
    },
    null,
    2
  )
)
