import { describe, it, expect } from "vitest";
import { formatMarkdown } from "../markdown.js";
import type { ScanResult } from "../types.js";

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    server: { name: "test-server", version: "1.0.0" },
    tools: [],
    toolSummary: { read: 0, write: 0, admin: 0 },
    aguara: { available: false, findings: [], summary: "aguara not installed" },
    scanDuration: 500,
    ...overrides,
  };
}

describe("formatMarkdown", () => {
  it("includes report header", () => {
    const md = formatMarkdown([makeScanResult()]);
    expect(md).toContain("# MCP Inspector Report");
  });

  it("includes server name as section header", () => {
    const md = formatMarkdown([makeScanResult({ server: { name: "my-mcp", version: "3.0.0" } })]);
    expect(md).toContain("## my-mcp v3.0.0");
  });

  it("includes tool summary with categories", () => {
    const md = formatMarkdown([makeScanResult({
      tools: [
        { tool: { name: "a", description: "A" }, category: "read" },
        { tool: { name: "b", description: "B" }, category: "write" },
      ],
      toolSummary: { read: 1, write: 1, admin: 0 },
    })]);
    expect(md).toContain("2 (1 read, 1 write, 0 admin)");
  });

  it("includes tools table with category column", () => {
    const md = formatMarkdown([makeScanResult({
      tools: [{
        tool: { name: "delete_repo", description: "Delete a repository" },
        category: "admin",
      }],
    })]);
    expect(md).toContain("| Tool | Category | Description |");
    expect(md).toContain("| `delete_repo` | admin | Delete a repository |");
  });

  it("includes aguara findings when available", () => {
    const md = formatMarkdown([makeScanResult({
      aguara: {
        available: true,
        findings: [{ severity: "CRITICAL", ruleId: "MCP_001", ruleName: "Injection", matchedText: "test" }],
        summary: "1 critical finding",
      },
    })]);
    expect(md).toContain("### Security Findings (Aguara)");
    expect(md).toContain("MCP_001");
    expect(md).toContain("CRITICAL");
  });

  it("shows aguara unavailable message", () => {
    const md = formatMarkdown([makeScanResult()]);
    expect(md).toContain("aguara not installed");
  });

  it("handles multiple servers", () => {
    const md = formatMarkdown([
      makeScanResult({ server: { name: "server-a", version: "1.0.0" } }),
      makeScanResult({ server: { name: "server-b", version: "2.0.0" } }),
    ]);
    expect(md).toContain("## server-a v1.0.0");
    expect(md).toContain("## server-b v2.0.0");
  });

  it("includes aguarascan.com footer", () => {
    const md = formatMarkdown([makeScanResult()]);
    expect(md).toContain("aguarascan.com");
  });

  it("truncates long descriptions", () => {
    const md = formatMarkdown([makeScanResult({
      tools: [{ tool: { name: "t", description: "X".repeat(100) }, category: "read" }],
    })]);
    expect(md).toContain("...");
  });
});
