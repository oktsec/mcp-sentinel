import chalk from "chalk";
import type {
  ScanResult, AnalyzedTool, AguaraFinding,
  ResourceInfo, ResourceTemplateInfo, PromptInfo, ServerCapabilities,
} from "./types.js";

const CATEGORY_ICONS = { read: "\u2705", write: "\u270F\uFE0F", admin: "\u26A0\uFE0F" } as const;

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function formatToolLine(analyzed: AnalyzedTool): string {
  const { tool, category } = analyzed;
  const icon = CATEGORY_ICONS[category];
  const name = category === "admin" ? chalk.red(tool.name)
    : category === "write" ? chalk.yellow(tool.name)
    : tool.name;
  const desc = truncate(tool.description, 55);
  const tag = category !== "read" ? chalk.dim(` [${category}]`) : "";
  const paramCount = tool.parameters.length;
  const params = paramCount > 0 ? chalk.dim(` (${paramCount} params)`) : "";

  return `  ${icon} ${name}  ${chalk.dim(desc)}${tag}${params}`;
}

function formatToolParams(analyzed: AnalyzedTool): string[] {
  if (analyzed.tool.parameters.length === 0) return [];

  const lines: string[] = [];
  for (const p of analyzed.tool.parameters) {
    const req = p.required ? chalk.red("*") : " ";
    const type = chalk.cyan(p.type.padEnd(8));
    const desc = p.description.length > 0 ? chalk.dim(` ${truncate(p.description, 50)}`) : "";
    lines.push(`     ${req} ${type} ${p.name}${desc}`);
  }
  return lines;
}

function formatCapabilities(caps: ServerCapabilities): string {
  const items: string[] = [];
  if (caps.tools) items.push("tools");
  if (caps.resources) items.push("resources");
  if (caps.prompts) items.push("prompts");
  if (caps.logging) items.push("logging");
  return items.length > 0 ? items.join(", ") : "none";
}

function formatResource(r: ResourceInfo): string {
  const mime = r.mimeType.length > 0 ? chalk.dim(` [${r.mimeType}]`) : "";
  const desc = r.description.length > 0 ? chalk.dim(` ${truncate(r.description, 50)}`) : "";
  return `  ${chalk.cyan(r.uri)}${mime}${desc}`;
}

function formatResourceTemplate(r: ResourceTemplateInfo): string {
  const mime = r.mimeType.length > 0 ? chalk.dim(` [${r.mimeType}]`) : "";
  const desc = r.description.length > 0 ? chalk.dim(` ${truncate(r.description, 50)}`) : "";
  return `  ${chalk.cyan(r.uriTemplate)}${mime}${desc}`;
}

function formatPrompt(p: PromptInfo): string {
  const desc = p.description.length > 0 ? chalk.dim(` ${truncate(p.description, 50)}`) : "";
  const argCount = p.arguments.length;
  const args = argCount > 0 ? chalk.dim(` (${argCount} args)`) : "";
  return `  \u{1F4AC} ${p.name}${desc}${args}`;
}

function formatFinding(finding: AguaraFinding): string {
  const sevColor = finding.severity === "CRITICAL" ? chalk.bgRed.white
    : finding.severity === "HIGH" ? chalk.red
    : finding.severity === "MEDIUM" ? chalk.yellow
    : chalk.dim;
  return `  ${sevColor(finding.severity.padEnd(8))} ${finding.ruleId} ${chalk.dim(finding.ruleName)}`;
}

export function formatOutput(result: ScanResult): string {
  const lines: string[] = [];
  const { server, capabilities, tools, toolSummary, resources, resourceTemplates, prompts, instructions, aguara, scanDuration } = result;

  // Header
  lines.push("");
  lines.push(`\u{1F50D} ${chalk.bold("MCP Inspector")} v0.1.0`);
  lines.push("");

  // Server
  lines.push(`\u{1F4E6} Server: ${chalk.bold(server.name)} v${server.version}`);
  lines.push(`   Capabilities: ${formatCapabilities(capabilities)}`);
  lines.push("");

  // Tools
  if (tools.length > 0) {
    lines.push(`\u{1F527} ${chalk.bold("Tools")} ${chalk.dim(`(${tools.length})`)}  ${chalk.green(`${toolSummary.read} read`)} \u2022 ${chalk.yellow(`${toolSummary.write} write`)} \u2022 ${chalk.red(`${toolSummary.admin} admin`)}`);
    lines.push("");
    for (const tool of tools) {
      lines.push(formatToolLine(tool));
      const paramLines = formatToolParams(tool);
      lines.push(...paramLines);
    }
    lines.push("");
  }

  // Resources
  if (resources.length > 0 || resourceTemplates.length > 0) {
    const total = resources.length + resourceTemplates.length;
    lines.push(`\u{1F4C1} ${chalk.bold("Resources")} ${chalk.dim(`(${total})`)}`);
    lines.push("");
    for (const r of resources) {
      lines.push(formatResource(r));
    }
    for (const r of resourceTemplates) {
      lines.push(formatResourceTemplate(r));
    }
    lines.push("");
  }

  // Prompts
  if (prompts.length > 0) {
    lines.push(`\u{1F4AC} ${chalk.bold("Prompts")} ${chalk.dim(`(${prompts.length})`)}`);
    lines.push("");
    for (const p of prompts) {
      lines.push(formatPrompt(p));
    }
    lines.push("");
  }

  // Instructions
  if (instructions !== null) {
    lines.push(`\u{1F4DD} ${chalk.bold("Server Instructions")}`);
    lines.push("");
    const preview = truncate(instructions, 200);
    lines.push(`  ${chalk.dim(preview)}`);
    lines.push("");
  }

  // Aguara
  if (aguara.available) {
    lines.push(`\u{1F6E1}\uFE0F  ${chalk.bold("Aguara Security Analysis")}`);
    lines.push("");
    if (aguara.findings.length > 0) {
      for (const finding of aguara.findings) {
        lines.push(formatFinding(finding));
      }
      lines.push("");
    }
    lines.push(`  ${aguara.summary}`);
  } else {
    lines.push(`\u{1F6E1}\uFE0F  ${chalk.dim("Install")} ${chalk.cyan("aguara")} ${chalk.dim("for deep security analysis:")} ${chalk.cyan("https://github.com/garagon/aguara")}`);
  }
  lines.push("");

  // Footer
  lines.push(chalk.dim(`Scanned in ${scanDuration}ms`));
  lines.push("");
  lines.push(`\u{1F310} Deep scan: ${chalk.cyan.underline("https://aguarascan.com")}`);
  lines.push("");

  return lines.join("\n");
}

export function formatJson(result: ScanResult | ScanResult[]): string {
  return JSON.stringify(result, null, 2);
}

export function formatError(message: string): string {
  return `\n${chalk.red("\u2716")} ${chalk.red.bold("Error:")} ${message}\n`;
}
