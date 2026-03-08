import { describe, it, expect } from "vitest";
import { analyzeTools, categorizeTool, summarize } from "../analyzer.js";
import type { ToolInfo, AguaraFinding } from "../types.js";

function makeFinding(overrides: Partial<AguaraFinding> = {}): AguaraFinding {
  return {
    severity: "HIGH",
    ruleId: "TEST_001",
    ruleName: "Test finding",
    category: "prompt-injection",
    description: "Test",
    matchedText: "test",
    toolName: "test",
    ...overrides,
  };
}

describe("categorizeTool", () => {
  it("categorizes read-only tools", () => {
    expect(categorizeTool({ name: "get_file", description: "Read a file" })).toBe("read");
    expect(categorizeTool({ name: "list_items", description: "List all items" })).toBe("read");
    expect(categorizeTool({ name: "search", description: "Search for data" })).toBe("read");
  });

  it("categorizes write tools", () => {
    expect(categorizeTool({ name: "write_file", description: "Write to a file" })).toBe("write");
    expect(categorizeTool({ name: "create_issue", description: "Create a new issue" })).toBe("write");
    expect(categorizeTool({ name: "push_files", description: "Push files to repo" })).toBe("write");
    expect(categorizeTool({ name: "upload_asset", description: "Upload an asset" })).toBe("write");
  });

  it("categorizes admin tools", () => {
    expect(categorizeTool({ name: "delete_repository", description: "Delete a repository" })).toBe("admin");
    expect(categorizeTool({ name: "run_command", description: "Execute a shell command" })).toBe("admin");
    expect(categorizeTool({ name: "drop_table", description: "Drop a database table" })).toBe("admin");
    expect(categorizeTool({ name: "purge_cache", description: "Purge the cache" })).toBe("admin");
  });

  it("admin takes priority over write", () => {
    expect(categorizeTool({ name: "delete_and_create", description: "Delete then create" })).toBe("admin");
  });

  it("matches on description too", () => {
    expect(categorizeTool({ name: "do_thing", description: "Execute a task" })).toBe("admin");
    expect(categorizeTool({ name: "do_thing", description: "Create a new item" })).toBe("write");
  });
});

describe("analyzeTools", () => {
  it("returns analyzed tools with categories", () => {
    const tools: ToolInfo[] = [
      { name: "get_data", description: "Read data" },
      { name: "write_file", description: "Write a file" },
      { name: "delete_item", description: "Delete an item" },
    ];
    const result = analyzeTools(tools);
    expect(result).toHaveLength(3);
    expect(result[0]!.category).toBe("read");
    expect(result[1]!.category).toBe("write");
    expect(result[2]!.category).toBe("admin");
  });

  it("handles empty tool list", () => {
    expect(analyzeTools([])).toEqual([]);
  });
});

describe("summarize", () => {
  it("counts categories correctly", () => {
    const tools: ToolInfo[] = [
      { name: "get_a", description: "Read" },
      { name: "get_b", description: "Read" },
      { name: "write_c", description: "Write something" },
      { name: "delete_d", description: "Delete something" },
    ];
    const analyzed = analyzeTools(tools);
    const summary = summarize(analyzed);
    expect(summary).toEqual({ read: 2, write: 1, admin: 1 });
  });

  it("handles all read tools", () => {
    const tools: ToolInfo[] = [
      { name: "list_a", description: "List" },
      { name: "get_b", description: "Get" },
    ];
    const summary = summarize(analyzeTools(tools));
    expect(summary).toEqual({ read: 2, write: 0, admin: 0 });
  });

  it("handles empty list", () => {
    expect(summarize([])).toEqual({ read: 0, write: 0, admin: 0 });
  });
});

describe("categorizeTool with aguara findings", () => {
  it("escalates read tool to admin when critical prompt-injection found", () => {
    const tool = { name: "get_fact", description: "Get a fun fact", parameters: [] };
    const findings = [makeFinding({ severity: "CRITICAL", category: "prompt-injection" })];
    expect(categorizeTool(tool, findings)).toBe("admin");
  });

  it("escalates read tool to admin when high exfiltration found", () => {
    const tool = { name: "format_text", description: "Format some text", parameters: [] };
    const findings = [makeFinding({ severity: "HIGH", category: "exfiltration" })];
    expect(categorizeTool(tool, findings)).toBe("admin");
  });

  it("does not escalate for medium findings", () => {
    const tool = { name: "get_data", description: "Get data", parameters: [] };
    const findings = [makeFinding({ severity: "MEDIUM", category: "prompt-injection" })];
    expect(categorizeTool(tool, findings)).toBe("read");
  });

  it("does not escalate for non-dangerous categories", () => {
    const tool = { name: "get_data", description: "Get data", parameters: [] };
    const findings = [makeFinding({ severity: "CRITICAL", category: "third-party-content" })];
    expect(categorizeTool(tool, findings)).toBe("read");
  });

  it("escalates for credential-leak category", () => {
    const tool = { name: "check_health", description: "Check health", parameters: [] };
    const findings = [makeFinding({ severity: "HIGH", category: "credential-leak" })];
    expect(categorizeTool(tool, findings)).toBe("admin");
  });
});

describe("analyzeTools with findings map", () => {
  it("applies per-tool findings and escalates categories", () => {
    const tools: ToolInfo[] = [
      { name: "safe_tool", description: "Safe", parameters: [] },
      { name: "evil_tool", description: "Looks safe", parameters: [] },
    ];
    const findingsByTool = new Map<string, AguaraFinding[]>();
    findingsByTool.set("evil_tool", [makeFinding({ severity: "CRITICAL", category: "exfiltration", toolName: "evil_tool" })]);

    const result = analyzeTools(tools, findingsByTool);
    expect(result[0]!.category).toBe("read");
    expect(result[0]!.findings).toHaveLength(0);
    expect(result[1]!.category).toBe("admin");
    expect(result[1]!.findings).toHaveLength(1);
  });
});
