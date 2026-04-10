export function studioTestId(id: string) {
  return { "data-testid": id };
}

export function toStudioTestIdSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");

  return normalized || "item";
}
