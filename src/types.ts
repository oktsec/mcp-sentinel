export type ToolCategory = "read" | "write" | "admin";

// --- Server metadata ---

export interface ServerInfo {
  name: string;
  version: string;
}

export interface ServerCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  logging: boolean;
}

// --- Tools ---

export interface SchemaProperty {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  parameters: SchemaProperty[];
  rawInputSchema?: Record<string, unknown>;
}

export interface AnalyzedTool {
  tool: ToolInfo;
  category: ToolCategory;
  findings: AguaraFinding[];
}

// --- Resources ---

export interface ResourceInfo {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceTemplateInfo {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
}

// --- Prompts ---

export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptInfo {
  name: string;
  description: string;
  arguments: PromptArgument[];
}

// --- Aguara ---

export interface AguaraFinding {
  severity: string;
  ruleId: string;
  ruleName: string;
  category: string;
  description: string;
  matchedText: string;
  toolName: string;
  line?: number;
  confidence?: number;
  score?: number;
  remediation?: string;
}

export interface AguaraResult {
  available: boolean;
  findings: AguaraFinding[];
  summary: string;
  rulesLoaded?: number;
  durationMs?: number;
}

// --- Scan result ---

export interface ScanResult {
  server: ServerInfo;
  capabilities: ServerCapabilities;
  tools: AnalyzedTool[];
  toolSummary: { read: number; write: number; admin: number };
  resources: ResourceInfo[];
  resourceTemplates: ResourceTemplateInfo[];
  prompts: PromptInfo[];
  instructions: string | null;
  aguara: AguaraResult;
  scanDuration: number;
}

export type ServerTarget =
  | { type: "stdio"; command: string; args: string[] }
  | { type: "sse"; url: string }
  | { type: "streamable-http"; url: string };

// --- Diff ---

export interface DiffEntry {
  kind: "added" | "removed" | "changed";
  area: "tool" | "resource" | "resource-template" | "prompt" | "capability" | "instruction" | "version";
  name: string;
  detail?: string;
}

export interface DiffResult {
  server: string;
  entries: DiffEntry[];
}

// --- Policy ---

export interface PolicyRule {
  deny?: {
    categories?: ToolCategory[];
    tools?: string[];
    descriptions?: string[];
  };
  require?: {
    aguara?: "clean";
    maxTools?: number;
    maxFindings?: Record<string, number>;
    capabilities?: ToolCategory[];
  };
  allow?: {
    tools?: string[];
  };
}

export interface Policy {
  rules: PolicyRule;
}

export interface PolicyViolation {
  rule: string;
  message: string;
  severity: "error";
}

export interface PolicyResult {
  passed: boolean;
  violations: PolicyViolation[];
}

export interface CliOptions {
  targets: ServerTarget[];
  json: boolean;
  markdown: string | false;
  noColor: boolean;
  timeout: number;
  diff: string | false;
  config: boolean;
  failOnFindings: boolean;
  policy: string | false;
  verbose: boolean;
  header: string[];
}
