# MCP Sentinel - Project Status

Last updated: 2026-03-07
Current version: 0.1.4 (npm) / 0.1.5 (dev)

## What's Built

### Core Scanning
- [x] Connect to MCP servers via stdio, SSE, streamable-http
- [x] List tools, resources, resource templates, prompts
- [x] Extract server instructions
- [x] Read server capabilities
- [x] Timeout handling with configurable --timeout

### Tool Analysis
- [x] Categorize tools as read/write/admin via regex patterns
- [x] Smart escalation: tools with critical/high aguara findings auto-escalate to admin
- [x] Sort tools by risk in output (admin > write > read)

### Aguara Integration
- [x] Auto-detect aguara binary
- [x] Per-tool scanning (each tool gets its own file for finding attribution)
- [x] Scan resources and prompts (not just tools)
- [x] Rich finding data: category, description, confidence, score, remediation
- [x] Severity normalization (numeric 1-4 and string CRITICAL/HIGH/MEDIUM/LOW)
- [x] Aguara metadata in output (rules loaded, scan duration)

### Policy Engine
- [x] YAML policy files (.mcp-policy.yml)
- [x] Auto-detect policy in project root
- [x] deny.categories - block by tool category
- [x] deny.tools - block by name/glob pattern
- [x] deny.descriptions - block by description content patterns
- [x] require.aguara: clean - require zero findings
- [x] require.maxTools - limit tool count
- [x] require.maxFindings - limit findings per severity level
- [x] allow.tools - exceptions to deny rules
- [x] Exit code 2 on violations (CI-friendly)

### Drift Detection
- [x] Save scan as JSON baseline
- [x] Compare current scan against baseline
- [x] Detect added/removed/changed tools, resources, prompts, capabilities

### Config Discovery
- [x] Claude Desktop (macOS, Windows, Linux)
- [x] Claude Code
- [x] Cursor
- [x] Windsurf
- [x] VS Code
- [x] Zed
- [x] Scan all discovered servers with --config

### Output Formats
- [x] Terminal (chalk-colored, structured)
- [x] JSON (--json)
- [x] Markdown (--markdown report.md)
- [x] Verbose mode (--verbose) - full descriptions, finding details, remediation

### CLI
- [x] Multi-server scanning (--- separator)
- [x] --policy, --config, --diff, --json, --markdown, --verbose
- [x] --header for authenticated remote servers
- [x] --fail-on-findings for CI
- [x] --no-color, --timeout
- [x] --transport override (stdio, sse, streamable-http)

### CI/CD
- [x] GitHub Actions example workflow
- [x] Exit code 2 on policy violations or findings
- [x] 138 tests, 9 test suites
- [x] ESLint + TypeScript strict mode
- [x] CI runs on Node 18/20/22
- [x] SARIF output (--sarif) for GitHub Code Scanning

### Examples
- [x] 4 starter policies (permissive, standard, strict, ci-pipeline)
- [x] Test malicious server with 7 real-world attack patterns
- [x] GitHub Action workflow example

## What's NOT Built Yet

### High Priority
- [ ] Server-level risk score (A-F grade like aguarascan.com)

### Medium Priority
- [ ] Watch mode (--watch) for continuous monitoring of remote servers
- [ ] Aggregate score per server (A-F grade like aguarascan.com)
- [ ] Config discovery for more clients (Cline, Continue, Amazon Q, etc.)
- [ ] Policy: deny.parameters - block tools with specific parameter patterns
- [ ] Policy: require.capabilities - enforce specific server capabilities

### Low Priority / Nice to Have
- [ ] Interactive mode (TUI) for exploring scan results
- [ ] Plugin system for custom analyzers
- [ ] Webhook notifications on policy violations
- [ ] Historical tracking (scan over time, trend analysis)
- [ ] npm badge generator for README

## Architecture

```
CLI (cli.ts)
  |
  v
Orchestrator (index.ts)
  |
  +-- Scanner (scanner.ts) -- connects to MCP server, lists everything
  |
  +-- Aguara (aguara.ts) -- per-tool security scan via aguara binary
  |
  +-- Analyzer (analyzer.ts) -- categorize tools (with aguara context)
  |
  +-- Policy (policy.ts) -- evaluate rules against scan results
  |
  +-- Formatter (formatter.ts) -- terminal output
  +-- Markdown (markdown.ts) -- markdown report
  +-- Diff (diff.ts) -- compare against baseline
  +-- Config (config.ts) -- discover MCP client configs
```

## npm Publishing
- Package: mcp-sentinel
- Registry: npmjs.com
- Auth: granular access token (no OTP needed)
- Publish: `npm publish` from repo root
- Remember to bump version in both package.json AND src/formatter.ts

## Key Files
- `package.json` - version, dependencies, bin entry
- `src/formatter.ts` - VERSION const must match package.json
- `examples/test-malicious-server.mjs` - test server (not published to npm)
- `examples/policies/` - starter policies
- `.mcp-policy.example.yml` - example policy for users
