import { readFile, writeFile } from "node:fs/promises";
import chalk from "chalk";
import { parseArgs } from "./cli.js";
import {
  connectToServer, getServerInfo, getServerCapabilities,
  listTools, listResources, listResourceTemplates, listPrompts,
  getInstructions, disconnect,
} from "./scanner.js";
import { analyzeTools, summarize } from "./analyzer.js";
import { scanWithAguara } from "./aguara.js";
import { formatOutput, formatJson, formatDiff, formatPolicyResult, formatError } from "./formatter.js";
import { formatMarkdown } from "./markdown.js";
import { formatSarif } from "./sarif.js";
import { diffScans } from "./diff.js";
import { discoverServers } from "./config.js";
import { loadPolicy, findPolicy, evaluatePolicy } from "./policy.js";
import type { ScanResult, ServerTarget, Policy, AguaraFinding } from "./types.js";

function targetLabel(target: ServerTarget): string {
  if (target.type === "stdio") {
    return `${target.command} ${target.args.join(" ")}`.trim();
  }
  return target.url;
}

async function scanServer(target: ServerTarget, timeout: number, headers: string[] = []): Promise<ScanResult> {
  const startTime = Date.now();
  const connection = await connectToServer(target, timeout, headers);

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

    // Run aguara on all content (tools, resources, prompts)
    const aguara = await scanWithAguara({
      tools: rawTools,
      resources,
      resourceTemplates,
      prompts,
    });

    // Build per-tool findings map for analyzer
    const findingsByTool = new Map<string, AguaraFinding[]>();
    for (const f of aguara.findings) {
      if (f.toolName.length > 0 && !f.toolName.startsWith("[")) {
        const existing = findingsByTool.get(f.toolName) ?? [];
        existing.push(f);
        findingsByTool.set(f.toolName, existing);
      }
    }

    // Analyze tools with aguara context for better categorization
    const tools = analyzeTools(rawTools, findingsByTool);
    const toolSummary = summarize(tools);
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

async function loadBaseline(filePath: string): Promise<ScanResult> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as ScanResult;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (options === null) return;

  if (options.noColor) {
    process.env["FORCE_COLOR"] = "0";
  }

  // Discover servers from config files if --config is set
  if (options.config) {
    const discovered = await discoverServers();
    if (discovered.length === 0) {
      console.error(formatError("No MCP servers found in config files."));
      process.exit(1);
    }
    console.log(chalk.bold(`Found ${discovered.length} server(s) in config files:\n`));
    for (const s of discovered) {
      console.log(`  ${chalk.dim(s.source)} ${chalk.cyan(s.name)}`);
      options.targets.push(s.target);
    }
    console.log("");
  }

  const results: ScanResult[] = [];

  for (const target of options.targets) {
    try {
      const result = await scanServer(target, options.timeout, options.header);
      results.push(result);

      if (!options.json && options.diff === false) {
        console.log(formatOutput(result, { verbose: options.verbose }));
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

  // Diff mode
  if (options.diff !== false) {
    const baseline = await loadBaseline(options.diff);
    for (const current of results) {
      const diff = diffScans(baseline, current);
      if (options.json) {
        console.log(JSON.stringify(diff, null, 2));
      } else {
        console.log(formatDiff(diff));
      }
    }
    return;
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

  if (options.sarif !== false) {
    const sarifOutput = formatSarif(results);
    await writeFile(options.sarif, sarifOutput, "utf-8");
    console.log(`SARIF report saved to ${options.sarif}`);
  }

  // Policy enforcement
  let policy: Policy | null = null;
  if (options.policy !== false) {
    const policyPath = options.policy === "auto" ? await findPolicy() : options.policy;
    if (policyPath !== null) {
      policy = await loadPolicy(policyPath);
      if (!options.json) {
        console.log(`\n${chalk.bold("\u{1F6E1}\uFE0F  Policy:")} ${policyPath}\n`);
      }
    } else if (options.policy === "auto") {
      // No policy file found, skip silently
    } else {
      console.error(formatError(`Policy file not found: ${options.policy}`));
      process.exit(1);
    }
  }

  if (policy !== null) {
    let anyFailed = false;
    const policyResults: Array<{ server: string; result: ReturnType<typeof evaluatePolicy> }> = [];

    for (const scanResult of results) {
      const pr = evaluatePolicy(policy, scanResult);
      policyResults.push({ server: scanResult.server.name, result: pr });
      if (!pr.passed) anyFailed = true;
      if (!options.json) {
        console.log(formatPolicyResult(pr, scanResult.server.name));
      }
    }

    if (!options.json) {
      console.log("");
    } else {
      console.log(JSON.stringify(policyResults, null, 2));
    }

    if (anyFailed) {
      process.exit(2);
    }
    return;
  }

  // CI exit code: exit 2 if aguara found issues
  if (options.failOnFindings) {
    const hasFindings = results.some((r) => r.aguara.findings.length > 0);
    if (hasFindings) {
      process.exit(2);
    }
  }
}

main().catch((err: unknown) => {
  console.error(formatError(err instanceof Error ? err.message : "Unexpected error"));
  process.exit(1);
});
