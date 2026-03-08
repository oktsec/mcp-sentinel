import { describe, it, expect } from "vitest";
import { evaluatePolicy } from "../policy.js";
import type { Policy, ScanResult } from "../types.js";

function baseScan(overrides: Partial<ScanResult> = {}): ScanResult {
  return {
    server: { name: "test-server", version: "1.0.0" },
    capabilities: { tools: true, resources: false, prompts: false, logging: false },
    tools: [],
    toolSummary: { read: 0, write: 0, admin: 0 },
    resources: [],
    resourceTemplates: [],
    prompts: [],
    instructions: null,
    aguara: { available: true, findings: [], summary: "0 finding(s)" },
    riskScore: { grade: "A", score: 100, breakdown: { toolRisk: 40, findingRisk: 40, surfaceRisk: 20 } },
    scanDuration: 100,
    ...overrides,
  };
}

describe("evaluatePolicy", () => {
  it("passes with empty rules", () => {
    const policy: Policy = { rules: {} };
    const result = evaluatePolicy(policy, baseScan());
    expect(result.passed).toBe(true);
    expect(result.violations).toEqual([]);
  });

  // deny.categories
  it("denies tools with forbidden categories", () => {
    const policy: Policy = { rules: { deny: { categories: ["admin"] } } };
    const scan = baseScan({
      tools: [
        { tool: { name: "delete_repo", description: "", parameters: [] }, category: "admin" },
        { tool: { name: "list_files", description: "", parameters: [] }, category: "read" },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.message).toContain("delete_repo");
    expect(result.violations[0]?.message).toContain("admin");
  });

  it("passes when no tools match denied categories", () => {
    const policy: Policy = { rules: { deny: { categories: ["admin"] } } };
    const scan = baseScan({
      tools: [
        { tool: { name: "list_files", description: "", parameters: [] }, category: "read" },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(true);
  });

  // deny.tools with patterns
  it("denies tools matching glob pattern", () => {
    const policy: Policy = { rules: { deny: { tools: ["delete_*"] } } };
    const scan = baseScan({
      tools: [
        { tool: { name: "delete_file", description: "", parameters: [] }, category: "write" },
        { tool: { name: "delete_repo", description: "", parameters: [] }, category: "admin" },
        { tool: { name: "list_files", description: "", parameters: [] }, category: "read" },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2);
  });

  it("denies tools by exact name", () => {
    const policy: Policy = { rules: { deny: { tools: ["execute_command"] } } };
    const scan = baseScan({
      tools: [
        { tool: { name: "execute_command", description: "", parameters: [] }, category: "admin" },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations[0]?.message).toContain("execute_command");
  });

  // require.aguara
  it("fails when aguara is required but not installed", () => {
    const policy: Policy = { rules: { require: { aguara: "clean" } } };
    const scan = baseScan({
      aguara: { available: false, findings: [], summary: "not installed" },
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations[0]?.message).toContain("not installed");
  });

  it("fails when aguara is required clean but has findings", () => {
    const policy: Policy = { rules: { require: { aguara: "clean" } } };
    const scan = baseScan({
      aguara: {
        available: true,
        findings: [{ severity: "HIGH", ruleId: "MCP_001", ruleName: "injection", category: "test", description: "", matchedText: "", toolName: "" }],
        summary: "1 finding",
      },
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations[0]?.message).toContain("1 security issue");
  });

  it("passes when aguara is clean", () => {
    const policy: Policy = { rules: { require: { aguara: "clean" } } };
    const scan = baseScan();
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(true);
  });

  // require.maxTools
  it("fails when tool count exceeds maxTools", () => {
    const policy: Policy = { rules: { require: { maxTools: 5 } } };
    const tools = Array.from({ length: 10 }, (_, i) => ({
      tool: { name: `tool_${i}`, description: "", parameters: [] },
      category: "read" as const, findings: [],
    }));
    const scan = baseScan({ tools });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations[0]?.message).toContain("10 tools");
    expect(result.violations[0]?.message).toContain("max 5");
  });

  it("passes when tool count is within maxTools", () => {
    const policy: Policy = { rules: { require: { maxTools: 20 } } };
    const scan = baseScan({
      tools: [{ tool: { name: "a", description: "", parameters: [] }, category: "read" }],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(true);
  });

  // allow exceptions
  it("allows specific tools even in denied categories", () => {
    const policy: Policy = {
      rules: {
        deny: { categories: ["admin"] },
        allow: { tools: ["delete_cache"] },
      },
    };
    const scan = baseScan({
      tools: [
        { tool: { name: "delete_cache", description: "", parameters: [] }, category: "admin" },
        { tool: { name: "delete_repo", description: "", parameters: [] }, category: "admin" },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.message).toContain("delete_repo");
  });

  it("allows tools by pattern in exceptions", () => {
    const policy: Policy = {
      rules: {
        deny: { tools: ["execute_*"] },
        allow: { tools: ["execute_query"] },
      },
    };
    const scan = baseScan({
      tools: [
        { tool: { name: "execute_query", description: "", parameters: [] }, category: "read" },
        { tool: { name: "execute_shell", description: "", parameters: [] }, category: "admin" },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.message).toContain("execute_shell");
  });

  // deny.descriptions
  it("denies tools by description pattern", () => {
    const policy: Policy = { rules: { deny: { descriptions: ["*ssh*", "*credentials*"] } } };
    const scan = baseScan({
      tools: [
        { tool: { name: "check_health", description: "Reads ~/.ssh/id_rsa for diagnostics", parameters: [] }, category: "read", findings: [] },
        { tool: { name: "add_numbers", description: "Add two numbers", parameters: [] }, category: "read", findings: [] },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]?.message).toContain("check_health");
    expect(result.violations[0]?.message).toContain("*ssh*");
  });

  it("allows tool excepted from description deny", () => {
    const policy: Policy = {
      rules: {
        deny: { descriptions: ["*ssh*"] },
        allow: { tools: ["check_health"] },
      },
    };
    const scan = baseScan({
      tools: [
        { tool: { name: "check_health", description: "Reads ~/.ssh/id_rsa", parameters: [] }, category: "read", findings: [] },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(true);
  });

  // require.maxFindings
  it("fails when findings exceed maxFindings per severity", () => {
    const policy: Policy = { rules: { require: { maxFindings: { critical: 0, high: 1 } } } };
    const scan = baseScan({
      aguara: {
        available: true,
        findings: [
          { severity: "CRITICAL", ruleId: "A", ruleName: "a", category: "test", description: "", matchedText: "", toolName: "" },
          { severity: "HIGH", ruleId: "B", ruleName: "b", category: "test", description: "", matchedText: "", toolName: "" },
          { severity: "HIGH", ruleId: "C", ruleName: "c", category: "test", description: "", matchedText: "", toolName: "" },
        ],
        summary: "3 findings",
      },
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    expect(result.violations).toHaveLength(2); // 1 critical > 0, 2 high > 1
  });

  it("passes when findings are within maxFindings limits", () => {
    const policy: Policy = { rules: { require: { maxFindings: { critical: 0, high: 2 } } } };
    const scan = baseScan({
      aguara: {
        available: true,
        findings: [
          { severity: "HIGH", ruleId: "A", ruleName: "a", category: "test", description: "", matchedText: "", toolName: "" },
        ],
        summary: "1 finding",
      },
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(true);
  });

  // Combined rules
  it("evaluates multiple rules together", () => {
    const policy: Policy = {
      rules: {
        deny: { categories: ["admin"], tools: ["push_*"] },
        require: { maxTools: 3 },
      },
    };
    const scan = baseScan({
      tools: [
        { tool: { name: "list_files", description: "", parameters: [] }, category: "read" },
        { tool: { name: "push_code", description: "", parameters: [] }, category: "write" },
        { tool: { name: "delete_all", description: "", parameters: [] }, category: "admin" },
        { tool: { name: "read_file", description: "", parameters: [] }, category: "read" },
      ],
    });
    const result = evaluatePolicy(policy, scan);
    expect(result.passed).toBe(false);
    // admin tool + push_* pattern + maxTools(4 > 3) = 3 violations
    expect(result.violations).toHaveLength(3);
  });
});
