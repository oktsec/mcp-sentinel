import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseArgs } from "../cli.js";

describe("parseArgs", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null and shows help when no args", () => {
    const result = parseArgs(["node", "mcp-inspector"]);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("returns null for --help flag", () => {
    const result = parseArgs(["node", "mcp-inspector", "--help"]);
    expect(result).toBeNull();
  });

  it("returns null for --version flag", () => {
    const result = parseArgs(["node", "mcp-inspector", "--version"]);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith("0.1.0");
  });

  it("parses a single server target", () => {
    const result = parseArgs(["node", "mcp-inspector", "npx", "@mcp/server"]);
    expect(result).toEqual({
      targets: [{ command: "npx", args: ["@mcp/server"] }],
      json: false,
      markdown: false,
      noColor: false,
      timeout: 30_000,
    });
  });

  it("parses multiple server targets separated by ---", () => {
    const result = parseArgs([
      "node", "mcp-inspector",
      "npx", "@mcp/server-a", "---", "npx", "@mcp/server-b", "arg1",
    ]);
    expect(result?.targets).toEqual([
      { command: "npx", args: ["@mcp/server-a"] },
      { command: "npx", args: ["@mcp/server-b", "arg1"] },
    ]);
  });

  it("parses --json flag", () => {
    const result = parseArgs(["node", "mcp-inspector", "--json", "npx", "@mcp/server"]);
    expect(result?.json).toBe(true);
  });

  it("parses --no-color flag", () => {
    const result = parseArgs(["node", "mcp-inspector", "--no-color", "npx", "@mcp/server"]);
    expect(result?.noColor).toBe(true);
  });

  it("parses --timeout flag", () => {
    const result = parseArgs(["node", "mcp-inspector", "--timeout", "5000", "npx", "@mcp/server"]);
    expect(result?.timeout).toBe(5000);
  });

  it("parses --markdown flag with file path", () => {
    const result = parseArgs(["node", "mcp-inspector", "--markdown", "report.md", "npx", "@mcp/server"]);
    expect(result?.markdown).toBe("report.md");
  });

  it("exits on --markdown without file path", () => {
    expect(() => {
      parseArgs(["node", "mcp-inspector", "--markdown", "--json", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on invalid timeout", () => {
    expect(() => {
      parseArgs(["node", "mcp-inspector", "--timeout", "abc", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits when only flags provided without command", () => {
    expect(() => {
      parseArgs(["node", "mcp-inspector", "--json"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("preserves server args correctly", () => {
    const result = parseArgs(["node", "mcp-inspector", "npx", "@mcp/fs", "/tmp", "/home"]);
    expect(result?.targets[0]).toEqual({
      command: "npx",
      args: ["@mcp/fs", "/tmp", "/home"],
    });
  });
});
