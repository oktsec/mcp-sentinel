import { execFile } from "node:child_process";
import { writeFile, unlink, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import type { ToolInfo, AguaraResult, AguaraFinding } from "./types.js";

const execFileAsync = promisify(execFile);

export async function isAguaraInstalled(): Promise<boolean> {
  try {
    await execFileAsync("aguara", ["version"]);
    return true;
  } catch {
    return false;
  }
}

function buildScanContent(tools: ToolInfo[]): string {
  const lines: string[] = [];

  for (const tool of tools) {
    lines.push(`## Tool: ${tool.name}`);
    lines.push("");
    lines.push(tool.description);
    lines.push("");

    if (tool.parameters.length > 0) {
      lines.push(`Parameters: ${tool.parameters.map((p) => p.name).join(", ")}`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

interface AguaraScanOutput {
  summary?: string;
  findings?: {
    severity?: string;
    rule_id?: string;
    rule_name?: string;
    matched_text?: string;
    line?: number;
  }[];
}

function parseAguaraOutput(stdout: string): { findings: AguaraFinding[]; summary: string } {
  try {
    const parsed = JSON.parse(stdout) as AguaraScanOutput;
    const findings: AguaraFinding[] = [];

    if (Array.isArray(parsed.findings)) {
      for (const f of parsed.findings) {
        findings.push({
          severity: String(f.severity ?? "UNKNOWN"),
          ruleId: String(f.rule_id ?? ""),
          ruleName: String(f.rule_name ?? ""),
          matchedText: String(f.matched_text ?? ""),
          line: typeof f.line === "number" ? f.line : undefined,
        });
      }
    }

    return {
      findings,
      summary: typeof parsed.summary === "string" ? parsed.summary : `${findings.length} finding(s)`,
    };
  } catch {
    return { findings: [], summary: "Failed to parse aguara output" };
  }
}

export async function scanWithAguara(tools: ToolInfo[]): Promise<AguaraResult> {
  const installed = await isAguaraInstalled();
  if (!installed) {
    return {
      available: false,
      findings: [],
      summary: "aguara not installed — install from https://github.com/garagon/aguara for deep security analysis",
    };
  }

  const content = buildScanContent(tools);
  const tmpDir = await mkdtemp(join(tmpdir(), "mcp-gate-"));
  const tmpFile = join(tmpDir, "tools.md");

  try {
    await writeFile(tmpFile, content, "utf-8");

    const { stdout } = await execFileAsync("aguara", [
      "scan", tmpFile, "--format", "json", "--severity", "low",
    ], {
      timeout: 30_000,
      env: process.env,
      maxBuffer: 10 * 1024 * 1024,
    });

    const result = parseAguaraOutput(stdout);
    return { available: true, ...result };
  } catch (err) {
    // aguara exits with code 1 when findings are found, but still outputs JSON
    if (typeof err === "object" && err !== null && "stdout" in err) {
      const stdout = String((err as { stdout: unknown }).stdout);
      if (stdout.trim().length > 0) {
        const result = parseAguaraOutput(stdout);
        return { available: true, ...result };
      }
    }
    return {
      available: true,
      findings: [],
      summary: `aguara scan failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  } finally {
    try { await unlink(tmpFile); } catch { /* cleanup */ }
    try {
      const { rmdir } = await import("node:fs/promises");
      await rmdir(tmpDir);
    } catch { /* cleanup */ }
  }
}
