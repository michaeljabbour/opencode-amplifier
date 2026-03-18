/**
 * Mode discovery — reads mode definitions from the Amplifier bundle cache.
 *
 * Phase 1: preserved from src/index.ts for compatibility.
 * Phase 2: replace with a runtime API call to listModes().
 */

import { readFileSync, readdirSync, existsSync } from "fs"
import { join, basename } from "path"
import { homedir } from "os"

export interface ModeDefinition {
  name: string
  description: string
  shortcut: string
  source: string
  filePath: string
}

export function discoverModes(): ModeDefinition[] {
  const cacheDir = join(homedir(), ".amplifier", "cache")
  if (!existsSync(cacheDir)) return []
  const modes: ModeDefinition[] = []
  const seen = new Set<string>()
  try {
    for (const entry of readdirSync(cacheDir)) {
      const modesDir = join(cacheDir, entry, "modes")
      if (!existsSync(modesDir)) continue
      const source = entry.replace(/-[a-f0-9]{16}$/, "")
      for (const file of readdirSync(modesDir)) {
        if (!file.endsWith(".md")) continue
        const name = basename(file, ".md")
        if (seen.has(name)) continue
        seen.add(name)
        const content = readFileSync(join(modesDir, file), "utf-8")
        const fm = parseFrontmatter(content)
        modes.push({
          name: fm.name || name,
          description: fm.description || "",
          shortcut: fm.shortcut || name,
          source,
          filePath: join(modesDir, file),
        })
      }
    }
  } catch (e) {
    console.error("[amplifier] discoverModes cache traversal failed:", (e as Error).message)
  }
  return modes
}

export function parseFrontmatter(content: string): Record<string, string> {
  const result: Record<string, string> = {}
  const match = content.match(/^---\n([\s\S]*?)\n---/)
  if (!match) return result
  for (const line of match[1].split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed === "mode:") continue
    const colon = trimmed.indexOf(":")
    if (colon < 0) continue
    const key = trimmed.slice(0, colon).trim()
    const val = trimmed.slice(colon + 1).trim().replace(/^['"]|['"]$/g, "")
    if (key && val) result[key] = val
  }
  return result
}

export function loadModeContent(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, "utf-8")
    return content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim() || null
  } catch (e) {
    console.error("[amplifier] loadModeContent failed:", (e as Error).message)
    return null
  }
}
