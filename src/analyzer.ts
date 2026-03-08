import type {
  ToolInfo,
  AnalyzedTool,
  ToolCategory,
  AguaraFinding,
} from "./types.js";

const WRITE_HINTS = [
  /\bwrite\b/i, /\bcreate\b/i, /\bupdate\b/i, /\bmodify\b/i,
  /\bset\b/i, /\bput\b/i, /\bpatch\b/i, /\bpush\b/i,
  /\binsert\b/i, /\bupload\b/i, /\bsave\b/i, /\bmove\b/i,
];

const ADMIN_HINTS = [
  /\bdelete\b/i, /\bremove\b/i, /\bdrop\b/i, /\bdestroy\b/i,
  /\bpurge\b/i, /\btruncate\b/i, /\bexec\b/i, /\bexecute\b/i,
  /\bshell\b/i, /\bbash\b/i, /\bspawn\b/i, /\beval\b/i,
  /\buninstall\b/i, /\breset\b/i, /\bkill\b/i, /\bforce\b/i,
];

// Aguara categories that indicate a tool is dangerous
const DANGEROUS_CATEGORIES = new Set([
  "prompt-injection", "indirect-injection", "exfiltration",
  "credential-leak", "command-execution", "supply-chain",
  "mcp-attack", "unicode-attack",
]);

export function categorizeTool(tool: ToolInfo, findings?: AguaraFinding[]): ToolCategory {
  // If aguara found critical/high findings in dangerous categories, escalate to admin
  if (findings !== undefined && findings.length > 0) {
    const hasDangerous = findings.some((f) =>
      (f.severity === "CRITICAL" || f.severity === "HIGH") &&
      DANGEROUS_CATEGORIES.has(f.category)
    );
    if (hasDangerous) return "admin";
  }

  const text = `${tool.name} ${tool.description}`;

  if (ADMIN_HINTS.some((p) => p.test(text))) {
    return "admin";
  }
  if (WRITE_HINTS.some((p) => p.test(text))) {
    return "write";
  }
  return "read";
}

export function analyzeTools(tools: ToolInfo[], findingsByTool?: Map<string, AguaraFinding[]>): AnalyzedTool[] {
  return tools.map((tool) => {
    const toolFindings = findingsByTool?.get(tool.name) ?? [];
    return {
      tool,
      category: categorizeTool(tool, toolFindings),
      findings: toolFindings,
    };
  });
}

export function summarize(tools: AnalyzedTool[]): { read: number; write: number; admin: number } {
  let read = 0;
  let write = 0;
  let admin = 0;

  for (const t of tools) {
    if (t.category === "admin") admin++;
    else if (t.category === "write") write++;
    else read++;
  }

  return { read, write, admin };
}
