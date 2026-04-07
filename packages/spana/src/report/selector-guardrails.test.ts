import { describe, expect, test } from "bun:test";
import { analyzeStepQuality } from "./selector-guardrails.js";
import type { StepResult } from "./types.js";

describe("selector guardrails", () => {
  test("warns on coordinate taps", () => {
    const steps: StepResult[] = [
      { command: "tapXY", status: "passed", durationMs: 50 },
      { command: "tap", selector: { testID: "btn" }, status: "passed", durationMs: 50 },
    ];

    const warnings = analyzeStepQuality(steps);
    expect(warnings.some((w) => w.rule === "coordinate-tap")).toBe(true);
    expect(warnings.find((w) => w.rule === "coordinate-tap")?.stepIndex).toBe(0);
  });

  test("warns on point selectors", () => {
    const steps: StepResult[] = [
      { command: "tap", selector: { point: { x: 100, y: 200 } }, status: "passed", durationMs: 50 },
    ];

    const warnings = analyzeStepQuality(steps);
    expect(warnings.some((w) => w.rule === "coordinate-tap")).toBe(true);
  });

  test("warns when flow is text-heavy (>50% text selectors)", () => {
    const steps: StepResult[] = [
      { command: "tap", selector: "Sign In", status: "passed", durationMs: 50 },
      { command: "tap", selector: { text: "Continue" }, status: "passed", durationMs: 50 },
      { command: "tap", selector: "Next", status: "passed", durationMs: 50 },
      { command: "tap", selector: { testID: "btn" }, status: "passed", durationMs: 50 },
    ];

    const warnings = analyzeStepQuality(steps);
    expect(warnings.some((w) => w.rule === "text-heavy")).toBe(true);
    expect(warnings.find((w) => w.rule === "text-heavy")?.message).toContain("3/4");
  });

  test("warns on bare string selectors", () => {
    const steps: StepResult[] = [
      { command: "tap", selector: "Submit", status: "passed", durationMs: 50 },
      { command: "tap", selector: { testID: "btn" }, status: "passed", durationMs: 50 },
    ];

    const warnings = analyzeStepQuality(steps);
    expect(warnings.some((w) => w.rule === "bare-string" && w.stepIndex === 0)).toBe(true);
  });

  test("returns no warnings for testID-only flows", () => {
    const steps: StepResult[] = [
      { command: "tap", selector: { testID: "a" }, status: "passed", durationMs: 50 },
      { command: "tap", selector: { testID: "b" }, status: "passed", durationMs: 50 },
    ];

    const warnings = analyzeStepQuality(steps);
    expect(warnings).toEqual([]);
  });

  test("ignores steps without selectors (inputText, pressKey)", () => {
    const steps: StepResult[] = [
      { command: "inputText", status: "passed", durationMs: 50 },
      { command: "pressKey", status: "passed", durationMs: 50 },
      { command: "tap", selector: { testID: "a" }, status: "passed", durationMs: 50 },
    ];

    const warnings = analyzeStepQuality(steps);
    expect(warnings).toEqual([]);
  });
});
