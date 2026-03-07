import { describe, it, expect } from "vitest";
import { formatOutput, formatJson, formatError } from "../formatter.js";
import type { ScanResult } from "../types.js";

function makeScanResult(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    server: { name: "test-server", version: "1.0.0" },
    capabilities: { tools: true, resources: false, prompts: false, logging: false },
    tools: [],
    toolSummary: { read: 0, write: 0, admin: 0 },
    resources: [],
    resourceTemplates: [],
    prompts: [],
    instructions: null,
    aguara: { available: false, findings: [], summary: "aguara not installed" },
    scanDuration: 500,
    ...overrides,
  };
}

describe("formatOutput", () => {
  it("includes server name and version", () => {
    const output = formatOutput(makeScanResult({ server: { name: "my-server", version: "2.1.0" } }));
    expect(output).toContain("my-server");
    expect(output).toContain("2.1.0");
  });

  it("shows capabilities", () => {
    const output = formatOutput(makeScanResult({
      capabilities: { tools: true, resources: true, prompts: false, logging: true },
    }));
    expect(output).toContain("tools");
    expect(output).toContain("resources");
    expect(output).toContain("logging");
  });

  it("shows tool summary breakdown", () => {
    const output = formatOutput(makeScanResult({
      tools: [
        { tool: { name: "a", description: "A", parameters: [] }, category: "read" },
        { tool: { name: "b", description: "B", parameters: [] }, category: "write" },
      ],
      toolSummary: { read: 1, write: 1, admin: 0 },
    }));
    expect(output).toContain("1 read");
    expect(output).toContain("1 write");
  });

  it("shows parameter count per tool", () => {
    const output = formatOutput(makeScanResult({
      tools: [{
        tool: {
          name: "create_issue",
          description: "Create an issue",
          parameters: [
            { name: "title", type: "string", required: true, description: "Issue title" },
            { name: "body", type: "string", required: false, description: "Issue body" },
          ],
        },
        category: "write",
      }],
    }));
    expect(output).toContain("2 params");
  });

  it("shows resources when present", () => {
    const output = formatOutput(makeScanResult({
      capabilities: { tools: true, resources: true, prompts: false, logging: false },
      resources: [{ uri: "file:///tmp/test.txt", name: "test", description: "A test file", mimeType: "text/plain" }],
    }));
    expect(output).toContain("Resources");
    expect(output).toContain("file:///tmp/test.txt");
  });

  it("shows prompts when present", () => {
    const output = formatOutput(makeScanResult({
      capabilities: { tools: true, resources: false, prompts: true, logging: false },
      prompts: [{
        name: "summarize",
        description: "Summarize text",
        arguments: [{ name: "text", description: "Input text", required: true }],
      }],
    }));
    expect(output).toContain("Prompts");
    expect(output).toContain("summarize");
  });

  it("shows server instructions when present", () => {
    const output = formatOutput(makeScanResult({ instructions: "You are a helpful assistant." }));
    expect(output).toContain("Server Instructions");
    expect(output).toContain("You are a helpful assistant.");
  });

  it("hides sections when not present", () => {
    const output = formatOutput(makeScanResult());
    expect(output).not.toContain("Resources");
    expect(output).not.toContain("Prompts");
    expect(output).not.toContain("Server Instructions");
  });

  it("includes aguarascan.com link", () => {
    const output = formatOutput(makeScanResult());
    expect(output).toContain("aguarascan.com");
  });

  it("includes scan duration", () => {
    const output = formatOutput(makeScanResult({ scanDuration: 1234 }));
    expect(output).toContain("1234ms");
  });
});

describe("formatJson", () => {
  it("returns valid JSON for single result", () => {
    expect(() => JSON.parse(formatJson(makeScanResult())) as unknown).not.toThrow();
  });

  it("returns valid JSON for array of results", () => {
    const parsed = JSON.parse(formatJson([makeScanResult(), makeScanResult()])) as unknown[];
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
  });
});

describe("formatError", () => {
  it("includes the error message", () => {
    expect(formatError("Connection failed")).toContain("Connection failed");
  });
});
