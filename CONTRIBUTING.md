# Contributing to MCP Inspector

Thanks for your interest in contributing. This document covers the process and standards.

## Getting Started

```bash
git clone https://github.com/oktsec/mcp-inspector.git
cd mcp-inspector
npm install
npm run build
npm test
```

## Development Workflow

1. **Open an issue first** — Describe the change and get alignment before coding
2. **Fork and branch** — Create a feature branch from `main`
   - `feat/` for new features
   - `fix/` for bug fixes
   - `docs/` for documentation
   - `chore/` for maintenance
3. **Write code** — Follow the standards below
4. **Write tests** — Every change needs test coverage
5. **Submit PR** — Reference the issue, describe the change

## Code Standards

### TypeScript
- Strict mode enabled (`strict: true`)
- Explicit return types on all exported functions
- No `any` — use `unknown` with type narrowing
- No unused variables or parameters

### Testing
- Use `vitest` for all tests
- Tests go in `src/__tests__/` mirroring the source structure
- Test behavior, not implementation details
- Cover edge cases and error paths

### Dependencies
- Minimize external dependencies
- Only use well-maintained, widely-trusted packages
- Every new dependency requires justification in the PR

### Security
- No `eval()`, `Function()`, or dynamic code execution
- No shell string interpolation — use array-based args
- Validate all external inputs
- Run `npm audit` before submitting

## Before Submitting

```bash
npm run build      # Must compile with zero errors
npm test           # All tests must pass
npm run lint       # No lint violations
npm audit          # No known vulnerabilities
```

## Commit Messages

Use [conventional commits](https://www.conventionalcommits.org/):

```
feat: add multi-server scanning support
fix: reduce false positives in execute pattern detection
docs: update README with new CLI options
test: add formatter edge case coverage
chore: update typescript to 5.8
```

## Code of Conduct

Be respectful, constructive, and collaborative. We're building security tooling — approach contributions with the care and rigor that requires.
