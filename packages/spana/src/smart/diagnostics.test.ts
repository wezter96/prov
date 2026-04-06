import { describe, expect, test } from "bun:test";
import type { Element } from "../schemas/element.js";
import { diagnoseElementNotFound, formatDiagnostic } from "./diagnostics.js";

function makeElement(overrides: Partial<Element> = {}): Element {
  return {
    bounds: { x: 0, y: 0, width: 100, height: 40 },
    visible: true,
    enabled: true,
    children: [],
    ...overrides,
  };
}

describe("diagnostics", () => {
  test("detects not-visible elements", () => {
    const root = makeElement({
      children: [makeElement({ id: "btn", visible: false })],
    });
    const result = diagnoseElementNotFound(root, { testID: "btn" });
    expect(result.reason).toBe("not-visible");
    expect(result.suggestions[0]).toContain("visible=false");
  });

  test("detects off-screen elements", () => {
    const root = makeElement({
      children: [
        makeElement({
          id: "btn",
          bounds: { x: -200, y: -200, width: 100, height: 40 },
        }),
      ],
    });
    const result = diagnoseElementNotFound(root, { testID: "btn" });
    expect(result.reason).toBe("off-screen");
  });

  test("detects disabled elements", () => {
    const root = makeElement({
      children: [makeElement({ id: "btn", enabled: false })],
    });
    const result = diagnoseElementNotFound(root, { testID: "btn" });
    expect(result.reason).toBe("not-interactive");
  });

  test("suggests similar testIDs", () => {
    const root = makeElement({
      children: [makeElement({ id: "login-button" }), makeElement({ id: "logout-button" })],
    });
    const result = diagnoseElementNotFound(root, { testID: "login-btn" });
    expect(result.reason).toBe("not-found");
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]).toContain("login-button");
  });

  test("suggests similar text", () => {
    const root = makeElement({
      children: [makeElement({ text: "Submit Order" }), makeElement({ text: "Cancel" })],
    });
    const result = diagnoseElementNotFound(root, "Submit");
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0]).toContain("Submit Order");
  });

  test("returns not-found with no suggestions for completely unrelated selector", () => {
    const root = makeElement({
      children: [makeElement({ text: "Hello" })],
    });
    const result = diagnoseElementNotFound(root, {
      testID: "zzz-completely-unrelated",
    });
    expect(result.reason).toBe("not-found");
    expect(result.totalElements).toBe(2);
  });

  test("formatDiagnostic produces human-readable output", () => {
    const output = formatDiagnostic({
      reason: "not-visible",
      suggestions: ["Element exists but has visible=false (1 match(es))"],
      totalElements: 15,
    });
    expect(output).toContain("not visible");
    expect(output).toContain("15 elements");
  });
});
