# Accessibility Audits and Assertions — Design Spec

> Web axe-core audits with structured violation reports, plus cross-platform assertion matchers for common accessibility properties.

## 1. Overview

Two layers of accessibility testing:

1. **Web audits** — full axe-core scanning that returns WCAG violations with severity, affected elements, and help URLs. Runs in the browser context via Playwright's `page.evaluate()`.
2. **Cross-platform assertions** — matchers for accessibility properties (labels, roles, focusability, touch target size) that work on web, Android, and iOS using hierarchy data already captured by `dumpHierarchy()`.

Both layers integrate with HTML, Allure, console, and JSON reporters.

## 2. Web Audit API

### Basic Audit

```typescript
await expect().toPassAccessibilityAudit();
```

Runs axe-core on the current page state. Fails if any violations at "serious" severity or above are found.

### Granular Control

```typescript
await expect().toPassAccessibilityAudit({
  severity: "serious", // minimum level to fail on
  rules: { "color-contrast": false }, // disable specific rules
  exclude: [{ testID: "third-party-widget" }], // regions to skip
});
```

| Option     | Type                                               | Default     | Description                                    |
| ---------- | -------------------------------------------------- | ----------- | ---------------------------------------------- |
| `severity` | `"critical" \| "serious" \| "moderate" \| "minor"` | `"serious"` | Minimum violation severity that causes failure |
| `rules`    | `Record<string, boolean>`                          | `{}`        | Enable/disable specific axe-core rules by ID   |
| `exclude`  | `Selector[]`                                       | `[]`        | Elements to exclude from the audit             |

### Severity Levels

axe-core reports four severity levels (mapped from its `impact` field):

| Level      | Meaning                | Example Rules                                 |
| ---------- | ---------------------- | --------------------------------------------- |
| `critical` | Blocks access entirely | missing form labels, empty buttons            |
| `serious`  | Major barrier          | insufficient color contrast, missing alt text |
| `moderate` | Inconvenient           | missing landmarks, heading order skipped      |
| `minor`    | Best practice          | redundant ARIA roles, tabindex > 0            |

### Platform Restriction

`toPassAccessibilityAudit()` is **web-only**. Calling it on Android or iOS throws a clear error: `"Accessibility audits are only supported on web. Use toHaveAccessibilityLabel(), toBeFocusable(), toHaveRole(), or toHaveMinTouchTarget() for cross-platform accessibility assertions."`

## 3. Cross-Platform Assertion Matchers

These matchers work on all platforms (web, Android, iOS) using data from `dumpHierarchy()`.

### toHaveAccessibilityLabel

```typescript
// Assert element has a non-empty accessibility label
await expect({ testID: "login-btn" }).toHaveAccessibilityLabel();

// Assert element has a specific label
await expect({ testID: "login-btn" }).toHaveAccessibilityLabel("Log in");
```

Checks the `accessibilityLabel` field from the element hierarchy. On web, this maps to `aria-label`. On Android, `contentDescription`. On iOS, `accessibilityLabel`.

### toBeFocusable

```typescript
await expect({ testID: "email-input" }).toBeFocusable();
```

Checks that the element can receive focus. Implementation per platform:

| Platform | How Determined                                                                          |
| -------- | --------------------------------------------------------------------------------------- |
| Web      | Element is focusable by tag (input, button, a, textarea, select) or has `tabindex >= 0` |
| Android  | Element has `focusable: true` in hierarchy                                              |
| iOS      | Element has `isAccessibilityElement: true` or is a known interactive type               |

### toHaveRole

```typescript
await expect({ testID: "login-btn" }).toHaveRole("button");
```

Checks the semantic role of the element.

| Platform | Source                                                                                           |
| -------- | ------------------------------------------------------------------------------------------------ |
| Web      | `role` attribute or implicit role from tag name (button → "button", a → "link", h1 → "heading")  |
| Android  | `className` mapping (android.widget.Button → "button", android.widget.EditText → "textfield")    |
| iOS      | `traits` mapping (UIAccessibilityTraitButton → "button", UIAccessibilityTraitHeader → "heading") |

A mapping table in `accessibility-audit.ts` normalizes platform-specific values to a common role vocabulary.

### toHaveMinTouchTarget

```typescript
// Assert minimum 44x44 touch target (Apple/Google guideline)
await expect({ testID: "login-btn" }).toHaveMinTouchTarget();

// Assert custom minimum size
await expect({ testID: "login-btn" }).toHaveMinTouchTarget(48);
```

Checks that the element's `bounds.width` and `bounds.height` are both at least the specified size. Default is 44 (dp on mobile, px on web), matching both Apple's HIG and Google's Material guidelines.

## 4. Violation Data Structure

