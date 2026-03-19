/**
 * Settings tools.
 *
 * Phase 1: preserved from CLI passthrough in src/index.ts.
 * Phase 3: replace with runtime settings API.
 */

import { tool } from "@opencode-ai/plugin"
import type { RunCli } from "./index.js"

export function buildSettingsTools(runCli: RunCli) {
  return {
    amplifier_settings_get: tool({
      description: "Show current amplifier settings.",
      args: {
        key: tool.schema.string().optional().describe("Specific setting key to get (omit for all settings)"),
      },
      async execute(args, ctx) {
        return runCli(`settings get${args.key ? ` ${args.key}` : ""}`, ctx.directory)
      },
    }),

    amplifier_settings_set: tool({
      description: "Update an amplifier setting.",
      args: {
        key: tool.schema.string().describe("Setting key"),
        value: tool.schema.string().describe("Setting value"),
      },
      async execute(args, ctx) {
        return runCli(`settings set ${args.key} ${args.value}`, ctx.directory)
      },
    }),
  }
}
