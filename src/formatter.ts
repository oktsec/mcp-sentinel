import chalk from "chalk";
import type {
  ScanResult, AnalyzedTool, AguaraFinding, DiffResult, PolicyResult,
  ResourceInfo, ResourceTemplateInfo, PromptInfo, ServerCapabilities, RiskScore,
} from "./types.js";
import { VERSION } from "./version.js";
const WIDTH = 70;

const CATEGORY_COLORS = {
  read: chalk.green,
  write: chalk.yellow,
  admin: chalk.red,
} as const;

const CATEGORY_ICONS = {
  read: chalk.green("\u2714"),
  write: chalk.yellow("\u270E"),
  admin: chalk.red("\u26A0"),
} as const;

const SEV_MAP: Record<string, { label: string; color: (t: string) => string }> = {
  "4": { label: "CRITICAL", color: chalk.red.bold },
  "3": { label: "HIGH", color: chalk.magenta },
  "2": { label: "MEDIUM", color: chalk.yellow },
  "1": { label: "LOW", color: chalk.dim },
  "CRITICAL": { label: "CRITICAL", color: chalk.red.bold },
  "HIGH": { label: "HIGH", color: chalk.magenta },
  "MEDIUM": { label: "MEDIUM", color: chalk.yellow },
  "LOW": { label: "LOW", color: chalk.dim },
};

function sevInfo(severity: string): { label: string; color: (t: string) => string } {
  return SEV_MAP[severity] ?? { label: severity, color: chalk.dim };
}

export interface FormatOptions {
  verbose?: boolean;
}

// sanitize strips HTML-style markup from MCP-supplied descriptions
// before they are rendered to the terminal.
//
// The previous shape (`replace(/<[^>]+>/g, "")` alone) was flagged
// by CodeQL js/incomplete-multi-character-sanitization because a
// payload like "<script alert(1)" without a closing ">" produces
// no match and survives intact, leaving "<script" in the output.
// The terminal would not execute it, but a downstream consumer
// that pipes the output into HTML (a docs page, a report) would.
//
// The fix is a conservative two-pass strip: first remove
// well-formed tags so legitimate inline markup loses its
// delimiters but keeps its text content, then unconditionally
// drop any surviving "<" or ">" bytes so a malformed tag cannot
// leak. After this no angle bracket remains, which is the shape
// CodeQL recognises as a complete sanitiser for this rule.
function sanitize(text: string): string {
  return text
    .replace(/\n/g, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  const clean = sanitize(text);
  if (clean.length <= max) return clean;
  const cut = clean.lastIndexOf(" ", max - 3);
  return (cut > max * 0.5 ? clean.slice(0, cut) : clean.slice(0, max - 3)) + "...";
}

function box(text: string): string {
  const inner = `  ${text}  `;
  const len = stripAnsi(inner).length;
  const top = `\u250C${"\u2500".repeat(len)}\u2510`;
  const bot = `\u2514${"\u2500".repeat(len)}\u2518`;
  return `${chalk.dim(top)}\n${chalk.dim("\u2502")}${inner}${chalk.dim("\u2502")}\n${chalk.dim(bot)}`;
}

function stripAnsi(str: string): string {
  const ESC = String.fromCharCode(27);
  return str.split(ESC).map((s) => s.replace(/\[[0-9;]*m/, "")).join("");
}

function rightAlign(left: string, right: string, width: number): string {
  const leftLen = stripAnsi(left).length;
  const rightLen = stripAnsi(right).length;
  const gap = Math.max(2, width - leftLen - rightLen);
  return left + " ".repeat(gap) + right;
}

function divider(): string {
  return chalk.dim(`  ${"\u2500".repeat(WIDTH - 4)}`);
}

const GRADE_COLORS: Record<string, (t: string) => string> = {
  A: chalk.green.bold,
  B: chalk.green,
  C: chalk.yellow,
  D: chalk.red,
  F: chalk.red.bold,
};

function formatGrade(riskScore: RiskScore): string {
  const colorFn = GRADE_COLORS[riskScore.grade] ?? chalk.dim;
  return `${colorFn(riskScore.grade)} ${chalk.dim(`(${riskScore.score}/100)`)}`;
}

function sortToolsByRisk(tools: AnalyzedTool[]): AnalyzedTool[] {
  const order = { admin: 0, write: 1, read: 2 };
  return [...tools].sort((a, b) => {
    const catDiff = order[a.category] - order[b.category];
    if (catDiff !== 0) return catDiff;
    return b.findings.length - a.findings.length;
  });
}

function wrapText(text: string, indent: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxWidth) {
      lines.push(`${indent}${remaining}`);
      break;
    }
    const cut = remaining.lastIndexOf(" ", maxWidth);
    const breakAt = cut > maxWidth * 0.3 ? cut : maxWidth;
    lines.push(`${indent}${remaining.slice(0, breakAt)}`);
    remaining = remaining.slice(breakAt).trimStart();
  }
  return lines;
}

