import { describe, it, expect } from "vitest";
import { formatMarkdown } from "../markdown.js";
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
    riskScore: { grade: "A", score: 100, breakdown: { toolRisk: 40, findingRisk: 40, surfaceRisk: 20 } },
    scanDuration: 500,
    ...overrides,
  };
}

describe("formatMarkdown", () => {
  it("includes report header", () => {
    expect(formatMarkdown([makeScanResult()])).toContain("# MCP Sentinel Report");
  });

  it("includes capabilities", () => {
    const md = formatMarkdown([makeScanResult({
      capabilities: { tools: true, resources: true, prompts: false, logging: false },
    })]);
    expect(md).toContain("tools, resources");
  });

  it("includes tools table with parameters column", () => {
    const md = formatMarkdown([makeScanResult({
      tools: [{
        tool: {
          name: "get_file",
          description: "Read a file",
          parameters: [
            { name: "path", type: "string", required: true, description: "File path" },
          ],
        },
        category: "read",
      }],
      toolSummary: { read: 1, write: 0, admin: 0 },
    })]);
    expect(md).toContain("| Tool | Category | Description | Parameters |");
    expect(md).toContain("`get_file`");
    expect(md).toContain("**path**");
  });

  it("includes resources section", () => {
    const md = formatMarkdown([makeScanResult({
      resources: [{ uri: "file:///data", name: "data", description: "Data file", mimeType: "text/plain" }],
    })]);
    expect(md).toContain("### Resources");
    expect(md).toContain("`file:///data`");
  });

  it("includes prompts section", () => {
    const md = formatMarkdown([makeScanResult({
      prompts: [{
        name: "review",
        description: "Code review",
        arguments: [{ name: "code", description: "Code to review", required: true }],
      }],
    })]);
    expect(md).toContain("### Prompts");
    expect(md).toContain("`review`");
  });

  it("includes server instructions", () => {
    const md = formatMarkdown([makeScanResult({ instructions: "Be helpful." })]);
    expect(md).toContain("### Server Instructions");
    expect(md).toContain("Be helpful.");
  });

  it("handles multiple servers", () => {
    const md = formatMarkdown([
      makeScanResult({ server: { name: "a", version: "1.0" } }),
      makeScanResult({ server: { name: "b", version: "2.0" } }),
    ]);
    expect(md).toContain("## a v1.0");
    expect(md).toContain("## b v2.0");
  });

  it("includes aguarascan footer", () => {
    expect(formatMarkdown([makeScanResult()])).toContain("aguarascan.com");
  });
});
