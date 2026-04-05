import type { RawDriverService } from "../drivers/raw-driver.js";
import type { FlowDefinition } from "../api/flow.js";
import type { Platform } from "../schemas/selector.js";
import { createPromiseApp } from "../api/app.js";
import { createPromiseExpect } from "../api/expect.js";
import type { CoordinatorConfig } from "../smart/coordinator.js";
import type { Attachment, StepResult } from "../report/types.js";
import type { ArtifactConfig } from "../schemas/config.js";
import { captureArtifacts, resolveArtifactConfig } from "./artifacts.js";
import { createStepRecorder } from "./step-recorder.js";

export interface TestResult {
  name: string;
  platform: Platform;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: Error;
  attachments?: Attachment[];
  steps?: StepResult[];
}

export interface EngineConfig {
  appId: string;
  platform: Platform;
  coordinatorConfig: CoordinatorConfig;
  autoLaunch?: boolean;
  flowTimeout?: number;
  artifactConfig?: ArtifactConfig;
}

export async function executeFlow(
  flow: FlowDefinition,
  driver: RawDriverService,
  config: EngineConfig,
): Promise<TestResult> {
  const start = Date.now();
  const { platform, coordinatorConfig, appId } = config;
  const autoLaunch = flow.config.autoLaunch ?? config.autoLaunch ?? true;
  const timeout = flow.config.timeout ?? config.flowTimeout ?? 60_000;
  const artifactConfig = resolveArtifactConfig(config.artifactConfig, flow.config.artifacts);
  const stepRecorder = createStepRecorder(driver, artifactConfig, flow.name, platform);

  try {
    const app = createPromiseApp(driver, appId, coordinatorConfig, stepRecorder);
    const expect = createPromiseExpect(driver, coordinatorConfig, stepRecorder);

    if (autoLaunch) {
      await app.launch();
    }

    // Execute with timeout
    await Promise.race([
      flow.fn({ app, expect, platform }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Flow "${flow.name}" timed out after ${timeout}ms`)), timeout),
      ),
    ]);

    const attachments = await captureArtifacts(driver, artifactConfig, flow.name, platform, "passed");

    return {
      name: flow.name,
      platform,
      status: "passed",
      durationMs: Date.now() - start,
      attachments,
      steps: stepRecorder.getSteps(),
    };
  } catch (error) {
    const attachments = await captureArtifacts(driver, artifactConfig, flow.name, platform, "failed");

    return {
      name: flow.name,
      platform,
      status: "failed",
      durationMs: Date.now() - start,
      error: error instanceof Error ? error : new Error(String(error)),
      attachments,
      steps: stepRecorder.getSteps(),
    };
  }
}
