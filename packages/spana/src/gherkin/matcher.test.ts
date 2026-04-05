import { describe, test, expect, beforeEach } from "bun:test";
import { globalRegistry } from "./registry.js";
import { Given, When, Then } from "./steps.js";
import { createStepMatcher } from "./matcher.js";

beforeEach(() => {
  globalRegistry.clear();
});

describe("step matcher", () => {
  test("matches exact text", () => {
    Given("a user exists", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    const result = matcher.match("a user exists");
    expect(result).toBeDefined();
    expect(result!.handler.keyword).toBe("Given");
    expect(result!.args).toEqual([]);
  });

  test("extracts {string} parameters", () => {
    When("I tap the {string} button", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    const result = matcher.match('I tap the "Login" button');
    expect(result).toBeDefined();
    expect(result!.args).toEqual(["Login"]);
  });

  test("extracts {int} parameters", () => {
    Given("I have {int} items in my cart", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    const result = matcher.match("I have 5 items in my cart");
    expect(result).toBeDefined();
    expect(result!.args).toEqual([5]);
  });

  test("extracts {float} parameters", () => {
    Then("the price should be {float}", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    const result = matcher.match("the price should be 9.99");
    expect(result).toBeDefined();
    expect(result!.args).toEqual([9.99]);
  });

  test("extracts {word} parameters", () => {
    When("I navigate to {word}", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    const result = matcher.match("I navigate to settings");
    expect(result).toBeDefined();
    expect(result!.args).toEqual(["settings"]);
  });

  test("matches regex patterns with capture groups", () => {
    Given(/^I have (\d+) items?$/, async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    const result = matcher.match("I have 1 item");
    expect(result).toBeDefined();
    expect(result!.args).toEqual([1]);
  });

  test("returns undefined for no match", () => {
    Given("a user exists", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    expect(matcher.match("no such step")).toBeUndefined();
  });

  test("throws on ambiguous match", () => {
    Given("I have {int} items", async () => {});
    Given("I have {float} items", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    expect(() => matcher.match("I have 5 items")).toThrow("Ambiguous step definition");
  });

  test("handles multiple parameters", () => {
    When("I type {string} into {string}", async () => {});
    const matcher = createStepMatcher(globalRegistry.getSteps());

    const result = matcher.match('I type "hello" into "search"');
    expect(result).toBeDefined();
    expect(result!.args).toEqual(["hello", "search"]);
  });
});
