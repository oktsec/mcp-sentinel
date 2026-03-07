import type { CliOptions, ServerTarget } from "./types.js";

const VERSION = "0.1.0";

const HELP = `
mcp-inspector v${VERSION}
Scan MCP servers to detect exposed tools, destructive operations, and security risks.

USAGE
  npx mcp-inspector <command> [args...]
  npx mcp-inspector <command1> [args...] --- <command2> [args...]

OPTIONS
  --json             Output results as JSON
  --markdown <file>  Export report as markdown file
  --no-color         Disable colored output
  --timeout <ms>     Connection timeout in milliseconds (default: 30000)
  --help, -h         Show this help message
  --version, -v      Show version number

EXAMPLES
  npx mcp-inspector npx @modelcontextprotocol/server-github
  npx mcp-inspector npx @modelcontextprotocol/server-filesystem /tmp
  npx mcp-inspector node my-server.js --json
  npx mcp-inspector npx @mcp/server-a --- npx @mcp/server-b
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

  let markdown: string | false = false;
  const markdownIdx = args.indexOf("--markdown");
  if (markdownIdx !== -1) {
    const markdownVal = args[markdownIdx + 1];
    if (markdownVal === undefined || markdownVal.startsWith("--")) {
      console.error("Error: --markdown requires a file path");
      process.exit(1);
    }
    markdown = markdownVal;
  }

  const filteredArgs = args.filter((arg, i) => {
    if (arg === "--json" || arg === "--no-color") return false;
    if (arg === "--timeout" || arg === "--markdown") return false;
    if (i > 0 && (args[i - 1] === "--timeout" || args[i - 1] === "--markdown")) return false;
    return true;
  });

  if (filteredArgs.length === 0) {
    console.error("Error: No server command provided. Run with --help for usage.");
    process.exit(1);
  }

  const targets = parseTargets(filteredArgs);

  if (targets.length === 0) {
    console.error("Error: No server command provided. Run with --help for usage.");
    process.exit(1);
  }

  return { targets, json, markdown, noColor, timeout };
}

function parseTargets(args: string[]): ServerTarget[] {
  const targets: ServerTarget[] = [];
  let current: string[] = [];

  for (const arg of args) {
    if (arg === "---") {
      if (current.length > 0) {
        targets.push(toTarget(current));
        current = [];
      }
    } else {
      current.push(arg);
    }
  }

  if (current.length > 0) {
    targets.push(toTarget(current));
  }

  return targets;
}

function toTarget(args: string[]): ServerTarget {
  const [command, ...rest] = args;
  return { command: command!, args: rest };
}
