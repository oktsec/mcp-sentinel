import { describe, it, expect } from "vitest";
import { calculateScore } from "../score.js";
import type { AguaraFinding } from "../types.js";

function makeFinding(severity: string): AguaraFinding {
  return {
    severity,
    ruleId: "T",
    ruleName: "test",
    category: "test",
    description: "",
    matchedText: "",
    toolName: "",
  };
}

describe("calculateScore", () => {
  it("gives grade A for a clean read-only server", () => {
    const result = calculateScore({
      toolSummary: { read: 3, write: 0, admin: 0 },
      toolCount: 3,
      findings: [],
      hasInstructions: false,
    });
    expect(result.grade).toBe("A");
    expect(result.score).toBe(100);
  });

  it("deducts for write tools", () => {
    const result = calculateScore({
      toolSummary: { read: 2, write: 2, admin: 0 },
      toolCount: 4,
      findings: [],
      hasInstructions: false,
    });
    expect(result.breakdown.toolRisk).toBe(34); // 40 - 2*3
    expect(result.score).toBe(94);
  });

  it("deducts for admin tools", () => {
    const result = calculateScore({
      toolSummary: { read: 1, write: 0, admin: 2 },
      toolCount: 3,
      findings: [],
      hasInstructions: false,
    });
    expect(result.breakdown.toolRisk).toBe(24); // 40 - 2*8
    expect(result.score).toBe(84);
  });

  it("gives grade F for many admin tools with critical findings", () => {
    const result = calculateScore({
      toolSummary: { read: 0, write: 0, admin: 5 },
      toolCount: 5,
      findings: [makeFinding("CRITICAL"), makeFinding("CRITICAL"), makeFinding("CRITICAL")],
      hasInstructions: true,
    });
    expect(result.grade).toBe("F");
    expect(result.score).toBeLessThan(35);
  });

  it("deducts per finding weighted by severity", () => {
    const result = calculateScore({
      toolSummary: { read: 5, write: 0, admin: 0 },
      toolCount: 5,
      findings: [makeFinding("HIGH"), makeFinding("MEDIUM")],
      hasInstructions: false,
    });
    expect(result.breakdown.findingRisk).toBe(29); // 40 - 8 - 3
  });

  it("deducts for large tool counts (>20)", () => {
    const result = calculateScore({
      toolSummary: { read: 25, write: 0, admin: 0 },
      toolCount: 25,
      findings: [],
      hasInstructions: false,
    });
    expect(result.breakdown.surfaceRisk).toBe(10); // 20 - 10
  });

  it("deducts for medium tool counts (11-20)", () => {
    const result = calculateScore({
      toolSummary: { read: 15, write: 0, admin: 0 },
      toolCount: 15,
      findings: [],
      hasInstructions: false,
    });
    expect(result.breakdown.surfaceRisk).toBe(15); // 20 - 5
  });

  it("deducts for server instructions", () => {
    const result = calculateScore({
      toolSummary: { read: 3, write: 0, admin: 0 },
      toolCount: 3,
      findings: [],
      hasInstructions: true,
    });
    expect(result.breakdown.surfaceRisk).toBe(18); // 20 - 2
  });

  it("clamps scores to 0 minimum", () => {
    const result = calculateScore({
      toolSummary: { read: 0, write: 0, admin: 10 },
      toolCount: 10,
      findings: Array.from({ length: 10 }, () => makeFinding("CRITICAL")),
      hasInstructions: true,
    });
    expect(result.breakdown.toolRisk).toBe(0);
    expect(result.breakdown.findingRisk).toBe(0);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.grade).toBe("F");
  });

  it("maps scores to correct grades", () => {
    expect(calculateScore({ toolSummary: { read: 3, write: 0, admin: 0 }, toolCount: 3, findings: [], hasInstructions: false }).grade).toBe("A");
    expect(calculateScore({ toolSummary: { read: 0, write: 0, admin: 2 }, toolCount: 2, findings: [], hasInstructions: false }).grade).toBe("B");
    expect(calculateScore({ toolSummary: { read: 0, write: 0, admin: 3 }, toolCount: 3, findings: [makeFinding("HIGH")], hasInstructions: true }).grade).toBe("C");
    expect(calculateScore({ toolSummary: { read: 0, write: 0, admin: 5 }, toolCount: 5, findings: [makeFinding("CRITICAL")], hasInstructions: true }).grade).toBe("D");
  });
});
