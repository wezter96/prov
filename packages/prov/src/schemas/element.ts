import { Schema } from "effect";

export const Bounds = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
  width: Schema.Number,
  height: Schema.Number,
});
export type Bounds = typeof Bounds.Type;

export const Element = Schema.Struct({
  id: Schema.optional(Schema.String),
  text: Schema.optional(Schema.String),
  accessibilityLabel: Schema.optional(Schema.String),
  resourceId: Schema.optional(Schema.String),
  elementType: Schema.optional(Schema.String),
  bounds: Bounds,
  enabled: Schema.optional(Schema.Boolean),
  visible: Schema.optional(Schema.Boolean),
  clickable: Schema.optional(Schema.Boolean),
  focused: Schema.optional(Schema.Boolean),
  children: Schema.optional(
    Schema.Array(Schema.suspend((): Schema.Schema<any, any, never> => Element)),
  ),
});
export type Element = typeof Element.Type;

export const ViewHierarchy = Schema.Struct({
  root: Element,
  timestamp: Schema.Number,
});
export type ViewHierarchy = typeof ViewHierarchy.Type;
