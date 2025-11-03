# OpenCode-Amplifier

**A minimal MCP bridge that lets you use Microsoft Amplifier scenarios directly from OpenCode.ai**

<!-- mcp-name: io.github.michaeljabbour/opencode-amplifier -->

This project provides a lightweight, maintainable integration between [OpenCode.ai](https://opencode.ai) and [Microsoft Amplifier](https://github.com/microsoft/amplifier) using the Model Context Protocol (MCP). It automatically discovers your Amplifier scenarios and exposes them as native tools in OpenCode.

---

## Why MCP?

After evaluating direct hooks vs. MCP integration, **MCP is the superior approach** because:

1. **Clean Separation**: Protocol-based boundary means changes to either project won't break the integration
2. **Native Support**: OpenCode is built around MCP as its primary extension mechanism
3. **Maintainability**: The MCP contract (tools/list, tools/call) is stable across versions
4. **Reusability**: Works with any MCP client, not just OpenCode
5. **Simplicity**: No need to modify either codebase

This implementation is intentionally minimal—a single JavaScript file that auto-discovers scenarios and requires zero manual registration.

---

## Quick Start

### 1. Install

#### From NPM (Recommended)

```bash
npm install -g opencode-amplifier
```

#### From MCP Registry

This server is available in the official MCP Registry:
- **Registry Name**: `io.github.michaeljabbour/opencode-amplifier`
- **Package**: `opencode-amplifier` on npm

#### From Source

```bash
# Clone this repository
git clone https://github.com/michaeljabbour/opencode-amplifier.git
cd opencode-amplifier

# Install dependencies
npm install
```

### 2. Configure OpenCode

Add to `~/.opencode/config.json`:

#### If installed globally via npm:

```json
{
  "mcp": {
    "amplifier": {
      "type": "local",
      "command": ["npx", "opencode-amplifier"],
      "environment": {
        "AMPLIFIER_PATH": "/path/to/amplifier",
        "PYTHON_PATH": "/path/to/amplifier/.venv/bin/python3"
      },
      "enabled": true
    }
  }
}
```

#### If running from source:

```json
{
  "mcp": {
    "amplifier": {
      "type": "local",
      "command": ["node", "/path/to/opencode-amplifier/server.js"],
      "environment": {
        "AMPLIFIER_PATH": "/path/to/amplifier",
        "PYTHON_PATH": "/path/to/amplifier/.venv/bin/python3"
      },
      "enabled": true
    }
  }
}
```

### 3. Use

```bash
opencode
```

All your Amplifier scenarios are now available as `amplifier_*` tools!

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  OpenCode.ai                                                 │
│    ↓ (discovers tools via MCP)                              │
│  opencode-amplifier/server.js                               │
│    ↓ (auto-discovers scenarios)                             │
│  amplifier/scenarios/*                                       │
│    ↓ (executes as Python subprocesses)                      │
│  Results streamed back to OpenCode                          │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**

- **Zero Configuration**: Automatically discovers all scenarios in your Amplifier installation
- **Parameter Parsing**: Extracts CLI parameters from Click decorators
- **Error Handling**: Comprehensive error messages and timeout protection
- **Logging**: Configurable logging to stderr (doesn't interfere with MCP protocol)
- **Single File**: The entire server is ~300 lines of readable JavaScript

---

## Configuration

Environment variables (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `AMPLIFIER_PATH` | `../amplifier` | Path to Amplifier installation |
| `PYTHON_PATH` | `python3` | Python interpreter (use venv path) |
| `TIMEOUT` | `300000` | Execution timeout in milliseconds |
| `LOG_LEVEL` | `INFO` | Logging level (DEBUG, INFO, WARN, ERROR) |

---

## Maintenance

### As Amplifier Evolves

**No changes needed!** The server automatically:
- Discovers new scenarios when they're added
- Parses parameter changes from Click decorators
- Handles scenario renames/removals gracefully

### As OpenCode Evolves

The MCP protocol is stable. As long as OpenCode supports MCP (which is core to its design), this integration will work.

### Upgrading

```bash
cd opencode-amplifier
git pull
npm install  # Only if MCP SDK updates
```

---

## Testing

Run the test suite to verify everything works:

```bash
npm test
```

Or manually test the server:

```bash
# Start server
AMPLIFIER_PATH=/path/to/amplifier \
PYTHON_PATH=/path/to/amplifier/.venv/bin/python3 \
LOG_LEVEL=DEBUG \
node server.js

# In another terminal, send MCP request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node server.js
```

---

## Troubleshooting

### Server won't start

```bash
# Check paths
ls $AMPLIFIER_PATH/scenarios
$PYTHON_PATH --version

# Enable debug logging
LOG_LEVEL=DEBUG node server.js
```

### Scenarios not discovered

```bash
# Ensure scenarios have main.py or __main__.py
find $AMPLIFIER_PATH/scenarios -name "main.py" -o -name "__main__.py"
```

### Execution fails

```bash
# Test scenario manually
cd $AMPLIFIER_PATH
$PYTHON_PATH -m scenarios.web_to_md --help
```

---

## Architecture Decisions

### Why Single File?

**Simplicity over abstraction.** The entire integration is ~300 lines. Splitting into modules would add complexity without meaningful benefits. If you need to understand or modify the code, it's all in one place.

### Why JavaScript not TypeScript?

**Zero build step.** No compilation, no type checking delays. Just `node server.js` and it works. For a bridge this simple, the type safety benefits don't justify the build complexity.

### Why Not Direct Hooks?

**Maintainability.** Direct hooks would require:
- Modifying OpenCode's core (breaks on updates)
- Tight coupling to internal APIs (breaks on refactors)
- Custom discovery logic in OpenCode (duplicates work)

MCP provides a stable contract that both projects already support.

---

## Contributing

This project is intentionally minimal. Before adding features, ask:

1. Does this belong in Amplifier itself?
2. Does this belong in OpenCode itself?
3. Is this truly necessary for the bridge?

If yes to #3, keep it simple. PRs welcome!

---

## MCP Registry

This server is registered in the official Model Context Protocol Registry:

- **Registry Name**: `io.github.michaeljabbour/opencode-amplifier`
- **Namespace**: `io.github.michaeljabbour/*`
- **Package Type**: npm
- **Schema Version**: 2025-09-29

### Publishing Updates

To publish a new version to the registry:

1. Update the version in both `package.json` and `server.json`
2. Publish to npm: `npm publish`
3. Use the MCP Registry CLI to publish:
   ```bash
   npx mcp-publisher login github
   npx mcp-publisher publish server.json
   ```

The registry validates that:
- The `mcpName` field in package.json matches the server name
- The npm package is published and accessible
- The namespace ownership is verified via GitHub authentication

---

## License

MIT

---

## References

- [OpenCode.ai](https://opencode.ai)
- [Microsoft Amplifier](https://github.com/microsoft/amplifier)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [MCP Registry](https://registry.modelcontextprotocol.io)
