<p align="center">
  <h1 align="center">MCP Sentinel</h1>
  <p align="center">
    <strong>Know what your MCP servers can do — before your AI agent does.</strong>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/mcp-sentinel"><img src="https://img.shields.io/npm/v/mcp-sentinel.svg" alt="npm version"></a>
    <a href="https://github.com/oktsec/mcp-sentinel/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/mcp-sentinel.svg" alt="license"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/mcp-sentinel.svg" alt="node version"></a>
  </p>
</p>

---

## The Problem

You add an MCP server to Claude Desktop, Cursor, or your agent framework. Now that server has tools your AI can call — tools that might read your files, run shell commands, or delete data.

**You're trusting code you haven't reviewed.**

MCP Sentinel connects to any MCP server, shows you every tool it exposes, and lets you define security policies that block dangerous ones automatically.

## Quick Start

```bash
# Scan any MCP server — no install needed
npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp
```

That's it. You'll see every tool the server exposes, categorized by risk:

```
🔍 MCP Sentinel v0.1.0

📦 Server: secure-filesystem-server v0.2.0
   Capabilities: tools

🔧 Tools (14)  11 read · 3 write · 0 admin

  ✅ read_file            Read the complete contents of a file... (3 params)
  ✅ read_multiple_files  Read multiple files simultaneously... (1 params)
  ✏️ write_file           Create a new file or overwrite... [write] (2 params)
  ✏️ create_directory     Create a new directory... [write] (1 params)
  ✏️ move_file            Move or rename files... [write] (2 params)
  ✅ list_directory       Get a detailed listing of all files... (1 params)
  ✅ search_files         Recursively search for files... (3 params)
  ...

Scanned in 1706ms
```

## Add a Security Policy

Create a `.mcp-policy.yml` in your project root:

```yaml
deny:
  categories: [admin]           # Block dangerous tools (delete, exec, shell)
  tools: ["write_*", "move_*"]  # Block by name pattern

require:
  maxTools: 10                  # Limit attack surface

allow:
  tools: ["write_file"]         # Exceptions to deny rules
```

Then enforce it:

```bash
npx mcp-sentinel --policy .mcp-policy.yml npx @modelcontextprotocol/server-filesystem /tmp
```

```
🛡️  Policy: .mcp-policy.yml

  ❌ secure-filesystem-server: policy FAILED (2 violations)

     ✖ [deny.tools] Tool 'move_file' matches denied pattern 'move_*'
     ✖ [require.maxTools] Server exposes 14 tools, policy allows max 10
```

Exit code `2` = violations found. Your CI pipeline stops here.

> `write_file` was allowed by the exception, but `move_file` and the tool count violated the policy.

## Use It in CI/CD

Add one line to your GitHub Actions workflow:

```yaml
- run: npx mcp-sentinel --policy .mcp-policy.yml npx ./your-mcp-server
```

If the server violates your policy, the build fails. See a [full workflow example](examples/github-action.yml).

<details>
<summary>Full GitHub Actions example</summary>

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
      - run: npx mcp-sentinel --policy .mcp-policy.yml npx ./your-mcp-server
```

</details>

## What Else Can It Do?

```bash
# Scan a remote server over HTTP
npx mcp-sentinel http://localhost:3000/mcp

# Scan all servers from Claude Desktop, Cursor, or Windsurf config
npx mcp-sentinel --config

# Detect changes between server versions
npx mcp-sentinel npx @mcp/server --json > baseline.json
npx mcp-sentinel npx @mcp/server --diff baseline.json

# Scan multiple servers in one command
npx mcp-sentinel npx @mcp/server-a --- npx @mcp/server-b

# Export as JSON or Markdown
npx mcp-sentinel --json npx @mcp/server
npx mcp-sentinel --markdown report.md npx @mcp/server
```

## Policy Reference

| Rule | What it does | Example |
|------|-------------|---------|
| `deny.categories` | Block tools by category | `[admin]`, `[admin, write]` |
| `deny.tools` | Block by name or glob | `["delete_*", "run_command"]` |
| `require.maxTools` | Max number of tools allowed | `20` |
| `require.aguara` | Require zero security findings | `clean` |
| `allow.tools` | Exceptions to deny rules | `["execute_query"]` |

### Starter Policies

Pick one from [`examples/policies/`](examples/policies/) and customize:

| Policy | Best for |
|--------|----------|
| [`permissive.yml`](examples/policies/permissive.yml) | Local development — blocks only destructive patterns |
| [`standard.yml`](examples/policies/standard.yml) | Team development — blocks admin + exec, allows writes |
| [`strict.yml`](examples/policies/strict.yml) | Production — blocks admin + write, requires security scan |
| [`ci-pipeline.yml`](examples/policies/ci-pipeline.yml) | CI/CD — blocks admin + deploy + push |

## Deep Security Analysis with Aguara

MCP Sentinel can optionally integrate with [Aguara](https://github.com/garagon/aguara), a security scanner with 177 rules that detects prompt injection, data exfiltration, credential leaks, and more.

```bash
# Install Aguara (optional)
curl -fsSL https://raw.githubusercontent.com/garagon/aguara/main/install.sh | bash
```

Once installed, MCP Sentinel auto-detects it and runs the analysis. Add `require.aguara: clean` to your policy to enforce zero findings.

## All Options

| Flag | Description |
|------|-------------|
| `--policy <file>` | Enforce a security policy (auto-detects `.mcp-policy.yml`) |
| `--config` | Scan servers from Claude Desktop / Cursor / Windsurf config |
| `--diff <file.json>` | Compare against a previous scan |
| `--transport <type>` | Force transport: `stdio`, `sse`, `streamable-http` |
| `--json` | JSON output |
| `--markdown <file>` | Export Markdown report |
| `--fail-on-findings` | Exit code 2 if aguara finds issues |
| `--no-color` | Disable colors |
| `--timeout <ms>` | Connection timeout (default: 30000) |

## How It Works

```
                      ┌────────────────┐
              stdio   │  MCP Server    │
            ┌──────── │  (local)       │
            │         └────────────────┘
┌───────────┤
│  mcp-     │ HTTP/   ┌────────────────┐
│  sentinel │ SSE     │  MCP Server    │
│           ├──────── │  (remote)      │
│  Scan     │         └────────────────┘
│  Enforce  │
│  Diff     │         ┌──────────────────┐
│  Report   │ ──────► │  Aguara (177      │
└───────────┘         │  security rules)  │
     │                └──────────────────┘
     ▼
 .mcp-policy.yml
 (deny / require / allow)
```

## Ecosystem

MCP Sentinel is part of the [Aguara](https://github.com/garagon/aguara) security ecosystem:

| Tool | What it does |
|------|-------------|
| **[Aguara](https://github.com/garagon/aguara)** | Security scanner — 177 rules, NLP, toxic-flow analysis |
| **[Aguara MCP](https://github.com/garagon/aguara-mcp)** | MCP server — gives AI agents security scanning as a tool |
| **MCP Sentinel** | Policy enforcement — audit, enforce, and monitor MCP servers |
| **[Aguara Watch](https://aguarascan.com)** | Cloud platform — continuous monitoring of MCP registries |

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE) — Gustavo Aragon ([@oktsec](https://github.com/oktsec))
