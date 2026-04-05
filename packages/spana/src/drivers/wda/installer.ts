import { execSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);

function resolveOptionalPackageDir(packageName: string): string | null {
  try {
    const packageJsonPath = require.resolve(`${packageName}/package.json`);
    return dirname(packageJsonPath);
  } catch {
    return null;
  }
}

/** Find the WDA Xcode project directory */
function findWDAProject(): string | null {
  const appiumWDA = resolveOptionalPackageDir("appium-webdriveragent");
  // Check in the current project first
  const projectWDA = resolve(process.cwd(), "drivers/ios/WebDriverAgent");
  // Check in spana's drivers/ directory as a fallback for development
  const provWDA = resolve(__dirname, "../../../../drivers/ios/WebDriverAgent");
  // Check in maestro-runner's drivers/ directory as fallback
  const maestroRunnerWDA = resolve(
    __dirname,
    "../../../../../../maestro-runner/drivers/ios/WebDriverAgent",
  );

  for (const wdaPath of [projectWDA, provWDA, maestroRunnerWDA, appiumWDA]) {
    if (!wdaPath) continue;
    if (existsSync(resolve(wdaPath, "WebDriverAgent.xcodeproj"))) {
      return wdaPath;
    }
  }
  return null;
}

/** Build WDA for a specific simulator using build-for-testing */
export function buildWDA(simulatorUDID: string): string {
  const wdaPath = findWDAProject();
  if (!wdaPath) {
    throw new Error(
      "WebDriverAgent project not found. Install appium-webdriveragent or place WDA in drivers/ios/WebDriverAgent/",
    );
  }

  const derivedDataPath = resolve(wdaPath, "../../.wda-builds", simulatorUDID);

  console.log("Building WebDriverAgent for simulator...");

  execSync(
    [
      "xcodebuild",
      "build-for-testing",
      `-project "${resolve(wdaPath, "WebDriverAgent.xcodeproj")}"`,
      "-scheme WebDriverAgentRunner",
      `-destination "platform=iOS Simulator,id=${simulatorUDID}"`,
      `-derivedDataPath "${derivedDataPath}"`,
      'CODE_SIGN_IDENTITY=""',
      "CODE_SIGNING_REQUIRED=NO",
      "CODE_SIGNING_ALLOWED=NO",
      "GCC_TREAT_WARNINGS_AS_ERRORS=0",
      "-quiet",
    ].join(" "),
    { stdio: "inherit", timeout: 600_000 }, // 10 min build timeout
  );

  console.log("WebDriverAgent built successfully.");
  return derivedDataPath;
}

let wdaProcess: ChildProcess | null = null;

/** Start WDA on a simulator using xcodebuild test-without-building */
export function startWDA(
  simulatorUDID: string,
  port: number = 8100,
  derivedDataPath?: string,
): ChildProcess {
  const wdaPath = findWDAProject();
  if (!wdaPath) {
    throw new Error("WebDriverAgent project not found");
  }

  const ddPath =
    derivedDataPath ??
    resolve(wdaPath, "../../.wda-builds", simulatorUDID);

  // USE_PORT is read by WDA from the environment / xctestrun plist.
  // For simulators we can pass it via the environment here.
  const env = { ...process.env, USE_PORT: String(port) };

  console.log(`Starting WebDriverAgent on port ${port}...`);

  const child = spawn(
    "xcodebuild",
    [
      "test-without-building",
      "-project",
      resolve(wdaPath, "WebDriverAgent.xcodeproj"),
      "-scheme",
      "WebDriverAgentRunner",
      "-destination",
      `platform=iOS Simulator,id=${simulatorUDID}`,
      "-derivedDataPath",
      ddPath,
    ],
    { env, stdio: "ignore", detached: true },
  );

  child.unref();
  wdaProcess = child;

  return child;
}

/** Stop the currently running WDA process */
export function stopWDA(): void {
  if (wdaProcess) {
    wdaProcess.kill();
    wdaProcess = null;
  }
}

/** Full setup: build if needed, start WDA, wait for it to be ready */
export async function setupWDA(
  simulatorUDID: string,
  port: number = 8100,
): Promise<{ host: string; port: number }> {
  const wdaPath = findWDAProject();
  if (!wdaPath) {
    throw new Error("WebDriverAgent project not found");
  }

  const derivedDataPath = resolve(
    wdaPath,
    "../../.wda-builds",
    simulatorUDID,
  );
  const buildProductsDir = resolve(
    derivedDataPath,
    "Build",
    "Products",
  );

  // Build if no previous build exists
  if (!existsSync(buildProductsDir)) {
    buildWDA(simulatorUDID);
  }

  // Start WDA
  startWDA(simulatorUDID, port, derivedDataPath);

  // Poll until WDA is ready — it can take up to ~30 s on cold start
  const maxRetries = 30;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/status`);
      if (res.ok) {
        console.log(`WebDriverAgent ready on port ${port}`);
        return { host: "localhost", port };
      }
    } catch {
      // Not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(
    `WebDriverAgent did not start within ${maxRetries} seconds`,
  );
}