function formatToolBlock(analyzed: AnalyzedTool, verbose: boolean): string[] {
  const { tool, category, findings } = analyzed;
  const lines: string[] = [];

  const icon = CATEGORY_ICONS[category];
  const colorFn = CATEGORY_COLORS[category];
  const name = chalk.bold(tool.name);
  const tag = colorFn(category);

  lines.push(rightAlign(`  ${icon} ${name}`, tag, WIDTH));

  if (tool.description.length > 0) {
    if (verbose) {
      const clean = sanitize(tool.description);
      for (const l of wrapText(clean, "    ", WIDTH - 8)) {
        lines.push(chalk.dim(l));
      }
    } else {
      lines.push(`    ${chalk.dim(truncate(tool.description, WIDTH - 8))}`);
    }
  }

  if (tool.parameters.length > 0) {
    const params = tool.parameters.map((p) =>
      p.required ? chalk.white(`${p.name}${chalk.red("*")}`) : chalk.dim(p.name)
    );
    lines.push(`    ${params.join(chalk.dim(" \u00B7 "))}`);
  }

  // Show per-tool findings inline
  if (findings.length > 0) {
    const findingCounts = formatFindingSummary(findings);
    lines.push(`    ${chalk.dim("\u2514\u2500")} ${findingCounts}`);
    if (verbose) {
      for (const f of findings) {
        const { label, color } = sevInfo(f.severity);
        lines.push(`       ${color(label)} ${chalk.dim(f.ruleId)} ${chalk.dim(f.ruleName)}`);
        if (f.remediation !== undefined) {
          lines.push(`       ${chalk.dim("\u2192 " + truncate(f.remediation, WIDTH - 12))}`);
        }
      }
    }
  }

  return lines;
}

function formatCapabilities(caps: ServerCapabilities): string {
  const items: string[] = [];
  if (caps.tools) items.push("tools");
  if (caps.resources) items.push("resources");
  if (caps.prompts) items.push("prompts");
  if (caps.logging) items.push("logging");
  return items.length > 0 ? items.join(chalk.dim(", ")) : "none";
}

function formatResource(r: ResourceInfo): string {
  const mime = r.mimeType.length > 0 ? chalk.dim(` [${r.mimeType}]`) : "";
  const desc = r.description.length > 0 ? `\n    ${chalk.dim(truncate(r.description, WIDTH - 8))}` : "";
  return `  ${chalk.cyan(r.uri)}${mime}${desc}`;
}

function formatResourceTemplate(r: ResourceTemplateInfo): string {
  const mime = r.mimeType.length > 0 ? chalk.dim(` [${r.mimeType}]`) : "";
  const desc = r.description.length > 0 ? `\n    ${chalk.dim(truncate(r.description, WIDTH - 8))}` : "";
  return `  ${chalk.cyan(r.uriTemplate)}${mime}${desc}`;
}

function formatPrompt(p: PromptInfo): string {
  const desc = p.description.length > 0 ? `\n    ${chalk.dim(truncate(p.description, WIDTH - 8))}` : "";
  const args = p.arguments.length > 0
    ? `\n    ${p.arguments.map((a) => a.required ? chalk.white(`${a.name}${chalk.red("*")}`) : chalk.dim(a.name)).join(chalk.dim(" \u00B7 "))}`
    : "";
  return `  ${chalk.bold(p.name)}${desc}${args}`;
}

