export function splitGraphemes(text: string): string[] {
  if (text.length === 0) {
    return [];
  }

  const Segmenter = globalThis.Intl?.Segmenter;
  if (!Segmenter) {
    return Array.from(text);
  }

  return Array.from(
    new Segmenter(undefined, { granularity: "grapheme" }).segment(text),
    (part) => part.segment,
  );
}
