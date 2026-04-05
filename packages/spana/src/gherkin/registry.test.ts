import { describe, test, expect, beforeEach } from "bun:test";
import { globalRegistry } from "./registry.js";
import { Given, When, Then, And, But, Before, After } from "./steps.js";

beforeEach(() => {
  globalRegistry.clear();
});

describe("step registration", () => {
  test("registers Given/When/Then steps with correct keywords", () => {
    Given("a user exists", async () => {});
    When("I log in", async () => {});
    Then("I see the home screen", async () => {});

    const steps = globalRegistry.getSteps();
    expect(steps).toHaveLength(3);
    expect(steps[0]!.keyword).toBe("Given");
    expect(steps[1]!.keyword).toBe("When");
    expect(steps[2]!.keyword).toBe("Then");
  });

  test("registers And/But steps", () => {
    And("another condition", async () => {});
    But("not this condition", async () => {});

    const steps = globalRegistry.getSteps();
    expect(steps).toHaveLength(2);
    expect(steps[0]!.keyword).toBe("And");
    expect(steps[1]!.keyword).toBe("But");
  });

  test("throws on duplicate patterns", () => {
    Given("a user exists", async () => {});
    expect(() => When("a user exists", async () => {})).toThrow(
      'Duplicate step definition: "a user exists"',
    );
  });

  test("allows same text with different pattern types", () => {
    Given("I have {int} items", async () => {});
    // Different pattern string — not a duplicate
    When("I have {string} items", async () => {});
    expect(globalRegistry.getSteps()).toHaveLength(2);
  });

  test("supports regex patterns", () => {
    Given(/^I have (\d+) items$/, async () => {});
    const steps = globalRegistry.getSteps();
    expect(steps[0]!.pattern).toBeInstanceOf(RegExp);
  });
});

describe("hook registration", () => {
  test("registers Before hooks", () => {
    Before(async () => {});
    expect(globalRegistry.getHooks("Before")).toHaveLength(1);
  });

  test("registers After hooks", () => {
    After(async () => {});
    expect(globalRegistry.getHooks("After")).toHaveLength(1);
  });

  test("registers hooks with tag expressions", () => {
    Before("@smoke", async () => {});
    After("@e2e and not @slow", async () => {});

    const beforeHooks = globalRegistry.getHooks("Before");
    expect(beforeHooks).toHaveLength(1);
    expect(beforeHooks[0]!.tagExpression).toBe("@smoke");

    const afterHooks = globalRegistry.getHooks("After");
    expect(afterHooks).toHaveLength(1);
    expect(afterHooks[0]!.tagExpression).toBe("@e2e and not @slow");
  });

  test("clear resets all registrations", () => {
    Given("something", async () => {});
    Before(async () => {});
    globalRegistry.clear();
    expect(globalRegistry.getSteps()).toHaveLength(0);
    expect(globalRegistry.getHooks("Before")).toHaveLength(0);
  });
});
