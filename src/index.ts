import { writeFile } from "node:fs/promises";
import { parseArgs } from "./cli.js";
import {
  connectToServer, getServerInfo, getServerCapabilities,
  listTools, listResources, listResourceTemplates, listPrompts,
  getInstructions, disconnect,
} from "./scanner.js";
import { analyzeTools, summarize } from "./analyzer.js";
import { scanWithAguara } from "./aguara.js";
import { formatOutput, formatJson, formatError } from "./formatter.js";
import { formatMarkdown } from "./markdown.js";
import type { ScanResult, ServerTarget } from "./types.js";

function targetLabel(target: ServerTarget): string {
  if (target.type === "stdio") {
    return `${target.command} ${target.args.join(" ")}`.trim();
  }
  return target.url;
}

async function scanServer(target: ServerTarget, timeout: number): Promise<ScanResult> {
  const startTime = Date.now();
  const connection = await connectToServer(target, timeout);

  try {
    const server = getServerInfo(connection.client);
    const capabilities = getServerCapabilities(connection.client);

    const [rawTools, resources, resourceTemplates, prompts] = await Promise.all([
      listTools(connection.client, capabilities.tools),
      listResources(connection.client, capabilities.resources),
      listResourceTemplates(connection.client, capabilities.resources),
      listPrompts(connection.client, capabilities.prompts),
    ]);

    const instructions = getInstructions(connection.client);
    const tools = analyzeTools(rawTools);
    const toolSummary = summarize(tools);
    const aguara = await scanWithAguara(rawTools);
    const scanDuration = Date.now() - startTime;

    return {
      server, capabilities, tools, toolSummary,
      resources, resourceTemplates, prompts, instructions,
      aguara, scanDuration,
    };
  } finally {
    await disconnect(connection);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (options === null) return;

  if (options.noColor) {
    process.env["FORCE_COLOR"] = "0";
  }

  const results: ScanResult[] = [];

  for (const target of options.targets) {
    try {
      const result = await scanServer(target, options.timeout);
      results.push(result);

      if (!options.json) {
        console.log(formatOutput(result));
      }
    } catch (err) {
      const label = targetLabel(target);
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(formatError(`[${label}] ${message}`));
    }
  }

  if (results.length === 0) {
    console.error(formatError("No servers were scanned successfully."));
    process.exit(1);
  }

  if (options.json) {
    const output = results.length === 1 ? results[0]! : results;
    console.log(formatJson(output));
  }

  if (options.markdown !== false) {
    const md = formatMarkdown(results);
    await writeFile(options.markdown, md, "utf-8");
    console.log(`Report saved to ${options.markdown}`);
  }
}

main().catch((err: unknown) => {
  console.error(formatError(err instanceof Error ? err.message : "Unexpected error"));
  process.exit(1);
});
