import { describe, test, expect, beforeEach } from "bun:test";
import { compileFeature } from "./compiler.js";
import { globalRegistry } from "./registry.js";
import { Given, When, Then, Before, After } from "./steps.js";

beforeEach(() => {
  globalRegistry.clear();
});

describe("compileFeature", () => {
  test("compiles a simple scenario into a FlowDefinition", () => {
    const feature = `
Feature: Login
  Scenario: Valid login
    Given a user exists
    When I log in
    Then I see the home screen
`;
    const flows = compileFeature(feature);
    expect(flows).toHaveLength(1);
    expect(flows[0]!.name).toBe("Login — Valid login");
    expect(flows[0]!.config.tags).toBeUndefined();
    expect(flows[0]!.config.platforms).toBeUndefined();
  });

  test("compiles multiple scenarios", () => {
    const feature = `
Feature: Auth
  Scenario: Login
    Given a user exists
    When I log in
    Then I see home

  Scenario: Logout
    Given I am logged in
    When I log out
    Then I see login screen
`;
    const flows = compileFeature(feature);
    expect(flows).toHaveLength(2);
    expect(flows[0]!.name).toBe("Auth — Login");
    expect(flows[1]!.name).toBe("Auth — Logout");
  });

  test("extracts tags from scenarios", () => {
    const feature = `
Feature: Auth
  @smoke @regression
  Scenario: Login
    Given a user exists
`;
    const flows = compileFeature(feature);
    expect(flows[0]!.config.tags).toEqual(["@smoke", "@regression"]);
  });

  test("inherits feature-level tags", () => {
    const feature = `
@e2e
Feature: Auth
  @smoke
  Scenario: Login
    Given a user exists
`;
    const flows = compileFeature(feature);
    expect(flows[0]!.config.tags).toEqual(["@e2e", "@smoke"]);
  });

  test("extracts platform tags into config.platforms", () => {
    const feature = `
Feature: Auth
  @ios @android
  Scenario: Biometric login
    Given biometrics are enabled
`;
    const flows = compileFeature(feature);
    expect(flows[0]!.config.platforms).toEqual(["ios", "android"]);
    expect(flows[0]!.config.tags).toBeUndefined();
  });

  test("separates platform tags from regular tags", () => {
    const feature = `
Feature: Auth
  @smoke @web
  Scenario: Web login
    Given a user exists
`;
    const flows = compileFeature(feature);
    expect(flows[0]!.config.platforms).toEqual(["web"]);
    expect(flows[0]!.config.tags).toEqual(["@smoke"]);
  });

  test("expands Scenario Outline with Examples", () => {
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
  });

  test("prepends Background steps to each scenario", async () => {
    const executedSteps: string[] = [];

    Given("the app is launched", async () => {
      executedSteps.push("background");
    });
    Given("a user exists", async () => {
      executedSteps.push("user-exists");
    });
    When("I log in", async () => {
      executedSteps.push("login");
    });

    const feature = `
Feature: Auth
  Background:
    Given the app is launched

  Scenario: Login
    Given a user exists
    When I log in
`;
    const flows = compileFeature(feature);
    expect(flows).toHaveLength(1);

    // Execute the flow to verify Background runs first
    const mockCtx: any = {
      app: {},
      expect: () => {},
      platform: "web",
    };
    await flows[0]!.fn(mockCtx);

    expect(executedSteps).toEqual(["background", "user-exists", "login"]);
  });

  test("executes steps with extracted parameters", async () => {
    let capturedName = "";

    Given("a user named {string}", async (_ctx, name) => {
      capturedName = name as string;
    });

    const feature = `
Feature: Users
  Scenario: Create user
    Given a user named "Alice"
`;
    const flows = compileFeature(feature);
    const mockCtx: any = { app: {}, expect: () => {}, platform: "web" };
    await flows[0]!.fn(mockCtx);

    expect(capturedName).toBe("Alice");
  });

  test("fails fast and skips remaining steps on failure", async () => {
    const executed: string[] = [];

    Given("step one", async () => {
      executed.push("one");
    });
    When("step two fails", async () => {
      executed.push("two");
      throw new Error("step two failed");
    });
    Then("step three", async () => {
      executed.push("three");
    });

    const feature = `
Feature: Fail fast
  Scenario: Failure
    Given step one
    When step two fails
    Then step three
`;
    const flows = compileFeature(feature);
    const mockCtx: any = { app: {}, expect: () => {}, platform: "web" };

    await expect(flows[0]!.fn(mockCtx)).rejects.toThrow("step two failed");
    expect(executed).toEqual(["one", "two"]);

    // Check scenarioSteps were attached
    const scenarioSteps = mockCtx.__scenarioSteps;
    expect(scenarioSteps).toHaveLength(3);
    expect(scenarioSteps[0]!.status).toBe("passed");
    expect(scenarioSteps[1]!.status).toBe("failed");
    expect(scenarioSteps[2]!.status).toBe("skipped");
  });

  test("always runs After hooks even on failure", async () => {
    const executed: string[] = [];

    Given("a step that fails", async () => {
      throw new Error("boom");
    });
    After(async () => {
      executed.push("after");
    });

    const feature = `
Feature: Hooks
  Scenario: After runs
    Given a step that fails
`;
    const flows = compileFeature(feature);
    const mockCtx: any = { app: {}, expect: () => {}, platform: "web" };

    await expect(flows[0]!.fn(mockCtx)).rejects.toThrow("boom");
    expect(executed).toContain("after");
  });

  test("runs Before hooks before steps", async () => {
    const order: string[] = [];

    Before(async () => {
      order.push("before");
    });
    Given("a step", async () => {
      order.push("step");
    });

    const feature = `
Feature: Hooks
  Scenario: Before runs
    Given a step
`;
    const flows = compileFeature(feature);
    const mockCtx: any = { app: {}, expect: () => {}, platform: "web" };
    await flows[0]!.fn(mockCtx);

    expect(order).toEqual(["before", "step"]);
  });

  test("throws on undefined step", async () => {
    const feature = `
Feature: Missing
  Scenario: No step def
    Given a step that does not exist
`;
    const flows = compileFeature(feature);
    const mockCtx: any = { app: {}, expect: () => {}, platform: "web" };

    await expect(flows[0]!.fn(mockCtx)).rejects.toThrow("Undefined step");
  });

  test("passes DataTable as last argument", async () => {
    let capturedTable: unknown;

    Given("the following users:", async (_ctx, table) => {
      capturedTable = table;
    });

    const feature = `
Feature: Tables
  Scenario: With data table
    Given the following users:
      | name  | role  |
      | Alice | admin |
      | Bob   | user  |
`;
    const flows = compileFeature(feature);
    const mockCtx: any = { app: {}, expect: () => {}, platform: "web" };
    await flows[0]!.fn(mockCtx);

    expect(capturedTable).toEqual([
      ["name", "role"],
      ["Alice", "admin"],
      ["Bob", "user"],
    ]);
  });

  test("passes DocString as last argument", async () => {
    let capturedDoc: unknown;

    Given("the following JSON:", async (_ctx, doc) => {
      capturedDoc = doc;
    });

    const feature = `
Feature: DocStrings
  Scenario: With doc string
    Given the following JSON:
      """
      {"key": "value"}
      """
`;
    const flows = compileFeature(feature);
    const mockCtx: any = { app: {}, expect: () => {}, platform: "web" };
    await flows[0]!.fn(mockCtx);

    expect(capturedDoc).toBe('{"key": "value"}');
  });

  test("returns empty array for featureless document", () => {
    const flows = compileFeature("");
    expect(flows).toEqual([]);
  });
});
