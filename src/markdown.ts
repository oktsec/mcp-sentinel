import type { ScanResult, AnalyzedTool } from "./types.js";

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 3) + "..." : text;
}

function formatToolRow(analyzed: AnalyzedTool): string {
  const desc = truncate(analyzed.tool.description, 80);
  const params = analyzed.tool.parameters.map((p) => {
    const req = p.required ? "**" : "";
    return `${req}${p.name}${req} (${p.type})`;
  }).join(", ");
  return `| \`${analyzed.tool.name}\` | ${analyzed.category} | ${desc} | ${params} |`;
}

export function formatMarkdown(results: ScanResult[]): string {
  const lines: string[] = [];
  const timestamp = new Date().toISOString().split("T")[0]!;

  lines.push("# MCP Gate Report");
  lines.push("");
  lines.push(`Generated: ${timestamp}`);
  lines.push("");

  for (const result of results) {
    lines.push(`## ${result.server.name} v${result.server.version}`);
    lines.push("");

    // Capabilities
    const caps: string[] = [];
    if (result.capabilities.tools) caps.push("tools");
    if (result.capabilities.resources) caps.push("resources");
    if (result.capabilities.prompts) caps.push("prompts");
    if (result.capabilities.logging) caps.push("logging");
    lines.push(`- **Capabilities:** ${caps.join(", ") || "none"}`);
    lines.push(`- **Scan time:** ${result.scanDuration}ms`);
    lines.push("");

    // Tools
    if (result.tools.length > 0) {
      lines.push(`### Tools (${result.tools.length}: ${result.toolSummary.read} read, ${result.toolSummary.write} write, ${result.toolSummary.admin} admin)`);
      lines.push("");
      lines.push("| Tool | Category | Description | Parameters |");
      lines.push("|------|----------|-------------|------------|");
      for (const tool of result.tools) {
        lines.push(formatToolRow(tool));
      }
      lines.push("");
    }

    // Resources
    if (result.resources.length > 0 || result.resourceTemplates.length > 0) {
      const total = result.resources.length + result.resourceTemplates.length;
      lines.push(`### Resources (${total})`);
      lines.push("");
      lines.push("| URI | Name | Type |");
      lines.push("|-----|------|------|");
      for (const r of result.resources) {
        lines.push(`| \`${r.uri}\` | ${r.name} | ${r.mimeType} |`);
      }
      for (const r of result.resourceTemplates) {
        lines.push(`| \`${r.uriTemplate}\` | ${r.name} | ${r.mimeType} |`);
      }
      lines.push("");
    }

    // Prompts
    if (result.prompts.length > 0) {
      lines.push(`### Prompts (${result.prompts.length})`);
      lines.push("");
      lines.push("| Prompt | Description | Arguments |");
      lines.push("|--------|-------------|-----------|");
      for (const p of result.prompts) {
        const args = p.arguments.map((a) => `${a.required ? "**" : ""}${a.name}${a.required ? "**" : ""}`).join(", ");
        lines.push(`| \`${p.name}\` | ${truncate(p.description, 60)} | ${args} |`);
      }
      lines.push("");
    }

    // Instructions
    if (result.instructions !== null) {
      lines.push("### Server Instructions");
      lines.push("");
      lines.push("```");
      lines.push(result.instructions);
      lines.push("```");
      lines.push("");
    }

    // Aguara
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
