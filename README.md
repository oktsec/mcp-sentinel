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

**MCP Inspector fixes that.** One command, zero config, instant security visibility.

```bash
npx mcp-inspector npx @modelcontextprotocol/server-github
```

## Demo

```
🔍 MCP Inspector v0.1.0

📦 Server: github-mcp-server v0.1.0 | Tools: 12

🔧 Tools detected

  ✅ get_file_contents       Read files from a repository
  ✅ list_commits             List commits in a repository
  ✅ search_repositories      Search for GitHub repositories
  ⚠️ delete_repository       Delete a repository [DESTRUCTIVE]
  ⚠️ push_files              Write files to repo [WRITE ACCESS]
  ⚠️ create_or_update_file   Create or update a single file [WRITE ACCESS]

🟡 Risk: MEDIUM

  • 1 destructive operation detected
  • 2 tools with write access
  • Possible environment dependencies: GITHUB_TOKEN

Scanned in 1842ms

🛡️  Deep scan: https://aguarascan.com
```

## Why

MCP servers are the new npm packages for AI agents. You `npm install` them into your workflow and hope for the best. But unlike npm packages:

- There's no `package.json` showing what they access
- There's no permission model — a server can expose `delete_everything` and your agent will call it
- Most developers never read the tool list before granting access

MCP Inspector gives you **instant visibility** into what any MCP server can do, before you let it anywhere near your environment.

## Install & Use

```bash
# No install needed — just run it
npx mcp-inspector <command> [args...]
```

### Examples

```bash
# Scan popular MCP servers
npx mcp-inspector npx @modelcontextprotocol/server-github
npx mcp-inspector npx @modelcontextprotocol/server-filesystem /tmp
npx mcp-inspector npx @modelcontextprotocol/server-postgres postgres://localhost/mydb

# Scan your own server
npx mcp-inspector node ./my-server.js

# JSON output for CI/CD pipelines
npx mcp-inspector --json npx @modelcontextprotocol/server-github

# Custom timeout
npx mcp-inspector --timeout 10000 npx @modelcontextprotocol/server-github
```

## What It Detects

| Category | Patterns | Example |
|----------|----------|---------|
| **Destructive** | delete, remove, drop, destroy, purge | `delete_repository` |
| **Code Execution** | exec, shell, bash, eval, spawn | `run_command` |
| **Write Access** | write, create, update, push, upload | `push_files` |
| **Network** | fetch, http, request, webhook, send | `send_webhook` |
| **Credentials** | token, secret, password, api_key | `GITHUB_TOKEN` in descriptions |

## Risk Levels

| Level | When | What it means |
|-------|------|---------------|
| 🟢 **LOW** | Read-only tools, no risky patterns | Safe to use with minimal concern |
| 🟡 **MEDIUM** | Destructive ops or write+network combo | Review before granting access |
| 🔴 **HIGH** | Code execution or 3+ destructive ops | Requires careful audit before use |

## Options

| Flag | Description |
|------|-------------|
| `--json` | Structured JSON output for scripting and CI |
| `--no-color` | Disable colored output |
| `--timeout <ms>` | Connection timeout in ms (default: 30000) |
| `-h, --help` | Show help |
| `-v, --version` | Show version |

## Roadmap

- [ ] Scan multiple servers in one command
- [ ] Export reports as Markdown
- [ ] GitHub Action for CI/CD integration
- [ ] VS Code extension
- [ ] Diff mode: compare two versions of the same server
- [ ] Registry integration (Smithery, mcp.run)

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## License

[MIT](LICENSE) — Gustavo Aragon ([@oktsec](https://github.com/oktsec))
