import chalk from "chalk";
import type { ScanResult, AnalyzedTool, AguaraFinding } from "./types.js";

const CATEGORY_ICONS = { read: "\u2705", write: "\u270F\uFE0F", admin: "\u26A0\uFE0F" } as const;

function formatToolLine(analyzed: AnalyzedTool): string {
  const { tool, category } = analyzed;

  const icon = CATEGORY_ICONS[category];
  const name = category === "admin" ? chalk.red(tool.name)
    : category === "write" ? chalk.yellow(tool.name)
    : tool.name;
  const desc = tool.description.length > 60
    ? tool.description.slice(0, 57) + "..."
    : tool.description;
  const tag = category === "admin" ? chalk.red(` [${category.toUpperCase()}]`)
    : category === "write" ? chalk.yellow(` [${category.toUpperCase()}]`)
    : "";

  return `  ${icon} ${name}  ${chalk.dim(desc)}${tag}`;
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
  const { server, tools, toolSummary, aguara, scanDuration } = result;

  lines.push("");
  lines.push(`\u{1F50D} ${chalk.bold("MCP Inspector")} v0.1.0`);
  lines.push("");

  lines.push(
    `\u{1F4E6} Server: ${chalk.bold(server.name)} v${server.version} | Tools: ${chalk.bold(String(tools.length))}`,
  );
  lines.push(
    `   ${chalk.green(`${toolSummary.read} read`)} \u2022 ${chalk.yellow(`${toolSummary.write} write`)} \u2022 ${chalk.red(`${toolSummary.admin} admin`)}`,
  );
  lines.push("");

  lines.push(`\u{1F527} ${chalk.bold("Tools")}`);
  lines.push("");
  for (const tool of tools) {
    lines.push(formatToolLine(tool));
  }
  lines.push("");

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

  lines.push(chalk.dim(`Scanned in ${scanDuration}ms`));
  lines.push("");
  lines.push(
    `\u{1F310} Deep scan: ${chalk.cyan.underline("https://aguarascan.com")}`,
  );
  lines.push("");

  return lines.join("\n");
}

export function formatJson(result: ScanResult | ScanResult[]): string {
  return JSON.stringify(result, null, 2);
}

export function formatError(message: string): string {
  return `\n${chalk.red("\u2716")} ${chalk.red.bold("Error:")} ${message}\n`;
}
