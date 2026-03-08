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
    const result = parseArgs(["node", "mcp-sentinel"]);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("returns null for --help flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--help"]);
    expect(result).toBeNull();
  });

  it("returns null for --version flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--version"]);
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalledWith("0.1.4");
  });

  it("parses a single stdio server target", () => {
    const result = parseArgs(["node", "mcp-sentinel", "npx", "@mcp/server"]);
    expect(result).toEqual({
      targets: [{ type: "stdio", command: "npx", args: ["@mcp/server"] }],
      json: false,
      markdown: false,
      noColor: false,
      timeout: 30_000,
      diff: false,
      config: false,
      failOnFindings: false,
      policy: false,
      verbose: false,
      sarif: false,
      header: [],
    });
  });

  it("parses multiple server targets separated by ---", () => {
    const result = parseArgs([
      "node", "mcp-sentinel",
      "npx", "@mcp/server-a", "---", "npx", "@mcp/server-b", "arg1",
    ]);
    expect(result?.targets).toEqual([
      { type: "stdio", command: "npx", args: ["@mcp/server-a"] },
      { type: "stdio", command: "npx", args: ["@mcp/server-b", "arg1"] },
    ]);
  });

  it("parses --json flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--json", "npx", "@mcp/server"]);
    expect(result?.json).toBe(true);
  });

  it("parses --no-color flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--no-color", "npx", "@mcp/server"]);
    expect(result?.noColor).toBe(true);
  });

  it("parses --timeout flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--timeout", "5000", "npx", "@mcp/server"]);
    expect(result?.timeout).toBe(5000);
  });

  it("parses --markdown flag with file path", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--markdown", "report.md", "npx", "@mcp/server"]);
    expect(result?.markdown).toBe("report.md");
  });

  it("exits on --markdown without file path", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--markdown", "--json", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on invalid timeout", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--timeout", "abc", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits when only flags provided without command", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--json"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("preserves server args correctly", () => {
    const result = parseArgs(["node", "mcp-sentinel", "npx", "@mcp/fs", "/tmp", "/home"]);
    expect(result?.targets[0]).toEqual({
      type: "stdio",
      command: "npx",
      args: ["@mcp/fs", "/tmp", "/home"],
    });
  });

  // URL-based targets
  it("parses an HTTP URL as streamable-http target", () => {
    const result = parseArgs(["node", "mcp-sentinel", "http://localhost:3000/mcp"]);
    expect(result?.targets[0]).toEqual({
      type: "streamable-http",
      url: "http://localhost:3000/mcp",
    });
  });

  it("parses an HTTPS URL as streamable-http target", () => {
    const result = parseArgs(["node", "mcp-sentinel", "https://example.com/mcp"]);
    expect(result?.targets[0]).toEqual({
      type: "streamable-http",
      url: "https://example.com/mcp",
    });
  });

  it("uses sse transport when --transport sse with URL", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--transport", "sse", "http://localhost:3000/sse"]);
    expect(result?.targets[0]).toEqual({
      type: "sse",
      url: "http://localhost:3000/sse",
    });
  });

  it("exits on --transport with invalid value", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--transport", "invalid", "http://localhost:3000/mcp"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on --transport stdio with URL target", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--transport", "stdio", "http://localhost:3000/mcp"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits on --transport sse with command target", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--transport", "sse", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("exits when URL target has extra args", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "http://localhost:3000/mcp", "extra"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("mixes stdio and URL targets with ---", () => {
    const result = parseArgs([
      "node", "mcp-sentinel",
      "npx", "@mcp/server-a", "---", "http://localhost:3000/mcp",
    ]);
    expect(result?.targets).toEqual([
      { type: "stdio", command: "npx", args: ["@mcp/server-a"] },
      { type: "streamable-http", url: "http://localhost:3000/mcp" },
    ]);
  });

  // --diff
  it("parses --diff flag with file path", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--diff", "baseline.json", "npx", "@mcp/server"]);
    expect(result?.diff).toBe("baseline.json");
  });

  it("exits on --diff without file path", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--diff", "--json", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // --policy
  it("parses --policy with explicit file path", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--policy", "my-policy.yml", "npx", "@mcp/server"]);
    expect(result?.policy).toBe("my-policy.yml");
  });

  it("parses --policy without file as auto-detect", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--policy", "--json", "npx", "@mcp/server"]);
    expect(result?.policy).toBe("auto");
  });

  // --fail-on-findings
  it("parses --fail-on-findings flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--fail-on-findings", "npx", "@mcp/server"]);
    expect(result?.failOnFindings).toBe(true);
  });

  // --verbose
  it("parses --verbose flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--verbose", "npx", "@mcp/server"]);
    expect(result?.verbose).toBe(true);
  });

  // --sarif
  it("parses --sarif flag with file path", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--sarif", "report.sarif", "npx", "@mcp/server"]);
    expect(result?.sarif).toBe("report.sarif");
  });

  it("exits on --sarif without file path", () => {
    expect(() => {
      parseArgs(["node", "mcp-sentinel", "--sarif", "--json", "npx", "@mcp/server"]);
    }).toThrow("process.exit called");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  // --header
  it("parses single --header flag", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--header", "Authorization: Bearer xxx", "http://localhost:3000/mcp"]);
    expect(result?.header).toEqual(["Authorization: Bearer xxx"]);
  });

  it("parses multiple --header flags", () => {
    const result = parseArgs([
      "node", "mcp-sentinel",
      "--header", "Authorization: Bearer xxx",
      "--header", "X-Custom: value",
      "http://localhost:3000/mcp",
    ]);
    expect(result?.header).toEqual(["Authorization: Bearer xxx", "X-Custom: value"]);
  });

  // --config
  it("parses --config flag with no targets", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--config"]);
    expect(result?.config).toBe(true);
    expect(result?.targets).toEqual([]);
  });

  it("parses --config flag with additional targets", () => {
    const result = parseArgs(["node", "mcp-sentinel", "--config", "npx", "@mcp/server"]);
    expect(result?.config).toBe(true);
    expect(result?.targets).toEqual([{ type: "stdio", command: "npx", args: ["@mcp/server"] }]);
  });
});
