<p align="center">
  <h1 align="center">MCP Inspector</h1>
  <p align="center">
    <strong>Audit and enforce security policies on MCP servers before you trust them.</strong>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/mcp-inspector"><img src="https://img.shields.io/npm/v/mcp-inspector.svg" alt="npm version"></a>
    <a href="https://github.com/oktsec/mcp-inspector/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/mcp-inspector.svg" alt="license"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/mcp-inspector.svg" alt="node version"></a>
  </p>
</p>

---

MCP servers run third-party code with access to your files, credentials, and shell. MCP Inspector connects to any server, shows you exactly what it exposes, and **enforces security policies** — blocking dangerous tools before your agent can call them.

```bash
npx mcp-inspector --policy .mcp-policy.yml npx @modelcontextprotocol/server-filesystem /tmp
```

## Real Output

Scanned against the official [MCP filesystem server](https://www.npmjs.com/package/@modelcontextprotocol/server-filesystem):

```
🔍 MCP Inspector v0.1.0

📦 Server: secure-filesystem-server v0.2.0
   Capabilities: tools

🔧 Tools (14)  11 read • 3 write • 0 admin

  ✅ read_file        Read the complete contents of a file as text... (3 params)
     * string   path
       number   tail
       number   head
  ✅ read_text_file   Read the complete contents of a file from... (3 params)
  ✅ read_media_file  Read an image or audio file... (1 params)
  ✅ read_multiple_files  Read multiple files simultaneously... (1 params)
  ✏️ write_file       Create a new file or overwrite an existing... [write] (2 params)
     * string   path
     * string   content
  ✅ edit_file         Make line-based edits to a text file... (3 params)
  ✏️ create_directory  Create a new directory... [write] (1 params)
  ✅ list_directory    Get a detailed listing of all files... (1 params)
  ✏️ move_file         Move or rename files and directories... [write] (2 params)
  ✅ search_files      Recursively search for files... (3 params)
  ✅ get_file_info     Retrieve detailed metadata... (1 params)
  ✅ list_allowed_directories  Returns the list of allowed directories

🛡️  Aguara Security Analysis

  0 finding(s)

Scanned in 1706ms
```

### With Policy Enforcement

Using this policy:

```yaml
# .mcp-policy.yml
deny:
  categories: [admin]
  tools: ["write_*", "move_*"]
require:
  maxTools: 10
allow:
  tools: ["write_file"]   # Allow write_file despite deny pattern
```

```
🛡️  Policy: .mcp-policy.yml

  ❌ secure-filesystem-server: policy FAILED (2 violations)

     ✖ [deny.tools] Tool 'move_file' matches denied pattern 'move_*'
     ✖ [require.maxTools] Server exposes 14 tools, policy allows max 10
```

**Exit code 2** — `write_file` was allowed by the exception, but `move_file` and the tool count violated the policy. Your CI pipeline stops here.

## Why MCP Inspector

Every MCP client already shows you the tool list. MCP Inspector goes further:

| Feature | MCP Client | MCP Inspector |
|---------|-----------|---------------|
| See tool list | Yes | Yes |
| **Security policy enforcement** | No | **Yes** |
| **CI/CD pipeline gate** | No | **Yes** |
| **Drift detection** between versions | No | **Yes** |
| **Fleet scan** all configured servers | No | **Yes** |
| Deep security analysis (aguara) | No | **Yes** |
| Exportable reports (JSON/Markdown) | No | **Yes** |

## Policy Enforcement

Define what's allowed in `.mcp-policy.yml`:

```yaml
deny:
  categories:
    - admin                    # No admin tools (delete, exec, shell)
  tools:
    - "execute_*"              # Block all execution patterns
    - "push_*"                 # Block push operations

require:
  aguara: clean                # Zero security findings required
  maxTools: 20                 # Limit attack surface

allow:
  tools:
    - "execute_query"          # Allow specific tools even if pattern-denied
```

### Policy Rules

| Rule | Description |
|------|-------------|
| `deny.categories` | Block tools by category: `read`, `write`, `admin` |
| `deny.tools` | Block tools by name or glob pattern (`delete_*`, `exec*`) |
| `require.aguara` | Require aguara scan with zero findings (`clean`) |
| `require.maxTools` | Maximum number of tools a server can expose |
| `allow.tools` | Exception list — allow specific tools even if they match deny rules |

### Example Policies

Ready-to-use policies in [`examples/policies/`](examples/policies/):

| Policy | Use case |
|--------|----------|
| [`strict.yml`](examples/policies/strict.yml) | Production — blocks admin + write, requires aguara clean |
| [`standard.yml`](examples/policies/standard.yml) | Development — blocks admin + exec patterns, allows writes |
| [`permissive.yml`](examples/policies/permissive.yml) | Local dev — only blocks destructive patterns (delete, drop, destroy) |
| [`ci-pipeline.yml`](examples/policies/ci-pipeline.yml) | CI/CD — blocks admin + deploy + push, requires aguara clean |

### CI/CD Integration

```yaml
# .github/workflows/mcp-audit.yml
name: MCP Security Audit
on: [pull_request]

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npx mcp-inspector --policy .mcp-policy.yml npx ./your-mcp-server
        # Exit code 2 = policy violations → build fails
```

See full example in [`examples/github-action.yml`](examples/github-action.yml).

## Install & Use

```bash
# No install needed
npx mcp-inspector <command> [args...]
```

### Quick Start

```bash
# 1. Scan a server
npx mcp-inspector npx @modelcontextprotocol/server-filesystem /tmp

# 2. Create a policy
cat > .mcp-policy.yml << 'EOF'
deny:
  categories: [admin]
  tools: ["execute_*", "delete_*"]
require:
  aguara: clean
  maxTools: 20
EOF

# 3. Enforce it
npx mcp-inspector --policy .mcp-policy.yml npx @modelcontextprotocol/server-filesystem /tmp
```

### More Examples

```bash
# Scan remote servers via HTTP
npx mcp-inspector http://localhost:3000/mcp

# Scan all servers from your config (Claude Desktop, Cursor, Windsurf)
npx mcp-inspector --config

# Diff mode: detect changes between server versions
npx mcp-inspector npx @mcp/server --json > baseline.json
npx mcp-inspector npx @mcp/server --diff baseline.json

# Scan multiple servers at once
npx mcp-inspector npx @mcp/server-a --- npx @mcp/server-b

# JSON output for scripting
npx mcp-inspector --json npx @mcp/server

# Markdown report
npx mcp-inspector --markdown report.md npx @mcp/server
```

### With Aguara (recommended)

Install [Aguara](https://github.com/garagon/aguara) for deep security analysis (prompt injection, exfiltration, supply chain, credential leaks):

```bash
curl -fsSL https://raw.githubusercontent.com/garagon/aguara/main/install.sh | bash
```

MCP Inspector auto-detects Aguara and runs its 177-rule engine against tool descriptions. Combine with `require.aguara: clean` in your policy to enforce zero findings.

## Options

| Flag | Description |
|------|-------------|
| `--policy <file>` | Enforce security policy (auto-detects `.mcp-policy.yml`) |
| `--config` | Auto-detect and scan servers from config files |
| `--diff <file.json>` | Compare against a previous JSON scan |
| `--transport <type>` | Force transport: `stdio`, `sse`, `streamable-http` |
| `--json` | Structured JSON output |
| `--markdown <file>` | Export report as Markdown |
| `--fail-on-findings` | Exit code 2 if aguara finds issues |
| `--no-color` | Disable colored output |
| `--timeout <ms>` | Connection timeout (default: 30000) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## How It Works

```
                      ┌────────────────┐
              stdio   │  MCP Server    │
            ┌──────── │  (local)       │
            │         └────────────────┘
┌───────────┤
│ mcp-      │ HTTP/   ┌────────────────┐
│ inspector │ SSE     │  MCP Server    │
│           ├──────── │  (remote)      │
│ Scan      │         └────────────────┘
│ Enforce   │
│ Diff      │         ┌──────────────────┐
│ Report    │ ──────► │  Aguara (177      │
└───────────┘         │  security rules)  │
     │                └──────────────────┘
     ▼
 .mcp-policy.yml
 (deny / require / allow)
```

## Ecosystem

MCP Inspector is part of the [Aguara](https://github.com/garagon/aguara) security ecosystem:

| Tool | What it does |
|------|-------------|
| **[Aguara](https://github.com/garagon/aguara)** | Security scanner — 177 rules, NLP, toxic-flow analysis |
| **[Aguara MCP](https://github.com/garagon/aguara-mcp)** | MCP server — gives AI agents security scanning as a tool |
| **MCP Inspector** | Policy enforcement — audit, enforce, and monitor MCP servers |
| **[Aguara Watch](https://aguarascan.com)** | Cloud platform — continuous monitoring of MCP registries |

## Roadmap

- [x] Runtime introspection (tools, resources, prompts, capabilities)
- [x] **Policy enforcement engine**
- [x] Aguara integration
- [x] HTTP/SSE transport support
- [x] Diff mode
- [x] Config auto-detection (Claude Desktop, Cursor, Windsurf)
- [ ] Per-server policy overrides
- [ ] Registry integration (Smithery, mcp.run)
- [ ] GitHub Action (reusable workflow)
- [ ] VS Code extension

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development standards.

## License

[MIT](LICENSE) — Gustavo Aragon ([@oktsec](https://github.com/oktsec))
