import type { CliOptions, ServerTarget } from "./types.js";

const VERSION = "0.1.4";

const HELP = `
mcp-sentinel v${VERSION}
Scan MCP servers to detect exposed tools, destructive operations, and security risks.

USAGE
  npx mcp-sentinel <command> [args...]
  npx mcp-sentinel <url>
  npx mcp-sentinel --config
  npx mcp-sentinel <command1> [args...] --- <command2> [args...]

TRANSPORTS
  stdio (default for commands)   Connect via stdin/stdout
  sse                            Connect via Server-Sent Events (legacy)
  streamable-http (default for URLs)  Connect via Streamable HTTP

OPTIONS
  --policy <file>      Enforce a security policy (.mcp-policy.yml auto-detected)
  --config             Auto-detect servers from config files (Claude Desktop, Cursor, Windsurf)
  --transport <type>   Force transport type: stdio, sse, streamable-http
  --diff <file.json>   Compare current scan against a previous JSON scan
  --fail-on-findings   Exit with code 2 if aguara finds security issues (for CI)
  --json               Output results as JSON
  --markdown <file>    Export report as markdown file
  --verbose            Show full tool descriptions and finding details
  --header <value>     HTTP header for remote servers (e.g. "Authorization: Bearer xxx")
  --no-color           Disable colored output
  --timeout <ms>       Connection timeout in milliseconds (default: 30000)
  --help, -h           Show this help message
  --version, -v        Show version number

EXAMPLES
  npx mcp-sentinel npx @modelcontextprotocol/server-github
  npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp
  npx mcp-sentinel http://localhost:3000/mcp
  npx mcp-sentinel http://localhost:3000/sse --transport sse
  npx mcp-sentinel node my-server.js --json
  npx mcp-sentinel node my-server.js --verbose
  npx mcp-sentinel http://remote:3000/mcp --header "Authorization: Bearer token"
  npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp --- npx @modelcontextprotocol/server-github
  npx mcp-sentinel --config
  npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp --json > baseline.json
  npx mcp-sentinel npx @modelcontextprotocol/server-filesystem /tmp --diff baseline.json
`.trim();

function isUrl(value: string): boolean {
  return value.startsWith("http://") || value.startsWith("https://");
}

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
  const config = args.includes("--config");
  const failOnFindings = args.includes("--fail-on-findings");
  const verbose = args.includes("--verbose");

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

  let transportOverride: "stdio" | "sse" | "streamable-http" | undefined;
  const transportIdx = args.indexOf("--transport");
  if (transportIdx !== -1) {
    const transportVal = args[transportIdx + 1];
    if (transportVal !== "stdio" && transportVal !== "sse" && transportVal !== "streamable-http") {
      console.error("Error: --transport must be one of: stdio, sse, streamable-http");
      process.exit(1);
    }
    transportOverride = transportVal;
  }

  let diff: string | false = false;
  const diffIdx = args.indexOf("--diff");
  if (diffIdx !== -1) {
    const diffVal = args[diffIdx + 1];
    if (diffVal === undefined || diffVal.startsWith("--")) {
      console.error("Error: --diff requires a JSON file path");
      process.exit(1);
    }
    diff = diffVal;
  }

  let policy: string | false = false;
  const policyIdx = args.indexOf("--policy");
  if (policyIdx !== -1) {
    const policyVal = args[policyIdx + 1];
    if (policyVal === undefined || policyVal.startsWith("--")) {
      // --policy without a file means auto-detect
      policy = "auto";
    } else {
      policy = policyVal;
    }
  }

  // Collect --header values (can be repeated)
  const header: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--header" && i + 1 < args.length) {
      header.push(args[i + 1]!);
    }
  }

  const FLAG_ARGS = new Set(["--timeout", "--markdown", "--transport", "--diff", "--policy", "--header"]);

  const filteredArgs = args.filter((arg, i) => {
    if (arg === "--json" || arg === "--no-color" || arg === "--config" || arg === "--fail-on-findings" || arg === "--verbose") return false;
    if (FLAG_ARGS.has(arg)) return false;
    if (i > 0 && FLAG_ARGS.has(args[i - 1]!)) return false;
    return true;
  });

  if (filteredArgs.length === 0 && !config) {
    console.error("Error: No server command provided. Run with --help for usage.");
    process.exit(1);
  }

  const targets = filteredArgs.length > 0 ? parseTargets(filteredArgs, transportOverride) : [];

  if (targets.length === 0 && !config) {
    console.error("Error: No server command provided. Run with --help for usage.");
    process.exit(1);
  }

  return { targets, json, markdown, noColor, timeout, diff, config, failOnFindings, policy, verbose, header };
}

function parseTargets(args: string[], transportOverride?: "stdio" | "sse" | "streamable-http"): ServerTarget[] {
  const targets: ServerTarget[] = [];
  let current: string[] = [];

  for (const arg of args) {
    if (arg === "---") {
      if (current.length > 0) {
        targets.push(toTarget(current, transportOverride));
        current = [];
      }
    } else {
      current.push(arg);
    }
  }

  if (current.length > 0) {
    targets.push(toTarget(current, transportOverride));
  }

  return targets;
}

function toTarget(args: string[], transportOverride?: "stdio" | "sse" | "streamable-http"): ServerTarget {
  const first = args[0]!;

  if (isUrl(first)) {
    if (args.length > 1) {
      console.error(`Error: URL targets do not accept additional arguments: ${args.slice(1).join(" ")}`);
      process.exit(1);
    }
    if (transportOverride === "stdio") {
      console.error("Error: Cannot use stdio transport with a URL target");
      process.exit(1);
    }
    const type = transportOverride ?? "streamable-http";
    return { type, url: first };
  }

  if (transportOverride !== undefined && transportOverride !== "stdio") {
    console.error(`Error: Cannot use ${transportOverride} transport with a command target. Use a URL instead.`);
    process.exit(1);
  }

  const [command, ...rest] = args;
  return { type: "stdio", command: command!, args: rest };
}
