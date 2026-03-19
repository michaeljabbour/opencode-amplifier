/**
 * Tools barrel. Import all tool builders here so src/plugin/index.ts
 * has a single import point.
 *
 * Phase 1 keeps these builders as mechanical extractions from src/index.ts.
 * Later phases will replace CLI passthrough and cache reads with runtime APIs.
 */

// Shared type for injected CLI runner used by bundle, provider, settings, and diagnostics tools.
// Phase 3: this type disappears when CLI passthrough is replaced with runtime API calls.
export type RunCli = (command: string, cwd: string) => Promise<string>

export { buildStatusTools } from "./status.js"
export { buildBundleTools } from "./bundle.js"
export { buildProviderTools } from "./provider.js"
export { buildModeTools } from "./mode.js"
export { buildSettingsTools } from "./settings.js"
export { buildDiagnosticsTools } from "./diagnostics.js"
export { buildCliTool } from "./cli.js"
