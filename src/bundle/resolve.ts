/**
 * Bundle resolution via Python subprocess.
 *
 * Phase 1: preserved from src/index.ts for compatibility.
 * Phase 2: replace with a runtime API call to listBundles() + prepareProfile().
 * Phase 3: remove the Python subprocess entirely.
 */

import { runPython } from "./_python.js"

export interface BundleConfig {
  name: string
  mount_plan: {
    tools: { name: string; module: string; transport: string }[]
    providers: { name: string; module: string; transport: string; config?: Record<string, unknown> }[]
    hooks: { event: string; module: string; transport: string; priority?: number }[]
    context: { name: string; module: string; transport: string }[]
  }
}

export async function resolveBundle(bundleName: string, settings?: Record<string, unknown>): Promise<BundleConfig> {
  const settingsJson = JSON.stringify(settings ?? {})
  const raw = await runPython(`
import json, sys, asyncio
async def main():
    try:
        from amplifier_foundation import BundleRegistry
        registry = BundleRegistry()
        bundle = await registry.load(${JSON.stringify(bundleName)})
        if ${JSON.stringify(settingsJson)} != "{}":
            bundle = bundle.with_settings(json.loads(${JSON.stringify(settingsJson)}))
        prepared = await bundle.prepare()
        print(json.dumps({
            "name": prepared.name,
            "mount_plan": {
                "tools": [{"name": t.name, "module": t.module, "transport": t.transport} for t in prepared.tools],
                "providers": [{"name": p.name, "module": p.module, "transport": p.transport} for p in prepared.providers],
                "hooks": [{"event": h.event, "module": h.module, "transport": h.transport} for h in prepared.hooks],
                "context": [{"name": c.name, "module": c.module, "transport": c.transport} for c in prepared.context],
            },
        }))
    except Exception as e:
        print(json.dumps({"error": str(e)})); sys.exit(1)
asyncio.run(main())
`)
  const r = JSON.parse(raw)
  if (r.error) throw new Error(r.error)
  return r
}

export async function resolveBundleOrDefault(name: string, settings?: Record<string, unknown>): Promise<BundleConfig> {
  try { return await resolveBundle(name, settings) }
  catch {
    return { name, mount_plan: { tools: [], providers: [], hooks: [], context: [] } }
  }
}
