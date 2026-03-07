import type {
  ToolInfo,
  ToolFlag,
  AnalyzedTool,
  RiskAssessment,
  RiskLevel,
  RiskReason,
  FlagType,
} from "./types.js";

const DESTRUCTIVE_PATTERNS = [
  /\bdelete\b/i,
  /\bremove\b/i,
  /\bdrop\b/i,
  /\bdestroy\b/i,
  /\bpurge\b/i,
  /\btruncate\b/i,
  /\buninstall\b/i,
  /\brm\b/i,
];

const WRITE_PATTERNS = [
  /\bwrite\b/i,
  /\bcreate\b/i,
  /\bupdate\b/i,
  /\bmodify\b/i,
  /\bset\b/i,
  /\bput\b/i,
  /\bpatch\b/i,
  /\bpush\b/i,
  /\binsert\b/i,
  /\bupload\b/i,
  /\boverwrite\b/i,
  /\bsave\b/i,
];

const EXECUTE_PATTERNS = [
  /\bexec\b/i,
  /\bexecute\b/i,
  /\brun\b/i,
  /\bshell\b/i,
  /\bbash\b/i,
  /\bcmd\b/i,
  /\bcommand\b/i,
  /\bspawn\b/i,
  /\beval\b/i,
  /\bsubprocess\b/i,
];

const NETWORK_PATTERNS = [
  /\bfetch\b/i,
  /\brequest\b/i,
  /\bhttp\b/i,
  /\bapi\b/i,
  /\bcurl\b/i,
  /\bwebhook\b/i,
  /\bdownload\b/i,
  /\bsocket\b/i,
  /\bsend\b/i,
];

const CREDENTIAL_PATTERNS = [
  /\btoken\b/i,
  /\bsecret\b/i,
  /\bpassword\b/i,
  /\bapi.?key\b/i,
  /\bcredential\b/i,
  /\bauth\b/i,
  /\bprivate.?key\b/i,
  /\baccess.?key\b/i,
];

const ENV_VAR_PATTERN = /\b[A-Z][A-Z0-9_]{2,}\b/g;

// Dangerous parameter names in tool input schemas
const DANGEROUS_PARAM_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /^(command|cmd|shell_command|bash_command)$/i, label: "accepts shell command" },
  { pattern: /^(script|code|expression|query|sql)$/i, label: "accepts code/query input" },
  { pattern: /^(url|uri|endpoint|webhook_url|callback_url)$/i, label: "accepts arbitrary URL" },
  { pattern: /^(file_path|dir_path|dest|destination|target_path|source_path)$/i, label: "accepts filesystem path" },
  { pattern: /^(password|secret|token|api_key|credentials?)$/i, label: "accepts sensitive credential" },
  { pattern: /^(body|payload|data|raw_input)$/i, label: "accepts raw input payload" },
];

function matchPatterns(
  text: string,
  patterns: RegExp[],
): RegExp | undefined {
  return patterns.find((p) => p.test(text));
}

function extractSchemaParams(schema: Record<string, unknown>): string[] {
  const properties = schema["properties"];
  if (typeof properties !== "object" || properties === null) {
    return [];
  }
  return Object.keys(properties as Record<string, unknown>);
}

export function analyzeSchema(schema: Record<string, unknown> | undefined): ToolFlag[] {
  if (schema === undefined) {
    return [];
  }

  const params = extractSchemaParams(schema);
  const flags: ToolFlag[] = [];

  for (const param of params) {
    for (const { pattern, label } of DANGEROUS_PARAM_PATTERNS) {
      if (pattern.test(param)) {
        flags.push({
          type: "schema",
          label: "DANGEROUS PARAM",
          reason: `Parameter "${param}": ${label}`,
        });
        break;
      }
    }
  }

  return flags;
}

