import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import type { Policy, PolicyRule, PolicyViolation, PolicyResult, ScanResult, ToolCategory } from "./types.js";

const VALID_CATEGORIES = new Set<string>(["read", "write", "admin"]);
const VALID_SEVERITIES = new Set<string>(["critical", "high", "medium", "low"]);

function validatePolicy(raw: unknown): Policy {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("Policy file must be a YAML object");
  }

  const obj = raw as Record<string, unknown>;
  const rules: PolicyRule = {};

  if (obj["deny"] !== undefined) {
    if (typeof obj["deny"] !== "object" || obj["deny"] === null) {
      throw new Error("Policy 'deny' must be an object");
    }
    const deny = obj["deny"] as Record<string, unknown>;
    rules.deny = {};

    if (deny["categories"] !== undefined) {
      if (!Array.isArray(deny["categories"])) {
        throw new Error("Policy 'deny.categories' must be an array");
      }
      for (const c of deny["categories"]) {
        if (!VALID_CATEGORIES.has(String(c))) {
          throw new Error(`Invalid category '${String(c)}' in deny.categories. Valid: read, write, admin`);
        }
      }
      rules.deny.categories = deny["categories"] as ToolCategory[];
    }

    if (deny["tools"] !== undefined) {
      if (!Array.isArray(deny["tools"])) {
        throw new Error("Policy 'deny.tools' must be an array");
      }
      rules.deny.tools = deny["tools"].map(String);
    }

    if (deny["descriptions"] !== undefined) {
      if (!Array.isArray(deny["descriptions"])) {
        throw new Error("Policy 'deny.descriptions' must be an array");
      }
      rules.deny.descriptions = deny["descriptions"].map(String);
    }
  }

  if (obj["require"] !== undefined) {
    if (typeof obj["require"] !== "object" || obj["require"] === null) {
      throw new Error("Policy 'require' must be an object");
    }
    const req = obj["require"] as Record<string, unknown>;
    rules.require = {};

    if (req["aguara"] !== undefined) {
      if (req["aguara"] !== "clean") {
        throw new Error("Policy 'require.aguara' must be 'clean'");
      }
      rules.require.aguara = "clean";
    }

    if (req["maxTools"] !== undefined) {
      const n = Number(req["maxTools"]);
      if (!Number.isInteger(n) || n < 0) {
        throw new Error("Policy 'require.maxTools' must be a non-negative integer");
      }
      rules.require.maxTools = n;
    }

    if (req["maxFindings"] !== undefined) {
      if (typeof req["maxFindings"] !== "object" || req["maxFindings"] === null) {
        throw new Error("Policy 'require.maxFindings' must be an object");
      }
      const mf = req["maxFindings"] as Record<string, unknown>;
      rules.require.maxFindings = {};
      for (const [sev, val] of Object.entries(mf)) {
        if (!VALID_SEVERITIES.has(sev)) {
          throw new Error(`Invalid severity '${sev}' in require.maxFindings. Valid: critical, high, medium, low`);
        }
        const n = Number(val);
        if (!Number.isInteger(n) || n < 0) {
          throw new Error(`require.maxFindings.${sev} must be a non-negative integer`);
        }
        rules.require.maxFindings[sev] = n;
      }
    }
  }

  if (obj["allow"] !== undefined) {
    if (typeof obj["allow"] !== "object" || obj["allow"] === null) {
      throw new Error("Policy 'allow' must be an object");
    }
    const allow = obj["allow"] as Record<string, unknown>;
    rules.allow = {};

    if (allow["tools"] !== undefined) {
      if (!Array.isArray(allow["tools"])) {
        throw new Error("Policy 'allow.tools' must be an array");
      }
      rules.allow.tools = allow["tools"].map(String);
    }
  }

  return { rules };
}

function matchesPattern(name: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
    return regex.test(name);
  }
  return name === pattern;
}

