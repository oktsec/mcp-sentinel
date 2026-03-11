import { execFile } from "node:child_process";
import { writeFile, unlink, mkdtemp, mkdir } from "node:fs/promises";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import type { ToolInfo, ResourceInfo, ResourceTemplateInfo, PromptInfo, AguaraResult, AguaraFinding } from "./types.js";

const execFileAsync = promisify(execFile);

let aguaraInstalledCache: boolean | null = null;

const SEV_LABELS: Record<number, string> = {
  4: "CRITICAL",
  3: "HIGH",
  2: "MEDIUM",
  1: "LOW",
};

export async function isAguaraInstalled(): Promise<boolean> {
  if (aguaraInstalledCache !== null) return aguaraInstalledCache;
  try {
    await execFileAsync("aguara", ["version"]);
    aguaraInstalledCache = true;
    return true;
  } catch {
    aguaraInstalledCache = false;
    return false;
  }
}

function sanitizeToolName(name: string): string {
  const base = basename(name);
  return base.replace(/[^a-zA-Z0-9_\-.]/g, "_");
}

function buildToolFile(tool: ToolInfo): string {
  const lines: string[] = [];
  lines.push(`## Tool: ${tool.name}`);
  lines.push("");
  lines.push(tool.description);
  lines.push("");
  if (tool.parameters.length > 0) {
    for (const p of tool.parameters) {
      lines.push(`- ${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildResourceContent(resources: ResourceInfo[], templates: ResourceTemplateInfo[]): string {
  const lines: string[] = [];
  for (const r of resources) {
    lines.push(`## Resource: ${r.name}`);
    lines.push(`URI: ${r.uri}`);
    if (r.description.length > 0) lines.push(r.description);
    lines.push("");
  }
  for (const r of templates) {
    lines.push(`## Resource Template: ${r.name}`);
    lines.push(`URI Template: ${r.uriTemplate}`);
    if (r.description.length > 0) lines.push(r.description);
    lines.push("");
  }
  return lines.join("\n");
}

function buildPromptContent(prompts: PromptInfo[]): string {
  const lines: string[] = [];
  for (const p of prompts) {
    lines.push(`## Prompt: ${p.name}`);
    if (p.description.length > 0) lines.push(p.description);
    if (p.arguments.length > 0) {
      for (const a of p.arguments) {
        lines.push(`- ${a.name}${a.required ? " (required)" : ""}: ${a.description}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

interface AguaraRawFinding {
  severity?: number | string;
  rule_id?: string;
  rule_name?: string;
  category?: string;
  description?: string;
  matched_text?: string;
  line?: number;
  confidence?: number;
  score?: number;
  remediation?: string;
}

interface AguaraScanOutput {
  findings?: AguaraRawFinding[];
  files_scanned?: number;
  rules_loaded?: number;
  duration_ms?: number;
}

function normalizeSeverity(sev: number | string | undefined): string {
  if (typeof sev === "number") return SEV_LABELS[sev] ?? String(sev);
  if (typeof sev === "string") {
    const upper = sev.toUpperCase();
    if (["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(upper)) return upper;
    return sev;
  }
  return "UNKNOWN";
}

function parseFindings(raw: AguaraRawFinding[], toolName: string): AguaraFinding[] {
  return raw.map((f) => ({
    severity: normalizeSeverity(f.severity),
    ruleId: String(f.rule_id ?? ""),
    ruleName: String(f.rule_name ?? ""),
    category: String(f.category ?? ""),
    description: String(f.description ?? ""),
    matchedText: String(f.matched_text ?? ""),
    toolName,
    line: typeof f.line === "number" ? f.line : undefined,
    confidence: typeof f.confidence === "number" ? f.confidence : undefined,
    score: typeof f.score === "number" ? f.score : undefined,
    remediation: typeof f.remediation === "string" ? f.remediation : undefined,
  }));
}

async function runAguara(filePath: string): Promise<AguaraScanOutput> {
  try {
    const { stdout } = await execFileAsync("aguara", [
      "scan", filePath, "--format", "json", "--severity", "low",
    ], {
      timeout: 30_000,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout) as AguaraScanOutput;
  } catch (err) {
    // aguara exits with code 1 when findings are found, but still outputs JSON
    if (typeof err === "object" && err !== null && "stdout" in err) {
      const stdout = String((err as { stdout: unknown }).stdout);
      if (stdout.trim().length > 0) {
        return JSON.parse(stdout) as AguaraScanOutput;
      }
    }
    return { findings: [] };
  }
}

export interface AguaraScanInput {
  tools: ToolInfo[];
  resources: ResourceInfo[];
  resourceTemplates: ResourceTemplateInfo[];
  prompts: PromptInfo[];
}

export async function scanWithAguara(input: AguaraScanInput): Promise<AguaraResult> {
  const installed = await isAguaraInstalled();
  if (!installed) {
    return {
      available: false,
      findings: [],
      summary: "aguara not installed",
    };
  }

  const tmpDir = await mkdtemp(join(tmpdir(), "mcp-sentinel-"));
  const toolsDir = join(tmpDir, "tools");
  await mkdir(toolsDir);

  const allFindings: AguaraFinding[] = [];
  const filesToClean: string[] = [];
  let rulesLoaded = 0;
  let totalDuration = 0;

  try {
    // Scan each tool individually for per-tool finding attribution
    for (const tool of input.tools) {
      const content = buildToolFile(tool);
      const safeName = sanitizeToolName(tool.name);
      const filePath = join(toolsDir, `${safeName}.md`);
      await writeFile(filePath, content, "utf-8");
      filesToClean.push(filePath);

      const output = await runAguara(filePath);
      if (output.rules_loaded !== undefined) rulesLoaded = output.rules_loaded;
      if (output.duration_ms !== undefined) totalDuration += output.duration_ms;

      if (Array.isArray(output.findings)) {
        allFindings.push(...parseFindings(output.findings, tool.name));
      }
    }

    // Scan resources
    if (input.resources.length > 0 || input.resourceTemplates.length > 0) {
      const content = buildResourceContent(input.resources, input.resourceTemplates);
      if (content.trim().length > 0) {
        const filePath = join(tmpDir, "resources.md");
        await writeFile(filePath, content, "utf-8");
        filesToClean.push(filePath);

        const output = await runAguara(filePath);
        if (output.duration_ms !== undefined) totalDuration += output.duration_ms;
        if (Array.isArray(output.findings)) {
          allFindings.push(...parseFindings(output.findings, "[resource]"));
        }
      }
    }

    // Scan prompts
    if (input.prompts.length > 0) {
      const content = buildPromptContent(input.prompts);
      if (content.trim().length > 0) {
        const filePath = join(tmpDir, "prompts.md");
        await writeFile(filePath, content, "utf-8");
        filesToClean.push(filePath);

        const output = await runAguara(filePath);
        if (output.duration_ms !== undefined) totalDuration += output.duration_ms;
        if (Array.isArray(output.findings)) {
          allFindings.push(...parseFindings(output.findings, "[prompt]"));
        }
      }
    }

    // Sort by severity (CRITICAL first)
    const sevOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    allFindings.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

    return {
      available: true,
      findings: allFindings,
      summary: `${allFindings.length} finding(s)`,
      rulesLoaded: rulesLoaded > 0 ? rulesLoaded : undefined,
      durationMs: totalDuration > 0 ? totalDuration : undefined,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return {
      available: true,
      findings: [],
      summary: `aguara scan error: ${message}`,
      error: true,
    };
  } finally {
    for (const f of filesToClean) {
      try { await unlink(f); } catch { /* cleanup */ }
    }
    try {
      const { rm } = await import("node:fs/promises");
      await rm(tmpDir, { recursive: true });
    } catch { /* cleanup */ }
  }
}
