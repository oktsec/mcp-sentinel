import type { AguaraFinding, RiskScore } from "./types.js";

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface ScoreInput {
  toolSummary: { read: number; write: number; admin: number };
  toolCount: number;
  findings: AguaraFinding[];
  hasInstructions: boolean;
}

const SEV_WEIGHTS: Record<string, number> = {
  CRITICAL: 15,
  HIGH: 8,
  MEDIUM: 3,
  LOW: 1,
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Calculate a risk score for a scan result.
 *
 * Scoring (100 = safest):
 * - Tool risk (40 pts): deductions for write and admin tools
 * - Finding risk (40 pts): deductions per aguara finding weighted by severity
 * - Surface risk (20 pts): deductions for large tool counts and instructions
 */
export function calculateScore(input: ScoreInput): RiskScore {
  const adminPenalty = input.toolSummary.admin * 8;
  const writePenalty = input.toolSummary.write * 3;
  const toolRisk = clamp(40 - adminPenalty - writePenalty, 0, 40);

  let findingPenalty = 0;
  for (const f of input.findings) {
    findingPenalty += SEV_WEIGHTS[f.severity] ?? 1;
  }
  const findingRisk = clamp(40 - findingPenalty, 0, 40);

  const toolCountPenalty = input.toolCount > 20 ? 10 : input.toolCount > 10 ? 5 : 0;
  const instructionPenalty = input.hasInstructions ? 2 : 0;
  const surfaceRisk = clamp(20 - toolCountPenalty - instructionPenalty, 0, 20);

  const score = toolRisk + findingRisk + surfaceRisk;
  const grade = scoreToGrade(score);

  return { grade, score, breakdown: { toolRisk, findingRisk, surfaceRisk } };
}

function scoreToGrade(score: number): Grade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 55) return "C";
  if (score >= 35) return "D";
  return "F";
}
