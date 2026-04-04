import { execSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { findADB, adbShell, adbInstall, adbForward } from "../../device/android.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

/** Find the UiAutomator2 server APKs */
function findUiAutomator2APK(): { serverApk: string; testApk: string } | null {
  // Check in prov's drivers/ directory first
  const provDrivers = resolve(__dirname, "../../../../drivers/android");
  // Check in maestro-runner's drivers/ directory as fallback
  const maestroRunnerDrivers = resolve(
    __dirname,
    "../../../../../../maestro-runner/drivers/android",
  );

  for (const dir of [provDrivers, maestroRunnerDrivers]) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir);
    const serverApk = files.find(
      (f) =>
        f.startsWith("appium-uiautomator2-server") &&
        !f.includes("androidTest") &&
        f.endsWith(".apk"),
    );
    const testApk = files.find(
      (f) => f.includes("androidTest") && f.endsWith(".apk"),
    );
    if (serverApk && testApk) {
      return { serverApk: join(dir, serverApk), testApk: join(dir, testApk) };
    }
  }
  return null;
}

/** Install UiAutomator2 server on device */
export function installUiAutomator2(serial: string): void {
  const apks = findUiAutomator2APK();
  if (!apks) {
    throw new Error(
      "UiAutomator2 server APK not found. Run 'prov setup' or place APKs in drivers/android/",
    );
  }

  console.log(`Installing UiAutomator2 server on ${serial}...`);
  adbInstall(serial, apks.serverApk);
  adbInstall(serial, apks.testApk);
  console.log("UiAutomator2 server installed.");
}

/** Check if UiAutomator2 server is installed on device */
export function isUiAutomator2Installed(serial: string): boolean {
  try {
    const output = adbShell(
      serial,
      "pm list packages io.appium.uiautomator2.server",
    );
    return output.includes("io.appium.uiautomator2.server");
  } catch {
    return false;
  }
}

/** Start UiAutomator2 server on device via adb instrument */
export function startUiAutomator2Server(serial: string): void {
  const adb = findADB();
  if (!adb) throw new Error("adb not found");

  // Start the instrumentation in the background.
  // The server starts listening on port 6790 on the device.
  // The command blocks while the server is running — timeout is expected.
  try {
    execSync(
      `${adb} -s ${serial} shell am instrument -w -e disableAnalytics true io.appium.uiautomator2.server.test/androidx.test.runner.AndroidJUnitRunner &`,
      { stdio: "ignore", timeout: 5000 },
    );
  } catch {
    // The command may timeout because it blocks — that's expected.
    // The server is starting in the background.
  }
}

/** Full setup: install if needed, start server, forward port */
export async function setupUiAutomator2(
  serial: string,
  hostPort: number = 8200,
): Promise<{ host: string; port: number }> {
  if (!isUiAutomator2Installed(serial)) {
    installUiAutomator2(serial);
  }

  startUiAutomator2Server(serial);

  // Give the server a moment to start before forwarding
  await new Promise((r) => setTimeout(r, 2000));

  // Forward device port to host
  const devicePort = 6790;
  adbForward(serial, hostPort, devicePort);

  // Poll until the server responds
  const maxRetries = 10;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${hostPort}/status`);
      if (res.ok) {
        console.log(`UiAutomator2 server ready on port ${hostPort}`);
        return { host: "localhost", port: hostPort };
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(
    `UiAutomator2 server did not start within ${maxRetries} seconds`,
  );
}
