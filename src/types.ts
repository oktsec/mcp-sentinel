export type ToolCategory = "read" | "write" | "admin";

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface AnalyzedTool {
  tool: ToolInfo;
  category: ToolCategory;
}

export interface AguaraFinding {
  severity: string;
  ruleId: string;
  ruleName: string;
  matchedText: string;
  line?: number;
}

export interface AguaraResult {
  available: boolean;
  findings: AguaraFinding[];
  summary: string;
}

export interface ServerInfo {
  name: string;
  version: string;
}

export interface ScanResult {
  server: ServerInfo;
  tools: AnalyzedTool[];
  toolSummary: { read: number; write: number; admin: number };
  aguara: AguaraResult;
  scanDuration: number;
}

export interface ServerTarget {
  command: string;
  args: string[];
}

export interface CliOptions {
  targets: ServerTarget[];
  json: boolean;
  markdown: string | false;
  noColor: boolean;
  timeout: number;
}
