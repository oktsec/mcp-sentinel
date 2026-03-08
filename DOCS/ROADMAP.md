# MCP Sentinel - Roadmap

## v0.2.0 - Hardening

### Done
- [x] Wire --header to HTTP transports
- [x] SARIF output for GitHub Code Scanning
- [x] Tests: analyzer escalation, policy deny.descriptions/maxFindings, aguara per-tool, formatter verbose/diff/policy, CLI flags
- [x] 138 tests across 9 test suites

### Remaining
- Server-level risk score (aggregate findings into A-F grade)
- Expand config discovery (Cline, Continue, Amazon Q, Copilot)
- --watch mode for continuous monitoring of remote servers
- Policy: deny.parameters (block tools with suspicious parameter names)
- Improve analyzer heuristics (detect URL patterns, file path patterns in descriptions)

## v0.3.0 - Ecosystem

- Registry integration: scan from Smithery or mcp.run URLs
- SARIF upload to GitHub via API
- Aggregate dashboard for --config scans (multi-server summary view)
- Policy inheritance (base + override per server)

## v1.0.0 - Production

- Stable API surface
- VS Code extension
- Plugin system for custom analyzers
- Historical tracking (scan over time)
- Webhook notifications on policy violations

## PRD Compliance

Original PRD: DOCS:/MCP-Inspector-PRD.docx

| Requirement | Status |
|---|---|
| P0: Connect to MCP servers | Done |
| P0: List tools with descriptions | Done |
| P0: Flag destructive operations | Done |
| P0: Flag env var dependencies | Partial (aguara detects, not standalone) |
| P0: Risk levels | Done (read/write/admin + aguara escalation) |
| P0: Zero install via npx | Done |
| P0: Terminal color output | Done |
| P0: aguarascan.com footer | Done |
| P1: JSON output | Done |
| P1: Multi-server scanning | Done |
| P1: Markdown export | Done |
| P1: Name heuristic detection | Done |
| P2: GitHub Action | Done |
| P2: Diff mode | Done |
| P2: VS Code extension | Not started |
| P2: Registry integration | Not started |
