import { afterEach, describe, expect, test } from "bun:test";
import { BrowserStackProvider } from "./browserstack.js";

const originalFetch = globalThis.fetch;

interface FetchResponse {
  status?: number;
  body: unknown;
}

function queueFetch(responses: FetchResponse[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (input, init) => {
    const response = responses.shift();
    if (!response) {
      throw new Error(`Unexpected fetch: ${String(input)}`);
    }

    calls.push({ url: String(input), init });

    return new Response(
      typeof response.body === "string" ? response.body : JSON.stringify(response.body),
      {
        status: response.status ?? 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  }) as typeof fetch;

  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("BrowserStackProvider", () => {
  const provider = new BrowserStackProvider();

  test("name returns BrowserStack", () => {
    expect(provider.name()).toBe("BrowserStack");
  });

  describe("extractMeta", () => {
    test("captures sessionId", () => {
      const meta: Record<string, string> = {};
      provider.extractMeta("sess-123", {}, meta);
      expect(meta["sessionId"]).toBe("sess-123");
    });

    test("captures bstack:options buildName and projectName", () => {
      const meta: Record<string, string> = {};
      provider.extractMeta(
        "sess-456",
        {
          "bstack:options": {
            buildName: "my-build",
            projectName: "my-project",
          },
        },
        meta,
      );
      expect(meta["sessionId"]).toBe("sess-456");
      expect(meta["buildName"]).toBe("my-build");
      expect(meta["projectName"]).toBe("my-project");
    });

    test("ignores missing bstack:options", () => {
      const meta: Record<string, string> = {};
      provider.extractMeta("sess-789", { other: "cap" }, meta);
      expect(meta["sessionId"]).toBe("sess-789");
      expect(meta["buildName"]).toBeUndefined();
      expect(meta["projectName"]).toBeUndefined();
    });
  });

  describe("reportResult", () => {
    test("sends PUT request with correct auth and body for passed test", async () => {
      const calls = queueFetch([{ body: { status: "ok" } }]);

      await provider.reportResult(
        "https://myuser:mykey@hub-cloud.browserstack.com/wd/hub",
        { sessionId: "sess-abc" },
        { passed: true, name: "spana android" },
      );

      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe(
        "https://api-cloud.browserstack.com/app-automate/sessions/sess-abc.json",
      );
      expect(calls[0].init?.method).toBe("PUT");
      expect(calls[0].init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa("myuser:mykey")}`,
      });
      const body = JSON.parse(calls[0].init?.body as string);
      expect(body.status).toBe("passed");
      expect(body.name).toBe("spana android");
      expect(body.reason).toBe("");
    });

    test("sends failed status with reason", async () => {
      const calls = queueFetch([{ body: { status: "ok" } }]);

      await provider.reportResult(
        "https://user:key@hub-cloud.browserstack.com/wd/hub",
        { sessionId: "sess-def" },
        { passed: false, name: "spana ios", reason: "assertion failed" },
      );

      const body = JSON.parse(calls[0].init?.body as string);
      expect(body.status).toBe("failed");
      expect(body.reason).toBe("assertion failed");
    });
  });
});
