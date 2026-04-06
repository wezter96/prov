import { Effect } from "effect";
import type { ProvConfig } from "../schemas/config.js";
import type { RuntimeResult } from "./types.js";
import { AppiumClient } from "../drivers/appium/client.js";
import { createAppiumAndroidDriver } from "../drivers/appium/android.js";
import { createAppiumIOSDriver } from "../drivers/appium/ios.js";
import { parseAndroidHierarchy } from "../drivers/uiautomator2/pagesource.js";
import { parseIOSHierarchy } from "../drivers/wda/pagesource.js";
import { detectProvider } from "../cloud/provider.js";

export async function buildAppiumAndroidRuntime(
  config: ProvConfig,
  appiumUrl: string,
  caps: Record<string, unknown>,
): Promise<RuntimeResult> {
  const client = new AppiumClient(appiumUrl);
  await client.createSession({
    platformName: "Android",
    ...caps,
  });

  const driver = await Effect.runPromise(createAppiumAndroidDriver(client));

  const sessionId = client.getSessionId() ?? undefined;
  const sessionCaps = client.getSessionCaps();

  // Detect cloud provider
  const detectedProvider = detectProvider(appiumUrl);
  const providerName = detectedProvider?.name();

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
        sessionId,
        sessionCaps,
        provider: providerName,
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
        waitForIdleTimeout: config.defaults?.waitForIdleTimeout,
        typingDelay: config.defaults?.typingDelay,
      },
      autoLaunch: false, // Appium manages app lifecycle
      flowTimeout: config.defaults?.waitTimeout ? config.defaults.waitTimeout * 10 : 60_000,
      artifactConfig: config.artifacts,
      launchOptions: config.launchOptions,
      hooks: config.hooks,
    },
  };
}

export async function buildAppiumIOSRuntime(
  config: ProvConfig,
  appiumUrl: string,
  caps: Record<string, unknown>,
): Promise<RuntimeResult> {
  const client = new AppiumClient(appiumUrl);
  await client.createSession({
    platformName: "iOS",
    "appium:automationName": "XCUITest",
    ...caps,
  });

  const driver = await Effect.runPromise(createAppiumIOSDriver(client));

  const sessionId = client.getSessionId() ?? undefined;
  const sessionCaps = client.getSessionCaps();

  // Detect cloud provider
  const detectedProvider = detectProvider(appiumUrl);
  const providerName = detectedProvider?.name();

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
        platform: "ios",
        mode: "appium",
        sessionId,
        sessionCaps,
        provider: providerName,
      },
    },
    engineConfig: {
      appId: (caps["appium:bundleId"] as string) ?? "",
      platform: "ios",
      coordinatorConfig: {
        parse: parseIOSHierarchy,
        defaults: {
          timeout: config.defaults?.waitTimeout,
          pollInterval: config.defaults?.pollInterval,
        },
        waitForIdleTimeout: config.defaults?.waitForIdleTimeout,
        typingDelay: config.defaults?.typingDelay,
      },
      autoLaunch: false, // Appium manages app lifecycle
      flowTimeout: config.defaults?.waitTimeout ? config.defaults.waitTimeout * 10 : 60_000,
      artifactConfig: config.artifacts,
      launchOptions: config.launchOptions,
      hooks: config.hooks,
    },
  };
}