When `toPassAccessibilityAudit()` fails, violations are captured as structured data:

```typescript
interface AccessibilityViolation {
  ruleId: string; // e.g., "color-contrast"
  severity: "critical" | "serious" | "moderate" | "minor";
  description: string; // human-readable rule description
  helpUrl: string; // link to axe-core rule documentation
  wcagCriteria: string[]; // e.g., ["1.4.3", "1.4.6"]
  elements: Array<{
    selector: string; // CSS selector of affected element
    html: string; // outer HTML snippet
    failureSummary: string; // what specifically failed
  }>;
}
```

This structure is attached to the step result as a JSON attachment alongside any screenshots.

## 5. axe-core Integration

### Injection

axe-core is injected into the web page via Playwright's `page.evaluate()`:

1. Read the axe-core source bundle (bundled with spana, not fetched at runtime).
2. Inject into page context.
3. Run `axe.run(document, config)` with the configured rules and exclusions.
4. Return the violations array.

### Exclusion Mapping

`exclude` selectors are resolved to CSS selectors before passing to axe-core:

| Spana Selector                | CSS Equivalent                             |
| ----------------------------- | ------------------------------------------ |
| `{ testID: "x" }`             | `[data-testid="x"]`                        |
| `{ text: "Submit" }`          | Not supported — logged as warning, skipped |
| `{ accessibilityLabel: "x" }` | `[aria-label="x"]`                         |

### Bundling

`axe-core` is added as a production dependency. The minified source (~250 KB) is read at runtime from `node_modules/axe-core/axe.min.js` and cached in memory for the session.

## 6. Report Integration

### HTML Reporter

Violations render as a structured table in the failure details section:

```
┌──────────────────┬──────────┬──────────────────────────┬───────────┐
│ Rule             │ Severity │ Elements                 │ WCAG      │
├──────────────────┼──────────┼──────────────────────────┼───────────┤
│ color-contrast   │ serious  │ <p class="muted">...     │ 1.4.3     │
│ button-name      │ critical │ <button class="icon">... │ 4.1.2     │
└──────────────────┴──────────┴──────────────────────────┴───────────┘
```

Each rule ID links to its axe-core help URL. Severity cells are color-coded (red for critical, orange for serious, yellow for moderate, blue for minor).

### Allure Reporter

Violations are attached as a JSON file (`a11y-violations.json`) to the step. Allure's attachment viewer renders the JSON. Screenshots captured at the time of the audit are attached alongside.

### Console Reporter

Prints a summary on failure:

```
  ✗ Accessibility audit failed: 2 violations (1 critical, 1 serious)
    - button-name (critical): 1 element — <button class="icon">...
    - color-contrast (serious): 3 elements
```

### JSON Reporter

Includes the full violations array in the step result for downstream tooling.

## 7. Architecture

### New Files

| File                                             | Purpose                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------- |
| `packages/spana/src/core/accessibility-audit.ts` | axe-core runner, violation formatter, severity filter, role mapping table |

### Modified Files

| File                                      | Change                                                                                                                      |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/spana/src/api/expect.ts`        | Add `toPassAccessibilityAudit()`, `toHaveAccessibilityLabel()`, `toBeFocusable()`, `toHaveRole()`, `toHaveMinTouchTarget()` |
| `packages/spana/src/smart/coordinator.ts` | Add coordination methods for a11y audit and matchers                                                                        |
| `packages/spana/src/report/html.ts`       | Render violation table in failure details                                                                                   |
| `packages/spana/src/report/allure.ts`     | Attach violation JSON                                                                                                       |
| `packages/spana/src/report/console.ts`    | Print violation summary                                                                                                     |
| `package.json`                            | Add `axe-core` dependency                                                                                                   |

### Dependencies

| Package    | Purpose                            | Size               |
| ---------- | ---------------------------------- | ------------------ |
| `axe-core` | WCAG accessibility scanning engine | ~250 KB (minified) |

## 8. Scope Boundaries

### In Scope

- `toPassAccessibilityAudit()` web-only assertion with axe-core
- Configurable severity threshold, rule toggles, and element exclusions
- Structured violation data with rule ID, WCAG criteria, severity, affected elements, help URLs
- Cross-platform matchers: `toHaveAccessibilityLabel()`, `toBeFocusable()`, `toHaveRole()`, `toHaveMinTouchTarget()`
- Role normalization across web/Android/iOS
- HTML, Allure, console, and JSON report integration

### Out of Scope (Future)

- Native screen reader simulation (VoiceOver/TalkBack)
- Color contrast checking on native platforms
- Focus order / tab sequence validation
- ARIA authoring practice validation beyond axe-core rules
- Automated remediation suggestions
- Custom axe-core rule authoring
- Accessibility tree diffing between runs
