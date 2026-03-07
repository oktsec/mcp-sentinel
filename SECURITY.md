# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability in MCP Gate, please report it responsibly.

**Do not open a public issue.**

Send an email to **security@aguarascan.com** with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

We will acknowledge your report within 48 hours and aim to provide a fix within 7 days for critical issues.

## Scope

MCP Gate is a read-only scanning tool. It connects to MCP servers, queries their tool list, and analyzes the results. It does **not**:

- Execute any tools on the target server
- Send data to external services
- Store scan results (unless `--markdown` is used to write a local file)
- Require or collect authentication credentials

## Dependencies

We minimize dependencies and audit them regularly:

- `@modelcontextprotocol/sdk` — Official MCP SDK from Anthropic
- `chalk` — Terminal color output (no network, no filesystem)

All dependencies are pinned via `package-lock.json` and checked with `npm audit`.
