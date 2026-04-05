interface Flow {
  name: string;
  tags: string[];
  platforms: string[];
}

interface FlowListProps {
  flows: Flow[];
  selectedFlows: Set<string>;
  onToggleFlow: (name: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}

export function FlowList({
  flows,
  selectedFlows,
  onToggleFlow,
  onSelectAll,
  onDeselectAll,
}: FlowListProps) {
  const allSelected = flows.length > 0 && flows.every((f) => selectedFlows.has(f.name));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-300">Flows</h2>
        <div className="flex gap-2">
          <button
            onClick={onSelectAll}
            disabled={allSelected}
            className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-default"
          >
            Select all
          </button>
          <button
            onClick={onDeselectAll}
            disabled={selectedFlows.size === 0}
            className="text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-default"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {flows.length === 0 && (
          <p className="text-sm text-zinc-500 px-2 py-4 text-center">No flows discovered</p>
        )}
        {flows.map((flow) => (
          <label
            key={flow.name}
            className="flex items-start gap-2.5 px-2 py-1.5 rounded hover:bg-zinc-800/50 cursor-pointer"
          >
            <input
              type="checkbox"
              checked={selectedFlows.has(flow.name)}
              onChange={() => onToggleFlow(flow.name)}
              className="mt-0.5 accent-emerald-500"
            />
            <div className="min-w-0">
              <span className="text-sm text-zinc-200 block truncate">{flow.name}</span>
              {flow.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {flow.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
