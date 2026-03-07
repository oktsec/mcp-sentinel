import type { CliOptions } from "./types.js";

const VERSION = "0.1.0";

const HELP = `
mcp-inspector v${VERSION}
Scan MCP servers to detect exposed tools, destructive operations, and security risks.

USAGE
  npx mcp-inspector <command> [args...]
  npx mcp-inspector npx @modelcontextprotocol/server-github
  npx mcp-inspector node ./my-server.js --port 3000

OPTIONS
  --json        Output results as JSON
  --no-color    Disable colored output
  --timeout <ms> Connection timeout in milliseconds (default: 30000)
  --help, -h    Show this help message
  --version, -v Show version number

EXAMPLES
  npx mcp-inspector npx @modelcontextprotocol/server-github
  npx mcp-inspector npx @modelcontextprotocol/server-filesystem /tmp
  npx mcp-inspector node my-server.js --json
`.trim();

export function parseArgs(argv: string[]): CliOptions | null {
  const args = argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(HELP);
    return null;
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(VERSION);
    return null;
  }

  const json = args.includes("--json");
  const noColor = args.includes("--no-color");

  let timeout = 30_000;
  const timeoutIdx = args.indexOf("--timeout");
  if (timeoutIdx !== -1) {
    const timeoutVal = args[timeoutIdx + 1];
    if (timeoutVal === undefined) {
      console.error("Error: --timeout requires a value");
      process.exit(1);
    }
    const parsed = Number(timeoutVal);
    if (Number.isNaN(parsed) || parsed <= 0) {
      console.error("Error: --timeout must be a positive number");
      process.exit(1);
    }
    timeout = parsed;
  }

  const filteredArgs = args.filter((arg, i) => {
    if (arg === "--json" || arg === "--no-color") return false;
    if (arg === "--timeout") return false;
    if (i > 0 && args[i - 1] === "--timeout") return false;
    return true;
  });

  if (filteredArgs.length === 0) {
    console.error("Error: No server command provided. Run with --help for usage.");
    process.exit(1);
  }

  const [command, ...serverArgs] = filteredArgs;

  return {
    command: command!,
    args: serverArgs,
    json,
    noColor,
    timeout,
  };
}
