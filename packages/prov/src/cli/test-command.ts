import { resolve } from "node:path";
import { Effect } from "effect";
import { discoverFlows, loadFlowFile, filterFlows } from "../core/runner.js";
import { orchestrate, type PlatformConfig } from "../core/orchestrator.js";
import type { EngineConfig } from "../core/engine.js";
import type { ProvConfig } from "../schemas/config.js";
import type { Platform } from "../schemas/selector.js";
import { parseWebHierarchy } from "../drivers/playwright-parser.js";
import { makePlaywrightDriver } from "../drivers/playwright.js";
import { parseAndroidHierarchy } from "../drivers/uiautomator2/pagesource.js";
import { createUiAutomator2Driver } from "../drivers/uiautomator2/driver.js";
import { parseIOSHierarchy } from "../drivers/wda/pagesource.js";
import { createWDADriver } from "../drivers/wda/driver.js";
import { firstAndroidDevice } from "../device/android.js";
import { firstIOSSimulator, bootSimulator } from "../device/ios.js";
import { setupUiAutomator2 } from "../drivers/uiautomator2/installer.js";
import { setupWDA } from "../drivers/wda/installer.js";

export interface TestCommandOptions {
  platforms: Platform[];
  tags?: string[];
  grep?: string;
  reporter: string;
  configPath?: string;
  flowPath?: string;
}

export async function runTestCommand(opts: TestCommandOptions): Promise<boolean> {
  // 1. Load config
  let config: ProvConfig = {};
  try {
    const configPath = resolve(opts.configPath ?? "prov.config.ts");
    const mod = await import(configPath);
    config = mod.default ?? {};
  } catch {
    // No config file, use defaults
  }

  // 2. Discover flows
  const flowDir = opts.flowPath ?? config.flowDir ?? "./flows";
  const flowPaths = await discoverFlows(flowDir);

  if (flowPaths.length === 0) {
    console.log("No flow files found.");
    return true;
  }

  // 3. Load and filter flows
  const flows = [];
  for (const p of flowPaths) {
    flows.push(await loadFlowFile(p));
  }
  const filtered = filterFlows(flows, {
    tags: opts.tags,
    grep: opts.grep,
    platforms: opts.platforms,
  });

  if (filtered.length === 0) {
    console.log("No flows match the given filters.");
    return true;
  }

  console.log(`Running ${filtered.length} flow(s) on ${opts.platforms.join(", ")}...\n`);

  // 4. Setup platform drivers
  const platformConfigs: PlatformConfig[] = [];

  for (const platform of opts.platforms) {
    if (platform === "web") {
      const webUrl = config.apps?.web?.url ?? "http://localhost:3000";
      const driver = await Effect.runPromise(
        makePlaywrightDriver({ headless: true, baseUrl: webUrl }),
      );
      const engineConfig: EngineConfig = {
        appId: webUrl,
        platform: "web",
        coordinatorConfig: {
          parse: parseWebHierarchy,
          defaults: {
            timeout: config.defaults?.waitTimeout,
            pollInterval: config.defaults?.pollInterval,
          },
        },
        autoLaunch: true,
        flowTimeout: config.defaults?.waitTimeout
          ? config.defaults.waitTimeout * 10
          : 60_000,
      };
      platformConfigs.push({ platform, driver, engineConfig });
    }
    if (platform === "android") {
      const device = firstAndroidDevice();
      if (!device) {
        console.log("No Android device/emulator connected. Skipping android platform.");
        continue;
      }
      const packageName = config.apps?.android?.packageName ?? "";
      const hostPort = 8200 + Math.floor(Math.random() * 100);
      try {
        // Auto-setup: install APK if needed, start server, forward port
        const conn = await setupUiAutomator2(device.serial, hostPort);
        const driver = await Effect.runPromise(
          createUiAutomator2Driver(conn.host, conn.port, packageName),
        );
        const engineConfig: EngineConfig = {
          appId: packageName,
          platform: "android",
          coordinatorConfig: {
            parse: parseAndroidHierarchy,
            defaults: {
              timeout: config.defaults?.waitTimeout,
              pollInterval: config.defaults?.pollInterval,
            },
          },
          autoLaunch: true,
          flowTimeout: config.defaults?.waitTimeout
            ? config.defaults.waitTimeout * 10
            : 60_000,
        };
        platformConfigs.push({ platform, driver, engineConfig });
      } catch (e) {
        console.log(`Android setup failed on ${device.serial}: ${e instanceof Error ? e.message : e}`);
      }
    }

    if (platform === "ios") {
      const simulator = firstIOSSimulator();
      if (!simulator) {
        console.log("No iOS simulator available. Skipping ios platform.");
        continue;
      }
      // Boot simulator if not already booted
      if (simulator.state !== "Booted") {
        console.log(`Booting simulator ${simulator.name}...`);
        bootSimulator(simulator.udid);
      }
      const bundleId = config.apps?.ios?.bundleId ?? "";
      const wdaPort = 8100 + Math.floor(Math.random() * 100);
      try {
        // Auto-setup: build WDA if needed, start it, wait for ready
        const conn = await setupWDA(simulator.udid, wdaPort);
        const driver = await Effect.runPromise(
          createWDADriver(conn.host, conn.port, bundleId),
        );
        const engineConfig: EngineConfig = {
          appId: bundleId,
          platform: "ios",
          coordinatorConfig: {
            parse: parseIOSHierarchy,
            defaults: {
              timeout: config.defaults?.waitTimeout,
              pollInterval: config.defaults?.pollInterval,
            },
          },
          autoLaunch: true,
          flowTimeout: config.defaults?.waitTimeout
            ? config.defaults.waitTimeout * 10
            : 60_000,
        };
        platformConfigs.push({ platform, driver, engineConfig });
      } catch (e) {
        console.log(`iOS setup failed on ${simulator.name}: ${e instanceof Error ? e.message : e}`);
      }
    }
  }

  // 5. Run
  const result = await orchestrate(filtered, platformConfigs);

  // 6. Report
  const { createConsoleReporter } = await import("../report/console.js");
  const { createJsonReporter } = await import("../report/json.js");

  const { createJUnitReporter } = await import("../report/junit.js");

  const reporters = opts.reporter.split(",").map((r) => {
    switch (r.trim()) {
      case "json": return createJsonReporter();
      case "junit": return createJUnitReporter(config.artifacts?.outputDir ?? "./prov-output");
      default: return createConsoleReporter();
    }
  });

  for (const r of result.results) {
    const flowResult = {
      ...r,
      error: r.error
        ? { message: r.error.message, stack: r.error.stack }
        : undefined,
    };
    for (const reporter of reporters) {
      if (r.status === "passed") {
        reporter.onFlowPass?.(flowResult);
      } else if (r.status === "failed") {
        reporter.onFlowFail?.(flowResult);
      }
    }
  }

  for (const reporter of reporters) {
    reporter.onRunComplete({
      total: result.results.length,
      passed: result.passed,
      failed: result.failed,
      skipped: result.skipped,
      durationMs: result.totalDurationMs,
      results: result.results.map((r) => ({
        ...r,
        error: r.error
          ? { message: r.error.message, stack: r.error.stack }
          : undefined,
      })),
      platforms: opts.platforms,
    });
  }

  // 7. Cleanup
  for (const pc of platformConfigs) {
    try {
      await Effect.runPromise(pc.driver.killApp(""));
    } catch {
      // ignore cleanup errors
    }
  }

  return result.failed === 0;
}
