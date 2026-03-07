import { describe, it, expect } from "vitest";
import { formatOutput, formatJson, formatError } from "../formatter.js";
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

describe("formatOutput", () => {
  it("includes server name and version", () => {
    const result = makeScanResult({ server: { name: "my-server", version: "2.1.0" } });
    const output = formatOutput(result);
    expect(output).toContain("my-server");
    expect(output).toContain("2.1.0");
  });

  it("includes tool count", () => {
    const result = makeScanResult({
      tools: [
        { tool: { name: "a", description: "A" }, category: "read" },
        { tool: { name: "b", description: "B" }, category: "write" },
      ],
      toolSummary: { read: 1, write: 1, admin: 0 },
    });
    const output = formatOutput(result);
    expect(output).toContain("2");
  });

  it("includes tool summary breakdown", () => {
    const result = makeScanResult({
      toolSummary: { read: 5, write: 3, admin: 1 },
    });
    const output = formatOutput(result);
    expect(output).toContain("5 read");
    expect(output).toContain("3 write");
    expect(output).toContain("1 admin");
  });

  it("shows aguara install prompt when not available", () => {
    const result = makeScanResult();
    const output = formatOutput(result);
    expect(output).toContain("aguara");
    expect(output).toContain("github.com/garagon/aguara");
  });

  it("shows aguara findings when available", () => {
    const result = makeScanResult({
      aguara: {
        available: true,
        findings: [{ severity: "HIGH", ruleId: "MCP_001", ruleName: "Tool description injection", matchedText: "test" }],
        summary: "Found 1 issue: 1 high",
      },
    });
    const output = formatOutput(result);
    expect(output).toContain("MCP_001");
    expect(output).toContain("HIGH");
    expect(output).toContain("Aguara Security Analysis");
  });

  it("includes scan duration", () => {
    const result = makeScanResult({ scanDuration: 1234 });
    const output = formatOutput(result);
    expect(output).toContain("1234ms");
  });

  it("includes aguarascan.com link", () => {
    const output = formatOutput(makeScanResult());
    expect(output).toContain("aguarascan.com");
  });

  it("shows category tags on tools", () => {
    const result = makeScanResult({
      tools: [
        { tool: { name: "delete_it", description: "Delete" }, category: "admin" },
        { tool: { name: "write_it", description: "Write" }, category: "write" },
      ],
    });
    const output = formatOutput(result);
    expect(output).toContain("ADMIN");
    expect(output).toContain("WRITE");
  });

  it("truncates long descriptions", () => {
    const result = makeScanResult({
      tools: [{ tool: { name: "t", description: "A".repeat(100) }, category: "read" }],
    });
    const output = formatOutput(result);
    expect(output).toContain("...");
  });
});

describe("formatJson", () => {
  it("returns valid JSON for single result", () => {
    const json = formatJson(makeScanResult());
    expect(() => JSON.parse(json) as unknown).not.toThrow();
  });

  it("returns valid JSON for array of results", () => {
    const json = formatJson([makeScanResult(), makeScanResult()]);
    const parsed = JSON.parse(json) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });
});

describe("formatError", () => {
  it("includes the error message", () => {
    expect(formatError("Connection failed")).toContain("Connection failed");
  });

  it("includes Error label", () => {
    expect(formatError("timeout")).toContain("Error:");
  });
});
