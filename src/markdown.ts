import type { ScanResult, AnalyzedTool } from "./types.js";

const RISK_ICONS = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" } as const;

function formatToolRow(analyzed: AnalyzedTool): string {
  const status = analyzed.safe ? "OK" : "WARN";
  const flags = analyzed.flags.map((f) => f.label).join(", ");
  const desc = analyzed.tool.description.length > 80
    ? analyzed.tool.description.slice(0, 77) + "..."
    : analyzed.tool.description;
  return `| ${status} | \`${analyzed.tool.name}\` | ${desc} | ${flags} |`;
}

export function formatMarkdown(results: ScanResult[]): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString().split("T")[0]!;

  lines.push("# MCP Inspector Report");
  lines.push("");
  lines.push(`Generated: ${timestamp}`);
  lines.push("");

  for (const result of results) {
    lines.push(`## ${result.server.name} v${result.server.version}`);
    lines.push("");
    lines.push(`- **Tools:** ${result.tools.length}`);
    lines.push(`- **Risk:** ${RISK_ICONS[result.risk.level]}`);
    lines.push(`- **Scan time:** ${result.scanDuration}ms`);
    lines.push("");

    if (result.risk.reasons.length > 0) {
      lines.push("### Risk Details");
      lines.push("");
      for (const reason of result.risk.reasons) {
        lines.push(`- ${reason.message}`);
      }
      lines.push("");
    }

    if (result.envVars.length > 0) {
      lines.push("### Environment Dependencies");
      lines.push("");
      lines.push(`\`${result.envVars.join("`, `")}\``);
      lines.push("");
    }

    lines.push("### Tools");
    lines.push("");
    lines.push("| Status | Tool | Description | Flags |");
    lines.push("|--------|------|-------------|-------|");

    for (const tool of result.tools) {
      lines.push(formatToolRow(tool));
    }

    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("Deep scan: [aguarascan.com](https://aguarascan.com)");
  lines.push("");

  return lines.join("\n");
}
