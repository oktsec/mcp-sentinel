import chalk from "chalk";
import type { ScanResult, AnalyzedTool, RiskLevel } from "./types.js";

const RISK_COLORS: Record<RiskLevel, (text: string) => string> = {
  LOW: chalk.green,
  MEDIUM: chalk.yellow,
  HIGH: chalk.red,
};

const RISK_ICONS: Record<RiskLevel, string> = {
  LOW: "\u{1F7E2}",
  MEDIUM: "\u{1F7E1}",
  HIGH: "\u{1F534}",
};

function formatToolLine(analyzed: AnalyzedTool): string {
  const { tool, flags, safe } = analyzed;

  const icon = safe ? "\u2705" : "\u26A0\uFE0F";
  const name = safe ? tool.name : chalk.yellow(tool.name);
  const desc = tool.description.length > 60
    ? tool.description.slice(0, 57) + "..."
    : tool.description;

  const flagLabels = flags.map((f) => chalk.red(`[${f.label}]`)).join(" ");
  const suffix = flagLabels.length > 0 ? ` ${flagLabels}` : "";

  return `  ${icon} ${name}  ${chalk.dim(desc)}${suffix}`;
}

export function formatOutput(result: ScanResult): string {
  const lines: string[] = [];
  const { server, tools, risk, scanDuration } = result;

  // Header
  lines.push("");
  lines.push(`\u{1F50D} ${chalk.bold("MCP Inspector")} v0.1.0`);
  lines.push("");

  // Server info
  const toolCount = tools.length;
  lines.push(
    `\u{1F4E6} Server: ${chalk.bold(server.name)} v${server.version} | Tools: ${chalk.bold(String(toolCount))}`,
  );
  lines.push("");

  // Tools
  lines.push(`\u{1F527} ${chalk.bold("Tools detected")}`);
  lines.push("");

  for (const tool of tools) {
    lines.push(formatToolLine(tool));
  }

  lines.push("");

  // Risk assessment
  const riskColor = RISK_COLORS[risk.level];
  const riskIcon = RISK_ICONS[risk.level];
  lines.push(`${riskIcon} Risk: ${riskColor(chalk.bold(risk.level))}`);
  lines.push("");

  for (const reason of risk.reasons) {
    lines.push(`  \u2022 ${reason.message}`);
  }

  lines.push("");

  // Scan duration
  lines.push(chalk.dim(`Scanned in ${scanDuration}ms`));
  lines.push("");

  // Footer
  lines.push(
    `\u{1F6E1}\uFE0F  Deep scan: ${chalk.cyan.underline("https://aguarascan.com")}`,
  );
  lines.push("");

  return lines.join("\n");
}

export function formatJson(result: ScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatError(message: string): string {
  return `\n${chalk.red("\u2716")} ${chalk.red.bold("Error:")} ${message}\n`;
}
