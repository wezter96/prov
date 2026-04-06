import { Effect } from "effect";
import type { ProvConfig } from "../schemas/config.js";
import type { RuntimeResult } from "./types.js";
import type { AppiumExecutionConfig } from "../schemas/config.js";
import { AppiumClient } from "../drivers/appium/client.js";
import { createAppiumAndroidDriver } from "../drivers/appium/android.js";
import { resolveCapabilities } from "./capabilities.js";
import { parseAndroidHierarchy } from "../drivers/uiautomator2/pagesource.js";

export async function buildAppiumAndroidRuntime(
  config: ProvConfig,
  appiumConfig: AppiumExecutionConfig,
  opts: { capsPath?: string; capsJson?: string },
): Promise<RuntimeResult> {
  const caps = await resolveCapabilities(appiumConfig, opts);
  const client = new AppiumClient(appiumConfig.serverUrl!);
  await client.createSession({
    platformName: "Android",
    ...caps,
  });

  const driver = await Effect.runPromise(createAppiumAndroidDriver(client));

  return {
    runtime: {
      driver,
      cleanup: async () => {
        try {
          await client.deleteSession();
        } catch {
          /* swallow cleanup errors */
        }
      },
      metadata: {
        platform: "android",
        mode: "appium",
        sessionId: client.getSessionId() ?? undefined,
        sessionCaps: client.getSessionCaps(),
      },
    },
    engineConfig: {
      appId: (caps["appium:appPackage"] as string) ?? "",
      platform: "android",
      coordinatorConfig: {
        parse: parseAndroidHierarchy,
        defaults: {
          timeout: config.defaults?.waitTimeout,
          pollInterval: config.defaults?.pollInterval,
        },
      },
      autoLaunch: false, // Appium manages app lifecycle
      flowTimeout: config.defaults?.waitTimeout ? config.defaults.waitTimeout * 10 : 60_000,
      artifactConfig: config.artifacts,
      launchOptions: config.launchOptions,
      hooks: config.hooks,
    },
  };
}
