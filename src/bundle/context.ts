/**
 * Bundle context loading — extracts system prompt, agent definitions, and
 * context files from amplifier-foundation.
 *
 * Phase 1: preserved from src/index.ts for compatibility.
 * Phase 2: replace with runtime event stream projection.
 */

import { runPython } from "./_python.js"
import type { BundleConfig } from "./resolve.js"

export async function loadBundleContext(bundle: BundleConfig): Promise<string | null> {
  try {
    const raw = await runPython(`
import json, os, importlib.resources

pkg_path = str(importlib.resources.files("amplifier_foundation"))
parts = []

# Load core system context files
for rel in [
    "context/shared/common-system-base.md",
    "context/agents/delegation-instructions.md",
]:
    path = os.path.join(pkg_path, rel)
    if os.path.exists(path):
        with open(path) as f:
            parts.append(f.read())

# Load agent summaries (name + description from frontmatter)
agents_dir = os.path.join(pkg_path, "agents")
summaries = []
if os.path.isdir(agents_dir):
    for fname in sorted(os.listdir(agents_dir)):
        if not fname.endswith(".md"):
            continue
        name = fname.replace(".md", "")
        desc = ""
        with open(os.path.join(agents_dir, fname)) as f:
            in_fm = False
            for line in f:
                line = line.strip()
                if line == "---":
                    in_fm = not in_fm
                    continue
                if in_fm and line.startswith("description:"):
                    desc = line.split("description:", 1)[1].strip().strip("'\\"")
                    break
        if desc:
            summaries.append(f"- foundation:{name}: {desc}")

if summaries:
    parts.append("# Available Agents\\n\\n" + "\\n".join(summaries))

print(json.dumps({"context": "\\n\\n---\\n\\n".join(parts) if parts else None}))
`, 15000)
    const r = JSON.parse(raw)
    return r.context ?? fallbackContext()
  } catch (e) {
    console.error("[amplifier] loadBundleContext failed:", (e as Error).message)
    return fallbackContext()
  }
}

export function fallbackContext(): string {
  return `You have amplifier tools available. Use them to answer questions about amplifier capabilities, agents, bundles, and modes. When the user types a slash command like /brainstorm, /plan, /debug, or /modes, use the amplifier_mode or amplifier_modes_list tool to handle it.`
}
