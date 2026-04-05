import { describe, test, expect } from "bun:test";
import type { Element } from "../schemas/element.js";
import type { RelativeSelector } from "../schemas/selector.js";
import { findElementExtended } from "./element-matcher.js";

// Layout:
//   [header]          y:0-50
//   [label-a] [btn-a] y:60-100
//   [label-b] [btn-b] y:110-150
//   [footer]           y:160-200

function makeTree(): Element {
  return {
    elementType: "root",
    bounds: { x: 0, y: 0, width: 400, height: 200 },
    visible: true,
    enabled: true,
    children: [
      {
        id: "header",
        text: "Header",
        elementType: "View",
        bounds: { x: 0, y: 0, width: 400, height: 50 },
        visible: true,
        enabled: true,
        children: [],
      },
      {
        id: "row-a",
        elementType: "View",
        bounds: { x: 0, y: 60, width: 400, height: 40 },
        visible: true,
        enabled: true,
        children: [
          {
            id: "label-a",
            text: "Label A",
            elementType: "Text",
            bounds: { x: 10, y: 65, width: 100, height: 30 },
            visible: true,
            enabled: true,
            children: [],
          },
          {
            id: "btn-a",
            text: "Button",
            elementType: "Button",
            bounds: { x: 200, y: 65, width: 80, height: 30 },
            visible: true,
            enabled: true,
            clickable: true,
            children: [],
          },
        ],
      },
      {
        id: "row-b",
        elementType: "View",
        bounds: { x: 0, y: 110, width: 400, height: 40 },
        visible: true,
        enabled: true,
        children: [
          {
            id: "label-b",
            text: "Label B",
            elementType: "Text",
            bounds: { x: 10, y: 115, width: 100, height: 30 },
            visible: true,
            enabled: true,
            children: [],
          },
          {
            id: "btn-b",
            text: "Button",
            elementType: "Button",
            bounds: { x: 200, y: 115, width: 80, height: 30 },
            visible: true,
            enabled: true,
            clickable: true,
            children: [],
          },
        ],
      },
      {
        id: "footer",
        text: "Footer",
        elementType: "View",
        bounds: { x: 0, y: 160, width: 400, height: 40 },
        visible: true,
        enabled: true,
        children: [],
      },
    ],
  };
}

describe("relative selectors", () => {
  test("below: finds button below header", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      below: { testID: "header" },
    };
    const el = findElementExtended(tree, sel);
    expect(el).toBeDefined();
    expect(el!.id).toBe("btn-a"); // closest below
  });

  test("below: finds button below row-a (skips btn-a, finds btn-b)", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      below: { testID: "row-a" },
    };
    const el = findElementExtended(tree, sel);
    expect(el).toBeDefined();
    expect(el!.id).toBe("btn-b");
  });

  test("above: finds element above footer", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      above: { testID: "footer" },
    };
    const el = findElementExtended(tree, sel);
    expect(el).toBeDefined();
    // Closest above footer = btn-b (y:115, footer at y:160)
    expect(el!.id).toBe("btn-b");
  });

  test("rightOf: finds button right of label", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      rightOf: { testID: "label-a" },
    };
    const el = findElementExtended(tree, sel);
    expect(el).toBeDefined();
    expect(el!.id).toBe("btn-a");
  });

  test("leftOf: finds label left of button", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Label A" },
      leftOf: { testID: "btn-a" },
    };
    const el = findElementExtended(tree, sel);
    expect(el).toBeDefined();
    expect(el!.id).toBe("label-a");
  });

  test("childOf: finds element within parent", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      childOf: { testID: "row-b" },
    };
    const el = findElementExtended(tree, sel);
    expect(el).toBeDefined();
    expect(el!.id).toBe("btn-b");
  });

  test("combined: below + rightOf narrows results", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      below: { testID: "row-a" },
      rightOf: { testID: "label-b" },
    };
    const el = findElementExtended(tree, sel);
    expect(el).toBeDefined();
    expect(el!.id).toBe("btn-b");
  });

  test("returns undefined when anchor not found", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      below: { testID: "nonexistent" },
    };
    expect(findElementExtended(tree, sel)).toBeUndefined();
  });

  test("returns undefined when no candidates match constraints", () => {
    const tree = makeTree();
    const sel: RelativeSelector = {
      selector: { text: "Button" },
      above: { testID: "header" }, // nothing above header
    };
    expect(findElementExtended(tree, sel)).toBeUndefined();
  });

  test("simple selector falls through to findElement", () => {
    const tree = makeTree();
    const el = findElementExtended(tree, { testID: "btn-a" });
    expect(el).toBeDefined();
    expect(el!.id).toBe("btn-a");
  });
});
