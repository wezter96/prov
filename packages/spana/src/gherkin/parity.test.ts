/**
 * Parity tests: same user journey written as native flow and as Gherkin feature,
 * asserting matching names, tags, platform filtering, step-level results, and behavior.
 */
import { describe, test, expect, beforeEach } from "bun:test";
import { flow } from "../api/flow.js";
import { compileFeature } from "./compiler.js";
import { globalRegistry } from "./registry.js";
import { Given, When, Then, Before, After, defineWorld } from "./steps.js";
import { clearWorldFactory } from "./world.js";
import type { ScenarioStepResult } from "../report/types.js";

// Shared test state
let actions: string[] = [];

function mockCtx(): any {
  return { app: {}, expect: () => {}, platform: "web" };
}

beforeEach(() => {
  globalRegistry.clear();
  clearWorldFactory();
  actions = [];
});

describe("parity: native flow vs Gherkin feature", () => {
  test("same journey produces same actions", async () => {
    // --- Native flow ---
    const nativeFlow = flow("Auth — User can log in", { tags: ["@smoke"] }, async () => {
      actions.push("launch");
      actions.push("tap-login");
      actions.push("verify-home");
    });

    await nativeFlow.fn(mockCtx());
    const nativeActions = [...actions];
    actions = [];

    // --- Gherkin equivalent ---
    Given("the app is launched", async () => {
      actions.push("launch");
    });
    When("I tap login", async () => {
      actions.push("tap-login");
    });
    Then("I see the home screen", async () => {
      actions.push("verify-home");
    });

    const feature = `
@smoke
Feature: Auth
  Scenario: User can log in
    Given the app is launched
    When I tap login
    Then I see the home screen
`;
    const flows = compileFeature(feature);
    expect(flows).toHaveLength(1);

    await flows[0]!.fn(mockCtx());
    const gherkinActions = [...actions];

    // Same actions in same order
    expect(gherkinActions).toEqual(nativeActions);
  });

  test("matching names", () => {
    const feature = `
Feature: Auth
  Scenario: User can log in
    Given something
`;
    const flows = compileFeature(feature);
    expect(flows[0]!.name).toBe("Auth — User can log in");
  });

  test("matching tags", () => {
    const feature = `
@e2e
Feature: Auth
  @smoke
  Scenario: Login
    Given something
`;
    const flows = compileFeature(feature);
    expect(flows[0]!.config.tags).toEqual(["@e2e", "@smoke"]);
  });

  test("platform filtering via tags", () => {
    const feature = `
Feature: Auth
  @web
  Scenario: Web only
    Given something

  @ios @android
  Scenario: Mobile only
    Given something
`;
    const flows = compileFeature(feature);
    expect(flows[0]!.config.platforms).toEqual(["web"]);
    expect(flows[1]!.config.platforms).toEqual(["ios", "android"]);
  });

  test("scenario outline produces same results as multiple native flows", async () => {
    Given("a user with role {string}", async (_ctx, role) => {
      actions.push(`role-${role}`);
    });
    Then("I see {string}", async (_ctx, page) => {
      actions.push(`page-${page}`);
    });

    const feature = `
Feature: Auth
  Scenario Outline: Login as <role>
    Given a user with role "<role>"
    Then I see "<page>"

    Examples:
      | role  | page      |
      | admin | dashboard |
      | user  | home      |
`;
    const flows = compileFeature(feature);
    expect(flows).toHaveLength(2);
    expect(flows[0]!.name).toBe("Auth — Login as admin");
    expect(flows[1]!.name).toBe("Auth — Login as user");

    await flows[0]!.fn(mockCtx());
    expect(actions).toEqual(["role-admin", "page-dashboard"]);

    actions = [];
    await flows[1]!.fn(mockCtx());
    expect(actions).toEqual(["role-user", "page-home"]);
  });

  test("step-level results are recorded for Gherkin flows", async () => {
    Given("step one", async () => {});
    When("step two", async () => {});
    Then("step three", async () => {});

    const feature = `
Feature: Steps
  Scenario: All pass
    Given step one
    When step two
    Then step three
`;
    const flows = compileFeature(feature);
    const ctx = mockCtx();
    await flows[0]!.fn(ctx);

    const scenarioSteps: ScenarioStepResult[] = ctx.__scenarioSteps;
    expect(scenarioSteps).toHaveLength(3);
    expect(scenarioSteps[0]!).toMatchObject({
      keyword: "Given",
      text: "step one",
      status: "passed",
    });
    expect(scenarioSteps[1]!).toMatchObject({
      keyword: "When",
      text: "step two",
      status: "passed",
    });
    expect(scenarioSteps[2]!).toMatchObject({
      keyword: "Then",
      text: "step three",
      status: "passed",
    });

    // All should have positive durations
    for (const step of scenarioSteps) {
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  test("fail fast with skipped steps matches expected behavior", async () => {
    Given("passes", async () => {});
    When("fails", async () => {
      throw new Error("boom");
    });
    Then("never runs", async () => {
      actions.push("should-not-run");
    });

    const feature = `
Feature: Failure
  Scenario: Mid-failure
    Given passes
    When fails
    Then never runs
`;
    const flows = compileFeature(feature);
    const ctx = mockCtx();

    await expect(flows[0]!.fn(ctx)).rejects.toThrow("boom");

    const scenarioSteps: ScenarioStepResult[] = ctx.__scenarioSteps;
    expect(scenarioSteps[0]!.status).toBe("passed");
    expect(scenarioSteps[1]!.status).toBe("failed");
    expect(scenarioSteps[1]!.error).toBe("boom");
    expect(scenarioSteps[2]!.status).toBe("skipped");

    // The skipped step should not have run
    expect(actions).toEqual([]);
  });

  test("Before/After hooks execute in correct order", async () => {
    Before(async () => {
      actions.push("before");
    });
    After(async () => {
      actions.push("after");
    });
    Given("a step", async () => {
      actions.push("step");
    });

    const feature = `
Feature: Hooks
  Scenario: With hooks
    Given a step
`;
    const flows = compileFeature(feature);
    await flows[0]!.fn(mockCtx());

    expect(actions).toEqual(["before", "step", "after"]);

    // Verify hook results in scenarioSteps
    const ctx = mockCtx();
    actions = [];
    await flows[0]!.fn(ctx);
    const scenarioSteps: ScenarioStepResult[] = ctx.__scenarioSteps;
    expect(scenarioSteps[0]!).toMatchObject({ keyword: "Before", status: "passed" });
    expect(scenarioSteps[1]!).toMatchObject({ keyword: "Given", text: "a step", status: "passed" });
    expect(scenarioSteps[2]!).toMatchObject({ keyword: "After", status: "passed" });
  });

  test("After hooks run even when steps fail", async () => {
    After(async () => {
      actions.push("after");
    });
    Given("a failing step", async () => {
      throw new Error("fail");
    });

    const feature = `
Feature: Hooks
  Scenario: After on failure
    Given a failing step
`;
    const flows = compileFeature(feature);
    await expect(flows[0]!.fn(mockCtx())).rejects.toThrow("fail");
    expect(actions).toContain("after");
  });

  test("defineWorld state is available in steps", async () => {
    defineWorld({
      create: () => ({ count: 0 }),
    });

    Given("I increment", async (ctx: any) => {
      ctx.count += 1;
      actions.push(`count-${ctx.count}`);
    });
    Then("count is {int}", async (ctx: any, expected) => {
      actions.push(`verify-${ctx.count}-eq-${expected}`);
    });

    const feature = `
Feature: World
  Scenario: Shared state
    Given I increment
    Given I increment
    Then count is 2
`;
    const flows = compileFeature(feature);
    await flows[0]!.fn(mockCtx());

    expect(actions).toEqual(["count-1", "count-2", "verify-2-eq-2"]);
  });

  test("Background steps prepend to all scenarios", async () => {
    Given("app launched", async () => {
      actions.push("bg");
    });
    When("action A", async () => {
      actions.push("A");
    });
    When("action B", async () => {
      actions.push("B");
    });

    const feature = `
Feature: Background
  Background:
    Given app launched

  Scenario: First
    When action A

  Scenario: Second
    When action B
`;
    const flows = compileFeature(feature);
    expect(flows).toHaveLength(2);

    await flows[0]!.fn(mockCtx());
    expect(actions).toEqual(["bg", "A"]);

    actions = [];
    await flows[1]!.fn(mockCtx());
    expect(actions).toEqual(["bg", "B"]);
  });
});
