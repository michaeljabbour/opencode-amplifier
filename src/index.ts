/**
 * opencode-amplifier — thin compatibility entrypoint.
 *
 * This file is the OpenCode plugin entry point (referenced in package.json
 * "exports" and in users' opencode.json "plugin" arrays). It re-exports the
 * plugin function from src/plugin/index.ts.
 *
 * Do not add logic here. All plugin behavior lives in src/plugin/.
 */

import { createAmplifierPlugin } from "./plugin/index.js"

export default createAmplifierPlugin()
