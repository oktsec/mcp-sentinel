import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { ToolInfo, ServerInfo } from "./types.js";

interface ScanConnection {
  client: Client;
  transport: StdioClientTransport;
}

export async function connectToServer(
  command: string,
  args: string[],
  timeout: number,
): Promise<ScanConnection> {
  const transport = new StdioClientTransport({
    command,
    args,
    stderr: "pipe",
  });

  const client = new Client({
    name: "mcp-inspector",
    version: "0.1.0",
  });

  const connectPromise = client.connect(transport);

  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`Connection timed out after ${timeout}ms`));
    }, timeout);
  });

  await Promise.race([connectPromise, timeoutPromise]);

  return { client, transport };
}

export function getServerInfo(client: Client): ServerInfo {
  const info = client.getServerVersion();
  return {
    name: info?.name ?? "unknown",
    version: info?.version ?? "unknown",
  };
}

export async function listTools(client: Client): Promise<ToolInfo[]> {
  const result = await client.listTools();

  return result.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
  }));
}

export async function disconnect(connection: ScanConnection): Promise<void> {
  try {
    await connection.client.close();
  } catch {
    // Ignore cleanup errors
  }
  try {
    await connection.transport.close();
  } catch {
    // Ignore cleanup errors
  }
}
