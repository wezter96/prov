import { describe, expect, test } from "bun:test";
import { detectProvider } from "./provider.js";

describe("detectProvider", () => {
  test("returns BrowserStack for hub-cloud.browserstack.com URLs", () => {
    const provider = detectProvider("https://user:key@hub-cloud.browserstack.com/wd/hub");
    expect(provider).not.toBeNull();
    expect(provider!.name()).toBe("BrowserStack");
  });

  test("returns BrowserStack for hub.browserstack.com URLs", () => {
    const provider = detectProvider("https://user:key@hub.browserstack.com/wd/hub");
    expect(provider).not.toBeNull();
    expect(provider!.name()).toBe("BrowserStack");
  });

  test("returns Sauce Labs for ondemand.us-west-1.saucelabs.com URLs", () => {
    const provider = detectProvider("https://user:key@ondemand.us-west-1.saucelabs.com/wd/hub");
    expect(provider).not.toBeNull();
    expect(provider!.name()).toBe("Sauce Labs");
  });

  test("returns Sauce Labs for ondemand.eu-central-1.saucelabs.com URLs", () => {
    const provider = detectProvider("https://user:key@ondemand.eu-central-1.saucelabs.com/wd/hub");
    expect(provider).not.toBeNull();
    expect(provider!.name()).toBe("Sauce Labs");
  });

  test("returns null for unknown URLs", () => {
    expect(detectProvider("http://localhost:4723/wd/hub")).toBeNull();
    expect(detectProvider("https://my-appium-server.example.com/wd/hub")).toBeNull();
  });

  test("returns null for invalid URLs", () => {
    expect(detectProvider("not-a-url")).toBeNull();
  });

  test("handles URLs with credentials", () => {
    const provider = detectProvider("https://myuser:mykey123@hub-cloud.browserstack.com/wd/hub");
    expect(provider).not.toBeNull();
    expect(provider!.name()).toBe("BrowserStack");
  });

  test("handles URLs without credentials", () => {
    const provider = detectProvider("https://hub-cloud.browserstack.com/wd/hub");
    expect(provider).not.toBeNull();
    expect(provider!.name()).toBe("BrowserStack");
  });
});
