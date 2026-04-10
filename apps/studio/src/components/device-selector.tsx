import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/client";
import { Monitor, Smartphone, Tablet } from "lucide-react";
import { studioTestId } from "@/lib/test-ids";

type Platform = "web" | "android" | "ios";

interface DeviceSelectorProps {
  platform: Platform;
  deviceId: string | undefined;
  onSelect: (platform: Platform, deviceId: string | undefined) => void;
  testIdPrefix?: string;
}

const platformIcons: Record<Platform, React.ReactNode> = {
  web: <Monitor className="w-4 h-4" />,
  android: <Smartphone className="w-4 h-4" />,
  ios: <Tablet className="w-4 h-4" />,
};

export function DeviceSelector({
  platform,
  deviceId,
  onSelect,
  testIdPrefix,
}: DeviceSelectorProps) {
  const testIdBase = testIdPrefix ?? "studio-device";
  const { data: devices, isLoading } = useQuery(orpc.devices.list.queryOptions({ input: {} }));

  const filteredDevices = (devices ?? []).filter((d) => d.platform === platform);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === "") {
      onSelect(platform, undefined);
      return;
    }
    onSelect(platform, value);
  };

  return (
    <div className="flex items-center gap-2" {...studioTestId(`${testIdBase}-${platform}`)}>
      <span
        className="text-zinc-400 text-sm flex items-center gap-1.5"
        {...studioTestId(`${testIdBase}-label-${platform}`)}
      >
        {platformIcons[platform]}
        Device:
      </span>
      <select
        value={deviceId ?? ""}
        onChange={handleChange}
        disabled={isLoading}
        {...studioTestId(`${testIdBase}-select-${platform}`)}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {isLoading && <option>Loading...</option>}
        {!isLoading && (
          <>
            <option value="">default</option>
            {filteredDevices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
