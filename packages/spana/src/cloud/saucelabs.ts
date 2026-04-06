import type { CloudProvider, ProviderRunResult } from "./provider.js";

export class SauceLabsProvider implements CloudProvider {
  name() {
    return "Sauce Labs";
  }

  extractMeta(sessionId: string, caps: Record<string, unknown>, meta: Record<string, string>) {
    meta["sessionId"] = sessionId;
    if (caps["sauce:options"]) {
      const opts = caps["sauce:options"] as Record<string, unknown>;
      if (opts.build) meta["build"] = String(opts.build);
      if (opts.name) meta["name"] = String(opts.name);
    }
  }

  async reportResult(appiumUrl: string, meta: Record<string, string>, result: ProviderRunResult) {
    const url = new URL(appiumUrl);
    const auth = btoa(`${url.username}:${url.password}`);
    const sessionId = meta["sessionId"];

    const region = url.hostname.includes("eu-central") ? "eu-central-1" : "us-west-1";

    await fetch(`https://api.${region}.saucelabs.com/rest/v1/${url.username}/jobs/${sessionId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        passed: result.passed,
        name: result.name ?? "",
      }),
    });
  }
}
