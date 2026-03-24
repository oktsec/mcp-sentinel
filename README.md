<p align="center">
  <h1 align="center">MCP Sentinel</h1>
  <p align="center">
    <strong>Know what your MCP servers can do -- before your AI agent does.</strong>
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/mcp-sentinel"><img src="https://img.shields.io/npm/v/mcp-sentinel.svg" alt="npm version"></a>
    <a href="https://www.npmjs.com/package/mcp-sentinel"><img src="https://img.shields.io/npm/dm/mcp-sentinel.svg" alt="npm downloads"></a>
    <a href="https://github.com/oktsec/mcp-sentinel/blob/main/LICENSE"><img src="https://img.shields.io/npm/l/mcp-sentinel.svg" alt="license"></a>
    <a href="https://nodejs.org"><img src="https://img.shields.io/node/v/mcp-sentinel.svg" alt="node version"></a>
    <a href="https://github.com/oktsec/mcp-sentinel"><img src="https://img.shields.io/github/stars/oktsec/mcp-sentinel?style=social" alt="GitHub stars"></a>
  </p>
</p>

> Part of the [Aguara](https://github.com/garagon/aguara) security ecosystem by [Oktsec](https://github.com/oktsec)

---

## The Problem

You add an MCP server to Claude Desktop, Cursor, or your agent framework. Now that server has tools your AI can call -- tools that might read your files, run shell commands, or delete data.

**You're trusting code you haven't reviewed.**

MCP Sentinel connects to any MCP server, shows you every tool it exposes, assigns a risk score, and lets you define security policies that block dangerous ones automatically.

## Quick Start

```bash
# Scan any MCP server -- no install needed
npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp
```

That's it. You'll see every tool the server exposes, categorized by risk:

```
┌──────────────────────────────┐
│  MCP Sentinel v0.2.3         │
└──────────────────────────────┘

  Server        secure-filesystem-server v0.2.0
  Capabilities  tools
  Risk Score    B (82/100)

🔧 Tools (14)    11 read · 3 write · 0 admin

  ⚠ move_file                                              write
    Move or rename files and directories

  ⚠ edit_file                                              write
    Make line-based edits to a text file
    path* · edits* · dryRun

  ⚠ write_file                                             write
    Create a new file or overwrite an existing file
    path* · content*

  ✔ read_file                                               read
    Read the complete contents of a file from the file system
    path*

  ✔ list_directory                                          read
    Get a detailed listing of all files and directories
    path*
  ...

  ──────────────────────────────────────────────────────────────

  🛡️  No security findings · aguara scan clean

  ──────────────────────────────────────────────────────────────

  Scanned in 1706ms  ·  Deep scan: https://aguarascan.com
```

## Features

- **Risk Scoring** -- A-F grade for every server based on tool risk, security findings, and attack surface
- **Policy Engine** -- YAML-based deny/require/allow rules with glob patterns and auto-detection
- **Deep Security Analysis** -- Per-tool scanning with [Aguara](https://github.com/garagon/aguara) (187 rules, 14 categories: prompt injection, exfiltration, credential leaks, supply chain exfiltration)
- **Smart Categorization** -- Analyzes tool names, descriptions, and parameters; auto-escalates when critical findings are detected
- **Multi-Transport** -- stdio, SSE, and Streamable HTTP with custom header support
- **Config Discovery** -- Auto-scan servers from Claude Desktop, Cursor, Windsurf, VS Code, Zed
- **CI/CD Ready** -- SARIF output for GitHub Code Scanning, exit codes for policy violations
- **Drift Detection** -- Save baselines and detect added/removed/changed tools over time
- **Multiple Exports** -- Terminal, JSON, Markdown, SARIF
- **Unicode Evasion Defense** -- NFKC normalization prevents homoglyph and fullwidth character bypasses
- **Hardened Inputs** -- Path traversal prevention, header injection blocking, ReDoS-safe policy patterns

## Deep Security Analysis with Aguara

MCP Sentinel handles runtime introspection: connecting to servers, listing tools, categorizing risk, and enforcing policies. For deep security analysis, it integrates with [Aguara](https://github.com/garagon/aguara) -- an open source security scanner with 187 rules across 14 categories that detects prompt injection, data exfiltration, credential leaks, supply chain exfiltration (.pth abuse, credential harvesting, K8s lateral movement), and more.

When Aguara is installed, MCP Sentinel automatically:
- Scans each tool individually and attributes findings to specific tools
- Escalates tool categories based on findings (a "read" tool with a critical injection finding becomes "admin")
- Reports severity, category, description, and remediation for each finding
- Factors findings into the risk score

```bash
# Install Aguara (optional, recommended)
curl -fsSL https://raw.githubusercontent.com/garagon/aguara/main/install.sh | bash

# MCP Sentinel auto-detects it -- just scan as usual
npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp
```

Add `require.aguara: clean` to your policy to enforce zero findings in CI.

Without Aguara, MCP Sentinel still provides tool categorization, risk scoring, and policy enforcement based on built-in heuristics. With Aguara, you get full coverage of OWASP LLM Top 10 attack vectors.

## Risk Score

Every server gets an **A-F grade** (0-100 scale) based on three factors:

| Factor | Weight | What it measures |
|--------|--------|-----------------|
| Tool risk | 40 pts | Penalty for write (-3) and admin (-8) tools |
| Finding risk | 40 pts | Penalty per aguara finding, weighted by severity |
| Surface risk | 20 pts | Penalty for large tool counts (>10, >20) |

A read-only server with no findings scores **A (100/100)**. A server with admin tools and critical findings scores **D** or **F**.

## Add a Security Policy

Create a `.mcp-policy.yml` in your project root:

```yaml
deny:
  categories: [admin]           # Block dangerous tools (delete, exec, shell)
  tools: ["write_*", "move_*"]  # Block by name pattern
  descriptions: ["*ssh*"]       # Block tools mentioning SSH in descriptions

require:
  maxTools: 10                  # Limit attack surface
  maxFindings:                  # Limit security findings by severity
    critical: 0
    high: 0

allow:
  tools: ["write_file"]         # Exceptions to deny rules
```

Then enforce it:

```bash
npx mcp-sentinel --policy .mcp-policy.yml npx @modelcontextprotocol/server-filesystem /tmp
```

```
🛡️  Policy: .mcp-policy.yml

  ✖ secure-filesystem-server policy FAILED (2 violations)

    → [deny.tools] Tool 'move_file' matches denied pattern 'move_*'
    → [require.maxTools] Server exposes 14 tools, policy allows max 10
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

<details>
<summary>SARIF integration for GitHub Code Scanning</summary>

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
      - run: npx mcp-sentinel --sarif results.sarif npx ./your-mcp-server
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: results.sarif
        if: always()
```

</details>

## What Else Can It Do?

```bash
# Scan a remote server over HTTP
npx mcp-sentinel http://localhost:3000/mcp

# Scan with custom headers (for authenticated servers)
npx mcp-sentinel --header "Authorization: Bearer xxx" http://localhost:3000/mcp

# Scan all servers from your Claude Desktop, Cursor, Windsurf, VS Code, or Zed config
npx mcp-sentinel --config

# Save a scan and detect changes later (drift detection)
npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp --json > baseline.json
npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp --diff baseline.json

# Scan multiple servers in one command
npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp --- npx @modelcontextprotocol/server-github

# Export as JSON, Markdown, or SARIF
npx mcp-sentinel --json npx @modelcontextprotocol/server-filesystem /tmp
npx mcp-sentinel --markdown report.md npx @modelcontextprotocol/server-filesystem /tmp
npx mcp-sentinel --sarif report.sarif npx @modelcontextprotocol/server-filesystem /tmp

# Verbose mode: full descriptions, finding details, and remediation
npx mcp-sentinel --verbose npx @modelcontextprotocol/server-filesystem /tmp
```

## Policy Reference

| Rule | What it does | Example |
|------|-------------|---------|
| `deny.categories` | Block tools by category | `[admin]`, `[admin, write]` |
| `deny.tools` | Block by name or glob | `["delete_*", "run_command"]` |
| `deny.descriptions` | Block tools by description content | `["*ssh*", "*IMPORTANT*"]` |
| `require.maxTools` | Max number of tools allowed | `20` |
| `require.aguara` | Require zero security findings | `clean` |
| `require.maxFindings` | Limit findings by severity | `{ critical: 0, high: 0 }` |
| `allow.tools` | Exceptions to deny rules | `["execute_query"]` |

### Starter Policies

Pick one from [`examples/policies/`](examples/policies/) and customize:

| Policy | Best for |
|--------|----------|
| [`permissive.yml`](examples/policies/permissive.yml) | Local development -- blocks only destructive patterns |
| [`standard.yml`](examples/policies/standard.yml) | Team development -- blocks admin + exec, allows writes |
| [`strict.yml`](examples/policies/strict.yml) | Production -- blocks admin + write, requires security scan |
| [`ci-pipeline.yml`](examples/policies/ci-pipeline.yml) | CI/CD -- blocks admin + deploy + push |

## All Options

| Flag | Description |
|------|-------------|
| `--policy <file>` | Enforce a security policy (auto-detects `.mcp-policy.yml`) |
| `--config` | Scan servers from Claude Desktop / Cursor / Windsurf / VS Code / Zed config |
| `--diff <file.json>` | Compare against a previous scan |
| `--sarif <file>` | Export SARIF report for GitHub Code Scanning |
| `--transport <type>` | Force transport: `stdio`, `sse`, `streamable-http` |
| `--json` | JSON output |
| `--markdown <file>` | Export Markdown report |
| `--verbose` | Show full descriptions, finding details, and remediation |
| `--header <value>` | HTTP header for remote servers (repeatable) |
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
│  Score    │
│  Enforce  │         ┌──────────────────┐
│  Diff     │ ──────► │  Aguara (187      │
│  Report   │         │  security rules)  │
└───────────┘         └──────────────────┘
     │
     ▼
 .mcp-policy.yml
 (deny / require / allow)
```

## The Aguara Ecosystem

MCP Sentinel is built by [Oktsec](https://github.com/oktsec) as part of the [Aguara](https://github.com/garagon/aguara) security ecosystem -- a suite of open source tools designed to secure MCP servers and AI agent infrastructure.

| Tool | What it does |
|------|-------------|
| **[Aguara](https://github.com/garagon/aguara)** | Security scanner -- 187 rules for prompt injection, exfiltration, credential leaks, supply chain exfiltration, and 10 more categories. Incident response commands (check/clean) for compromised packages. The detection engine behind the ecosystem. |
| **[MCP Sentinel](https://github.com/oktsec/mcp-sentinel)** | Runtime audit -- connect to live MCP servers, score risk, enforce policies, detect drift. Uses Aguara for deep analysis. |
| **[Aguara MCP](https://github.com/garagon/aguara-mcp)** | MCP server -- gives AI agents security scanning as a tool. Wrap Aguara's 187 rules as an MCP tool your agent can call. |
| **[Aguara Watch](https://aguarascan.com)** | Cloud platform -- continuous monitoring and security scanning of MCP servers across public registries. |

### How they fit together

- **Developing an MCP server?** Use `aguara` to scan your tool descriptions for security issues during development.
- **Deploying MCP servers?** Use `mcp-sentinel` with a policy file in CI to gate deployments.
- **Running AI agents?** Use `mcp-sentinel --config` to audit all servers your agent can access.
- **Building AI agents?** Add `aguara-mcp` so your agent can self-audit the servers it connects to.
- **Managing a fleet?** Use [Aguara Watch](https://aguarascan.com) for continuous monitoring across your organization.

## Contributing

Contributions welcome. Please open an issue first to discuss what you'd like to change. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[Apache 2.0](LICENSE) -- [Oktsec](https://github.com/oktsec) / Gustavo Aragon
