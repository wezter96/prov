import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function toSafeName(flowName: string): string {
  return flowName
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

/**
 * Resolves the path for a baseline screenshot.
 *
 * Path: dirname(flowFilePath)/__baselines__/{safeName}-{platform}/{screenshotName}.png
 */
export function resolveBaselinePath(
  flowFilePath: string,
  flowName: string,
  platform: string,
  screenshotName: string,
): string {
  const safeName = toSafeName(flowName);
  return join(
    dirname(flowFilePath),
    "__baselines__",
    `${safeName}-${platform}`,
    `${screenshotName}.png`,
  );
}

/** Returns true if the baseline file exists on disk. */
export function baselineExists(baselinePath: string): boolean {
  return existsSync(baselinePath);
}

/**
 * Reads a baseline image from disk.
 * Returns null if the file does not exist.
 */
export function readBaseline(baselinePath: string): Buffer | null {
  if (!existsSync(baselinePath)) return null;
  return readFileSync(baselinePath);
}

/**
 * Writes a baseline image to disk, creating parent directories as needed.
 */
export function writeBaseline(baselinePath: string, data: Buffer | Uint8Array): void {
  mkdirSync(dirname(baselinePath), { recursive: true });
  writeFileSync(baselinePath, data);
}
