<p align="center">
  <h1 align="center">MCP Inspector</h1>
  <p align="center">
    <strong>Know what you're trusting before you run it.</strong>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/mcp-inspector"><img src="https://img.shields.io/npm/v/mcp-inspector.svg" alt="npm version"></a>
    <a href="https://github.com/oktsec/mcp-inspector/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/mcp-inspector.svg" alt="license"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/mcp-inspector.svg" alt="node version"></a>
  </p>
</p>

---

Every developer using AI agents adds MCP servers to their setup. These servers run **third-party code** with access to your files, credentials, and shell. Nobody audits them before trusting them.

**MCP Inspector connects to any MCP server and shows you exactly what it exposes.** One command, zero config, instant visibility.

```bash
npx mcp-inspector npx @modelcontextprotocol/server-github
```

## Demo

```
🔍 MCP Inspector v0.1.0

📦 Server: github-mcp-server v0.1.0 | Tools: 12
   8 read • 3 write • 1 admin

🔧 Tools

  ✅ get_file_contents       Read files from a repository
  ✅ list_commits             List commits in a repository
  ✅ search_repositories      Search for GitHub repositories
  ✏️ push_files              Write files to repo [WRITE]
  ✏️ create_or_update_file   Create or update a single file [WRITE]
  ⚠️ delete_repository       Delete a repository [ADMIN]

🛡️  Aguara Security Analysis

  CRITICAL MCP_001  Tool description injection
  HIGH     EXFIL_002 Sensitive file read pattern

  Found 2 issues: 1 critical, 1 high

Scanned in 1842ms

🌐 Deep scan: https://aguarascan.com
```

## Why

MCP servers are the new npm packages for AI agents. You `npm install` them into your workflow and hope for the best. But unlike npm packages:

- There's no `package.json` showing what they access
- There's no permission model — a server can expose `delete_everything` and your agent will call it
- Most developers never read the tool list before granting access

MCP Inspector gives you **runtime introspection** — it connects to the live server, lists every tool it exposes, and categorizes them by capability (read, write, admin).

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
│ Connect   │         └────────────────┘
│ Introspect│
│ Categorize│         ┌──────────────────┐
│ Diff      │ ──────► │  Aguara (if       │
│ Report    │         │  installed)       │
└───────────┘         │  177 rules, NLP,  │
                      │  toxic-flow       │
                      └──────────────────┘
```

**MCP Inspector** handles runtime introspection (connect, list, categorize).
**[Aguara](https://github.com/garagon/aguara)** handles deep security analysis (prompt injection, exfiltration, supply chain, credential leaks).

When Aguara is installed, MCP Inspector automatically passes tool descriptions through it. When it's not, you still get full tool visibility with a link to install Aguara.

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
npx mcp-inspector node ./my-server.js

# Scan all servers from your config (Claude Desktop, Cursor, Windsurf, etc.)
npx mcp-inspector --config

# Scan remote servers via HTTP
npx mcp-inspector http://localhost:3000/mcp
npx mcp-inspector http://localhost:3000/sse --transport sse

# Scan multiple servers at once
npx mcp-inspector npx @mcp/server-a --- npx @mcp/server-b

# Diff mode: detect runtime changes
npx mcp-inspector npx @mcp/server --json > baseline.json
npx mcp-inspector npx @mcp/server --diff baseline.json

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

MCP Inspector auto-detects Aguara and runs its 177-rule engine against tool descriptions. No extra flags needed.

## Tool Categories

MCP Inspector categorizes every tool by capability:

| Category | Icon | Meaning |
|----------|------|---------|
| **read** | ✅ | Read-only operations (list, get, search) |
| **write** | ✏️ | Can modify state (create, update, push, upload) |
| **admin** | ⚠️ | Destructive or execution capability (delete, exec, shell) |

This is **categorization for visibility**, not security analysis. For security, use Aguara.

## Options

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON output for scripting and CI |
| `--markdown <file>` | Export report as Markdown file |
| `--diff <file.json>` | Compare against a previous JSON scan |
| `--transport <type>` | Force transport: `stdio`, `sse`, `streamable-http` |
| `--config` | Auto-detect and scan servers from config files |
| `--fail-on-findings` | Exit code 2 if aguara finds security issues (for CI) |
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
| **MCP Inspector** | Runtime introspection — connect to any MCP server, see what it exposes |
| **[Aguara Watch](https://aguarascan.com)** | Cloud platform — continuous monitoring of MCP registries |

## Roadmap

- [x] Connect to any MCP server via stdio
- [x] Tool categorization (read/write/admin)
- [x] Aguara integration for deep analysis
- [x] Multi-server scanning
- [x] Markdown report export
- [x] JSON output
- [x] GitHub Actions CI
- [x] HTTP/SSE transport support
- [x] Diff mode: compare server versions
- [x] Config file auto-detection (Claude Desktop, Cursor, Windsurf, etc.)
- [ ] Registry integration (Smithery, mcp.run)
- [ ] VS Code extension

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
