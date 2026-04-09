import { describe, expect, test } from "bun:test";
import {
  type AccessibilityViolation,
  type AuditOptions,
  buildAxeConfig,
  filterViolations,
  formatViolationSummary,
  normalizeRole,
} from "./accessibility-audit.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeViolation(
  ruleId: string,
  severity: AccessibilityViolation["severity"],
): AccessibilityViolation {
  return {
    ruleId,
    severity,
    description: `${ruleId} violation`,
    helpUrl: `https://dequeuniversity.com/rules/axe/${ruleId}`,
    wcagCriteria: ["1.1.1"],
    elements: [{ selector: `#${ruleId}`, html: `<div id="${ruleId}">`, failureSummary: "Fails" }],
  };
}

// ---------------------------------------------------------------------------
// 1. normalizeRole consistency across platforms
// ---------------------------------------------------------------------------

describe("normalizeRole: 'button' normalizes consistently", () => {
  test("web: <button> tag maps to 'button'", () => {
    expect(normalizeRole("web", "button", {})).toBe("button");
  });

  test("web: explicit role attribute overrides tag mapping", () => {
    expect(normalizeRole("web", "div", { role: "button" })).toBe("button");
  });

  test("android: Button class maps to 'button'", () => {
    expect(normalizeRole("android", "android.widget.Button", {})).toBe("button");
  });

  test("ios: button trait maps to 'button'", () => {
    expect(normalizeRole("ios", "button", {})).toBe("button");
  });

  test("all platforms return 'button' for their respective button element types", () => {
    const web = normalizeRole("web", "button", {});
    const android = normalizeRole("android", "android.widget.Button", {});
    const ios = normalizeRole("ios", "button", {});
    expect(web).toBe("button");
    expect(android).toBe("button");
    expect(ios).toBe("button");
  });
});

// ---------------------------------------------------------------------------
// 2. filterViolations by severity
// ---------------------------------------------------------------------------

