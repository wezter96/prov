import type { Platform } from "../schemas/selector.js";
import type { FlowResult, Reporter } from "./types.js";

function printResultAttachments(result: FlowResult): void {
  for (const attachment of result.attachments ?? []) {
    console.log(`    ↳ ${attachment.name}: ${attachment.path}`);
  }

  for (const [index, step] of (result.steps ?? []).entries()) {
    for (const attachment of step.attachments ?? []) {
      console.log(`    ↳ step ${index + 1} ${step.command}: ${attachment.path}`);
    }
  }
}

export function createConsoleReporter(): Reporter {
  return {
    onFlowStart(_name, _platform) {
      // Minimal — just track that it started
    },

    onFlowPass(result) {
      const platformTag = `[${result.platform}]`;
      const duration = `(${result.durationMs}ms)`;
      console.log(`  ✓ ${platformTag} ${result.name} ${duration}`);
      printResultAttachments(result);
    },

    onFlowFail(result) {
      const platformTag = `[${result.platform}]`;
      const duration = `(${result.durationMs}ms)`;
      console.log(`  ✗ ${platformTag} ${result.name} ${duration}`);
      printResultAttachments(result);
    },

    onRunComplete(summary) {
      console.log("");

      // Group results by platform
      const byPlatform = new Map<Platform, FlowResult[]>();
      for (const r of summary.results) {
        const list = byPlatform.get(r.platform) ?? [];
        list.push(r);
        byPlatform.set(r.platform, list);
      }

      // Platform summary lines
      const driverNames: Record<Platform, string> = {
        web: "Playwright",
        android: "UiAutomator2",
        ios: "WebDriverAgent",
      };

      for (const [platform, results] of byPlatform) {
        const passed = results.filter((r) => r.status === "passed").length;
        const total = results.length;
        const symbols = results.map((r) => (r.status === "passed" ? "✓" : "✗")).join("");
        const label = `${platform} (${driverNames[platform]})`;
        const duration = Math.max(...results.map((r) => r.durationMs));
        console.log(`${label.padEnd(25)} ${symbols}  ${passed}/${total} passed (${(duration / 1000).toFixed(1)}s)`);
      }

      // Failures detail
      const failures = summary.results.filter((r) => r.status === "failed");
      if (failures.length > 0) {
        console.log("\n--- Failures ---");
        for (const f of failures) {
          console.log(`✗ [${f.platform}] ${f.name}`);
          if (f.error) {
            console.log(`  ${f.error.message}`);
          }
        }
      }

      // Final summary
      console.log(
        `\n${summary.passed}/${summary.total} passed, ${summary.failed} failed (${(summary.durationMs / 1000).toFixed(1)}s)`,
      );
    },
  };
}
