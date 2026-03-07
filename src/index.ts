import { writeFile } from "node:fs/promises";
import { parseArgs } from "./cli.js";
import { connectToServer, getServerInfo, listTools, disconnect } from "./scanner.js";
import { analyzeTools, summarize } from "./analyzer.js";
import { scanWithAguara } from "./aguara.js";
import { formatOutput, formatJson, formatError } from "./formatter.js";
import { formatMarkdown } from "./markdown.js";
import type { ScanResult, ServerTarget } from "./types.js";

async function scanServer(target: ServerTarget, timeout: number): Promise<ScanResult> {
  const startTime = Date.now();
  const connection = await connectToServer(target.command, target.args, timeout);

  try {
    const serverInfo = getServerInfo(connection.client);
    const tools = await listTools(connection.client);
    const analyzedTools = analyzeTools(tools);
    const toolSummary = summarize(analyzedTools);
    const aguara = await scanWithAguara(tools);
    const scanDuration = Date.now() - startTime;

    return { server: serverInfo, tools: analyzedTools, toolSummary, aguara, scanDuration };
  } finally {
    await disconnect(connection);
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (options === null) {
    return;
  }

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
      const label = `${target.command} ${target.args.join(" ")}`.trim();
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
  console.error(
    formatError(err instanceof Error ? err.message : "Unexpected error"),
  );
  process.exit(1);
});
