# Visual Regression Assertions — Design Spec

> Baseline screenshot assertions with pixel-level diffing, configurable thresholds, masking, and diff artifacts integrated into HTML/Allure reports.

## 1. Overview

Add `toMatchScreenshot()` assertions to spana's expect API. Each assertion captures a screenshot (full-page or element-level), compares it against a stored baseline using pixel diffing, and fails if the difference exceeds a configurable threshold. Diff artifacts are written to `spana-output/` and embedded in reports.

Baselines are auto-created on first run, updated explicitly via `--update-baselines`, and optionally reviewed interactively in Studio.

## 2. Assertion API

### Full-Page Comparison

```typescript
await expect().toMatchScreenshot("dashboard");
```

Captures the entire screen and compares against the baseline named "dashboard" for the current platform.

### Element-Level Comparison

```typescript
await expect({ testID: "header" }).toMatchScreenshot("header-nav");
```

Locates the element, crops the screenshot to its bounds, and compares the cropped region against the baseline.

### Options

```typescript
await expect().toMatchScreenshot("dashboard", {
  threshold: 0.2, // per-pixel sensitivity (0–1), default 0.2
  maxDiffPixelRatio: 0.01, // max 1% of pixels can differ, default 0.01
  mask: [
    // regions to ignore during comparison
    { testID: "timestamp" },
    { testID: "avatar" },
  ],
});
```

| Option              | Type         | Default | Description                                                  |
| ------------------- | ------------ | ------- | ------------------------------------------------------------ |
| `threshold`         | `number`     | `0.2`   | Per-pixel color distance tolerance (0 = exact, 1 = anything) |
| `maxDiffPixelRatio` | `number`     | `0.01`  | Maximum fraction of total pixels allowed to differ           |
| `mask`              | `Selector[]` | `[]`    | Elements to paint over with a solid block before comparison  |

## 3. Baseline Management

### Lifecycle

1. **First run (no baseline exists):** Screenshot is saved as the baseline. Assertion passes. Console logs: `"Baseline created: {name}-{platform}.png"`.
2. **Subsequent runs:** Screenshot is compared against existing baseline. Passes if within threshold. Fails with diff artifacts on mismatch.
3. **Explicit update:** `spana test --update-baselines` overwrites all baselines with current screenshots. All visual assertions pass during an update run.
4. **Selective update:** `spana test --update-baselines --grep "login"` updates only baselines for matching flows.

### Storage Layout

```
flows/
  __baselines__/
    login-flow-web/
      dashboard.png
      header-nav.png
    login-flow-android/
      dashboard.png
      header-nav.png
    login-flow-ios/
      dashboard.png
      header-nav.png
  login.flow.ts
```

Pattern: `flows/__baselines__/{flowName}-{platform}/{screenshotName}.png`

This mirrors spana's existing `spana-output/{flowName}-{platform}/` convention. Baselines are committed to git so they're shared across the team.

### Path Resolution

The baseline manager resolves paths relative to the flow file's directory:

```
flowFile:     flows/auth/login.flow.ts
baseline:     flows/auth/__baselines__/login-flow-web/dashboard.png
```

For flows in subdirectories, `__baselines__/` lives alongside the flow file.

## 4. Image Comparison

### Library

**pixelmatch** — zero-dependency, fast, well-proven (used by Playwright, Storybook, Loki). Returns the number of differing pixels and generates a diff image highlighting mismatches in red.

### Comparison Pipeline

```
takeScreenshot()
  → Uint8Array (full-page PNG)
  → [if element-level: crop to element bounds]
  → [if mask: paint masked regions with solid fill on both images]
  → pixelmatch(expected, actual, { threshold })
  → diffPixels / totalPixels > maxDiffPixelRatio?
     → pass: discard actual screenshot
     → fail: write expected.png, actual.png, diff.png to spana-output/
```

### Element Cropping

For element-level assertions:

1. Resolve selector → element in hierarchy
2. Get `bounds: { x, y, width, height }` from element
3. Crop screenshot buffer to those bounds using `sharp` (already handles PNG decode/encode efficiently)
4. Compare cropped region against cropped baseline

### Masking

For each selector in `mask`:

