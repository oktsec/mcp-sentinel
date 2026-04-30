import { describe, it, expect } from "vitest";
import { formatOutput, formatJson, formatError, formatDiff, formatPolicyResult } from "../formatter.js";
import type { ScanResult, DiffResult, PolicyResult, AguaraFinding } from "../types.js";

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
        { tool: { name: "a", description: "A", parameters: [] }, category: "read", findings: [] },
        { tool: { name: "b", description: "B", parameters: [] }, category: "write", findings: [] },
      ],
      toolSummary: { read: 1, write: 1, admin: 0 },
    }));
    expect(output).toContain("1 read");
    expect(output).toContain("1 write");
  });

  it("shows parameter names with required markers", () => {
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
        findings: [],
      }],
    }));
    expect(output).toContain("title");
    expect(output).toContain("body");
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

  it("shows risk score grade and numeric score", () => {
    const output = formatOutput(makeScanResult({
      riskScore: { grade: "B", score: 82, breakdown: { toolRisk: 34, findingRisk: 40, surfaceRisk: 8 } },
    }));
    expect(output).toContain("Risk Score");
    expect(output).toContain("B");
    expect(output).toContain("82/100");
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

describe("formatOutput verbose mode", () => {
  it("shows full descriptions in verbose mode", () => {
    const longDesc = "This is a very long tool description that would normally be truncated but in verbose mode should be shown in full";
    const output = formatOutput(makeScanResult({
      tools: [{
        tool: { name: "test_tool", description: longDesc, parameters: [] },
        category: "read",
        findings: [],
      }],
    }), { verbose: true });
    expect(output).toContain("shown in full");
  });

  // Tool descriptions come from the MCP server we are scanning and
  // are not under our control. The sanitiser must not leave any
  // "<script"-shaped substring in the rendered output: a
  // well-formed tag, a malformed tag with no closing ">", and a
  // nested-tag re-form attack all need to land safely.
  it("strips angle-bracket markup from tool descriptions even when malformed", () => {
    const payloads = [
      "<script>alert(1)</script>",
      "<scr<script>ipt>alert(2)</script>",
      "<script alert(3)",                 // no closing ">"
      "before <b>bold</b> after",         // legitimate inline markup
    ];
    for (const description of payloads) {
      const output = formatOutput(makeScanResult({
        tools: [{
          tool: { name: "evil_tool", description, parameters: [] },
          category: "read",
          findings: [],
        }],
      }), { verbose: true });
      expect(output, `payload ${JSON.stringify(description)} leaked < bytes`).not.toContain("<");
      expect(output, `payload ${JSON.stringify(description)} leaked > bytes`).not.toContain(">");
      expect(output).not.toContain("<script");
    }
  });

  it("shows finding details in verbose mode", () => {
    const finding: AguaraFinding = {
      severity: "HIGH", ruleId: "MCP_001", ruleName: "Prompt injection detected",
      category: "prompt-injection", description: "Tool contains injection patterns",
      matchedText: "ignore all", toolName: "evil_tool", remediation: "Remove injection patterns",
    };
    const output = formatOutput(makeScanResult({
      aguara: { available: true, findings: [finding], summary: "1 finding" },
    }), { verbose: true });
    expect(output).toContain("MCP_001");
    expect(output).toContain("Remove injection patterns");
  });

  it("shows aguara install hint when not available", () => {
    const output = formatOutput(makeScanResult({
      aguara: { available: false, findings: [], summary: "not installed" },
    }));
    expect(output).toContain("aguara");
    expect(output).toContain("deep security analysis");
  });

  it("shows clean message when aguara has no findings", () => {
    const output = formatOutput(makeScanResult({
      aguara: { available: true, findings: [], summary: "0 findings" },
    }));
    expect(output).toContain("No security findings");
  });
});

describe("formatDiff", () => {
  it("shows no changes message when diff is empty", () => {
    const diff: DiffResult = { server: "test-server", entries: [] };
    const output = formatDiff(diff);
    expect(output).toContain("No changes detected");
  });

  it("shows server name in header", () => {
    const diff: DiffResult = { server: "my-server", entries: [] };
    const output = formatDiff(diff);
    expect(output).toContain("my-server");
  });

  it("shows added entries with + icon", () => {
    const diff: DiffResult = {
      server: "test",
      entries: [{ kind: "added", area: "tool", name: "new_tool" }],
    };
    const output = formatDiff(diff);
    expect(output).toContain("+");
    expect(output).toContain("added");
    expect(output).toContain("new_tool");
  });

  it("shows removed entries with - icon", () => {
    const diff: DiffResult = {
      server: "test",
      entries: [{ kind: "removed", area: "tool", name: "old_tool" }],
    };
    const output = formatDiff(diff);
    expect(output).toContain("-");
    expect(output).toContain("removed");
    expect(output).toContain("old_tool");
  });

  it("shows changed entries with ~ icon", () => {
    const diff: DiffResult = {
      server: "test",
      entries: [{ kind: "changed", area: "tool", name: "mod_tool", detail: "description changed" }],
    };
    const output = formatDiff(diff);
    expect(output).toContain("~");
    expect(output).toContain("changed");
    expect(output).toContain("description changed");
  });

  it("shows change count", () => {
    const diff: DiffResult = {
      server: "test",
      entries: [
        { kind: "added", area: "tool", name: "a" },
        { kind: "removed", area: "tool", name: "b" },
      ],
    };
    const output = formatDiff(diff);
    expect(output).toContain("2 change(s)");
  });
});

describe("formatPolicyResult", () => {
  it("shows passed message when policy passes", () => {
    const result: PolicyResult = { passed: true, violations: [] };
    const output = formatPolicyResult(result, "my-server");
    expect(output).toContain("my-server");
    expect(output).toContain("policy passed");
  });

  it("shows FAILED and violation count when policy fails", () => {
    const result: PolicyResult = {
      passed: false,
      violations: [
        { rule: "deny.categories", message: "Tool delete_repo uses denied category: admin" },
      ],
    };
    const output = formatPolicyResult(result, "my-server");
    expect(output).toContain("policy FAILED");
    expect(output).toContain("1 violation");
    expect(output).toContain("deny.categories");
    expect(output).toContain("delete_repo");
  });

  it("pluralizes violations correctly", () => {
    const result: PolicyResult = {
      passed: false,
      violations: [
        { rule: "deny.categories", message: "Violation 1" },
        { rule: "deny.tools", message: "Violation 2" },
      ],
    };
    const output = formatPolicyResult(result, "test");
    expect(output).toContain("2 violations");
  });
});

describe("formatError", () => {
  it("includes the error message", () => {
    expect(formatError("Connection failed")).toContain("Connection failed");
  });
});
