import { describe, expect, test } from "bun:test";
import { DriverError } from "../errors.js";
import { buildStorybookUrl } from "./storybook.js";

describe("buildStorybookUrl", () => {
  test("builds a Storybook iframe URL with args and globals", () => {
    const url = buildStorybookUrl(
      "components-button--primary",
      {
        args: { disabled: true, size: "lg", count: 2, helperText: null },
        globals: { theme: "dark" },
      },
      {
        appBaseUrl: "http://localhost:3000",
        storybook: { url: "http://localhost:6006" },
      },
    );

    expect(url).toBe(
      "http://localhost:6006/iframe.html?id=components-button--primary&viewMode=story&args=disabled%3Atrue%3Bsize%3Alg%3Bcount%3A2%3BhelperText%3A%21null&globals=theme%3Adark",
    );
  });

  test("falls back to the app base URL and supports docs view mode", () => {
    const url = buildStorybookUrl(
      "components-card--docs",
      { viewMode: "docs" },
      { appBaseUrl: "http://localhost:6006" },
    );

    expect(url).toBe("http://localhost:6006/iframe.html?id=components-card--docs&viewMode=docs");
  });

  test("throws a driver error for empty story ids", () => {
    expect(() =>
      buildStorybookUrl("   ", undefined, { appBaseUrl: "http://localhost:6006" }),
    ).toThrow(DriverError);
  });

  test("throws when args or globals contain unsupported Storybook query characters", () => {
    expect(() =>
      buildStorybookUrl(
        "components-button--primary",
        { args: { label: "Save: now" } },
        { appBaseUrl: "http://localhost:6006" },
      ),
    ).toThrow("openStory() args.label contains unsupported Storybook query characters");
  });
});
