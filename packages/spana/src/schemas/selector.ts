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
