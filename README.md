# opencode-amplifier

[OpenCode](https://opencode.ai) plugin that connects to a native local Amplifier runtime. Provides Amplifier-mode execution, bundle/profile management, mode switching, provider control, and fail-closed diagnostics from within any OpenCode session.

## What it does

| Layer | Responsibility |
|-------|---------------|
| **opencode-amplifier** (this plugin) | Bootstrap/connect runtime, translate OpenCode UX into runtime calls, render status and diagnostics |
| **Native Amplifier runtime** | Resolve bundles/profiles, create sessions, execute prompts, manage tools/hooks/approvals/orchestration |

## Install

```bash
npm install opencode-amplifier
```

Add to your `opencode.json` or `opencode.jsonc`:

```jsonc
{
  "plugin": ["opencode-amplifier"]
}
```

### Alternative: local development

```jsonc
{
  "plugin": ["file:///path/to/opencode-amplifier"]
}
```

## Available tools

| Tool | Description |
|------|-------------|
| `amplifier_status` | Session state, runtime connection, active bundle/mode/provider |
| `amplifier_capability` | Get, set, or list coordinator capabilities |
| `amplifier_emit` | Emit a kernel hook event |
| `amplifier_bundle_resolve` | Resolve a bundle and show its mount plan |
| `amplifier_bundle_list` | List available bundles |
| `amplifier_bundle_show` | Show bundle details |
| `amplifier_bundle_use` | Switch active bundle |
| `amplifier_bundle_current` | Show currently active bundle |
| `amplifier_agents_list` | List available agents |
| `amplifier_agents_show` | Show agent details |
| `amplifier_provider_list` | List configured providers |
| `amplifier_provider_use` | Switch active provider |
| `amplifier_modes_list` | List available modes |
| `amplifier_mode` | Activate or deactivate a mode |
| `amplifier_settings_get` | Show current settings |
| `amplifier_settings_set` | Update a setting |
| `amplifier_init` | Initialize Amplifier in the current project |
| `amplifier_doctor` | Diagnose configuration and runtime issues |
| `amplifier_cli` | Escape hatch: run any CLI command (diagnostics only) |

## Architecture

```
OpenCode UI surfaces
  -> opencode-amplifier plugin  (src/plugin/index.ts)
    -> runtime client            (src/runtime/client.ts)
      -> transport               (src/runtime/transport.ts)
        -> native Amplifier runtime
    -> bundle resolution         (src/bundle/)
    -> mode discovery            (src/modes/)
    -> provider mapping          (src/providers/)
    -> hooks                     (src/plugin/hooks.ts)
    -> tools                     (src/tools/)
    -> [transitional] kernel     (src/kernel/session.ts)
```

## Development

```bash
git clone https://github.com/michaeljabbour/opencode-amplifier
cd opencode-amplifier
bun install
bun test
```

## Requirements

- [OpenCode](https://opencode.ai) (any version with plugin support)
- Optional: `amplifier-foundation` Python package (bundle resolution)
- Optional: native Amplifier runtime binary (Phase 2+)

## License

MIT
