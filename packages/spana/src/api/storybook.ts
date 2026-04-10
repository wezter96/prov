import { DriverError } from "../errors.js";
import type { StorybookConfig, StorybookValue } from "../schemas/config.js";

export interface StorybookOpenOptions {
  /** Override the Storybook base URL for this call. */
  baseUrl?: string;
  /** Storybook view mode. Defaults to "story". */
  viewMode?: "story" | "docs";
  /** Story args encoded into the Storybook iframe query string. */
  args?: Record<string, StorybookValue>;
  /** Story globals encoded into the Storybook iframe query string. */
  globals?: Record<string, StorybookValue>;
}

interface StorybookRuntimeOptions {
  appBaseUrl?: string;
  storybook?: StorybookConfig;
}

function assertSafeStorybookToken(
  group: "args" | "globals",
  key: string,
  value: StorybookValue,
): void {
  if (/[;:=]/.test(key)) {
    throw new DriverError({
      message: `openStory() ${group} key "${key}" contains unsupported Storybook query characters (;, :, =).`,
    });
  }

  if (typeof value === "string" && /[;:]/.test(value)) {
    throw new DriverError({
      message: `openStory() ${group}.${key} contains unsupported Storybook query characters (; or :).`,
    });
  }
}

function encodeStorybookValue(value: StorybookValue): string {
  if (value === null) {
    return "!null";
  }

  return String(value);
}

function encodeStorybookEntries(
  group: "args" | "globals",
  entries: Record<string, StorybookValue> | undefined,
): string | undefined {
  if (!entries) {
    return undefined;
  }

  const pairs = Object.entries(entries);
  if (pairs.length === 0) {
    return undefined;
  }

  return pairs
    .map(([key, value]) => {
      assertSafeStorybookToken(group, key, value);
      return `${key}:${encodeStorybookValue(value)}`;
    })
    .join(";");
}

export function buildStorybookUrl(
  storyId: string,
  options: StorybookOpenOptions | undefined,
  runtime: StorybookRuntimeOptions,
): string {
  const trimmedStoryId = storyId.trim();
  if (!trimmedStoryId) {
    throw new DriverError({ message: "openStory() requires a non-empty Storybook story ID." });
  }

  const baseUrl = options?.baseUrl ?? runtime.storybook?.url ?? runtime.appBaseUrl;
  if (!baseUrl) {
    throw new DriverError({
      message:
        "openStory() requires apps.web.url, execution.web.storybook.url, or options.baseUrl.",
    });
  }

  let url: URL;
  try {
    url = new URL(runtime.storybook?.iframePath ?? "/iframe.html", baseUrl);
  } catch (error) {
    throw new DriverError({
      message: `openStory() could not build a Storybook URL from "${baseUrl}": ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  url.searchParams.set("id", trimmedStoryId);
  url.searchParams.set("viewMode", options?.viewMode ?? "story");

  const args = encodeStorybookEntries("args", options?.args);
  if (args) {
    url.searchParams.set("args", args);
  }

  const globals = encodeStorybookEntries("globals", options?.globals);
  if (globals) {
    url.searchParams.set("globals", globals);
  }

  return url.toString();
}