function matchesDescriptionPattern(description: string, pattern: string): boolean {
  if (pattern.includes("*")) {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"), "i");
    return regex.test(description);
  }
  return description.toLowerCase().includes(pattern.toLowerCase());
}

export function evaluatePolicy(policy: Policy, result: ScanResult): PolicyResult {
  const violations: PolicyViolation[] = [];
  const { rules } = policy;
  const allowedTools = rules.allow?.tools;

  // deny.categories
  if (rules.deny?.categories !== undefined) {
    for (const tool of result.tools) {
      if (rules.deny.categories.includes(tool.category)) {
        if (allowedTools !== undefined && allowedTools.some((p) => matchesPattern(tool.tool.name, p))) {
          continue;
        }
        violations.push({
          rule: "deny.categories",
          message: `Tool '${tool.tool.name}' has denied category '${tool.category}'`,
          severity: "error",
        });
      }
    }
  }

  // deny.tools
  if (rules.deny?.tools !== undefined) {
    for (const tool of result.tools) {
      for (const pattern of rules.deny.tools) {
        if (matchesPattern(tool.tool.name, pattern)) {
          if (allowedTools !== undefined && allowedTools.some((p) => matchesPattern(tool.tool.name, p))) {
            continue;
          }
          violations.push({
            rule: "deny.tools",
            message: `Tool '${tool.tool.name}' matches denied pattern '${pattern}'`,
            severity: "error",
          });
        }
      }
    }
  }

  // deny.descriptions
  if (rules.deny?.descriptions !== undefined) {
    for (const tool of result.tools) {
      for (const pattern of rules.deny.descriptions) {
        if (matchesDescriptionPattern(tool.tool.description, pattern)) {
          if (allowedTools !== undefined && allowedTools.some((p) => matchesPattern(tool.tool.name, p))) {
            continue;
          }
          violations.push({
            rule: "deny.descriptions",
            message: `Tool '${tool.tool.name}' description matches denied pattern '${pattern}'`,
            severity: "error",
          });
        }
      }
    }
  }

  // require.aguara
  if (rules.require?.aguara === "clean") {
    if (!result.aguara.available) {
      violations.push({
        rule: "require.aguara",
        message: "Policy requires aguara but it is not installed",
        severity: "error",
      });
    } else if (result.aguara.findings.length > 0) {
      violations.push({
        rule: "require.aguara",
        message: `Aguara found ${result.aguara.findings.length} security issue(s)`,
        severity: "error",
      });
    }
  }

  // require.maxFindings (per severity)
  if (rules.require?.maxFindings !== undefined) {
    const counts: Record<string, number> = {};
    for (const f of result.aguara.findings) {
      const sev = f.severity.toLowerCase();
      counts[sev] = (counts[sev] ?? 0) + 1;
    }
    for (const [sev, max] of Object.entries(rules.require.maxFindings)) {
      const actual = counts[sev] ?? 0;
      if (actual > max) {
        violations.push({
          rule: "require.maxFindings",
          message: `Found ${actual} ${sev} finding(s), policy allows max ${max}`,
          severity: "error",
        });
      }
    }
  }

  // require.maxTools
  if (rules.require?.maxTools !== undefined) {
    if (result.tools.length > rules.require.maxTools) {
      violations.push({
        rule: "require.maxTools",
        message: `Server exposes ${result.tools.length} tools, policy allows max ${rules.require.maxTools}`,
        severity: "error",
      });
    }
  }

  return { passed: violations.length === 0, violations };
}

export async function loadPolicy(filePath: string): Promise<Policy> {
  const resolved = resolve(filePath);
  const raw = await readFile(resolved, "utf-8");
  const parsed: unknown = parseYaml(raw);
  return validatePolicy(parsed);
}

const DEFAULT_PATHS = [".mcp-policy.yml", ".mcp-policy.yaml"];

export async function findPolicy(): Promise<string | null> {
  for (const path of DEFAULT_PATHS) {
    try {
      await readFile(resolve(path), "utf-8");
      return path;
    } catch {
      continue;
    }
  }
  return null;
}
