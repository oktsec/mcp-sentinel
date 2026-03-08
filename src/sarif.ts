import type { ScanResult, AguaraFinding } from "./types.js";

const SEV_TO_SARIF: Record<string, string> = {
  CRITICAL: "error",
  HIGH: "error",
  MEDIUM: "warning",
  LOW: "note",
};

const SEV_TO_LEVEL: Record<string, string> = {
  CRITICAL: "9.0",
  HIGH: "7.0",
  MEDIUM: "4.0",
  LOW: "1.0",
};

interface SarifResult {
  ruleId: string;
  level: string;
  message: { text: string };
  locations: {
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number };
    };
  }[];
  properties: Record<string, unknown>;
}

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  properties: Record<string, unknown>;
}

function findingToResult(finding: AguaraFinding, serverName: string): SarifResult {
  const location = finding.toolName.length > 0 ? finding.toolName : serverName;
  return {
    ruleId: finding.ruleId,
    level: SEV_TO_SARIF[finding.severity] ?? "note",
    message: {
      text: `[${finding.severity}] ${finding.ruleName}${finding.toolName.length > 0 ? ` in tool '${finding.toolName}'` : ""}${finding.remediation !== undefined ? `. ${finding.remediation}` : ""}`,
    },
    locations: [{
      physicalLocation: {
        artifactLocation: { uri: location },
        ...(finding.line !== undefined ? { region: { startLine: finding.line } } : {}),
      },
    }],
    properties: {
      severity: finding.severity,
      category: finding.category,
      toolName: finding.toolName,
      ...(finding.confidence !== undefined ? { confidence: finding.confidence } : {}),
      ...(finding.score !== undefined ? { score: finding.score } : {}),
    },
  };
}

function findingToRule(finding: AguaraFinding): SarifRule {
  return {
    id: finding.ruleId,
    name: finding.ruleName,
    shortDescription: { text: finding.description.length > 0 ? finding.description : finding.ruleName },
    properties: {
      severity: finding.severity,
      "security-severity": SEV_TO_LEVEL[finding.severity] ?? "1.0",
      category: finding.category,
    },
  };
}

export function formatSarif(results: ScanResult[]): string {
  const allResults: SarifResult[] = [];
  const rulesMap = new Map<string, SarifRule>();

  for (const result of results) {
    for (const finding of result.aguara.findings) {
      allResults.push(findingToResult(finding, result.server.name));
      if (!rulesMap.has(finding.ruleId)) {
        rulesMap.set(finding.ruleId, findingToRule(finding));
      }
    }
  }

  const sarif = {
    $schema: "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "mcp-sentinel",
          informationUri: "https://github.com/oktsec/mcp-sentinel",
          rules: [...rulesMap.values()],
        },
      },
      results: allResults,
    }],
  };

  return JSON.stringify(sarif, null, 2);
}
