import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import type { StepResult, FlowError, Attachment } from "./types.js";

export interface BundleStep {
  index: number;
  command: string;
  selector: unknown;
  durationMs: number;
  error?: string;
}

export interface FailureBundle {
  schemaVersion: number;
  flow: string;
  platform: string;
  timestamp: string;
  failedStep: BundleStep | null;
  lastPassedStep: BundleStep | null;
  error: {
    message: string;
    category: string;
    suggestion?: string;
    errorCode?: string;
  };
  selectorContext?: {
    attempted: unknown;
    nearbyAlternatives: string[];
  };
  artifacts: Record<string, string>;
  reproCommand: string;
  durationMs: number;
  selectorWarnings?: Array<{ rule: string; stepIndex?: number; message: string }>;
}

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i]![0] = i;
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i]![j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1]![j - 1]!
          : 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
    }
  }
  return dp[m]![n]!;
}

/**
 * Extract all testID and text values from a hierarchy JSON string via DFS.
 */
function extractIdentifiers(hierarchyJson: string): { testIDs: string[]; texts: string[] } {
  const testIDs: string[] = [];
  const texts: string[] = [];

  try {
    const root = JSON.parse(hierarchyJson);
    const queue = [root];
    while (queue.length > 0) {
      const node = queue.pop();
      if (!node || typeof node !== "object") continue;
      if (node.testID && typeof node.testID === "string") testIDs.push(node.testID);
      if (node.text && typeof node.text === "string") texts.push(node.text);
      if (Array.isArray(node.children)) {
        for (const child of node.children) queue.push(child);
      }
    }
  } catch {
    // Invalid JSON — return empty
  }

  return { testIDs, texts };
}

/**
 * Find selectors in the hierarchy that are similar to the attempted selector.
 * Returns up to 5 matches ranked by relevance.
 */
export function findNearbySelectors(attempted: unknown, hierarchyJson: string | null): string[] {
  if (!hierarchyJson) return [];

  const { testIDs, texts } = extractIdentifiers(hierarchyJson);

  let target: string;
  let candidates: string[];

  if (typeof attempted === "string") {
    // Bare string — search both testIDs and texts
    target = attempted.toLowerCase();
    candidates = [...testIDs, ...texts];
  } else if (attempted && typeof attempted === "object") {
    const sel = attempted as Record<string, unknown>;
    if (typeof sel.testID === "string") {
      target = sel.testID.toLowerCase();
      candidates = testIDs;
    } else if (typeof sel.text === "string") {
      target = sel.text.toLowerCase();
      candidates = texts;
    } else if (typeof sel.accessibilityLabel === "string") {
      target = sel.accessibilityLabel.toLowerCase();
      candidates = [...testIDs, ...texts];
    } else {
      return [];
    }
  } else {
    return [];
  }

  // Score each candidate: substring match (score 0) beats edit distance
  const scored = candidates
    .filter((c) => c !== target) // exclude exact match
    .map((c) => {
      const cl = c.toLowerCase();
      const substringMatch = cl.includes(target) || target.includes(cl);
      const dist = levenshtein(target, cl);
      return { value: c, score: substringMatch ? 0 : dist };
    })
    .filter((s) => s.score <= 5)
    .toSorted((a, b) => a.score - b.score);

  // Deduplicate and take top 5
  const seen = new Set<string>();
  const results: string[] = [];
  for (const s of scored) {
    if (!seen.has(s.value)) {
      seen.add(s.value);
      results.push(s.value);
      if (results.length >= 5) break;
    }
  }

  return results;
}

/**
 * Build the artifact map from attachment list — maps type to relative filename.
 */
function buildArtifactMap(attachments: Attachment[] | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  if (!attachments) return map;

  for (const att of attachments) {
    const filename = basename(att.path);
    if (filename === "screenshot.png") map.screenshot = filename;
    else if (filename === "hierarchy.json") map.hierarchy = filename;
    else if (filename === "console-logs.json") map.consoleLogs = filename;
    else if (filename === "js-errors.json") map.jsErrors = filename;
    else if (filename === "network.har") map.har = filename;
    else if (filename === "driver-logs.txt") map.driverLogs = filename;
  }

  return map;
}

/**
 * Create a structured failure bundle JSON for a failed flow.
 */
export function createFailureBundle(
  flowName: string,
  platform: string,
  steps: StepResult[],
  error: FlowError,
  artifactDir: string,
  attachments?: Attachment[],
  flowPath?: string,
): FailureBundle {
  // Find the failed step (last step with status "failed")
  const failedStepIndex = steps.findLastIndex((s) => s.status === "failed");
  const failedStep =
    failedStepIndex >= 0
      ? {
          index: failedStepIndex,
          command: steps[failedStepIndex]!.command,
          selector: steps[failedStepIndex]!.selector ?? null,
          durationMs: steps[failedStepIndex]!.durationMs,
          error: steps[failedStepIndex]!.error,
        }
      : null;

  // Find the last passed step before the failure
  const lastPassedIndex =
    failedStepIndex > 0
      ? steps.findLastIndex((s, i) => i < failedStepIndex && s.status === "passed")
      : -1;
  const lastPassedStep =
    lastPassedIndex >= 0
      ? {
          index: lastPassedIndex,
          command: steps[lastPassedIndex]!.command,
          selector: steps[lastPassedIndex]!.selector ?? null,
          durationMs: steps[lastPassedIndex]!.durationMs,
        }
      : null;

  // Build selector context with nearby alternatives
  let selectorContext: FailureBundle["selectorContext"];
  if (
    failedStep?.selector &&
    (error.category === "element-not-found" || error.category === "element-not-visible")
  ) {
    // Try to read the hierarchy from the artifact directory
    const hierarchyPath = join(artifactDir, "hierarchy.json");
    let hierarchyJson: string | null = null;
    if (existsSync(hierarchyPath)) {
      try {
        hierarchyJson = readFileSync(hierarchyPath, "utf-8");
      } catch {
        // Ignore read errors
      }
    }

    const nearbyAlternatives = findNearbySelectors(failedStep.selector, hierarchyJson);
    selectorContext = {
      attempted: failedStep.selector,
      nearbyAlternatives,
    };
  }

  const flowFile = flowPath ?? `flows/${flowName.replaceAll(" ", "-")}.flow.ts`;
  const reproCommand = `spana test ${flowFile} --platform ${platform} --grep '${flowName}'`;

  const bundle: FailureBundle = {
    schemaVersion: 1,
    flow: flowName,
    platform,
    timestamp: new Date().toISOString(),
    failedStep,
    lastPassedStep,
    error: {
      message: error.message,
      category: error.category,
      suggestion: error.suggestion,
      errorCode: error.errorCode,
    },
    selectorContext,
    artifacts: buildArtifactMap(attachments),
    reproCommand,
    durationMs: steps.reduce((sum, s) => sum + s.durationMs, 0),
  };

  return bundle;
}

/**
 * Write a failure bundle to disk as JSON.
 */
export function writeFailureBundle(bundle: FailureBundle, artifactDir: string): string {
  const path = join(artifactDir, "failure-bundle.json");
  writeFileSync(path, JSON.stringify(bundle, null, 2), "utf-8");
  return path;
}
