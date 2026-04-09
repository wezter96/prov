import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import {
  baselineExists,
  readBaseline,
  resolveBaselinePath,
  writeBaseline,
} from "./baseline-manager.js";
import { compareScreenshots } from "./screenshot-compare.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePng(
  width: number,
  height: number,
  fillColor: { r: number; g: number; b: number },
): Buffer {
  const png = new PNG({ width, height });
  const { r, g, b } = fillColor;
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = r;
    png.data[i * 4 + 1] = g;
    png.data[i * 4 + 2] = b;
    png.data[i * 4 + 3] = 255;
  }
  return PNG.sync.write(png);
}

let tempDir: string;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = "";
  }
});

function makeTempDir(): string {
  tempDir = mkdtempSync(join(tmpdir(), "spana-vr-integration-"));
  return tempDir;
}

// ---------------------------------------------------------------------------
// Test 1: write baseline, read back, compare with same image → match
// ---------------------------------------------------------------------------

describe("baseline-manager + screenshot-compare: write and compare same image", () => {
  test("red PNG written as baseline matches when compared with itself", () => {
    const dir = makeTempDir();
    const flowFile = join(dir, "my.flow.ts");
    const baselinePath = resolveBaselinePath(flowFile, "My Flow", "web", "home-screen");

    const redPng = makePng(20, 20, { r: 255, g: 0, b: 0 });

    // Write baseline
    writeBaseline(baselinePath, redPng);
    expect(baselineExists(baselinePath)).toBe(true);

    // Read back
    const stored = readBaseline(baselinePath);
    expect(stored).not.toBeNull();

    // Compare stored baseline with the same image
    const result = compareScreenshots(stored!, redPng);
    expect(result.match).toBe(true);
    expect(result.diffPixelCount).toBe(0);
    expect(result.sizeMismatch).toBeUndefined();
    expect(result.diffImage).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test 2: compare baseline with different (blue) image → mismatch with diff
// ---------------------------------------------------------------------------

describe("baseline-manager + screenshot-compare: mismatch produces diff image", () => {
  test("blue image differs from red baseline, diff image returned", () => {
    const dir = makeTempDir();
    const flowFile = join(dir, "checkout.flow.ts");
    const baselinePath = resolveBaselinePath(flowFile, "Checkout Flow", "android", "cart-screen");

    const redPng = makePng(10, 10, { r: 255, g: 0, b: 0 });
    const bluePng = makePng(10, 10, { r: 0, g: 0, b: 255 });

    writeBaseline(baselinePath, redPng);

    const stored = readBaseline(baselinePath);
    expect(stored).not.toBeNull();

    const result = compareScreenshots(stored!, bluePng);
    expect(result.match).toBe(false);
    expect(result.diffPixelCount).toBeGreaterThan(0);
    expect(result.diffPixelRatio).toBeGreaterThan(0);
    expect(result.diffImage).toBeDefined();

    // Verify diff image is a valid PNG with correct dimensions
    const diffPng = PNG.sync.read(result.diffImage!);
    expect(diffPng.width).toBe(10);
    expect(diffPng.height).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// Test 3: resolveBaselinePath produces correct paths
// ---------------------------------------------------------------------------

describe("resolveBaselinePath integration", () => {
  test("path segments are correct for a real temp directory flow", () => {
    const dir = makeTempDir();
    const flowFile = join(dir, "flows", "login.flow.ts");
    const baselinePath = resolveBaselinePath(flowFile, "Login Flow", "ios", "welcome");

    expect(baselinePath).toContain("__baselines__");
    expect(baselinePath).toContain("login-flow-ios");
    expect(baselinePath).toMatch(/welcome\.png$/);
    // dirname of baseline should be inside the flows dir
    expect(baselinePath).toContain(join(dir, "flows"));
  });

  test("flow name with special characters is sanitised in path", () => {
    const dir = makeTempDir();
    const flowFile = join(dir, "my.flow.ts");
    const baselinePath = resolveBaselinePath(flowFile, "Sign-Up & Onboarding!", "web", "step-1");

    expect(baselinePath).toContain("sign-up-onboarding-web");
    expect(baselinePath).toMatch(/step-1\.png$/);
  });

  test("baseline written to resolved path is readable", () => {
    const dir = makeTempDir();
    const flowFile = join(dir, "auth.flow.ts");
    const baselinePath = resolveBaselinePath(flowFile, "Auth Flow", "web", "dashboard");

    const img = makePng(5, 5, { r: 0, g: 255, b: 0 });
    writeBaseline(baselinePath, img);

    const stored = readBaseline(baselinePath);
    expect(stored).not.toBeNull();

    // Bytes round-trip correctly
    const decoded = PNG.sync.read(stored!);
    expect(decoded.width).toBe(5);
    expect(decoded.height).toBe(5);
    // First pixel should be green (R=0, G=255, B=0, A=255)
    expect(decoded.data[0]).toBe(0);
    expect(decoded.data[1]).toBe(255);
    expect(decoded.data[2]).toBe(0);
    expect(decoded.data[3]).toBe(255);
  });
});