function formatFinding(finding: AguaraFinding, verbose: boolean): string[] {
  const { label, color } = sevInfo(finding.severity);
  const sev = color(label.padEnd(8));
  const ruleId = chalk.white(finding.ruleId);
  const tool = finding.toolName.length > 0 ? chalk.cyan(finding.toolName) : "";

  const lines: string[] = [];

  // Line 1: severity + rule ID + tool name
  lines.push(`    ${sev}  ${ruleId}  ${tool}`);

  // Line 2: rule name (indented under rule ID, truncated)
  lines.push(`                ${chalk.dim(truncate(finding.ruleName, WIDTH - 16))}`);

  if (verbose) {
    if (finding.description.length > 0 && finding.description !== finding.ruleName) {
      lines.push(`                ${chalk.dim(truncate(finding.description, WIDTH - 16))}`);
    }
    if (finding.remediation !== undefined) {
      lines.push(`                ${chalk.dim("\u2192 " + truncate(finding.remediation, WIDTH - 18))}`);
    }
  }

  return lines;
}

function formatFindingSummary(findings: AguaraFinding[]): string {
  const counts: Record<string, number> = {};
  for (const f of findings) {
    const { label } = sevInfo(f.severity);
    counts[label] = (counts[label] ?? 0) + 1;
  }
  const parts: string[] = [];
  if (counts["CRITICAL"] !== undefined) parts.push(chalk.red.bold(`${counts["CRITICAL"]} critical`));
  if (counts["HIGH"] !== undefined) parts.push(chalk.magenta(`${counts["HIGH"]} high`));
  if (counts["MEDIUM"] !== undefined) parts.push(chalk.yellow(`${counts["MEDIUM"]} medium`));
  if (counts["LOW"] !== undefined) parts.push(chalk.dim(`${counts["LOW"]} low`));
  return parts.join(chalk.dim(" \u00B7 "));
}

function sectionHeader(icon: string, title: string, count?: number): string {
  const countStr = count !== undefined ? chalk.dim(` (${count})`) : "";
  return `${icon} ${chalk.bold(title)}${countStr}`;
}

export function formatOutput(result: ScanResult, options: FormatOptions = {}): string {
  const lines: string[] = [];
  const verbose = options.verbose === true;
  const { server, capabilities, tools, toolSummary, resources, resourceTemplates, prompts, instructions, aguara, riskScore, scanDuration } = result;

  // Header
  lines.push("");
  lines.push(box(`MCP Sentinel ${chalk.dim(`v${VERSION}`)}`));
  lines.push("");

  // Server info
  lines.push(`  ${chalk.dim("Server")}        ${chalk.bold(server.name)} ${chalk.dim(`v${server.version}`)}`);
  lines.push(`  ${chalk.dim("Capabilities")}  ${formatCapabilities(capabilities)}`);
  if (aguara.available && aguara.rulesLoaded !== undefined) {
    lines.push(`  ${chalk.dim("Aguara")}        ${chalk.dim(`${aguara.rulesLoaded} rules loaded`)}`);
  }
  lines.push(`  ${chalk.dim("Risk Score")}    ${formatGrade(riskScore)}`);
  lines.push("");

  // Tools (sorted by risk: admin first, then write, then read)
  if (tools.length > 0) {
    const sorted = sortToolsByRisk(tools);
    const summary = `${chalk.green(`${toolSummary.read} read`)} ${chalk.dim("\u00B7")} ${chalk.yellow(`${toolSummary.write} write`)} ${chalk.dim("\u00B7")} ${chalk.red(`${toolSummary.admin} admin`)}`;
    lines.push(`  ${sectionHeader("\u{1F527}", "Tools", tools.length)}    ${summary}`);
    lines.push("");
    for (const tool of sorted) {
      lines.push(...formatToolBlock(tool, verbose));
      lines.push("");
    }
  }

  // Resources
  if (resources.length > 0 || resourceTemplates.length > 0) {
    const total = resources.length + resourceTemplates.length;
    lines.push(`  ${sectionHeader("\u{1F4C1}", "Resources", total)}`);
    lines.push("");
    for (const r of resources) {
      lines.push(formatResource(r));
      lines.push("");
    }
    for (const r of resourceTemplates) {
      lines.push(formatResourceTemplate(r));
      lines.push("");
    }
  }

  // Prompts
  if (prompts.length > 0) {
    lines.push(`  ${sectionHeader("\u{1F4AC}", "Prompts", prompts.length)}`);
    lines.push("");
    for (const p of prompts) {
      lines.push(formatPrompt(p));
      lines.push("");
    }
  }

  // Instructions
  if (instructions !== null) {
    lines.push(`  ${sectionHeader("\u{1F4DD}", "Server Instructions")}`);
    lines.push("");
    if (verbose) {
      const clean = sanitize(instructions);
      for (const l of wrapText(clean, "    ", WIDTH - 8)) {
        lines.push(chalk.dim(l));
      }
    } else {
      lines.push(`    ${chalk.dim(truncate(instructions, 200))}`);
    }
    lines.push("");
  }

  // Aguara
  if (aguara.available) {
    lines.push(divider());
    lines.push("");
    if (aguara.findings.length > 0) {
      lines.push(`  ${sectionHeader("\u{1F6E1}\uFE0F ", "Security Findings", aguara.findings.length)}  ${formatFindingSummary(aguara.findings)}`);
      lines.push("");
      for (const finding of aguara.findings) {
        lines.push(...formatFinding(finding, verbose));
      }
    } else {
      lines.push(`  \u{1F6E1}\uFE0F  ${chalk.green.bold("No security findings")} ${chalk.dim("\u00B7 aguara scan clean")}`);
    }
    lines.push("");
  } else {
    lines.push(divider());
    lines.push("");
    lines.push(`  \u{1F6E1}\uFE0F  ${chalk.dim("Install")} ${chalk.cyan("aguara")} ${chalk.dim("for deep security analysis")}`);
    lines.push(`     ${chalk.cyan("https://github.com/garagon/aguara")}`);
    lines.push("");
  }

  // Footer
  lines.push(divider());
  lines.push("");
  const aguaraDuration = aguara.durationMs !== undefined ? chalk.dim(` (aguara ${aguara.durationMs}ms)`) : "";
  lines.push(`  ${chalk.dim(`Scanned in ${scanDuration}ms`)}${aguaraDuration}  ${chalk.dim("\u00B7")}  ${chalk.dim("Deep scan:")} ${chalk.cyan.underline("https://aguarascan.com")}`);
  lines.push("");

  return lines.join("\n");
}

