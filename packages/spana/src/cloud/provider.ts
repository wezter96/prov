import { BrowserStackProvider } from "./browserstack.js";
import { SauceLabsProvider } from "./saucelabs.js";

export interface ProviderRunResult {
  passed: boolean;
  name?: string;
  reason?: string;
}

export interface CloudProvider {
  name(): string;
  extractMeta(sessionId: string, caps: Record<string, unknown>, meta: Record<string, string>): void;
  reportResult(
    appiumUrl: string,
    meta: Record<string, string>,
    result: ProviderRunResult,
  ): Promise<void>;
}

export function detectProvider(appiumUrl: string): CloudProvider | null {
  let hostname: string;
  try {
    hostname = new URL(appiumUrl).hostname;
  } catch {
    return null;
  }

  if (hostname.includes("browserstack.com")) {
    return new BrowserStackProvider();
  }

  if (hostname.includes("saucelabs.com")) {
    return new SauceLabsProvider();
  }

  return null;
}
