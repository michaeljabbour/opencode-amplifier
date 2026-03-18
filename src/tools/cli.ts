/**
 * CLI escape hatch.
 *
 * Phase 1: preserved as-is from src/index.ts.
 * Not the primary parity mechanism.
 */

import { exec } from "child_process"
import { tool } from "@opencode-ai/plugin"

function runCli(command: string, cwd: string): Promise<string> {
  return new Promise<string>((resolve) => {
    exec(`amplifier ${command}`, { cwd, timeout: 30000, env: { ...process.env, FORCE_COLOR: "0" } },
      (err, stdout, stderr) => resolve(err ? `error: ${stderr.trim() || err.message}` : stdout.trim() || "(no output)"))
  })
}

export function buildCliTool(_runCli?: (cmd: string, cwd: string) => Promise<string>) {
  const executeCli = _runCli ?? runCli

  return {
    amplifier_cli: tool({
      description: "Run any amplifier CLI command not covered by dedicated tools. Escape hatch for advanced usage.",
      args: {
        command: tool.schema.string().describe("CLI command after 'amplifier' (e.g. 'config show', 'cache clear')"),
      },
      async execute(args, ctx) {
        return executeCli(args.command, ctx.directory)
      },
    }),
  }
}
