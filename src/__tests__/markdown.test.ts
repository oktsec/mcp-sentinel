import { describe, it, expect } from "vitest";
import { formatMarkdown } from "../markdown.js";
import type { ScanResult } from "../types.js";

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    server: { name: "test-server", version: "1.0.0" },
    tools: [],
    risk: { level: "LOW", reasons: [{ message: "No risky patterns detected" }] },
    envVars: [],
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

  it("includes tool count", () => {
    const md = formatMarkdown([makeScanResult({
      tools: [
        { tool: { name: "a", description: "A tool" }, flags: [], safe: true },
        { tool: { name: "b", description: "B tool" }, flags: [], safe: true },
      ],
    })]);
    expect(md).toContain("**Tools:** 2");
  });

  it("includes risk level", () => {
    const md = formatMarkdown([makeScanResult({
      risk: { level: "HIGH", reasons: [{ message: "Exec detected" }] },
    })]);
    expect(md).toContain("**Risk:** HIGH");
  });

  it("includes risk reasons section", () => {
    const md = formatMarkdown([makeScanResult({
      risk: { level: "MEDIUM", reasons: [{ message: "3 write tools" }] },
    })]);
    expect(md).toContain("### Risk Details");
    expect(md).toContain("- 3 write tools");
  });

  it("includes environment dependencies when present", () => {
    const md = formatMarkdown([makeScanResult({ envVars: ["API_KEY", "SECRET_TOKEN"] })]);
    expect(md).toContain("### Environment Dependencies");
    expect(md).toContain("`API_KEY`");
    expect(md).toContain("`SECRET_TOKEN`");
  });

  it("omits environment section when no env vars", () => {
    const md = formatMarkdown([makeScanResult({ envVars: [] })]);
    expect(md).not.toContain("### Environment Dependencies");
  });

  it("includes tools table with correct columns", () => {
    const md = formatMarkdown([makeScanResult({
      tools: [{
        tool: { name: "delete_repo", description: "Delete a repository" },
        flags: [{ type: "destructive", label: "DESTRUCTIVE", reason: "test" }],
        safe: false,
      }],
    })]);
    expect(md).toContain("| Status | Tool | Description | Flags |");
    expect(md).toContain("| WARN | `delete_repo` | Delete a repository | DESTRUCTIVE |");
  });

  it("shows OK status for safe tools", () => {
    const md = formatMarkdown([makeScanResult({
      tools: [{
        tool: { name: "list_files", description: "List files" },
        flags: [],
        safe: true,
      }],
    })]);
    expect(md).toContain("| OK | `list_files` |");
  });

  it("handles multiple servers", () => {
    const md = formatMarkdown([
      makeScanResult({ server: { name: "server-a", version: "1.0.0" } }),
      makeScanResult({ server: { name: "server-b", version: "2.0.0" } }),
    ]);
    expect(md).toContain("## server-a v1.0.0");
    expect(md).toContain("## server-b v2.0.0");
  });

  it("includes aguarascan.com footer link", () => {
    const md = formatMarkdown([makeScanResult()]);
    expect(md).toContain("aguarascan.com");
  });

  it("truncates long descriptions", () => {
    const longDesc = "X".repeat(100);
    const md = formatMarkdown([makeScanResult({
      tools: [{
        tool: { name: "tool", description: longDesc },
        flags: [],
        safe: true,
      }],
    })]);
    expect(md).toContain("...");
  });
});
