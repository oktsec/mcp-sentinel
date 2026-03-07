import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir, platform } from "node:os";
import type { ServerTarget } from "./types.js";

interface McpServerEntry {
  command?: string;
  args?: string[];
  url?: string;
  transport?: string;
}

interface McpConfigFile {
  mcpServers?: Record<string, McpServerEntry>;
}

interface ConfigSource {
  name: string;
  path: string;
}

function getConfigPaths(): ConfigSource[] {
  const home = homedir();
  const os = platform();
  const sources: ConfigSource[] = [];

  if (os === "darwin") {
    sources.push(
      { name: "Claude Desktop", path: join(home, "Library/Application Support/Claude/claude_desktop_config.json") },
      { name: "Cursor", path: join(home, ".cursor/mcp.json") },
      { name: "Windsurf", path: join(home, ".codeium/windsurf/mcp_config.json") },
    );
  } else if (os === "win32") {
    const appData = process.env["APPDATA"] ?? join(home, "AppData/Roaming");
    sources.push(
      { name: "Claude Desktop", path: join(appData, "Claude/claude_desktop_config.json") },
      { name: "Cursor", path: join(home, ".cursor/mcp.json") },
      { name: "Windsurf", path: join(home, ".codeium/windsurf/mcp_config.json") },
    );
  } else {
    // Linux
    const configDir = process.env["XDG_CONFIG_HOME"] ?? join(home, ".config");
    sources.push(
      { name: "Claude Desktop", path: join(configDir, "Claude/claude_desktop_config.json") },
      { name: "Cursor", path: join(home, ".cursor/mcp.json") },
      { name: "Windsurf", path: join(home, ".codeium/windsurf/mcp_config.json") },
    );
  }

  return sources;
}

function entryToTarget(entry: McpServerEntry): ServerTarget | null {
  if (entry.url !== undefined) {
    const transport = entry.transport === "sse" ? "sse" as const : "streamable-http" as const;
    return { type: transport, url: entry.url };
  }

  if (entry.command !== undefined) {
    return { type: "stdio", command: entry.command, args: entry.args ?? [] };
  }

  return null;
}

export interface DiscoveredServer {
  source: string;
  name: string;
  target: ServerTarget;
}

export async function discoverServers(): Promise<DiscoveredServer[]> {
  const sources = getConfigPaths();
  const discovered: DiscoveredServer[] = [];

  for (const source of sources) {
    try {
      const raw = await readFile(source.path, "utf-8");
      const config = JSON.parse(raw) as McpConfigFile;

      if (config.mcpServers === undefined || typeof config.mcpServers !== "object") {
        continue;
      }

      for (const [name, entry] of Object.entries(config.mcpServers)) {
        const target = entryToTarget(entry);
        if (target !== null) {
          discovered.push({ source: source.name, name, target });
        }
      }
    } catch {
      // File doesn't exist or is invalid — skip silently
    }
  }

  return discovered;
}
