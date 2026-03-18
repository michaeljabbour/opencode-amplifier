# opencode-amplifier

[OpenCode](https://opencode.ai) plugin that brings [amplifier-core](https://github.com/anomalyco/amplifier-core) kernel primitives to any OpenCode project.

**Zero dependencies. Zero core modifications. One file.**

## What it does

| Feature | How |
|---------|-----|
| **Kernel session** | Manages an amplifier session with coordinator, hooks, and cancellation |
| **Tool gating** | Every tool call passes through `tool:pre` / `tool:post` hooks |
| **LLM gating** | Every LLM call passes through `provider:pre` hooks |
| **Context injection** | Bundle-composed context from amplifier-foundation (not hardcoded) |
| **Bundle resolution** | Resolves amplifier-foundation bundles (optional, requires Python) |
| **Provider mapping** | Maps bundle providers to OpenCode's provider system |
| **Dedicated CLI tools** | First-class tools for every amplifier command with typed args |
| **Active state tracking** | Tracks active bundle, mode, and provider on the kernel |

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

### Alternative: Drop-in file

```bash
mkdir -p .opencode/plugins
curl -fsSL https://raw.githubusercontent.com/michaeljabbour/opencode-amplifier/main/src/index.ts \
  -o .opencode/plugins/amplifier.ts
```

### Alternative: Local development

```jsonc
{
  "plugin": ["file:///path/to/opencode-amplifier"]
}
```

## Usage

Start OpenCode normally:

```bash
opencode
```

The plugin loads automatically. Verify with:

```
> Use the amplifier_status tool
```

### Available tools

| Tool | Description |
|------|-------------|
| `amplifier_status` | Show kernel status: session, active bundle/mode/provider, capabilities, hooks |
| `amplifier_capability` | Get, set, or list capabilities on the coordinator |
| `amplifier_emit` | Emit a hook event and return the aggregated result |
| `amplifier_bundle_resolve` | Resolve an amplifier-foundation bundle and show its mount plan |
| `amplifier_init` | Initialize amplifier in the current project |
| `amplifier_doctor` | Diagnose configuration issues (with optional `--fix`) |
| `amplifier_bundle_list` | List all available bundles |
| `amplifier_bundle_show` | Show bundle details (mount plan, tools, agents, context) |
| `amplifier_bundle_use` | Switch the active bundle |
| `amplifier_agents_list` | List available agents/experts |
| `amplifier_agents_show` | Show agent details and instructions |
| `amplifier_provider_list` | List configured providers |
| `amplifier_provider_use` | Switch the active provider |
| `amplifier_settings_get` | Show current settings |
| `amplifier_settings_set` | Update a setting |
| `amplifier_mode` | Switch mode (plan, review, code, debug, etc.) |
| `amplifier_cli` | Escape hatch: run any amplifier CLI command |

### Hook integration

The plugin hooks into OpenCode's lifecycle automatically:

- `tool.execute.before` / `tool.execute.after` — kernel gates every tool call
- `chat.params` — kernel gates every LLM call
- `experimental.chat.system.transform` — kernel injects bundle-composed context
- `shell.env` — injects bundle provider API keys
- `event` — forwards all OpenCode events to the kernel

### Active state tracking

The kernel tracks active state on the coordinator:

- `active.bundle` — set on init, updated by `amplifier_bundle_use`
- `active.mode` — defaults to `"default"`, updated by `amplifier_mode`
- `active.provider` — set from bundle, updated by `amplifier_provider_use`

All reported by `amplifier_status`.

### System context

When `amplifier-foundation` is installed, the plugin loads the real system context at startup:
- `common-system-base.md` — shared base prompt
- `delegation-instructions.md` — agent delegation rules
- Agent summaries from frontmatter

When foundation is **not** installed, the fallback is minimal tool-awareness — no hardcoded identity or agent tables.

### Bundle providers

When amplifier-foundation is installed (`pip install amplifier-foundation`), the plugin resolves bundles at startup and maps providers:

| Bundle module | OpenCode provider |
|--------------|-------------------|
| `provider-anthropic` | `anthropic` |
| `provider-openai` | `openai` |
| `provider-google` | `google` |
| `provider-mistral` | `mistral` |
| `provider-groq` | `groq` |
| `provider-deepseek` | `deepseek` |
| ... | ... |

API keys from bundle configs are injected as environment variables automatically.

## Architecture

```
OpenCode (stock, unmodified)
  │
  └── plugin: opencode-amplifier (npm or local file)
        │
        ├── AmplifierSession (pure TS)
        │     ├── Coordinator
        │     │     ├── HookRegistry (priority-based dispatch)
        │     │     ├── CancellationToken (state machine)
        │     │     └── Capabilities (key-value store, tracks active state)
        │     └── Session lifecycle
        │
        ├── Bundle Resolution (Python subprocess, optional)
        │     └── amplifier-foundation (context, agents, providers)
        │
        └── CLI Tools (17 dedicated tools with typed arg schemas)
              └── amplifier-app-cli
```

### Application Integration

This plugin follows the [Application Integration Guide](https://github.com/microsoft/amplifier-foundation/blob/main/docs/APPLICATION_INTEGRATION_GUIDE.md):

| Lifecycle Step | Plugin mapping |
|---------------|----------------|
| **LOAD** | `resolveBundleOrDefault("foundation")` at plugin init |
| **PREPARE** | Python subprocess calls `bundle.prepare()` |
| **CREATE** | `new AmplifierSession()` |
| **MOUNT** | Tools registered via OpenCode plugin hooks |
| **HOOK** | Plugin hooks map to kernel events |
| **EXECUTE** | OpenCode's session loop calls through kernel gates |

| Protocol Point | OpenCode equivalent |
|---------------|---------------------|
| **ApprovalSystem** | OpenCode's `permission.ask` hook |
| **DisplaySystem** | OpenCode's TUI renders tool output |
| **StreamingHook** | `event` hook forwards bus events |
| **SpawnCapability** | `amplifier_cli` passthrough |

## Development

```bash
git clone https://github.com/michaeljabbour/opencode-amplifier
cd opencode-amplifier

# Link via config for local dev
# Add to opencode.json: "plugin": ["file:///path/to/opencode-amplifier"]
```

The entire plugin is one file (`src/index.ts`). Edit it directly.

## Requirements

- [OpenCode](https://opencode.ai) (any version with plugin support)
- Optional: `amplifier-foundation` Python package (for bundle resolution and context)
- Optional: `amplifier` CLI (for dedicated CLI tools)

## License

MIT
