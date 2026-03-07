import chalk from "chalk";
import type {
  ScanResult, AnalyzedTool, AguaraFinding, DiffResult, PolicyResult,
  ResourceInfo, ResourceTemplateInfo, PromptInfo, ServerCapabilities,
} from "./types.js";

const VERSION = "0.1.2";
const WIDTH = 60;

const CATEGORY_COLORS = {
  read: chalk.green,
  write: chalk.yellow,
  admin: chalk.red,
} as const;

const CATEGORY_ICONS = {
  read: chalk.green("✔"),
  write: chalk.yellow("✎"),
  admin: chalk.red("⚠"),
} as const;

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max - 3);
  return (cut > max * 0.5 ? text.slice(0, cut) : text.slice(0, max - 3)) + "...";
}

function box(text: string): string {
  const inner = `  ${text}  `;
  const len = stripAnsi(inner).length;
  const top = `┌${"─".repeat(len)}┐`;
  const bot = `└${"─".repeat(len)}┘`;
  return `${chalk.dim(top)}\n${chalk.dim("│")}${inner}${chalk.dim("│")}\n${chalk.dim(bot)}`;
}

function stripAnsi(str: string): string {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

function rightAlign(left: string, right: string, width: number): string {
  const leftLen = stripAnsi(left).length;
  const rightLen = stripAnsi(right).length;
  const gap = Math.max(2, width - leftLen - rightLen);
  return left + " ".repeat(gap) + right;
}

function formatToolBlock(analyzed: AnalyzedTool): string[] {
  const { tool, category } = analyzed;
  const lines: string[] = [];

  const icon = CATEGORY_ICONS[category];
  const colorFn = CATEGORY_COLORS[category];
  const name = chalk.bold(tool.name);
  const tag = colorFn(category);

  lines.push(rightAlign(`  ${icon} ${name}`, tag, WIDTH));

  if (tool.description.length > 0) {
    lines.push(`    ${chalk.dim(truncate(tool.description, WIDTH - 4))}`);
  }

  if (tool.parameters.length > 0) {
    const params = tool.parameters.map((p) =>
      p.required ? chalk.white(`${p.name}${chalk.red("*")}`) : chalk.dim(p.name)
    );
    lines.push(`    ${params.join(chalk.dim(" · "))}`);
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
  const desc = r.description.length > 0 ? `\n    ${chalk.dim(truncate(r.description, WIDTH - 4))}` : "";
  return `  ${chalk.cyan(r.uri)}${mime}${desc}`;
}

function formatResourceTemplate(r: ResourceTemplateInfo): string {
  const mime = r.mimeType.length > 0 ? chalk.dim(` [${r.mimeType}]`) : "";
  const desc = r.description.length > 0 ? `\n    ${chalk.dim(truncate(r.description, WIDTH - 4))}` : "";
  return `  ${chalk.cyan(r.uriTemplate)}${mime}${desc}`;
}

function formatPrompt(p: PromptInfo): string {
  const desc = p.description.length > 0 ? `\n    ${chalk.dim(truncate(p.description, WIDTH - 4))}` : "";
  const args = p.arguments.length > 0
    ? `\n    ${p.arguments.map((a) => a.required ? chalk.white(`${a.name}${chalk.red("*")}`) : chalk.dim(a.name)).join(chalk.dim(" · "))}`
    : "";
  return `  ${chalk.bold(p.name)}${desc}${args}`;
}

function formatFinding(finding: AguaraFinding): string {
  const sevColor = finding.severity === "CRITICAL" ? chalk.bgRed.white
    : finding.severity === "HIGH" ? chalk.red
    : finding.severity === "MEDIUM" ? chalk.yellow
    : chalk.dim;
  return `  ${sevColor(finding.severity.padEnd(8))} ${finding.ruleId} ${chalk.dim(finding.ruleName)}`;
}

function sectionHeader(icon: string, title: string, count?: number): string {
  const countStr = count !== undefined ? chalk.dim(` (${count})`) : "";
  return `${icon} ${chalk.bold(title)}${countStr}`;
}

export function formatOutput(result: ScanResult): string {
  const lines: string[] = [];
  const { server, capabilities, tools, toolSummary, resources, resourceTemplates, prompts, instructions, aguara, scanDuration } = result;

  // Header
  lines.push("");
  lines.push(box(`MCP Sentinel ${chalk.dim(`v${VERSION}`)}`));
  lines.push("");

  // Server info
  lines.push(`  ${chalk.dim("Server")}        ${chalk.bold(server.name)} ${chalk.dim(`v${server.version}`)}`);
  lines.push(`  ${chalk.dim("Capabilities")}  ${formatCapabilities(capabilities)}`);
  lines.push("");

  // Tools
  if (tools.length > 0) {
    const summary = `${chalk.green(`${toolSummary.read} read`)} ${chalk.dim("·")} ${chalk.yellow(`${toolSummary.write} write`)} ${chalk.dim("·")} ${chalk.red(`${toolSummary.admin} admin`)}`;
    lines.push(`  ${sectionHeader("🔧", "Tools", tools.length)}    ${summary}`);
    lines.push("");
    for (const tool of tools) {
      lines.push(...formatToolBlock(tool));
      lines.push("");
    }
  }

  // Resources
  if (resources.length > 0 || resourceTemplates.length > 0) {
    const total = resources.length + resourceTemplates.length;
    lines.push(`  ${sectionHeader("📁", "Resources", total)}`);
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
    lines.push(`  ${sectionHeader("💬", "Prompts", prompts.length)}`);
    lines.push("");
    for (const p of prompts) {
      lines.push(formatPrompt(p));
      lines.push("");
    }
  }

  // Instructions
  if (instructions !== null) {
    lines.push(`  ${sectionHeader("📝", "Server Instructions")}`);
    lines.push("");
    lines.push(`    ${chalk.dim(truncate(instructions, 200))}`);
    lines.push("");
  }

  // Aguara
  if (aguara.available) {
    lines.push(`  ${sectionHeader("🛡️ ", "Aguara Security Analysis")}`);
    lines.push("");
    if (aguara.findings.length > 0) {
      for (const finding of aguara.findings) {
        lines.push(formatFinding(finding));
      }
      lines.push("");
    }
    lines.push(`  ${aguara.summary}`);
    lines.push("");
  } else {
    lines.push(`  🛡️  ${chalk.dim("Install")} ${chalk.cyan("aguara")} ${chalk.dim("for deep security analysis")}`);
    lines.push(`     ${chalk.cyan("https://github.com/garagon/aguara")}`);
    lines.push("");
  }

  // Footer
  lines.push(chalk.dim(`  Scanned in ${scanDuration}ms`));
  lines.push("");
  lines.push(`  ${chalk.dim("Deep scan:")} ${chalk.cyan.underline("https://aguarascan.com")}`);
  lines.push("");

  return lines.join("\n");
}

export function formatJson(result: ScanResult | ScanResult[]): string {
  return JSON.stringify(result, null, 2);
}

export function formatDiff(diff: DiffResult): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(box(`MCP Sentinel Diff ${chalk.dim("·")} ${chalk.bold(diff.server)}`));
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
    lines.push(`  ${chalk.green("✔")} ${chalk.bold(serverName)} ${chalk.green("policy passed")}`);
    return lines.join("\n");
  }

  lines.push(`  ${chalk.red("✖")} ${chalk.bold(serverName)} ${chalk.red(`policy FAILED`)} ${chalk.dim(`(${result.violations.length} violation${result.violations.length === 1 ? "" : "s"})`)}`);
  lines.push("");
  for (const v of result.violations) {
    lines.push(`    ${chalk.red("→")} ${chalk.dim(`[${v.rule}]`)} ${v.message}`);
  }
  return lines.join("\n");
}

export function formatError(message: string): string {
  return `\n${chalk.red("✖")} ${chalk.red.bold("Error:")} ${message}\n`;
}
