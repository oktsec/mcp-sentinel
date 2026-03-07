import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverServers } from "../config.js";

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

import { readFile } from "node:fs/promises";

const mockReadFile = vi.mocked(readFile);

describe("discoverServers", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns empty array when no config files exist", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT"));
    const result = await discoverServers();
    expect(result).toEqual([]);
  });

  it("discovers stdio servers from config", async () => {
    const config = {
      mcpServers: {
        github: { command: "npx", args: ["@mcp/server-github"] },
        filesystem: { command: "npx", args: ["@mcp/server-fs", "/tmp"] },
      },
    };
    mockReadFile.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("claude_desktop_config")) {
        return Promise.resolve(JSON.stringify(config));
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await discoverServers();
    expect(result.length).toBe(2);
    expect(result[0]).toEqual({
      source: "Claude Desktop",
      name: "github",
      target: { type: "stdio", command: "npx", args: ["@mcp/server-github"] },
    });
    expect(result[1]).toEqual({
      source: "Claude Desktop",
      name: "filesystem",
      target: { type: "stdio", command: "npx", args: ["@mcp/server-fs", "/tmp"] },
    });
  });

  it("discovers URL servers from config", async () => {
    const config = {
      mcpServers: {
        remote: { url: "http://localhost:3000/mcp" },
      },
    };
    mockReadFile.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("claude_desktop_config")) {
        return Promise.resolve(JSON.stringify(config));
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await discoverServers();
    expect(result.length).toBe(1);
    expect(result[0]?.target).toEqual({ type: "streamable-http", url: "http://localhost:3000/mcp" });
  });

  it("discovers SSE servers when transport is sse", async () => {
    const config = {
      mcpServers: {
        legacy: { url: "http://localhost:3000/sse", transport: "sse" },
      },
    };
    mockReadFile.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("claude_desktop_config")) {
        return Promise.resolve(JSON.stringify(config));
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await discoverServers();
    expect(result[0]?.target).toEqual({ type: "sse", url: "http://localhost:3000/sse" });
  });

  it("skips entries without command or url", async () => {
    const config = {
      mcpServers: {
        invalid: { args: ["--flag"] },
        valid: { command: "node", args: ["server.js"] },
      },
    };
    mockReadFile.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("claude_desktop_config")) {
        return Promise.resolve(JSON.stringify(config));
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await discoverServers();
    expect(result.length).toBe(1);
    expect(result[0]?.name).toBe("valid");
  });

  it("skips configs with no mcpServers key", async () => {
    mockReadFile.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("claude_desktop_config")) {
        return Promise.resolve(JSON.stringify({ someOtherKey: true }));
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await discoverServers();
    expect(result).toEqual([]);
  });

  it("discovers from multiple config sources", async () => {
    mockReadFile.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("claude_desktop_config")) {
        return Promise.resolve(JSON.stringify({ mcpServers: { a: { command: "a" } } }));
      }
      if (typeof path === "string" && path.includes(".cursor")) {
        return Promise.resolve(JSON.stringify({ mcpServers: { b: { command: "b" } } }));
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await discoverServers();
    expect(result.length).toBe(2);
    expect(result[0]?.source).toBe("Claude Desktop");
    expect(result[1]?.source).toBe("Cursor");
  });

  it("handles default args when args not provided", async () => {
    const config = {
      mcpServers: {
        simple: { command: "my-server" },
      },
    };
    mockReadFile.mockImplementation((path) => {
      if (typeof path === "string" && path.includes("claude_desktop_config")) {
        return Promise.resolve(JSON.stringify(config));
      }
      return Promise.reject(new Error("ENOENT"));
    });

    const result = await discoverServers();
    expect(result[0]?.target).toEqual({ type: "stdio", command: "my-server", args: [] });
  });
});
