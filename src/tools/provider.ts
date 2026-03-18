/**
 * Provider tools.
 *
 * Phase 1: preserved from CLI passthrough in src/index.ts.
 * Phase 3: replace with runtime listProviders() API.
 */

import { tool } from "@opencode-ai/plugin"
import type { Coordinator } from "../kernel/session.js"

type RunCli = (command: string, cwd: string) => Promise<string>

export function buildProviderTools(coord: Coordinator, runCli: RunCli) {
  return {
    amplifier_provider_list: tool({
      description: "List all configured amplifier providers with their status and active model.",
      args: {},
      async execute(_args, ctx) {
        return runCli("provider list", ctx.directory)
      },
    }),

    amplifier_provider_use: tool({
      description: "Switch the active amplifier provider.",
      args: {
        name: tool.schema.string().describe("Provider name (e.g. 'anthropic', 'openai', 'google')"),
      },
      async execute(args, ctx) {
        const result = await runCli(`provider use ${args.name}`, ctx.directory)
        if (!result.startsWith("error:")) coord.registerCapability("active.provider", args.name)
        return result
      },
    }),
  }
}
