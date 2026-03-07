import { describe, it, expect } from "vitest";
import { formatOutput, formatJson, formatError } from "../formatter.js";
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
        { tool: { name: "get_data", description: "Get data" }, flags: [], safe: true },
        { tool: { name: "list_items", description: "List items" }, flags: [], safe: true },
      ],
    });
    const output = formatOutput(result);
    expect(output).toContain("2");
  });

  it("includes risk level", () => {
    const result = makeScanResult({
      risk: { level: "HIGH", reasons: [{ message: "Code execution detected" }] },
    });
    const output = formatOutput(result);
    expect(output).toContain("HIGH");
  });

  it("includes risk reasons", () => {
    const result = makeScanResult({
      risk: { level: "MEDIUM", reasons: [{ message: "2 destructive operations detected" }] },
    });
    const output = formatOutput(result);
    expect(output).toContain("2 destructive operations detected");
  });

  it("includes scan duration", () => {
    const result = makeScanResult({ scanDuration: 1234 });
    const output = formatOutput(result);
    expect(output).toContain("1234ms");
  });

  it("includes aguarascan.com link", () => {
    const result = makeScanResult();
    const output = formatOutput(result);
    expect(output).toContain("aguarascan.com");
  });

  it("truncates long descriptions", () => {
    const longDesc = "A".repeat(100);
    const result = makeScanResult({
      tools: [{ tool: { name: "tool", description: longDesc }, flags: [], safe: true }],
    });
    const output = formatOutput(result);
    expect(output).toContain("...");
  });

  it("shows flag labels for flagged tools", () => {
    const result = makeScanResult({
      tools: [{
        tool: { name: "delete_all", description: "Delete everything" },
        flags: [{ type: "destructive", label: "DESTRUCTIVE", reason: "test" }],
        safe: false,
      }],
    });
    const output = formatOutput(result);
    expect(output).toContain("DESTRUCTIVE");
  });
});

describe("formatJson", () => {
  it("returns valid JSON for single result", () => {
    const result = makeScanResult();
    const json = formatJson(result);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("returns valid JSON for array of results", () => {
    const results = [makeScanResult(), makeScanResult()];
    const json = formatJson(results);
    const parsed = JSON.parse(json) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });

  it("preserves all fields", () => {
    const result = makeScanResult({ envVars: ["API_KEY"] });
    const json = formatJson(result);
    const parsed = JSON.parse(json) as ScanResult;
    expect(parsed.envVars).toContain("API_KEY");
    expect(parsed.server.name).toBe("test-server");
  });
});

describe("formatError", () => {
  it("includes the error message", () => {
    const output = formatError("Connection failed");
    expect(output).toContain("Connection failed");
  });

  it("includes Error label", () => {
    const output = formatError("timeout");
    expect(output).toContain("Error:");
  });
});
