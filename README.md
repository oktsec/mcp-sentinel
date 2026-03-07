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
npx mcp-inspector --policy .mcp-policy.yml npx @modelcontextprotocol/server-github
```

## Demo

```
🔍 MCP Inspector v0.1.0

📦 Server: github-mcp-server v0.1.0
   Capabilities: tools

🔧 Tools (12)  8 read • 3 write • 1 admin

  ✅ get_file_contents       Read files from a repository
  ✅ search_repositories      Search for GitHub repositories
  ✏️ push_files              Write files to repo [write]
  ⚠️ delete_repository       Delete a repository [admin]

🛡️  Policy: .mcp-policy.yml

  ❌ github-mcp-server: policy FAILED (2 violations)

     ✖ [deny.categories] Tool 'delete_repository' has denied category 'admin'
     ✖ [deny.tools] Tool 'push_files' matches denied pattern 'push_*'
```

**Exit code 2** — your CI pipeline stops here.

## Why

Every MCP client already shows you the tool list. MCP Inspector goes further:

| Feature | MCP Client | MCP Inspector |
|---------|-----------|---------------|
| See tool list | Yes | Yes |
| Security policy enforcement | No | **Yes** |
| CI/CD pipeline gate | No | **Yes** |
| Drift detection between versions | No | **Yes** |
| Fleet scan (all configured servers) | No | **Yes** |
| Deep security analysis (aguara) | No | **Yes** |
| Exportable reports (JSON/Markdown) | No | **Yes** |

## Policy Enforcement

Define what's allowed in `.mcp-policy.yml`:

```yaml
# Block dangerous capabilities
deny:
  categories:
    - admin                    # No admin tools (delete, exec, shell)
  tools:
    - "execute_*"              # Block all execution patterns
    - "push_*"                 # Block push operations

# Requirements
require:
  aguara: clean                # Zero security findings required
  maxTools: 20                 # Limit attack surface

# Exceptions
allow:
  tools:
    - "execute_query"          # Allow specific tools even if pattern-denied
```

Run it:

```bash
# Explicit policy file
npx mcp-inspector --policy .mcp-policy.yml npx @mcp/server

# Auto-detect .mcp-policy.yml in current directory
npx mcp-inspector --policy npx @mcp/server

# CI pipeline: fail build on policy violations (exit code 2)
npx mcp-inspector --policy .mcp-policy.yml npx @mcp/server
```

### Policy Rules

| Rule | Description |
|------|-------------|
| `deny.categories` | Block tools by category: `read`, `write`, `admin` |
| `deny.tools` | Block tools by name or glob pattern (`delete_*`, `exec*`) |
| `require.aguara` | Require aguara scan with zero findings (`clean`) |
| `require.maxTools` | Maximum number of tools a server can expose |
| `allow.tools` | Exception list — allow specific tools even if they match deny rules |

## How it works

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

## Install & Use

```bash
# No install needed — just run it
npx mcp-inspector <command> [args...]
```

### Examples

```bash
# Scan any MCP server
npx mcp-inspector npx @modelcontextprotocol/server-github
npx mcp-inspector npx @modelcontextprotocol/server-filesystem /tmp

# Enforce a security policy (exit code 2 on violations)
npx mcp-inspector --policy .mcp-policy.yml npx @mcp/server

# Scan all servers from your config (Claude Desktop, Cursor, Windsurf)
npx mcp-inspector --config

# Scan remote servers via HTTP
npx mcp-inspector http://localhost:3000/mcp

# Diff mode: detect runtime changes
npx mcp-inspector npx @mcp/server --json > baseline.json
npx mcp-inspector npx @mcp/server --diff baseline.json

# Scan multiple servers at once
npx mcp-inspector npx @mcp/server-a --- npx @mcp/server-b

# JSON output for CI/CD pipelines
npx mcp-inspector --json npx @modelcontextprotocol/server-github

# Export as Markdown report
npx mcp-inspector --markdown report.md npx @modelcontextprotocol/server-github
```

### With Aguara (recommended)

Install [Aguara](https://github.com/garagon/aguara) to unlock deep security analysis:

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
| `--json` | Structured JSON output for scripting and CI |
| `--markdown <file>` | Export report as Markdown file |
| `--fail-on-findings` | Exit code 2 if aguara finds security issues |
| `--no-color` | Disable colored output |
| `--timeout <ms>` | Connection timeout in ms (default: 30000) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Ecosystem

MCP Inspector is part of the [Aguara](https://github.com/garagon/aguara) security ecosystem:

| Tool | What it does |
|------|-------------|
| **[Aguara](https://github.com/garagon/aguara)** | Security scanner — 177 rules, NLP, toxic-flow analysis |
| **[Aguara MCP](https://github.com/garagon/aguara-mcp)** | MCP server — gives AI agents security scanning as a tool |
| **MCP Inspector** | Policy enforcement — audit, enforce, and monitor MCP servers |
| **[Aguara Watch](https://aguarascan.com)** | Cloud platform — continuous monitoring of MCP registries |

## Roadmap

- [x] Connect to any MCP server via stdio
- [x] Tool categorization (read/write/admin)
- [x] Aguara integration for deep analysis
- [x] Multi-server scanning
- [x] HTTP/SSE transport support
- [x] Diff mode: compare server versions
- [x] Config file auto-detection (Claude Desktop, Cursor, Windsurf)
- [x] **Policy enforcement engine**
- [ ] Policy: per-server overrides
- [ ] Registry integration (Smithery, mcp.run)
- [ ] VS Code extension
- [ ] GitHub Action (reusable workflow)

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

See [CONTRIBUTING.md](CONTRIBUTING.md) for development standards.

## License

[MIT](LICENSE) — Gustavo Aragon ([@oktsec](https://github.com/oktsec))
