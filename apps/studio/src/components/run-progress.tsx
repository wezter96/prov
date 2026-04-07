import { useState } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  Circle,
  X,
  Trash2,
  ChevronDown,
  ChevronRight,
  Image as ImageIcon,
  Filter,
} from "lucide-react";

export interface Attachment {
  name: string;
  contentType: string;
  url: string;
}

export interface FlowResult {
  name: string;
  platform: string;
  status: "passed" | "failed" | "skipped";
  durationMs: number;
  error?: { message: string };
  attachments?: Attachment[];
  steps?: Array<{
    command: string;
    status: "passed" | "failed";
    durationMs: number;
    error?: string;
    attachments?: Attachment[];
  }>;
}

type Platform = "web" | "android" | "ios";
type StatusFilter = "passed" | "failed" | "skipped";

function ProgressBar({ platform, done, total }: { platform: string; done: number; total: number }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-zinc-400 w-16">{platform}</span>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-zinc-500 tabular-nums w-20 text-right">
        {done}/{total} ({pct}%)
      </span>
    </div>
  );
}

function FilterToggle({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-0.5 rounded text-xs transition-colors border ${
        active ? `${color} border-current` : "text-zinc-600 border-zinc-800 hover:text-zinc-400"
      }`}
    >
      {label}
    </button>
  );
}

interface RunProgressProps {
  results: FlowResult[];
  isRunning: boolean;
  onSelectResult?: (result: FlowResult) => void;
  onRemoveResult?: (index: number) => void;
  onClearResults?: () => void;
  selectedResult?: FlowResult;
  progress?: Record<string, { done: number; total: number }>;
}

function StatusIcon({ status }: { status: FlowResult["status"] | "running" }) {
  switch (status) {
    case "passed":
      return <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />;
    case "failed":
      return <XCircle className="w-4 h-4 text-red-400 shrink-0" />;
    case "running":
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin shrink-0" />;
    case "skipped":
      return <Circle className="w-4 h-4 text-zinc-500 shrink-0" />;
  }
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ScreenshotList({ attachments }: { attachments: Attachment[] }) {
  const images = attachments.filter((a) => a.contentType === "image/png");
  const [expanded, setExpanded] = useState<string | null>(null);

  if (images.length === 0) return null;

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {images.map((img, i) => (
          <button
            key={i}
            onClick={() => setExpanded(expanded === img.url ? null : img.url)}
            className="shrink-0 rounded border border-zinc-700 hover:border-zinc-500 transition-colors overflow-hidden"
          >
            <img
              src={img.url}
              alt={img.name}
              loading="lazy"
              className="h-20 w-auto object-contain bg-zinc-900"
            />
            <div className="text-[10px] text-zinc-500 px-1 py-0.5 truncate max-w-[100px]">
              {img.name}
            </div>
          </button>
        ))}
      </div>
      {expanded && (
        <div
          className="mt-2 rounded border border-zinc-700 overflow-hidden cursor-pointer"
          onClick={() => setExpanded(null)}
        >
          <img src={expanded} alt="Expanded screenshot" className="w-full h-auto bg-zinc-900" />
        </div>
      )}
    </div>
  );
}

function ResultDetails({ result }: { result: FlowResult }) {
  const statusColor =
    result.status === "passed"
      ? "text-emerald-400"
      : result.status === "failed"
        ? "text-red-400"
        : "text-zinc-500";

  return (
    <div className="p-3 space-y-3 border-t border-zinc-800 bg-zinc-800/20">
      <div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-400">{result.platform}</span>
          <span className={statusColor}>{result.status}</span>
          <span className="text-zinc-500">{formatDuration(result.durationMs)}</span>
        </div>
      </div>

      {result.error && (
        <div className="rounded border border-red-900/50 bg-red-950/30 p-2">
          <p className="text-xs font-medium text-red-400 mb-1">Error</p>
          <pre className="text-xs text-red-300 whitespace-pre-wrap break-words font-mono">
            {result.error.message}
          </pre>
        </div>
      )}

      {result.attachments && result.attachments.length > 0 && (
        <ScreenshotList attachments={result.attachments} />
      )}

      {result.steps && result.steps.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-400 mb-2">Steps</p>
          <div className="space-y-1">
            {result.steps.map((step, i) => (
              <div key={i}>
                <div className="flex items-start gap-2 px-2 py-1.5 rounded bg-zinc-800/40">
                  {step.status === "passed" ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-300 truncate">{step.command}</span>
                      {step.attachments && step.attachments.length > 0 && (
                        <ImageIcon className="w-3 h-3 text-zinc-500 shrink-0" />
                      )}
                      <span className="text-[10px] text-zinc-500 tabular-nums shrink-0">
                        {formatDuration(step.durationMs)}
                      </span>
                    </div>
                    {step.error && (
                      <p className="text-[11px] text-red-400 mt-0.5 break-words">{step.error}</p>
                    )}
                  </div>
                </div>
                {step.attachments && step.attachments.length > 0 && (
                  <div className="ml-6 mt-1 mb-2">
                    <ScreenshotList attachments={step.attachments} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RunProgress({
  results,
  isRunning,
  onSelectResult,
  onRemoveResult,
  onClearResults,
  selectedResult,
  progress,
}: RunProgressProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [platformFilter, setPlatformFilter] = useState<Set<Platform>>(new Set());
  const [statusFilter, setStatusFilter] = useState<Set<StatusFilter>>(new Set());

  const togglePlatformFilter = (p: Platform) => {
    setPlatformFilter((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  const toggleStatusFilter = (s: StatusFilter) => {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const toggleExpand = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const passed = results.filter((r) => r.status === "passed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  const filteredResults = results.filter((r) => {
    if (platformFilter.size > 0 && !platformFilter.has(r.platform as Platform)) return false;
    if (statusFilter.size > 0 && !statusFilter.has(r.status as StatusFilter)) return false;
    return true;
  });

  const resultPlatforms = [...new Set(results.map((r) => r.platform))] as Platform[];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
        <h2 className="text-sm font-semibold text-zinc-300">Results</h2>
        {(results.length > 0 || isRunning) && (
          <div className="flex items-center gap-3 text-xs">
            {isRunning && <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" />}
            {passed > 0 && <span className="text-emerald-400">{passed} passed</span>}
            {failed > 0 && <span className="text-red-400">{failed} failed</span>}
            {skipped > 0 && <span className="text-zinc-500">{skipped} skipped</span>}
            {results.length > 0 && !isRunning && onClearResults && (
              <button
                onClick={onClearResults}
                className="text-zinc-500 hover:text-zinc-300 transition-colors ml-1"
                title="Clear all results"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Per-platform progress bars */}
      {progress && Object.keys(progress).length > 0 && isRunning && (
        <div className="px-4 py-2 space-y-1.5 border-b border-zinc-800">
          {Object.entries(progress).map(([platform, { done, total }]) => (
            <ProgressBar key={platform} platform={platform} done={done} total={total} />
          ))}
        </div>
      )}

      {/* Filter controls */}
      {results.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-1.5 border-b border-zinc-800">
          <Filter className="w-3 h-3 text-zinc-500" />
          {resultPlatforms.map((p) => (
            <FilterToggle
              key={p}
              label={p}
              active={platformFilter.has(p)}
              onClick={() => togglePlatformFilter(p)}
              color="text-blue-400"
            />
          ))}
          {resultPlatforms.length > 0 && <span className="text-zinc-800">|</span>}
          {passed > 0 && (
            <FilterToggle
              label="passed"
              active={statusFilter.has("passed")}
              onClick={() => toggleStatusFilter("passed")}
              color="text-emerald-400"
            />
          )}
          {failed > 0 && (
            <FilterToggle
              label="failed"
              active={statusFilter.has("failed")}
              onClick={() => toggleStatusFilter("failed")}
              color="text-red-400"
            />
          )}
          {skipped > 0 && (
            <FilterToggle
              label="skipped"
              active={statusFilter.has("skipped")}
              onClick={() => toggleStatusFilter("skipped")}
              color="text-zinc-400"
            />
          )}
          {(platformFilter.size > 0 || statusFilter.size > 0) && (
            <button
              onClick={() => {
                setPlatformFilter(new Set());
                setStatusFilter(new Set());
              }}
              className="text-xs text-zinc-600 hover:text-zinc-400 ml-1"
            >
              clear
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {results.length === 0 && !isRunning && (
          <p className="text-sm text-zinc-500 px-2 py-4 text-center">No results yet</p>
        )}
        {results.length === 0 && isRunning && (
          <p className="text-sm text-zinc-500 px-2 py-4 text-center flex items-center justify-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Running tests...
          </p>
        )}
        <div className="divide-y divide-zinc-800/50">
          {filteredResults.map((result) => {
            const originalIndex = results.indexOf(result);
            const key = `${result.name}-${result.platform}-${originalIndex}`;
            const isExpanded = expanded.has(key);
            const isSelected =
              selectedResult?.name === result.name && selectedResult?.platform === result.platform;
            return (
              <div key={key}>
                <div
                  className={`group flex items-center gap-0.5 transition-colors ${
                    isSelected ? "bg-zinc-800" : "hover:bg-zinc-800/50"
                  }`}
                >
                  <button
                    onClick={() => {
                      onSelectResult?.(result);
                      toggleExpand(key);
                    }}
                    className="flex-1 flex items-center gap-2.5 px-2 py-2 text-left min-w-0"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
                    )}
                    <StatusIcon status={result.status} />
                    <span className="text-sm text-zinc-200 truncate flex-1">{result.name}</span>
                    <span className="text-xs text-zinc-500">{result.platform}</span>
                    <span className="text-xs text-zinc-500 tabular-nums">
                      {formatDuration(result.durationMs)}
                    </span>
                  </button>
                  {onRemoveResult && !isRunning && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveResult(originalIndex);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-2 mr-1 text-zinc-600 hover:text-zinc-300 transition-all shrink-0"
                      title="Remove result"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpanded ? "max-h-[1000px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <ResultDetails result={result} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
