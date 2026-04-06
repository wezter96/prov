import { readFile } from "node:fs/promises";
import type { AppiumExecutionConfig } from "../schemas/config.js";

export interface ResolveCapabilitiesOptions {
  capsPath?: string;
  capsJson?: string;
}

/**
 * Merge capabilities from three sources (later sources override earlier):
 * 1. Config file capabilities (execution.appium.capabilities)
 * 2. Capabilities JSON file (--caps or execution.appium.capabilitiesFile)
 * 3. Inline CLI JSON (--caps-json)
 */
export async function resolveCapabilities(
  config: AppiumExecutionConfig,
  opts: ResolveCapabilitiesOptions,
): Promise<Record<string, unknown>> {
  const configCaps = config.capabilities ?? {};

  // Load file caps from --caps flag or config capabilitiesFile
  let fileCaps: Record<string, unknown> = {};
  const capsFilePath = opts.capsPath ?? config.capabilitiesFile;
  if (capsFilePath) {
    const raw = await readFile(capsFilePath, "utf-8");
    fileCaps = JSON.parse(raw) as Record<string, unknown>;
  }

  // Parse inline JSON caps
  let cliCaps: Record<string, unknown> = {};
  if (opts.capsJson) {
    cliCaps = JSON.parse(opts.capsJson) as Record<string, unknown>;
  }

  return { ...configCaps, ...fileCaps, ...cliCaps };
}
