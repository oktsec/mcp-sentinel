import { describe, it, expect } from "vitest";
import { analyzeTools, detectEnvVars, assessRisk } from "../analyzer.js";
import type { ToolInfo } from "../types.js";

describe("analyzeTools", () => {
  it("flags destructive operations", () => {
    const tools: ToolInfo[] = [
      { name: "delete_repository", description: "Delete a repository" },
    ];
    const result = analyzeTools(tools);
    expect(result[0]!.flags).toContainEqual(
      expect.objectContaining({ type: "destructive" }),
    );
    expect(result[0]!.safe).toBe(false);
  });

  it("flags execution capabilities", () => {
    const tools: ToolInfo[] = [
      { name: "run_command", description: "Execute a shell command" },
    ];
    const result = analyzeTools(tools);
    const types = result[0]!.flags.map((f) => f.type);
    expect(types).toContain("execute");
  });

  it("flags write access", () => {
    const tools: ToolInfo[] = [
      { name: "push_files", description: "Write files to a repository" },
    ];
    const result = analyzeTools(tools);
    const types = result[0]!.flags.map((f) => f.type);
    expect(types).toContain("write");
  });

  it("flags network access", () => {
    const tools: ToolInfo[] = [
      { name: "fetch_url", description: "Fetch content from a URL via HTTP" },
    ];
    const result = analyzeTools(tools);
    const types = result[0]!.flags.map((f) => f.type);
    expect(types).toContain("network");
  });

  it("marks safe tools correctly", () => {
    const tools: ToolInfo[] = [
      { name: "get_file_contents", description: "Read files from a repository" },
    ];
    const result = analyzeTools(tools);
    expect(result[0]!.safe).toBe(true);
    expect(result[0]!.flags).toHaveLength(0);
  });

  it("handles multiple flags on a single tool", () => {
    const tools: ToolInfo[] = [
      { name: "execute_and_delete", description: "Run shell command to remove files" },
    ];
    const result = analyzeTools(tools);
    const types = result[0]!.flags.map((f) => f.type);
    expect(types).toContain("destructive");
    expect(types).toContain("execute");
  });
});

describe("detectEnvVars", () => {
  it("detects environment variable patterns", () => {
    const tools: ToolInfo[] = [
      { name: "github_api", description: "Requires GITHUB_TOKEN to authenticate" },
    ];
    const result = detectEnvVars(tools);
    expect(result).toContain("GITHUB_TOKEN");
  });

  it("filters out common false positives", () => {
    const tools: ToolInfo[] = [
      { name: "get_data", description: "Returns JSON via HTTP GET request" },
    ];
    const result = detectEnvVars(tools);
    expect(result).not.toContain("JSON");
    expect(result).not.toContain("HTTP");
    expect(result).not.toContain("GET");
  });

  it("requires underscore to reduce false positives", () => {
    const tools: ToolInfo[] = [
      { name: "search", description: "Uses CUSTOM token for search" },
    ];
    const result = detectEnvVars(tools);
    expect(result).not.toContain("CUSTOM");
  });
});

describe("assessRisk", () => {
  it("returns HIGH for code execution", () => {
    const tools: ToolInfo[] = [
      { name: "run_shell", description: "Execute a bash command" },
    ];
    const analyzed = analyzeTools(tools);
    const risk = assessRisk(analyzed, []);
    expect(risk.level).toBe("HIGH");
  });

  it("returns MEDIUM for destructive operations", () => {
    const tools: ToolInfo[] = [
      { name: "delete_file", description: "Delete a file from disk" },
    ];
    const analyzed = analyzeTools(tools);
    const risk = assessRisk(analyzed, []);
    expect(risk.level).toBe("MEDIUM");
  });

  it("returns HIGH for 3+ destructive operations", () => {
    const tools: ToolInfo[] = [
      { name: "delete_file", description: "Delete a file" },
      { name: "remove_user", description: "Remove a user account" },
      { name: "drop_table", description: "Drop a database table" },
    ];
    const analyzed = analyzeTools(tools);
    const risk = assessRisk(analyzed, []);
    expect(risk.level).toBe("HIGH");
  });

  it("returns LOW for safe tools only", () => {
    const tools: ToolInfo[] = [
      { name: "get_status", description: "Get current status" },
      { name: "list_items", description: "List all items" },
    ];
    const analyzed = analyzeTools(tools);
    const risk = assessRisk(analyzed, []);
    expect(risk.level).toBe("LOW");
  });

  it("includes env var reasons when present", () => {
    const tools: ToolInfo[] = [
      { name: "get_data", description: "Get data" },
    ];
    const analyzed = analyzeTools(tools);
    const risk = assessRisk(analyzed, ["API_KEY"]);
    expect(risk.reasons.some((r) => r.message.includes("API_KEY"))).toBe(true);
  });
});
