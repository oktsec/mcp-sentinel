import { parseArgs } from "./cli.js";
import { connectToServer, getServerInfo, listTools, disconnect } from "./scanner.js";
import { analyzeTools, detectEnvVars, assessRisk } from "./analyzer.js";
import { formatOutput, formatJson, formatError } from "./formatter.js";
import type { ScanResult } from "./types.js";

async function main(): Promise<void> {
  const options = parseArgs(process.argv);
  if (options === null) {
    return;
  }

  if (options.noColor) {
    process.env["FORCE_COLOR"] = "0";
  }

  const startTime = Date.now();

  let connection;
  try {
    connection = await connectToServer(options.command, options.args, options.timeout);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to connect to MCP server";
    console.error(formatError(message));
    process.exit(1);
  }

  try {
    const serverInfo = getServerInfo(connection.client);
    const tools = await listTools(connection.client);
    const analyzedTools = analyzeTools(tools);
    const envVars = detectEnvVars(tools);
    const risk = assessRisk(analyzedTools, envVars);

    const scanDuration = Date.now() - startTime;

    const result: ScanResult = {
      server: serverInfo,
      tools: analyzedTools,
      risk,
      envVars,
      scanDuration,
    };

    if (options.json) {
      console.log(formatJson(result));
    } else {
      console.log(formatOutput(result));
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to scan MCP server";
    console.error(formatError(message));
    process.exit(1);
  } finally {
    await disconnect(connection);
  }
}

main().catch((err: unknown) => {
  console.error(
    formatError(err instanceof Error ? err.message : "Unexpected error"),
  );
  process.exit(1);
});
