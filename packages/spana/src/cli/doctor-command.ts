import type { Platform } from "../schemas/selector.js";

interface DoctorOptions {
  configPath?: string;
  platforms: Platform[];
  driver?: "local" | "appium";
  appiumUrl?: string;
  capsPath?: string;
  capsJson?: string;
  json: boolean;
  pretty: boolean;
}

export async function runDoctorCommand(options: DoctorOptions): Promise<boolean> {
  const { platforms, json: jsonMode } = options;
  const targetPlatforms =
    platforms.length > 0 ? platforms : (["web", "android", "ios"] as Platform[]);

  let allGood = true;
  const checks: { name: string; status: "ok" | "warn" | "fail"; message: string }[] = [];

  // Check config
  try {
    const { loadConfig } = await import("./config-loader.js");
    await loadConfig({ configPath: options.configPath });
    checks.push({ name: "config", status: "ok", message: "Config is valid" });
  } catch (error) {
    checks.push({
      name: "config",
      status: "fail",
      message: `Config error: ${error instanceof Error ? error.message : String(error)}`,
    });
    allGood = false;
  }

  // Check platforms
  for (const platform of targetPlatforms) {
    if (platform === "web") {
      try {
        await import("playwright-core");
        checks.push({ name: "web", status: "ok", message: "Playwright available" });
      } catch {
        checks.push({ name: "web", status: "fail", message: "Playwright not installed" });
        allGood = false;
      }
    } else if (platform === "android") {
      const { discoverDevices } = await import("../device/discover.js");
      const devices = discoverDevices(["android"]);
      if (devices.length > 0) {
        checks.push({
          name: "android",
          status: "ok",
          message: `${devices.length} Android device(s) found`,
        });
      } else {
        checks.push({ name: "android", status: "warn", message: "No Android devices connected" });
      }
    } else if (platform === "ios") {
      const { discoverDevices } = await import("../device/discover.js");
      const devices = discoverDevices(["ios"]);
      if (devices.length > 0) {
        checks.push({
          name: "ios",
          status: "ok",
          message: `${devices.length} iOS device(s) found`,
        });
      } else {
        checks.push({ name: "ios", status: "warn", message: "No iOS simulators available" });
      }
    }
  }

  if (jsonMode) {
    const { createMachineSuccess, printMachinePayload } = await import("../machine.js");
    printMachinePayload(createMachineSuccess("doctor", { allGood, checks }), options.pretty);
  } else {
    for (const check of checks) {
      const icon = check.status === "ok" ? "✓" : check.status === "warn" ? "!" : "✗";
      console.log(`  ${icon} ${check.name}: ${check.message}`);
    }
    console.log(allGood ? "\nEnvironment ready." : "\nSome checks need attention.");
  }

  return allGood;
}
