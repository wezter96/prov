import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  baselineExists,
  readBaseline,
  resolveBaselinePath,
  writeBaseline,
} from "./baseline-manager.js";

let tempDir: string;

afterEach(() => {
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  tempDir = mkdtempSync(join(tmpdir(), "spana-baselines-"));
  return tempDir;
}

describe("resolveBaselinePath", () => {
  test("resolves path for a root-level flow file", () => {
    const path = resolveBaselinePath("/flows/login.flow.ts", "Login Flow", "ios", "home-screen");
    expect(path).toBe("/flows/__baselines__/login-flow-ios/home-screen.png");
  });

  test("resolves path for a nested flow file", () => {
    const path = resolveBaselinePath(
      "/project/src/flows/checkout/payment.flow.ts",
      "Payment Flow",
      "android",
      "confirm-order",
    );
    expect(path).toBe(
      "/project/src/flows/checkout/__baselines__/payment-flow-android/confirm-order.png",
    );
  });

  test("sanitises flow name - strips leading/trailing dashes and collapses non-alphanumeric", () => {
    const path = resolveBaselinePath(
      "/flows/my.flow.ts",
      "  My  --  Special Flow!!  ",
      "web",
      "step-1",
    );
    expect(path).toBe("/flows/__baselines__/my-special-flow-web/step-1.png");
  });

  test("lowercases flow name in directory", () => {
    const path = resolveBaselinePath("/flows/f.ts", "MyFlow", "web", "screen");
    expect(path).toBe("/flows/__baselines__/myflow-web/screen.png");
  });

  test("uses a custom baselines directory when provided", () => {
    const path = resolveBaselinePath(
      "/flows/f.ts",
      "Checkout Flow",
      "android",
      "summary",
      "/tmp/custom-baselines",
    );
    expect(path).toBe("/tmp/custom-baselines/checkout-flow-android/summary.png");
  });
});

describe("baselineExists", () => {
  test("returns false when the file does not exist", () => {
    expect(baselineExists("/nonexistent/__baselines__/foo-web/screen.png")).toBe(false);
  });

  test("returns true after the baseline is written", () => {
    const dir = makeTempDir();
    const path = resolveBaselinePath(join(dir, "my.flow.ts"), "My Flow", "web", "home");
    writeBaseline(path, Buffer.from([1, 2, 3]));
    expect(baselineExists(path)).toBe(true);
  });
});

describe("readBaseline", () => {
  test("returns null when file does not exist", () => {
    expect(readBaseline("/nonexistent/__baselines__/foo-web/screen.png")).toBeNull();
  });

  test("returns the buffer after a write-then-read roundtrip", () => {
    const dir = makeTempDir();
    const path = resolveBaselinePath(join(dir, "my.flow.ts"), "My Flow", "web", "home");
    const data = Buffer.from([10, 20, 30, 40]);
    writeBaseline(path, data);
    const result = readBaseline(path);
    expect(result).not.toBeNull();
    expect(Array.from(result!)).toEqual([10, 20, 30, 40]);
  });
});

describe("writeBaseline", () => {
  test("creates parent directories automatically", () => {
    const dir = makeTempDir();
    const path = resolveBaselinePath(
      join(dir, "flows", "nested", "my.flow.ts"),
      "My Flow",
      "ios",
      "screen-a",
    );
    expect(existsSync(path)).toBe(false);
    writeBaseline(path, Buffer.from([0xff]));
    expect(existsSync(path)).toBe(true);
  });

  test("accepts Uint8Array data", () => {
    const dir = makeTempDir();
    const path = resolveBaselinePath(join(dir, "my.flow.ts"), "My Flow", "android", "screen");
    writeBaseline(path, new Uint8Array([5, 6, 7]));
    const result = readBaseline(path);
    expect(Array.from(result!)).toEqual([5, 6, 7]);
  });
});
