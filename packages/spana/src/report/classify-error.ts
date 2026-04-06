import type { FailureCategory, FlowError } from "./types.js";

const TAG_KEY = "_tag";

interface TaggedLike {
  [TAG_KEY]?: string;
  message?: string;
  selector?: unknown;
  timeoutMs?: number;
  expected?: string;
  actual?: string;
  deviceId?: string;
  appId?: string;
  command?: string;
  platform?: string;
}

function selectorHint(selector: unknown): string {
  if (selector && typeof selector === "object") {
    const s = selector as Record<string, unknown>;
    if (s.testID) return `testID="${s.testID}"`;
    if (s.text) return `text="${s.text}"`;
    if (s.accessibilityLabel) return `accessibilityLabel="${s.accessibilityLabel}"`;
  }
  return JSON.stringify(selector);
}

function categorize(error: TaggedLike): { category: FailureCategory; suggestion?: string } {
  const tag = error[TAG_KEY];
  const msg = error.message ?? "";

  if (tag === "ElementNotFoundError" || tag === "WaitTimeoutError") {
    const sel = selectorHint((error as any).selector);
    if (msg.includes("scroll(s) toward")) {
      return {
        category: "element-not-found",
        suggestion: [
          `Selector ${sel} stayed off-screen while scrolling.`,
          "Try increasing `maxScrolls` or `timeout`, or reverse the search direction",
          'if the target is actually above the current viewport (for example `{ direction: "up" }`).',
        ].join("\n"),
      };
    }

    if (msg.includes("back action(s)")) {
      return {
        category: "element-not-found",
        suggestion: [
          `Selector ${sel} was not reached while navigating back.`,
          "Try increasing `maxBacks` or `timeout`, or prefer an explicit in-app",
          "back / close control on iOS-style screens instead of relying on system back.",
        ].join("\n"),
      };
    }

    return {
      category: "element-not-found",
      suggestion: [
        msg.includes("not visible")
          ? "The element exists but is hidden. Check if a loading state or animation is blocking it."
          : msg.includes("off-screen")
            ? "The element is off-screen. Use scrollUntilVisible() or scroll to the element first."
            : msg.includes("disabled")
              ? "The element is disabled. Wait for the app to enable it or check app state."
              : `Selector ${sel} was not found within ${(error as any).timeoutMs ?? "?"}ms. Run \`spana selectors\` to see available selectors on the current screen.`,
        "Consider increasing waitTimeout if the element appears after a delay.",
      ].join("\n"),
    };
  }

  if (tag === "TextMismatchError") {
    const e = error as TaggedLike;
    return {
      category: "text-mismatch",
      suggestion: [
        `Expected text "${e.expected}" but found "${e.actual ?? "(empty)"}".`,
        "The element exists but its content differs. Check for whitespace, truncation,",
        "or platform-specific text rendering differences.",
      ].join("\n"),
    };
  }

  if (tag === "TimeoutError") {
    return {
      category: "timeout",
      suggestion: [
        "The operation took longer than the allowed timeout.",
        "Try increasing `defaults.waitTimeout` in spana.config.ts,",
        "or set a per-flow timeout: `flow('name', { timeout: 30000 }, ...)`.",
      ].join("\n"),
    };
  }

  if (tag === "DeviceDisconnectedError") {
    const id = error.deviceId ? ` (${error.deviceId})` : "";
    return {
      category: "device-disconnected",
      suggestion: [
        `The device${id} disconnected during the test.`,
        "Check the physical connection or emulator/simulator stability.",
        "Run `spana devices` to verify available devices.",
      ].join("\n"),
    };
  }

  if (tag === "AppCrashedError") {
    const app = error.appId ? ` (${error.appId})` : "";
    return {
      category: "app-crashed",
      suggestion: [
        `The app${app} crashed during the test.`,
        "Check the device logs for a crash stack trace:",
        "  Android: `adb logcat -d | grep FATAL`",
        "  iOS: Check Console.app or `log show --predicate 'process == \"your-app\"'`",
      ].join("\n"),
    };
  }

  if (tag === "AppNotInstalledError") {
    return {
      category: "app-not-installed",
      suggestion: [
        `App "${error.appId}" is not installed on the device.`,
        "Install it before running tests, or configure `apps.android.appPath`",
        "/ `apps.ios.appPath` in spana.config.ts for auto-install.",
      ].join("\n"),
    };
  }

  if (tag === "DriverError") {
    if (msg.includes("dismissKeyboard()")) {
      return {
        category: "driver-error",
        suggestion: [
          "Keyboard dismissal failed.",
          'On Android, try `app.dismissKeyboard({ strategy: "back" })`.',
          "On iOS, prefer tapping a visible Done / Close control or a non-input element.",
        ].join("\n"),
      };
    }

    if (msg.includes("backUntilVisible()")) {
      return {
        category: "driver-error",
        suggestion: [
          "System back navigation failed before the target screen became visible.",
          "If this route uses app-level navigation, tap the visible back / close control instead.",
          "This is especially common on iOS where a system back button may not exist.",
        ].join("\n"),
      };
    }

    if (msg.includes("Input text failed")) {
      return {
        category: "driver-error",
        suggestion: [
          "Text input failed at the driver layer.",
          "Make sure the field is focused first, and retry with shorter input chunks if needed.",
          "If the keyboard is in the way, dismiss it before continuing the flow.",
        ].join("\n"),
      };
    }

    return {
      category: "driver-error",
      suggestion: error.command
        ? `Driver command "${error.command}" failed. Check the device connection and driver logs.`
        : "A low-level driver operation failed. Check the device connection and driver logs.",
    };
  }

  if (tag === "ConfigError" || tag === "FlowSyntaxError") {
    return {
      category: "config-error",
      suggestion: "Run `spana validate-config` to check your configuration.",
    };
  }

  // Heuristic fallbacks for errors that aren't Effect TaggedErrors
  if (msg.includes("timed out") || msg.includes("Timed out")) {
    return {
      category: "timeout",
      suggestion:
        "The operation timed out. Try increasing `defaults.waitTimeout` in spana.config.ts.",
    };
  }

  if (msg.includes("not found") || msg.includes("not visible")) {
    if (msg.includes("scroll(s) toward")) {
      return {
        category: "element-not-found",
        suggestion:
          "The target stayed off-screen while scrolling. Increase `maxScrolls` / `timeout`, or reverse the scroll search direction.",
      };
    }

    return {
      category: "element-not-found",
      suggestion:
        "An element was not found. Run `spana selectors` to check available selectors on the current screen.",
    };
  }

  if (msg.includes("dismissKeyboard()")) {
    return {
      category: "driver-error",
      suggestion:
        'Keyboard dismissal failed. On Android try `app.dismissKeyboard({ strategy: "back" })`; on iOS prefer an explicit Done / Close control.',
    };
  }

  if (msg.includes("ECONNREFUSED") || msg.includes("ECONNRESET") || msg.includes("disconnected")) {
    return {
      category: "device-disconnected",
      suggestion:
        "The connection was lost. Check the device or emulator/simulator is still running.",
    };
  }

  return { category: "unknown" };
}

/** Classify an Error into a typed FlowError with category and actionable suggestion. */
export function classifyError(error: Error): FlowError {
  const tagged = error as unknown as TaggedLike;
  const { category, suggestion } = categorize(tagged);
  return {
    message: error.message,
    stack: error.stack,
    category,
    suggestion,
  };
}