describe("filterViolations by severity", () => {
  const allViolations: AccessibilityViolation[] = [
    makeViolation("rule-minor", "minor"),
    makeViolation("rule-moderate", "moderate"),
    makeViolation("rule-serious", "serious"),
    makeViolation("rule-critical", "critical"),
  ];

  test("minSeverity 'minor' returns all 4 violations", () => {
    const result = filterViolations(allViolations, "minor");
    expect(result).toHaveLength(4);
  });

  test("minSeverity 'moderate' returns moderate, serious, critical (3)", () => {
    const result = filterViolations(allViolations, "moderate");
    expect(result).toHaveLength(3);
    const ruleIds = result.map((v) => v.ruleId);
    expect(ruleIds).not.toContain("rule-minor");
    expect(ruleIds).toContain("rule-moderate");
    expect(ruleIds).toContain("rule-serious");
    expect(ruleIds).toContain("rule-critical");
  });

  test("minSeverity 'serious' returns serious and critical (2)", () => {
    const result = filterViolations(allViolations, "serious");
    expect(result).toHaveLength(2);
    const ruleIds = result.map((v) => v.ruleId);
    expect(ruleIds).toContain("rule-serious");
    expect(ruleIds).toContain("rule-critical");
  });

  test("minSeverity 'critical' returns only critical (1)", () => {
    const result = filterViolations(allViolations, "critical");
    expect(result).toHaveLength(1);
    expect(result[0]?.ruleId).toBe("rule-critical");
  });

  test("empty violations array returns empty", () => {
    expect(filterViolations([], "minor")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 3. formatViolationSummary output
// ---------------------------------------------------------------------------

describe("formatViolationSummary", () => {
  test("includes total violation count", () => {
    const violations: AccessibilityViolation[] = [
      makeViolation("r1", "critical"),
      makeViolation("r2", "serious"),
      makeViolation("r3", "moderate"),
    ];
    const summary = formatViolationSummary(violations);
    expect(summary).toContain("3");
  });

  test("includes critical count in output", () => {
    const violations: AccessibilityViolation[] = [
      makeViolation("r1", "critical"),
      makeViolation("r2", "critical"),
      makeViolation("r3", "serious"),
    ];
    const summary = formatViolationSummary(violations);
    expect(summary).toContain("2 critical");
  });

  test("includes serious count in output", () => {
    const violations: AccessibilityViolation[] = [
      makeViolation("r1", "critical"),
      makeViolation("r2", "serious"),
    ];
    const summary = formatViolationSummary(violations);
    expect(summary).toContain("1 serious");
  });

  test("zero critical and serious violations reflected in output", () => {
    const violations: AccessibilityViolation[] = [
      makeViolation("r1", "minor"),
      makeViolation("r2", "moderate"),
    ];
    const summary = formatViolationSummary(violations);
    expect(summary).toContain("2");
    expect(summary).toContain("0 critical");
    expect(summary).toContain("0 serious");
  });
});

// ---------------------------------------------------------------------------
// 4. buildAxeConfig: rules and exclusions are formatted correctly
// ---------------------------------------------------------------------------

describe("buildAxeConfig", () => {
  test("enabled rules are set to { enabled: true }", () => {
    const options: AuditOptions = { rules: ["color-contrast", "aria-label"] };
    const config = buildAxeConfig(options);
    const rules = config["rules"] as Record<string, { enabled: boolean }>;
    expect(rules["color-contrast"]).toEqual({ enabled: true });
    expect(rules["aria-label"]).toEqual({ enabled: true });
  });

  test("disabledRules are set to { enabled: false }", () => {
    const options: AuditOptions = { disabledRules: ["region"] };
    const config = buildAxeConfig(options);
    const rules = config["rules"] as Record<string, { enabled: boolean }>;
    expect(rules["region"]).toEqual({ enabled: false });
  });

  test("rules and disabledRules can coexist", () => {
    const options: AuditOptions = {
      rules: ["color-contrast"],
      disabledRules: ["region"],
    };
    const config = buildAxeConfig(options);
    const rules = config["rules"] as Record<string, { enabled: boolean }>;
    expect(rules["color-contrast"]).toEqual({ enabled: true });
    expect(rules["region"]).toEqual({ enabled: false });
  });

  test("exclude selectors are placed in context.exclude", () => {
    const options: AuditOptions = { exclude: [".ads", "#cookie-banner"] };
    const config = buildAxeConfig(options);
    const context = config["context"] as Record<string, unknown>;
    expect(context["exclude"]).toEqual([".ads", "#cookie-banner"]);
  });

  test("include selectors are placed in context.include", () => {
    const options: AuditOptions = { include: ["main", "#content"] };
    const config = buildAxeConfig(options);
    const context = config["context"] as Record<string, unknown>;
    expect(context["include"]).toEqual(["main", "#content"]);
  });

  test("tags produce runOnly config", () => {
    const options: AuditOptions = { tags: ["wcag2a", "wcag2aa"] };
    const config = buildAxeConfig(options);
    expect(config["runOnly"]).toEqual({ type: "tag", values: ["wcag2a", "wcag2aa"] });
  });

  test("empty options produces empty config", () => {
    const config = buildAxeConfig({});
    expect(Object.keys(config)).toHaveLength(0);
  });

  test("no context key when no include/exclude provided", () => {
    const config = buildAxeConfig({ rules: ["color-contrast"] });
    expect(config["context"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Touch target compliance: bounds comparison logic
// ---------------------------------------------------------------------------

describe("touch target compliance: bounds comparison", () => {
  const MIN_TOUCH_TARGET_PX = 44;

  function isTouchTargetCompliant(bounds: { width: number; height: number }): boolean {
    return bounds.width >= MIN_TOUCH_TARGET_PX && bounds.height >= MIN_TOUCH_TARGET_PX;
  }

  test("44x44 element meets minimum touch target size", () => {
    expect(isTouchTargetCompliant({ width: 44, height: 44 })).toBe(true);
  });

  test("48x48 element exceeds minimum and is compliant", () => {
    expect(isTouchTargetCompliant({ width: 48, height: 48 })).toBe(true);
  });

  test("43x44 element fails on width", () => {
    expect(isTouchTargetCompliant({ width: 43, height: 44 })).toBe(false);
  });

  test("44x43 element fails on height", () => {
    expect(isTouchTargetCompliant({ width: 44, height: 43 })).toBe(false);
  });

  test("20x20 element is too small on both axes", () => {
    expect(isTouchTargetCompliant({ width: 20, height: 20 })).toBe(false);
  });

  test("violations at serious severity are included when filtering at serious level", () => {
    // Simulate a touch-target violation flowing through the full pipeline
    const touchTargetViolation = makeViolation("touch-target", "serious");
    const minorViolation = makeViolation("color-contrast", "minor");

    const filtered = filterViolations([touchTargetViolation, minorViolation], "serious");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.ruleId).toBe("touch-target");
  });
});