1. Resolve selector → element bounds
2. Paint a solid gray rectangle over those bounds on both the actual and baseline images
3. Then run pixelmatch on the masked images

This ensures dynamic content (timestamps, avatars, ads) doesn't cause false failures.

## 5. Diff Artifacts

On visual assertion failure, three images are written:

```
spana-output/{flowName}-{platform}/
  dashboard-expected.png    # the baseline
  dashboard-actual.png      # what was captured this run
  dashboard-diff.png        # red highlights showing pixel differences
```

### Report Integration

**HTML reporter:** Renders a triptych (expected | actual | diff) in the failure details section. Images are embedded as base64 data URIs, consistent with existing screenshot embedding.

**Allure reporter:** Attaches all three images as separate attachments with descriptive names. Allure's built-in image comparison viewer works with this format.

**Console reporter:** Logs the file paths to the diff artifacts for manual inspection.

**JSON reporter:** Includes artifact paths in the structured output for downstream tooling.

## 6. CLI Integration

### New Flag

```bash
spana test --update-baselines
```

When set, all `toMatchScreenshot()` calls overwrite their baselines with the current screenshot and pass unconditionally. Combined with `--grep` or `--tags` for selective updates.

### Config

The `spana.config.ts` can set project-wide defaults:

```typescript
export default {
  visualRegression: {
    threshold: 0.2,
    maxDiffPixelRatio: 0.01,
    baselinesDir: "__baselines__", // relative to flow file
  },
};
```

Per-assertion options override these defaults.

## 7. Studio Integration

When running tests through Studio and a visual assertion fails:

1. The result viewer shows the diff triptych inline (expected | actual | diff).
2. An "Accept" button updates the baseline to the actual screenshot.
3. A "Reject" button keeps the existing baseline (test stays failed).

This provides an interactive review workflow without needing CLI flags. Accepts are written immediately to the baseline directory.

## 8. Architecture

### New Files

| File                                                | Purpose                                                          |
| --------------------------------------------------- | ---------------------------------------------------------------- |
| `packages/spana/src/core/screenshot-compare.ts`     | pixelmatch wrapper, image cropping, masking, diff generation     |
| `packages/spana/src/core/baseline-manager.ts`       | Baseline path resolution, read/write/update, first-run detection |
| `apps/studio/src/components/visual-diff-viewer.tsx` | Side-by-side diff triptych with accept/reject                    |

### Modified Files

| File                                      | Change                                     |
| ----------------------------------------- | ------------------------------------------ |
| `packages/spana/src/api/expect.ts`        | Add `toMatchScreenshot()` matcher          |
| `packages/spana/src/smart/coordinator.ts` | Add `assertScreenshot` coordination method |
| `packages/spana/src/cli/test-command.ts`  | Add `--update-baselines` flag              |
| `packages/spana/src/report/html.ts`       | Render diff triptych in failure details    |
| `packages/spana/src/report/allure.ts`     | Attach diff images                         |
| `packages/spana/src/schemas/config.ts`    | Add `visualRegression` config schema       |
| `package.json`                            | Add `pixelmatch` and `sharp` dependencies  |

### Dependencies

| Package      | Purpose                                               | Size             |
| ------------ | ----------------------------------------------------- | ---------------- |
| `pixelmatch` | Pixel-level image comparison                          | ~5 KB            |
| `pngjs`      | PNG encode/decode (pixelmatch peer)                   | ~30 KB           |
| `sharp`      | Image cropping for element-level screenshots, masking | ~1.5 MB (native) |

## 9. Scope Boundaries

### In Scope

- `toMatchScreenshot()` assertion for full-page and element-level
- Configurable threshold, maxDiffPixelRatio, and mask
- Auto-create baselines on first run
- `--update-baselines` CLI flag
- Diff artifact generation (expected/actual/diff PNGs)
- HTML and Allure report integration
- Studio diff viewer with accept/reject
- Platform-separated baselines committed to git

### Out of Scope (Future)

- Perceptual or AI-based diffing (structural similarity, SSIM)
- Anti-aliasing detection (pixelmatch has basic support, not configurable)
- Responsive breakpoint testing (multiple viewport sizes in one assertion)
- Baseline branching (different baselines per git branch)
- Video frame comparison
- Cross-platform baseline sharing
