import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Reporter, FlowResult, RunSummary } from "./types.js";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildJUnitXML(summary: RunSummary): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(
    `<testsuites name="prov" tests="${summary.total}" failures="${summary.failed}" time="${(summary.durationMs / 1000).toFixed(3)}" timestamp="${timestamp}">`,
  );

  // Group by platform
  const byPlatform = new Map<string, FlowResult[]>();
  for (const r of summary.results) {
    const list = byPlatform.get(r.platform) ?? [];
    list.push(r);
    byPlatform.set(r.platform, list);
  }

  for (const [platform, results] of byPlatform) {
    const failed = results.filter((r) => r.status === "failed").length;
    const skipped = results.filter((r) => r.status === "skipped").length;
    const totalTime = results.reduce((sum, r) => sum + r.durationMs, 0);

    lines.push(
      `  <testsuite name="${escapeXml(platform)}" tests="${results.length}" failures="${failed}" skipped="${skipped}" time="${(totalTime / 1000).toFixed(3)}">`,
    );

    for (const result of results) {
      const time = (result.durationMs / 1000).toFixed(3);
      lines.push(
        `    <testcase name="${escapeXml(result.name)}" classname="prov.${escapeXml(platform)}" time="${time}">`,
      );

      if (result.status === "failed" && result.error) {
        lines.push(`      <failure message="${escapeXml(result.error.message)}">`);
        if (result.error.stack) {
          lines.push(escapeXml(result.error.stack));
        }
        lines.push(`      </failure>`);
      } else if (result.status === "skipped") {
        lines.push(`      <skipped/>`);
      }

      lines.push(`    </testcase>`);
    }

    lines.push(`  </testsuite>`);
  }

  lines.push(`</testsuites>`);
  return lines.join("\n");
}

export function createJUnitReporter(outputDir: string = "./prov-output"): Reporter {
  return {
    onRunComplete(summary) {
      const xml = buildJUnitXML(summary);
      mkdirSync(outputDir, { recursive: true });
      const outputPath = join(outputDir, "junit-report.xml");
      writeFileSync(outputPath, xml, "utf-8");
      console.log(`JUnit report written to ${outputPath}`);
    },
  };
}
