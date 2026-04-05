import { execFileSync, execSync } from "node:child_process";

export interface IOSSimulator {
  udid: string;
  name: string;
  state: "Booted" | "Shutdown" | string;
  runtime: string; // e.g. "iOS 17.5"
  isAvailable: boolean;
}

export interface IOSDevice {
  udid: string;
  name: string;
  type: "simulator" | "device";
  state: string;
  runtime?: string;
}

/** List iOS simulators */
export function listIOSSimulators(): IOSSimulator[] {
  try {
    const output = execSync("xcrun simctl list devices -j", { encoding: "utf-8" });
    const data = JSON.parse(output);
    const simulators: IOSSimulator[] = [];

    for (const [runtime, devices] of Object.entries(data.devices ?? {})) {
      // runtime looks like "com.apple.CoreSimulator.SimRuntime.iOS-17-5"
      const runtimeName = runtime
        .replace("com.apple.CoreSimulator.SimRuntime.", "")
        .replace(/-/g, ".");

      for (const device of devices as any[]) {
        simulators.push({
          udid: device.udid,
          name: device.name,
          state: device.state,
          runtime: runtimeName,
          isAvailable: device.isAvailable ?? true,
        });
      }
    }

    return simulators;
  } catch {
    return [];
  }
}

/** List booted iOS simulators */
export function listBootedSimulators(): IOSSimulator[] {
  return listIOSSimulators().filter((s) => s.state === "Booted" && s.isAvailable);
}

/** Get first booted simulator, or first available if none booted */
export function firstIOSSimulator(): IOSSimulator | null {
  const booted = listBootedSimulators();
  if (booted.length > 0) return booted[0]!;

  const available = listIOSSimulators().filter((s) => s.isAvailable);
  return available[0] ?? null;
}

/** Check whether an app is installed on a simulator */
export function hasAppInstalledOnSimulator(udid: string, bundleId: string): boolean {
  if (!bundleId) return false;

  try {
    execSync(`xcrun simctl get_app_container ${udid} ${bundleId} app`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Prefer a simulator that already has the requested app installed */
export function firstIOSSimulatorWithApp(bundleId: string): IOSSimulator | null {
  const bootedWithApp = listBootedSimulators().find((sim) =>
    hasAppInstalledOnSimulator(sim.udid, bundleId)
  );
  if (bootedWithApp) return bootedWithApp;

  const availableWithApp = listIOSSimulators()
    .filter((sim) => sim.isAvailable)
    .find((sim) => hasAppInstalledOnSimulator(sim.udid, bundleId));
  if (availableWithApp) return availableWithApp;

  return firstIOSSimulator();
}

/** Boot a simulator by UDID */
export function bootSimulator(udid: string): void {
  try {
    execSync(`xcrun simctl boot ${udid}`, { stdio: "ignore" });
  } catch {
    // May already be booted — ignore
  }
}

/** Install app on simulator */
export function installOnSimulator(udid: string, appPath: string): void {
  execSync(`xcrun simctl install ${udid} ${appPath}`);
}

/** Launch app on simulator */
export function launchOnSimulator(udid: string, bundleId: string): void {
  execSync(`xcrun simctl launch ${udid} ${bundleId}`);
}

/** Launch app on simulator with a deep link URL (bypasses system confirmation dialog) */
export function launchWithUrlOnSimulator(udid: string, bundleId: string, url: string): void {
  execFileSync("xcrun", ["simctl", "launch", udid, bundleId, "--open-url", url]);
}

/** List URL schemes registered by the installed app on simulator */
export function installedUrlSchemesOnSimulator(udid: string, bundleId: string): string[] {
  if (!bundleId) return [];

  try {
    const appPath = execSync(`xcrun simctl get_app_container ${udid} ${bundleId} app`, {
      encoding: "utf-8",
    }).trim();

    const raw = execFileSync("plutil", [
      "-extract",
      "CFBundleURLTypes",
      "json",
      "-o",
      "-",
      `${appPath}/Info.plist`,
    ], {
      encoding: "utf-8",
    });

    const urlTypes = JSON.parse(raw) as Array<{
      CFBundleURLSchemes?: string[];
    }>;

    return urlTypes.flatMap((entry) => entry.CFBundleURLSchemes ?? []);
  } catch {
    return [];
  }
}

/** Open a URL or deep link on simulator */
export function openUrlOnSimulator(udid: string, url: string): void {
  execFileSync("xcrun", ["simctl", "openurl", udid, url], { stdio: "ignore" });
}

/** Terminate app on simulator */
export function terminateOnSimulator(udid: string, bundleId: string): void {
  try {
    execSync(`xcrun simctl terminate ${udid} ${bundleId}`, { stdio: "ignore" });
  } catch {
    // May not be running
  }
}
