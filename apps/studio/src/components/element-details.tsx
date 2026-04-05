import { Copy, Check } from "lucide-react";
import { useState, useCallback } from "react";

interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ElementData {
  elementType?: string;
  resourceId?: string;
  text?: string;
  accessibilityLabel?: string;
  bounds: Bounds;
  enabled?: boolean;
  visible?: boolean;
  clickable?: boolean;
  focused?: boolean;
  id?: string;
}

interface Selector {
  strategy: string;
  value: string;
}

interface ElementDetailsProps {
  element: ElementData | undefined;
  selectors: Selector[];
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
      title="Copy to clipboard"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function PropertyRow({
  label,
  value,
}: {
  label: string;
  value: string | number | boolean | undefined;
}) {
  if (value === undefined || value === null) return null;
  const display = typeof value === "boolean" ? (value ? "true" : "false") : String(value);
  return (
    <div className="flex items-start gap-2 py-1">
      <span className="text-zinc-500 text-xs min-w-[120px] font-mono">{label}</span>
      <span className="text-zinc-200 text-xs font-mono break-all">{display}</span>
    </div>
  );
}

export function ElementDetails({ element, selectors }: ElementDetailsProps) {
  if (!element) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-500 text-sm p-4">
        <p>Click an element in the screenshot or tree to view its details</p>
      </div>
    );
  }

  const { bounds } = element;

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Element Properties</h3>
        <div className="space-y-0.5">
          <PropertyRow label="elementType" value={element.elementType} />
          <PropertyRow label="resourceId" value={element.resourceId} />
          <PropertyRow label="text" value={element.text} />
          <PropertyRow label="accessibilityLabel" value={element.accessibilityLabel} />
          <PropertyRow label="id" value={element.id} />
          <PropertyRow label="enabled" value={element.enabled} />
          <PropertyRow label="visible" value={element.visible} />
          <PropertyRow label="clickable" value={element.clickable} />
          <PropertyRow label="focused" value={element.focused} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-zinc-300 mb-2">Bounds</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <PropertyRow label="x" value={bounds.x} />
          <PropertyRow label="y" value={bounds.y} />
          <PropertyRow label="width" value={bounds.width} />
          <PropertyRow label="height" value={bounds.height} />
        </div>
      </div>

      {selectors.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Suggested Selectors</h3>
          <div className="space-y-1.5">
            {selectors.map((sel, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-zinc-800/50 rounded px-2 py-1.5 group"
              >
                <span className="text-zinc-500 text-xs min-w-[60px]">{sel.strategy}</span>
                <code className="text-xs text-emerald-400 font-mono flex-1 break-all">
                  {sel.value}
                </code>
                <CopyButton text={sel.value} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
