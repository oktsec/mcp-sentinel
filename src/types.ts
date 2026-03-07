export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export type FlagType = "destructive" | "write" | "execute" | "network" | "credential" | "schema";

export interface ToolFlag {
  type: FlagType;
  label: string;
  reason: string;
}

export interface AnalyzedTool {
  tool: ToolInfo;
  flags: ToolFlag[];
  safe: boolean;
}

export interface RiskReason {
  message: string;
}

export interface RiskAssessment {
  level: RiskLevel;
  reasons: RiskReason[];
}

export interface ServerInfo {
  name: string;
  version: string;
}

export interface ScanResult {
  server: ServerInfo;
  tools: AnalyzedTool[];
  risk: RiskAssessment;
  envVars: string[];
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
