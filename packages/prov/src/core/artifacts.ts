import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { RawDriverService } from "../drivers/raw-driver.js";
import { Effect } from "effect";

export interface ArtifactConfig {
  outputDir: string;
  captureOnFailure: boolean;
  captureOnSuccess: boolean;
  screenshot: boolean;
  uiHierarchy: boolean;
}

export const DEFAULT_ARTIFACT_CONFIG: ArtifactConfig = {
  outputDir: "./prov-output",
  captureOnFailure: true,
  captureOnSuccess: false,
  screenshot: true,
  uiHierarchy: true,
};

export interface CapturedArtifacts {
  screenshotPath?: string;
  hierarchyPath?: string;
}

/** Capture artifacts (screenshot + hierarchy) from the current driver state */
export async function captureArtifacts(
  driver: RawDriverService,
  config: ArtifactConfig,
  flowName: string,
  platform: string,
  status: "passed" | "failed",
): Promise<CapturedArtifacts> {
  const shouldCapture =
    (status === "failed" && config.captureOnFailure) ||
    (status === "passed" && config.captureOnSuccess);

  if (!shouldCapture) return {};

  const artifacts: CapturedArtifacts = {};
  const safeFlowName = flowName.replace(/[^a-zA-Z0-9-_]/g, "_");
  const dir = join(config.outputDir, `${safeFlowName}-${platform}`);
  mkdirSync(dir, { recursive: true });

  if (config.screenshot) {
    try {
      const screenshot = await Effect.runPromise(
        Effect.orDie(driver.takeScreenshot()),
      );
      const path = join(dir, "screenshot.png");
      writeFileSync(path, screenshot);
      artifacts.screenshotPath = path;
    } catch {
      // Screenshot capture failed — don't block test execution
    }
  }

  if (config.uiHierarchy) {
    try {
      const hierarchy = await Effect.runPromise(
        Effect.orDie(driver.dumpHierarchy()),
      );
      const path = join(dir, "hierarchy.json");
      writeFileSync(path, hierarchy, "utf-8");
      artifacts.hierarchyPath = path;
    } catch {
      // Hierarchy capture failed — don't block test execution
    }
  }

  return artifacts;
}
