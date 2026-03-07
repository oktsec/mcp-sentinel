import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  ServerInfo,
  ServerCapabilities,
  ToolInfo,
  SchemaProperty,
  ResourceInfo,
  ResourceTemplateInfo,
  PromptInfo,
  PromptArgument,
} from "./types.js";

export interface ScanConnection {
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
    setTimeout(() => reject(new Error(`Connection timed out after ${timeout}ms`)), timeout);
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

export function getServerCapabilities(client: Client): ServerCapabilities {
  const caps = client.getServerCapabilities();
  return {
    tools: caps?.tools !== undefined,
    resources: caps?.resources !== undefined,
    prompts: caps?.prompts !== undefined,
    logging: caps?.logging !== undefined,
  };
}

function extractSchemaProperties(schema: Record<string, unknown>): SchemaProperty[] {
  const properties = schema["properties"];
  if (typeof properties !== "object" || properties === null) {
    return [];
  }

  const requiredArr = Array.isArray(schema["required"]) ? schema["required"] as string[] : [];
  const props = properties as Record<string, Record<string, unknown>>;
  const result: SchemaProperty[] = [];

  for (const [name, def] of Object.entries(props)) {
    result.push({
      name,
      type: typeof def["type"] === "string" ? def["type"] : "unknown",
      required: requiredArr.includes(name),
      description: typeof def["description"] === "string" ? def["description"] : "",
    });
  }

  return result;
}

export async function listTools(client: Client, supported: boolean): Promise<ToolInfo[]> {
  if (!supported) return [];

  const result = await client.listTools();
  return result.tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    parameters: extractSchemaProperties(tool.inputSchema as Record<string, unknown>),
    rawInputSchema: tool.inputSchema as Record<string, unknown> | undefined,
  }));
}

export async function listResources(client: Client, supported: boolean): Promise<ResourceInfo[]> {
  if (!supported) return [];

  try {
    const result = await client.listResources();
    return result.resources.map((r) => ({
      uri: r.uri,
      name: r.name ?? "",
      description: typeof r.description === "string" ? r.description : "",
      mimeType: typeof r.mimeType === "string" ? r.mimeType : "",
    }));
  } catch {
    return [];
  }
}

export async function listResourceTemplates(client: Client, supported: boolean): Promise<ResourceTemplateInfo[]> {
  if (!supported) return [];

  try {
    const result = await client.listResourceTemplates();
    return result.resourceTemplates.map((r) => ({
      uriTemplate: r.uriTemplate,
      name: r.name ?? "",
      description: typeof r.description === "string" ? r.description : "",
      mimeType: typeof r.mimeType === "string" ? r.mimeType : "",
    }));
  } catch {
    return [];
  }
}

export async function listPrompts(client: Client, supported: boolean): Promise<PromptInfo[]> {
  if (!supported) return [];

  try {
    const result = await client.listPrompts();
    return result.prompts.map((p) => ({
      name: p.name,
      description: typeof p.description === "string" ? p.description : "",
      arguments: Array.isArray(p.arguments) ? p.arguments.map((a): PromptArgument => ({
        name: a.name,
        description: typeof a.description === "string" ? a.description : "",
        required: a.required === true,
      })) : [],
    }));
  } catch {
    return [];
  }
}

export function getInstructions(client: Client): string | null {
  try {
    const instructions = client.getInstructions();
    return typeof instructions === "string" && instructions.length > 0 ? instructions : null;
  } catch {
    return null;
  }
}

export async function disconnect(connection: ScanConnection): Promise<void> {
  try { await connection.client.close(); } catch { /* cleanup */ }
  try { await connection.transport.close(); } catch { /* cleanup */ }
}
