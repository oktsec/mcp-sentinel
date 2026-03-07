export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ToolInfo {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolFlag {
  type: "destructive" | "write" | "execute" | "network" | "credential";
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

export interface CliOptions {
  command: string;
  args: string[];
  json: boolean;
  noColor: boolean;
  timeout: number;
}
