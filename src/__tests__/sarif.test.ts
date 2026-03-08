import { describe, it, expect } from "vitest";
import { formatSarif } from "../sarif.js";
import type { ScanResult, AguaraFinding } from "../types.js";

function makeFinding(overrides: Partial<AguaraFinding> = {}): AguaraFinding {
  return {
    severity: "HIGH",
    ruleId: "TEST_001",
    ruleName: "Test finding",
    category: "prompt-injection",
    description: "A test finding",
    matchedText: "test",
    toolName: "evil_tool",
    ...overrides,
  };
}

function makeScan(overrides: Partial<ScanResult> = {}): ScanResult {
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

describe("formatSarif", () => {
  it("returns valid SARIF JSON with schema and version", () => {
    const output = formatSarif([makeScan()]);
    const sarif = JSON.parse(output) as Record<string, unknown>;
    expect(sarif["version"]).toBe("2.1.0");
    expect(sarif["$schema"]).toContain("sarif-schema");
  });

  it("has a run with mcp-sentinel driver", () => {
    const output = formatSarif([makeScan()]);
    const sarif = JSON.parse(output) as { runs: { tool: { driver: { name: string } } }[] };
    expect(sarif.runs).toHaveLength(1);
    expect(sarif.runs[0]!.tool.driver.name).toBe("mcp-sentinel");
  });

  it("returns empty results when no findings", () => {
    const sarif = JSON.parse(formatSarif([makeScan()])) as { runs: { results: unknown[] }[] };
    expect(sarif.runs[0]!.results).toHaveLength(0);
  });

  it("maps findings to SARIF results", () => {
    const scan = makeScan({
      aguara: {
        available: true,
        findings: [makeFinding(), makeFinding({ ruleId: "TEST_002", severity: "CRITICAL" })],
        summary: "2 findings",
      },
    });
    const sarif = JSON.parse(formatSarif([scan])) as { runs: { results: { ruleId: string; level: string }[] }[] };
    expect(sarif.runs[0]!.results).toHaveLength(2);
    expect(sarif.runs[0]!.results[0]!.ruleId).toBe("TEST_001");
    expect(sarif.runs[0]!.results[0]!.level).toBe("error");
  });

  it("maps severity to correct SARIF levels", () => {
    const findings = [
      makeFinding({ ruleId: "A", severity: "CRITICAL" }),
      makeFinding({ ruleId: "B", severity: "HIGH" }),
      makeFinding({ ruleId: "C", severity: "MEDIUM" }),
      makeFinding({ ruleId: "D", severity: "LOW" }),
    ];
    const scan = makeScan({ aguara: { available: true, findings, summary: "4" } });
    const sarif = JSON.parse(formatSarif([scan])) as { runs: { results: { level: string }[] }[] };
    const levels = sarif.runs[0]!.results.map((r) => r.level);
    expect(levels).toEqual(["error", "error", "warning", "note"]);
  });

  it("deduplicates rules by ruleId", () => {
    const findings = [
      makeFinding({ ruleId: "SAME_001" }),
      makeFinding({ ruleId: "SAME_001", toolName: "other_tool" }),
    ];
    const scan = makeScan({ aguara: { available: true, findings, summary: "2" } });
    const sarif = JSON.parse(formatSarif([scan])) as { runs: { tool: { driver: { rules: { id: string }[] } }; results: unknown[] }[] };
    expect(sarif.runs[0]!.tool.driver.rules).toHaveLength(1);
    expect(sarif.runs[0]!.results).toHaveLength(2);
  });

  it("includes tool name in result message and properties", () => {
    const scan = makeScan({
      aguara: { available: true, findings: [makeFinding({ toolName: "my_tool" })], summary: "1" },
    });
    const sarif = JSON.parse(formatSarif([scan])) as { runs: { results: { message: { text: string }; properties: { toolName: string } }[] }[] };
    const result = sarif.runs[0]!.results[0]!;
    expect(result.message.text).toContain("my_tool");
    expect(result.properties.toolName).toBe("my_tool");
  });

  it("includes remediation in message when present", () => {
    const scan = makeScan({
      aguara: { available: true, findings: [makeFinding({ remediation: "Remove the injection" })], summary: "1" },
    });
    const sarif = JSON.parse(formatSarif([scan])) as { runs: { results: { message: { text: string } }[] }[] };
    expect(sarif.runs[0]!.results[0]!.message.text).toContain("Remove the injection");
  });

  it("includes security-severity in rule properties", () => {
    const scan = makeScan({
      aguara: { available: true, findings: [makeFinding({ severity: "CRITICAL" })], summary: "1" },
    });
    const sarif = JSON.parse(formatSarif([scan])) as { runs: { tool: { driver: { rules: { properties: Record<string, string> }[] } } }[] };
    expect(sarif.runs[0]!.tool.driver.rules[0]!.properties["security-severity"]).toBe("9.0");
  });

  it("aggregates findings from multiple scan results", () => {
    const scan1 = makeScan({
      server: { name: "server-a", version: "1.0.0" },
      aguara: { available: true, findings: [makeFinding({ ruleId: "A" })], summary: "1" },
    });
    const scan2 = makeScan({
      server: { name: "server-b", version: "1.0.0" },
      aguara: { available: true, findings: [makeFinding({ ruleId: "B" })], summary: "1" },
    });
    const sarif = JSON.parse(formatSarif([scan1, scan2])) as { runs: { results: unknown[]; tool: { driver: { rules: unknown[] } } }[] };
    expect(sarif.runs[0]!.results).toHaveLength(2);
    expect(sarif.runs[0]!.tool.driver.rules).toHaveLength(2);
  });

  it("uses server name as location when tool name is empty", () => {
    const scan = makeScan({
      server: { name: "my-server", version: "1.0.0" },
      aguara: { available: true, findings: [makeFinding({ toolName: "" })], summary: "1" },
    });
    const sarif = JSON.parse(formatSarif([scan])) as { runs: { results: { locations: { physicalLocation: { artifactLocation: { uri: string } } }[] }[] }[] };
    expect(sarif.runs[0]!.results[0]!.locations[0]!.physicalLocation.artifactLocation.uri).toBe("my-server");
  });
});
