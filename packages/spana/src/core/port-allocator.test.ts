import { describe, expect, test, beforeEach } from "bun:test";
import { allocatePort, releasePort, resetAllocator } from "./port-allocator.js";

describe("port allocator", () => {
  beforeEach(() => {
    resetAllocator();
  });

  test("allocates sequential ports from base", () => {
    expect(allocatePort(8200)).toBe(8200);
    expect(allocatePort(8200)).toBe(8201);
    expect(allocatePort(8200)).toBe(8202);
  });

  test("different bases allocate independently", () => {
    expect(allocatePort(8200)).toBe(8200);
    expect(allocatePort(8100)).toBe(8100);
    expect(allocatePort(8200)).toBe(8201);
  });

  test("released ports are reused", () => {
    const p1 = allocatePort(8200);
    const _p2 = allocatePort(8200);
    releasePort(p1);
    expect(allocatePort(8200)).toBe(p1);
  });

  test("skips ports already in use", () => {
    allocatePort(8200); // 8200
    allocatePort(8200); // 8201
    releasePort(8200);
    expect(allocatePort(8200)).toBe(8200);
  });
});
