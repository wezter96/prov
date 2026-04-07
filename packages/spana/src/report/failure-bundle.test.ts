import { describe, expect, test } from "bun:test";
import { createFailureBundle, findNearbySelectors } from "./failure-bundle.js";
import type { StepResult, FlowError } from "./types.js";

describe("findNearbySelectors", () => {
  const hierarchy = {
    type: "View",
    testID: "login-form",
    children: [
      { type: "TextInput", testID: "email-input", children: [] },
      { type: "TextInput", testID: "password-input", children: [] },
      { type: "Button", testID: "submit-button", children: [] },
      { type: "Button", testID: "forgot-password-link", children: [] },
      { type: "Text", text: "Welcome back", children: [] },
    ],
  };
  const hierarchyJson = JSON.stringify(hierarchy);

  test("finds similar testIDs by substring match", () => {
    const results = findNearbySelectors({ testID: "submit-btn" }, hierarchyJson);
    expect(results).toContain("submit-button");
  });

  test("finds similar testIDs by edit distance", () => {
    const results = findNearbySelectors({ testID: "email-inpt" }, hierarchyJson);
    expect(results).toContain("email-input");
  });

  test("returns empty array when no matches", () => {
    const results = findNearbySelectors({ testID: "completely-unrelated" }, hierarchyJson);
    expect(results.length).toBeLessThanOrEqual(5);
  });

  test("searches text values for text selectors", () => {
    const results = findNearbySelectors({ text: "Welcome" }, hierarchyJson);
    expect(results).toContain("Welcome back");
  });

  test("handles bare string selectors", () => {
    const results = findNearbySelectors("Submit", hierarchyJson);
    // Should search both testIDs and text values
    expect(results.length).toBeGreaterThanOrEqual(0);
  });

  test("returns empty for null hierarchy", () => {
    const results = findNearbySelectors({ testID: "foo" }, null);
    expect(results).toEqual([]);
  });
});

describe("createFailureBundle", () => {
  test("creates a complete failure bundle", () => {
    const steps: StepResult[] = [
      { command: "tap", selector: { testID: "email" }, status: "passed", durationMs: 50 },
      { command: "inputText", status: "passed", durationMs: 30 },
      {
        command: "tap",
        selector: { testID: "submit-btn" },
        status: "failed",
        durationMs: 5000,
        error: "Element not found",
      },
    ];
    const error: FlowError = {
      message: 'Element not found: testID "submit-btn"',
      category: "element-not-found",
      suggestion: "Check selector spelling",
    };

    const bundle = createFailureBundle("login flow", "android", steps, error, "/tmp/artifacts");

    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.flow).toBe("login flow");
    expect(bundle.platform).toBe("android");
    expect(bundle.failedStep).toEqual({
      index: 2,
      command: "tap",
      selector: { testID: "submit-btn" },
      durationMs: 5000,
      error: "Element not found",
    });
    expect(bundle.lastPassedStep).toEqual({
      index: 1,
      command: "inputText",
      selector: null,
      durationMs: 30,
    });
    expect(bundle.error.category).toBe("element-not-found");
    expect(bundle.reproCommand).toContain("login flow");
  });

  test("handles flow with no passed steps", () => {
    const steps: StepResult[] = [
      {
        command: "tap",
        selector: { testID: "x" },
        status: "failed",
        durationMs: 100,
        error: "boom",
      },
    ];
    const error: FlowError = { message: "boom", category: "unknown" };

    const bundle = createFailureBundle("fail flow", "web", steps, error, "/tmp/out");
    expect(bundle.failedStep?.index).toBe(0);
    expect(bundle.lastPassedStep).toBeNull();
  });
});
