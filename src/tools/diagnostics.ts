/**
 * Diagnostics tools.
 *
 * amplifier_doctor is a first-class UX surface and should always work even
 * when the runtime is unavailable.
 */

import { tool } from "@opencode-ai/plugin"

type RunCli = (command: string, cwd: string) => Promise<string>

export function buildDiagnosticsTools(runCli: RunCli) {
  return {
    amplifier_init: tool({
      description: "Initialize amplifier in the current project. Creates config files and sets up the project for amplifier usage.",
      args: {
        wizard: tool.schema.boolean().optional().describe("Run interactive setup wizard"),
      },
      async execute(args, ctx) {
        return runCli(`init${args.wizard ? " --wizard" : ""}`, ctx.directory)
      },
    }),

    amplifier_doctor: tool({
      description: "Diagnose amplifier configuration issues. Checks installation, config, providers, and connectivity.",
      args: {
        fix: tool.schema.boolean().optional().describe("Automatically fix issues found"),
      },
      async execute(args, ctx) {
        return runCli(`doctor${args.fix ? " --fix" : ""}`, ctx.directory)
      },
    }),
  }
}
