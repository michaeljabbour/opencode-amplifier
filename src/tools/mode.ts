/**
 * Mode tools.
 *
 * Phase 1: preserved from cache reads in src/index.ts.
 * Phase 3: replace with runtime listModes() API.
 */

import { tool } from "@opencode-ai/plugin"
import type { Coordinator } from "../kernel/session.js"
import type { ModeDefinition } from "../modes/discovery.js"

type LoadModeContent = (filePath: string) => string | null

export function buildModeTools(
  coord: Coordinator,
  availableModes: ModeDefinition[],
  loadModeContent: LoadModeContent,
) {
  let activeModeContext: string | null = null

  const tools = {
    amplifier_modes_list: tool({
      description: "List available modes. Use when the user asks 'what modes are available', '/modes', 'list modes', or wants to know what modes they can use. Modes are behavioral overlays like brainstorm, plan, debug, etc.",
      args: {},
      async execute() {
        if (availableModes.length === 0) return "No modes found. Install a bundle with modes (e.g. 'superpowers') to enable modes."
        const currentMode = coord.getCapability("active.mode")
        const grouped = new Map<string, ModeDefinition[]>()
        for (const m of availableModes) {
          const list = grouped.get(m.source) ?? []
          list.push(m)
          grouped.set(m.source, list)
        }
        const lines = ["Available modes:"]
        for (const [source, modes] of grouped) {
          lines.push(`\n  ${source}:`)
          for (const m of modes) {
            const indicator = m.name === currentMode ? " *" : ""
            lines.push(`    /${m.shortcut}${indicator} — ${m.description || m.name}`)
          }
        }
        if (currentMode && currentMode !== "none") lines.push(`\nActive: ${currentMode}`)
        lines.push("\nUse /mode <name> to activate, /mode off to clear.")
        return lines.join("\n")
      },
    }),

    amplifier_mode: tool({
      description: "Activate or deactivate a mode. Use when the user says '/brainstorm', '/plan', '/debug', '/mode <name>', '/mode off', or any slash command matching a mode name. Modes are behavioral overlays that change how you operate (e.g. brainstorm mode focuses on design refinement, plan mode focuses on implementation planning).",
      args: {
        name: tool.schema.string().describe("Mode name to activate (e.g. 'brainstorm', 'plan', 'debug', 'write-plan', 'execute-plan', 'verify', 'finish', 'explore', 'careful'), or 'off' to clear the active mode"),
      },
      async execute(args) {
        const name = args.name.trim().toLowerCase().replace(/^\//, "")

        if (name === "off" || name === "clear" || name === "none") {
          activeModeContext = null
          coord.registerCapability("active.mode", "none")
          return "Mode cleared."
        }

        const mode = availableModes.find((m) => m.name === name || m.shortcut === name)
        if (!mode) {
          const names = availableModes.map((m) => m.shortcut).join(", ")
          return `Unknown mode: ${name}. Available: ${names || "none (install a bundle with modes)"}`
        }

        const content = loadModeContent(mode.filePath)
        if (!content) return `error: could not load mode content for ${mode.name}`

        activeModeContext = content
        coord.registerCapability("active.mode", mode.name)
        return `Mode: ${mode.name}` + (mode.description ? ` — ${mode.description}` : "")
      },
    }),
  }

  return {
    tools,
    getActiveModeContext() {
      return activeModeContext
    },
  }
}