export function formatJson(result: ScanResult | ScanResult[]): string {
  return JSON.stringify(result, null, 2);
}

export function formatDiff(diff: DiffResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(box(`MCP Sentinel Diff ${chalk.dim("\u00B7")} ${chalk.bold(diff.server)}`));
  lines.push("");

  if (diff.entries.length === 0) {
    lines.push(`  ${chalk.green("No changes detected.")}`);
    lines.push("");
    return lines.join("\n");
  }

  for (const entry of diff.entries) {
    const icon = entry.kind === "added" ? chalk.green("+")
      : entry.kind === "removed" ? chalk.red("-")
      : chalk.yellow("~");
    const label = entry.kind === "added" ? chalk.green(entry.kind)
      : entry.kind === "removed" ? chalk.red(entry.kind)
      : chalk.yellow(entry.kind);
    const detail = entry.detail !== undefined ? chalk.dim(` (${entry.detail})`) : "";
    lines.push(`  ${icon} [${entry.area}] ${label}: ${entry.name}${detail}`);
  }

  lines.push("");
  lines.push(chalk.dim(`  ${diff.entries.length} change(s) detected`));
  lines.push("");
  return lines.join("\n");
}

export function formatPolicyResult(result: PolicyResult, serverName: string): string {
  const lines: string[] = [];

  if (result.passed) {
    lines.push(`  ${chalk.green("\u2714")} ${chalk.bold(serverName)} ${chalk.green("policy passed")}`);
    return lines.join("\n");
  }

  lines.push(`  ${chalk.red("\u2716")} ${chalk.bold(serverName)} ${chalk.red("policy FAILED")} ${chalk.dim(`(${result.violations.length} violation${result.violations.length === 1 ? "" : "s"})`)}`);
  lines.push("");
  for (const v of result.violations) {
    lines.push(`    ${chalk.red("\u2192")} ${chalk.dim(`[${v.rule}]`)} ${v.message}`);
  }
  return lines.join("\n");
}

export function formatError(message: string): string {
  return `\n${chalk.red("\u2716")} ${chalk.red.bold("Error:")} ${message}\n`;
}
