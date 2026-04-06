import type { CloudProvider, ProviderRunResult } from "./provider.js";

export class BrowserStackProvider implements CloudProvider {
  name() {
    return "BrowserStack";
  }

  extractMeta(sessionId: string, caps: Record<string, unknown>, meta: Record<string, string>) {
    meta["sessionId"] = sessionId;
    if (caps["bstack:options"]) {
      const opts = caps["bstack:options"] as Record<string, unknown>;
      if (opts.buildName) meta["buildName"] = String(opts.buildName);
      if (opts.projectName) meta["projectName"] = String(opts.projectName);
    }
  }

  async reportResult(appiumUrl: string, meta: Record<string, string>, result: ProviderRunResult) {
    const url = new URL(appiumUrl);
    const auth = btoa(`${url.username}:${url.password}`);
    const sessionId = meta["sessionId"];

    await fetch(`https://api-cloud.browserstack.com/app-automate/sessions/${sessionId}.json`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        status: result.passed ? "passed" : "failed",
        reason: result.reason ?? "",
        name: result.name ?? "",
      }),
    });
  }
}
