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

  it("parses a single stdio server target", () => {
    const result = parseArgs(["node", "mcp-inspector", "npx", "@mcp/server"]);
    expect(result).toEqual({
      targets: [{ type: "stdio", command: "npx", args: ["@mcp/server"] }],
      json: false,
      markdown: false,
      noColor: false,
      timeout: 30_000,
      diff: false,
    });
  });

  it("parses multiple server targets separated by ---", () => {
    const result = parseArgs([
      "node", "mcp-inspector",
      "npx", "@mcp/server-a", "---", "npx", "@mcp/server-b", "arg1",
    ]);
    expect(result?.targets).toEqual([
      { type: "stdio", command: "npx", args: ["@mcp/server-a"] },
      { type: "stdio", command: "npx", args: ["@mcp/server-b", "arg1"] },
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
      type: "stdio",
      command: "npx",
      args: ["@mcp/fs", "/tmp", "/home"],
    });
  });

  // URL-based targets
  it("parses an HTTP URL as streamable-http target", () => {
    const result = parseArgs(["node", "mcp-inspector", "http://localhost:3000/mcp"]);
    expect(result?.targets[0]).toEqual({
      type: "streamable-http",
      url: "http://localhost:3000/mcp",
    });
  });

  it("parses an HTTPS URL as streamable-http target", () => {
    const result = parseArgs(["node", "mcp-inspector", "https://example.com/mcp"]);
    expect(result?.targets[0]).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
    });
  });

  it("uses sse transport when --transport sse with URL", () => {
    const result = parseArgs(["node", "mcp-inspector", "--transport", "sse", "http://localhost:3000/sse"]);
    expect(result?.targets[0]).toEqual({
      type: "sse",
      url: "http://localhost:3000/sse",
    });
  });

  it("exits on --transport with invalid value", () => {
    expect(() => {
      parseArgs(["node", "mcp-inspector", "--transport", "invalid", "http://localhost:3000/mcp"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on --transport stdio with URL target", () => {
    expect(() => {
      parseArgs(["node", "mcp-inspector", "--transport", "stdio", "http://localhost:3000/mcp"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on --transport sse with command target", () => {
    expect(() => {
      parseArgs(["node", "mcp-inspector", "--transport", "sse", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits when URL target has extra args", () => {
    expect(() => {
      parseArgs(["node", "mcp-inspector", "http://localhost:3000/mcp", "extra"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("mixes stdio and URL targets with ---", () => {
    const result = parseArgs([
      "node", "mcp-inspector",
      "npx", "@mcp/server-a", "---", "http://localhost:3000/mcp",
    ]);
    expect(result?.targets).toEqual([
      { type: "stdio", command: "npx", args: ["@mcp/server-a"] },
      { type: "streamable-http", url: "http://localhost:3000/mcp" },
    ]);
  });
});
