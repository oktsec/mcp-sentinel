import { describe, it, expect } from "vitest";
import { diffScans } from "../diff.js";
import type { ScanResult } from "../types.js";

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
    aguara: { available: false, findings: [], summary: "" },
    riskScore: { grade: "A", score: 100, breakdown: { toolRisk: 40, findingRisk: 40, surfaceRisk: 20 } },
    scanDuration: 100,
    ...overrides,
  };
}

describe("diffScans", () => {
  it("returns no entries for identical scans", () => {
    const scan = baseScan();
    const result = diffScans(scan, scan);
    expect(result.entries).toEqual([]);
    expect(result.server).toBe("test-server");
  });

  it("detects version change", () => {
    const prev = baseScan();
    const curr = baseScan({ server: { name: "test-server", version: "2.0.0" } });
    const result = diffScans(prev, curr);
    expect(result.entries).toEqual([{
      kind: "changed",
      area: "version",
      name: "server version",
      detail: "1.0.0 → 2.0.0",
    }]);
  });

  it("detects added capability", () => {
    const prev = baseScan();
    const curr = baseScan({ capabilities: { tools: true, resources: true, prompts: false, logging: false } });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "added", area: "capability", name: "resources" });
  });

  it("detects removed capability", () => {
    const prev = baseScan();
    const curr = baseScan({ capabilities: { tools: false, resources: false, prompts: false, logging: false } });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "removed", area: "capability", name: "tools" });
  });

  it("detects added tool", () => {
    const prev = baseScan();
    const curr = baseScan({
      tools: [{ tool: { name: "new_tool", description: "A new tool", parameters: [] }, category: "read" }],
    });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "added", area: "tool", name: "new_tool", detail: "read" });
  });

  it("detects removed tool", () => {
    const prev = baseScan({
      tools: [{ tool: { name: "old_tool", description: "An old tool", parameters: [] }, category: "write" }],
    });
    const curr = baseScan();
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "removed", area: "tool", name: "old_tool" });
  });

  it("detects changed tool category", () => {
    const tool = { name: "file_write", description: "Write files", parameters: [] };
    const prev = baseScan({ tools: [{ tool, category: "read" }] });
    const curr = baseScan({ tools: [{ tool, category: "write" }] });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({
      kind: "changed", area: "tool", name: "file_write",
      detail: "category: read → write",
    });
  });

  it("detects changed tool parameters", () => {
    const prevTool = {
      name: "query",
      description: "Query data",
      parameters: [{ name: "q", type: "string", required: true, description: "" }],
    };
    const currTool = {
      name: "query",
      description: "Query data",
      parameters: [
        { name: "q", type: "string", required: true, description: "" },
        { name: "limit", type: "number", required: false, description: "" },
      ],
    };
    const prev = baseScan({ tools: [{ tool: prevTool, category: "read" }] });
    const curr = baseScan({ tools: [{ tool: currTool, category: "read" }] });
    const result = diffScans(prev, curr);
    expect(result.entries[0]?.kind).toBe("changed");
    expect(result.entries[0]?.detail).toContain("params:");
  });

  it("detects added and removed resources", () => {
    const prev = baseScan({
      resources: [{ uri: "file:///old.txt", name: "old", description: "", mimeType: "" }],
    });
    const curr = baseScan({
      resources: [{ uri: "file:///new.txt", name: "new", description: "", mimeType: "" }],
    });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "added", area: "resource", name: "file:///new.txt" });
    expect(result.entries).toContainEqual({ kind: "removed", area: "resource", name: "file:///old.txt" });
  });

  it("detects added and removed prompts", () => {
    const prev = baseScan({
      prompts: [{ name: "old_prompt", description: "Old", arguments: [] }],
    });
    const curr = baseScan({
      prompts: [{ name: "new_prompt", description: "New", arguments: [] }],
    });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "added", area: "prompt", name: "new_prompt" });
    expect(result.entries).toContainEqual({ kind: "removed", area: "prompt", name: "old_prompt" });
  });

  it("detects instruction changes", () => {
    const prev = baseScan({ instructions: null });
    const curr = baseScan({ instructions: "You are a helpful assistant." });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "added", area: "instruction", name: "server instructions" });
  });

  it("detects instruction removal", () => {
    const prev = baseScan({ instructions: "Old instructions" });
    const curr = baseScan({ instructions: null });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "removed", area: "instruction", name: "server instructions" });
  });

  it("detects instruction modification", () => {
    const prev = baseScan({ instructions: "Old instructions" });
    const curr = baseScan({ instructions: "New instructions" });
    const result = diffScans(prev, curr);
    expect(result.entries).toContainEqual({ kind: "changed", area: "instruction", name: "server instructions" });
  });
});
