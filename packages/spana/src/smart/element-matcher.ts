import type { Element } from "../schemas/element.js";
import type { Selector } from "../schemas/selector.js";

/** Flatten an element tree into a list */
export function flattenElements(root: Element): Element[] {
  const result: Element[] = [root];
  if (root.children) {
    for (const child of root.children) {
      result.push(...flattenElements(child));
    }
  }
  return result;
}

/** Check if an element matches a selector */
export function matchesSelector(element: Element, selector: Selector): boolean {
  if (typeof selector === "string") {
    // String shorthand = text match (case-insensitive)
    return element.text?.toLowerCase().includes(selector.toLowerCase()) ?? false;
  }
  if ("testID" in selector) {
    return element.id === selector.testID;
  }
  if ("text" in selector) {
    return element.text?.toLowerCase().includes(selector.text.toLowerCase()) ?? false;
  }
  if ("accessibilityLabel" in selector) {
    return element.accessibilityLabel === selector.accessibilityLabel;
  }
  if ("point" in selector) {
    const { x, y } = selector.point;
    const b = element.bounds;
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }
  return false;
}

/** Find all elements matching a selector */
export function findElements(root: Element, selector: Selector): Element[] {
  return flattenElements(root).filter((el) => matchesSelector(el, selector));
}

function isProbablyOnScreen(element: Element): boolean {
  const centerX = element.bounds.x + element.bounds.width / 2;
  const centerY = element.bounds.y + element.bounds.height / 2;

  return element.bounds.width > 0
    && element.bounds.height > 0
    && centerX >= 0
    && centerY >= 0;
}

/** Find the best matching element — prefer clickable, then deepest */
export function findElement(root: Element, selector: Selector): Element | undefined {
  const matches = findElements(root, selector).filter((el) => el.visible !== false);
  if (matches.length === 0) return undefined;

  const visibleMatches = matches.filter(isProbablyOnScreen);
  if (visibleMatches.length === 0) return undefined;

  // Prefer clickable elements
  const clickable = visibleMatches.filter((el) => el.clickable);
  if (clickable.length > 0) return clickable[clickable.length - 1]!; // deepest clickable
  return visibleMatches[visibleMatches.length - 1]!; // deepest match
}

/** Calculate the center point of an element's bounds */
export function centerOf(element: Element): { x: number; y: number } {
  return {
    x: Math.round(element.bounds.x + element.bounds.width / 2),
    y: Math.round(element.bounds.y + element.bounds.height / 2),
  };
}
