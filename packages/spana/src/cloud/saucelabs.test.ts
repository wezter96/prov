import { afterEach, describe, expect, test } from "bun:test";
import { SauceLabsProvider } from "./saucelabs.js";

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

describe("SauceLabsProvider", () => {
  const provider = new SauceLabsProvider();

  test("name returns Sauce Labs", () => {
    expect(provider.name()).toBe("Sauce Labs");
  });

  describe("extractMeta", () => {
    test("captures sessionId", () => {
      const meta: Record<string, string> = {};
      provider.extractMeta("sess-123", {}, meta);
      expect(meta["sessionId"]).toBe("sess-123");
    });

    test("captures sauce:options build and name", () => {
      const meta: Record<string, string> = {};
      provider.extractMeta(
        "sess-456",
        {
          "sauce:options": {
            build: "build-42",
            name: "my test",
          },
        },
        meta,
      );
      expect(meta["sessionId"]).toBe("sess-456");
      expect(meta["build"]).toBe("build-42");
      expect(meta["name"]).toBe("my test");
    });

    test("ignores missing sauce:options", () => {
      const meta: Record<string, string> = {};
      provider.extractMeta("sess-789", { other: "cap" }, meta);
      expect(meta["sessionId"]).toBe("sess-789");
      expect(meta["build"]).toBeUndefined();
      expect(meta["name"]).toBeUndefined();
    });
  });

  describe("reportResult", () => {
    test("sends PUT to us-west-1 for US region URLs", async () => {
      const calls = queueFetch([{ body: {} }]);

      await provider.reportResult(
        "https://myuser:mykey@ondemand.us-west-1.saucelabs.com/wd/hub",
        { sessionId: "sess-abc" },
        { passed: true, name: "spana android" },
      );

      expect(calls).toHaveLength(1);
      expect(calls[0]!.url).toBe(
        "https://api.us-west-1.saucelabs.com/rest/v1/myuser/jobs/sess-abc",
      );
      expect(calls[0]!.init?.method).toBe("PUT");
      expect(calls[0]!.init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: `Basic ${btoa("myuser:mykey")}`,
      });
      const body = JSON.parse(calls[0]!.init?.body as string);
      expect(body.passed).toBe(true);
      expect(body.name).toBe("spana android");
    });

    test("sends PUT to eu-central-1 for EU region URLs", async () => {
      const calls = queueFetch([{ body: {} }]);

      await provider.reportResult(
        "https://user:key@ondemand.eu-central-1.saucelabs.com/wd/hub",
        { sessionId: "sess-def" },
        { passed: false, name: "spana ios" },
      );

      expect(calls[0]!.url).toBe(
        "https://api.eu-central-1.saucelabs.com/rest/v1/user/jobs/sess-def",
      );
      const body = JSON.parse(calls[0]!.init?.body as string);
      expect(body.passed).toBe(false);
    });
  });
});
