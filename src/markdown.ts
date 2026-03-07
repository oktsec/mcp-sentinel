import type { ScanResult, AnalyzedTool } from "./types.js";

function formatToolRow(analyzed: AnalyzedTool): string {
  const desc = analyzed.tool.description.length > 80
    ? analyzed.tool.description.slice(0, 77) + "..."
    : analyzed.tool.description;
  return `| \`${analyzed.tool.name}\` | ${analyzed.category} | ${desc} |`;
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
    lines.push(`- **Tools:** ${result.tools.length} (${result.toolSummary.read} read, ${result.toolSummary.write} write, ${result.toolSummary.admin} admin)`);
    lines.push(`- **Scan time:** ${result.scanDuration}ms`);
    lines.push("");

    lines.push("### Tools");
    lines.push("");
    lines.push("| Tool | Category | Description |");
    lines.push("|------|----------|-------------|");

    for (const tool of result.tools) {
      lines.push(formatToolRow(tool));
    }

    lines.push("");

    if (result.aguara.available && result.aguara.findings.length > 0) {
      lines.push("### Security Findings (Aguara)");
      lines.push("");
      lines.push("| Severity | Rule | Description |");
      lines.push("|----------|------|-------------|");
      for (const f of result.aguara.findings) {
        lines.push(`| ${f.severity} | ${f.ruleId} | ${f.ruleName} |`);
      }
      lines.push("");
      lines.push(`> ${result.aguara.summary}`);
      lines.push("");
    } else if (!result.aguara.available) {
      lines.push(`> ${result.aguara.summary}`);
      lines.push("");
    }
  }

  lines.push("---");
  lines.push("");
  lines.push("Deep scan: [aguarascan.com](https://aguarascan.com)");
  lines.push("");

  return lines.join("\n");
}
