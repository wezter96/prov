import { Schema } from "effect";

export type Platform = "android" | "ios" | "web";

const TestIDSelector = Schema.Struct({ testID: Schema.String });
const TextSelector = Schema.Struct({ text: Schema.String });
const AccessibilityLabelSelector = Schema.Struct({ accessibilityLabel: Schema.String });
const PointSelector = Schema.Struct({
  point: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
});

export const Selector = Schema.Union(
  Schema.String,
  TestIDSelector,
  TextSelector,
  AccessibilityLabelSelector,
  PointSelector,
);
export type Selector = typeof Selector.Type;

/** Relative selector — find element relative to an anchor element's position */
export interface RelativeSelector {
  selector: Selector;
  below?: Selector;
  above?: Selector;
  leftOf?: Selector;
  rightOf?: Selector;
  childOf?: Selector;
}

/** Extended selector that supports both simple and relative selectors */
export type ExtendedSelector = Selector | RelativeSelector;

export function isRelativeSelector(sel: ExtendedSelector): sel is RelativeSelector {
  return typeof sel === "object" && sel !== null && "selector" in sel;
}
