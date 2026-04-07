import { describe, expect, test } from "bun:test";
import { splitGraphemes } from "./graphemes.js";

describe("splitGraphemes", () => {
  test("keeps combined emoji and combining marks intact", () => {
    expect(splitGraphemes("A👨‍👩‍👧‍👦e\u0301")).toEqual(["A", "👨‍👩‍👧‍👦", "e\u0301"]);
  });

  test("returns an empty array for empty text", () => {
    expect(splitGraphemes("")).toEqual([]);
  });
});
