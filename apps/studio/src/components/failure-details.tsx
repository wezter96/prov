import { CheckCircle, XCircle } from "lucide-react";
import type { FlowResult } from "./run-progress";

interface FailureDetailsProps {
  result: FlowResult | undefined;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function FailureDetails({ result }: FailureDetailsProps) {
  if (!result) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-zinc-500">Select a result to view details</p>
      </div>
    );
  }

  const statusColor =
    result.status === "passed"
      ? "text-emerald-400"
      : result.status === "failed"
        ? "text-red-400"
        : "text-zinc-500";

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Details</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Header */}
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{result.name}</h3>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span className="text-zinc-400">{result.platform}</span>
            <span className={statusColor}>{result.status}</span>
            <span className="text-zinc-500">{formatDuration(result.durationMs)}</span>
          </div>
        </div>

        {/* Error message */}
        {result.error && (
          <div className="rounded border border-red-900/50 bg-red-950/30 p-3">
            <p className="text-xs font-medium text-red-400 mb-1">Error</p>
            <pre className="text-xs text-red-300 whitespace-pre-wrap break-words font-mono">
              {result.error.message}
            </pre>
          </div>
        )}

        {/* Steps breakdown */}
        {result.steps && result.steps.length > 0 && (
          <div>
            <p className="text-xs font-medium text-zinc-400 mb-2">Steps</p>
            <div className="space-y-1">
              {result.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded bg-zinc-800/40">
                  {step.status === "passed" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-300 truncate">{step.command}</span>
                      <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                        {formatDuration(step.durationMs)}
                      </span>
                    </div>
                    {step.error && (
                      <p className="text-[11px] text-red-400 mt-0.5 break-words">{step.error}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