function analyzeTool(tool: ToolInfo): AnalyzedTool {
  const searchText = `${tool.name} ${tool.description}`;
  const flags: ToolFlag[] = [];

  const destructiveMatch = matchPatterns(searchText, DESTRUCTIVE_PATTERNS);
  if (destructiveMatch !== undefined) {
    flags.push({
      type: "destructive",
      label: "DESTRUCTIVE",
      reason: `Matches destructive pattern: ${destructiveMatch.source}`,
    });
  }

  const executeMatch = matchPatterns(searchText, EXECUTE_PATTERNS);
  if (executeMatch !== undefined) {
    flags.push({
      type: "execute",
      label: "CODE EXECUTION",
      reason: `Matches execution pattern: ${executeMatch.source}`,
    });
  }

  const writeMatch = matchPatterns(searchText, WRITE_PATTERNS);
  if (writeMatch !== undefined) {
    flags.push({
      type: "write",
      label: "WRITE ACCESS",
      reason: `Matches write pattern: ${writeMatch.source}`,
    });
  }

  const networkMatch = matchPatterns(searchText, NETWORK_PATTERNS);
  if (networkMatch !== undefined) {
    flags.push({
      type: "network",
      label: "NETWORK",
      reason: `Matches network pattern: ${networkMatch.source}`,
    });
  }

  const credentialMatch = matchPatterns(searchText, CREDENTIAL_PATTERNS);
  if (credentialMatch !== undefined) {
    flags.push({
      type: "credential",
      label: "CREDENTIALS",
      reason: `Matches credential pattern: ${credentialMatch.source}`,
    });
  }

  const schemaFlags = analyzeSchema(tool.inputSchema);
  flags.push(...schemaFlags);

  return {
    tool,
    flags,
    safe: flags.length === 0,
  };
}

export function analyzeTools(tools: ToolInfo[]): AnalyzedTool[] {
  return tools.map(analyzeTool);
}

export function detectEnvVars(tools: ToolInfo[]): string[] {
  const envVars = new Set<string>();
  const falsePositives = new Set([
    "GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS",
    "JSON", "XML", "HTML", "CSS", "URL", "URI", "API",
    "HTTP", "HTTPS", "TRUE", "FALSE", "NULL", "NONE",
    "UTF", "ASCII", "BASE64", "SHA256", "SHA512", "MD5",
    "OK", "ERROR", "WARNING", "INFO", "DEBUG",
  ]);

  for (const tool of tools) {
    const text = `${tool.name} ${tool.description}`;
    const matches = text.match(ENV_VAR_PATTERN);
    if (matches !== null) {
      for (const match of matches) {
        if (!falsePositives.has(match) && match.includes("_")) {
          envVars.add(match);
        }
      }
    }
  }

  return [...envVars].sort();
}

export function assessRisk(
  analyzedTools: AnalyzedTool[],
  envVars: string[],
): RiskAssessment {
  const reasons: RiskReason[] = [];

  const countByType = (type: FlagType): number =>
    analyzedTools.filter((t) => t.flags.some((f) => f.type === type)).length;

  const destructiveCount = countByType("destructive");
  const executeCount = countByType("execute");
  const writeCount = countByType("write");
  const networkCount = countByType("network");
  const schemaCount = countByType("schema");

  if (destructiveCount > 0) {
    reasons.push({
      message: `${destructiveCount} destructive operation${destructiveCount > 1 ? "s" : ""} detected`,
    });
  }

  if (executeCount > 0) {
    reasons.push({
      message: `${executeCount} tool${executeCount > 1 ? "s" : ""} with code execution capability`,
    });
  }

  if (writeCount > 0) {
    reasons.push({
      message: `${writeCount} tool${writeCount > 1 ? "s" : ""} with write access`,
    });
  }

  if (networkCount > 0) {
    reasons.push({
      message: `${networkCount} tool${networkCount > 1 ? "s" : ""} with network access`,
    });
  }

  if (schemaCount > 0) {
    reasons.push({
      message: `${schemaCount} tool${schemaCount > 1 ? "s" : ""} with dangerous input parameters`,
    });
  }

  if (envVars.length > 0) {
    reasons.push({
      message: `Possible environment dependencies: ${envVars.join(", ")}`,
    });
  }

  const level = computeRiskLevel(destructiveCount, executeCount, writeCount, networkCount, schemaCount);

  if (reasons.length === 0) {
    reasons.push({ message: "No risky patterns detected" });
  }

  return { level, reasons };
}

function computeRiskLevel(
  destructive: number,
  execute: number,
  write: number,
  network: number,
  schema: number,
): RiskLevel {
  // HIGH: any code execution, or 3+ destructive ops, or dangerous params with exec-like tools
  if (execute > 0 || destructive >= 3) {
    return "HIGH";
  }

  // MEDIUM: any destructive op, significant write + network combo, or dangerous params
  if (destructive > 0 || (write >= 2 && network >= 2) || schema >= 3) {
    return "MEDIUM";
  }

  // MEDIUM: many write operations
  if (write >= 5) {
    return "MEDIUM";
  }

  // LOW: everything else
  return "LOW";
}
