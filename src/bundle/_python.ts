/**
 * Private subprocess helper for bundle resolution and context loading.
 * Phase 1/2 transitional — replaced in Phase 3 when Python subprocesses are removed.
 */
import { spawn } from "child_process"

export function runPython(script: string, timeout = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("python3", ["-c", script], { stdio: ["pipe", "pipe", "pipe"], timeout })
    let stdout = "", stderr = ""
    proc.stdout.on("data", (d: Buffer) => { stdout += d })
    proc.stderr.on("data", (d: Buffer) => { stderr += d })
    proc.on("close", (code) => {
      if (code !== 0) {
        const lines = stderr.trim().split("\n")
        const summary = lines.at(-1)?.trim() || `exit ${code}`
        return reject(new Error(summary))
      }
      resolve(stdout.trim())
    })
    proc.on("error", (e) => reject(new Error(`python: ${e.message}`)))
  })
}
