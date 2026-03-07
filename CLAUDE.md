# MCP Inspector — Project Guide

## Project Overview

Open source CLI tool that scans MCP servers for security risks. Connects via stdio transport, lists exposed tools, detects dangerous patterns, and assigns risk levels.

**Owner:** Gustavo Aragon ([@oktsec](https://github.com/oktsec))
**License:** MIT
**Stack:** Node.js 18+, TypeScript (strict), ESM only

## Architecture

```
src/
  cli.ts          → Argument parsing, --help, --version
  scanner.ts      → MCP SDK client, stdio transport connection
  analyzer.ts     → Pattern-based risk detection engine
  formatter.ts    → Terminal (chalk) and JSON output
  types.ts        → Shared TypeScript interfaces
  index.ts        → Main orchestration
  __tests__/      → Unit tests (vitest)
bin/
  mcp-inspector.js → npx entry point
```

## Code Quality Standards

### Strict Rules
- TypeScript `strict: true` with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- ESLint with `@typescript-eslint/recommended-requiring-type-checking`
- `explicit-function-return-type` required on all exports
- `no-explicit-any` — never use `any`, prefer `unknown` + type narrowing
- `strict-boolean-expressions` — no implicit truthy/falsy checks

### Dependencies
- **Only official or widely trusted libraries** (>10k stars, active maintenance)
- Current: `@modelcontextprotocol/sdk` (official MCP SDK), `chalk` (terminal colors)
- Never add a dependency where native Node.js APIs suffice
- Audit every new dependency before adding

### Testing
- Every module must have corresponding tests in `src/__tests__/`
- Test the behavior, not the implementation
- Cover edge cases: empty inputs, boundary conditions, error paths
- Run `npm test` before every commit — all tests must pass
- Run `npm run build` before every commit — zero errors, zero warnings

### Security
- No `eval`, `Function()`, or dynamic code execution
- No shell injection — always use array-based args, never string interpolation in commands
- Validate and sanitize all external input (server responses, CLI args)
- Never log or expose credentials, tokens, or sensitive data
- Dependencies must be audited (`npm audit` clean)

## Git Workflow

- **Never commit directly to `main`** — always use feature branches + PRs
- Branch naming: `feat/`, `fix/`, `chore/`, `docs/`
- Commit messages: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`)
- Author: `garagon` — never use any other co-author
- Squash merge PRs to keep history clean

## Current Status

### Completed (P0 — MVP)
- [x] MCP connection via stdio transport
- [x] Tool listing with name and description
- [x] Destructive operation detection (delete, remove, drop, destroy, purge, truncate)
- [x] Code execution detection (exec, shell, bash, eval, spawn)
- [x] Write access detection (write, create, update, push, upload)
- [x] Network access detection (fetch, http, request, webhook)
- [x] Credential pattern detection (token, secret, password, api_key)
- [x] Environment variable detection with false-positive filtering
- [x] Risk levels: LOW / MEDIUM / HIGH with reasoning
- [x] Zero-install via npx
- [x] Clean terminal output with color
- [x] JSON output (--json)
- [x] Configurable timeout (--timeout)
- [x] No-color mode (--no-color)
- [x] aguarascan.com footer link
- [x] 23 unit tests passing

### In Progress (P1)
- [ ] Scan multiple servers in one command
- [ ] Export report as markdown file (--markdown)
- [ ] Formatter unit tests
- [ ] SECURITY.md
- [ ] CONTRIBUTING.md

### Future (P2)
- [ ] GitHub Action for CI/CD
- [ ] VS Code extension
- [ ] Registry integration (Smithery, mcp.run)
- [ ] Diff mode: compare server versions
- [ ] HTTP/SSE transport support
