import { describe, it, expect } from "vitest";
import { scanWithAguara } from "../aguara.js";
import type { ToolInfo } from "../types.js";

describe("scanWithAguara", () => {
  const sampleTools: ToolInfo[] = [
    { name: "get_file", description: "Read a file" },
    { name: "write_file", description: "Write a file" },
  ];

  it("returns a result with available field", async () => {
    const result = await scanWithAguara(sampleTools);
    expect(typeof result.available).toBe("boolean");
    expect(Array.isArray(result.findings)).toBe(true);
    expect(typeof result.summary).toBe("string");
  });

  it("returns findings as an array", async () => {
    const result = await scanWithAguara(sampleTools);
    for (const finding of result.findings) {
      expect(typeof finding.severity).toBe("string");
      expect(typeof finding.ruleId).toBe("string");
      expect(typeof finding.ruleName).toBe("string");
    }
  });

  it("handles empty tool list", async () => {
    const result = await scanWithAguara([]);
    expect(typeof result.available).toBe("boolean");
    expect(typeof result.summary).toBe("string");
  });
});
