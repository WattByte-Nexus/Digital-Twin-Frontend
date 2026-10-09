import { useId } from "react";
import { Map, Mountain } from "lucide-react";
import { SettingRow, SettingsCard } from "./settings-section";
import { Switch } from "./switch";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";
import type { DigitalTwinMapDisplaySettings } from "./digital-twin-map-toolbar";

const DISPLAY_GROUPS: ReadonlyArray<{
  title: string;
  description: string;
  settings: ReadonlyArray<{ key: keyof DigitalTwinMapDisplaySettings; label: string }>;
}> = [
  {
    title: "Map surface",
    description: "Choose the imagery and terrain shown on the map.",
    settings: [
      { key: "satellite", label: "Satellite imagery" },
      { key: "elevation", label: "Elevation" },
      { key: "pointClouds", label: "Point clouds" },
    ],
  },
  {
    title: "Reference labels",
    description: "Control which names and labels are visible.",
    settings: [
      { key: "placeLabels", label: "City & place names" },
      { key: "roadLabels", label: "Road names & route numbers" },
      { key: "poiLabels", label: "Points of interest" },
      { key: "waterLabels", label: "Water names" },
    ],
  },
  {
    title: "Map detail",
    description: "Show or hide geographic features and asset models.",
    settings: [
      { key: "roads", label: "Roads & paths" },
      { key: "water", label: "Water features" },
      { key: "buildings", label: "Building footprints" },
      { key: "assetTrees", label: "Tree models" },
      { key: "parks", label: "Parks & green space" },
      { key: "boundaries", label: "Administrative boundaries" },
    ],
  },
];

/** Full-page controls sharing the live map toolbar's values and callbacks. */
export function DigitalTwinMapSettings({
  value,
  viewMode,
  onValueChange,
  onViewModeChange,
}: {
  value: DigitalTwinMapDisplaySettings;
  viewMode: "3d" | "plan";
  onValueChange: (value: DigitalTwinMapDisplaySettings) => void;
  onViewModeChange: (mode: "3d" | "plan") => void;
}) {
  const id = useId();
  return (
    <div className="space-y-5">
      <SettingsCard
        title="Map perspective"
        description="Changes apply immediately to your current workspace."
      >
        <SettingRow label="View mode" labelId={`${id}-view`}>
          <ToggleGroup
            aria-labelledby={`${id}-view`}
            onValueChange={(next) => {
              if (next === "3d" || next === "plan") onViewModeChange(next);
            }}
            type="single"
            value={viewMode}
            variant="outline"
          >
            <ToggleGroupItem className="min-h-11 px-3" value="3d">
              <Mountain aria-hidden="true" />
              Terrain 3D
            </ToggleGroupItem>
            <ToggleGroupItem className="min-h-11 px-3" value="plan">
              <Map aria-hidden="true" />
              Plan view
            </ToggleGroupItem>
          </ToggleGroup>
        </SettingRow>
      </SettingsCard>
      {DISPLAY_GROUPS.map((group) => (
        <SettingsCard description={group.description} key={group.title} title={group.title}>
          {group.settings.map(({ key, label }) => (
            <SettingRow htmlFor={`${id}-${key}`} inline key={key} label={label}>
              <Switch
                checked={value[key]}
                className="relative before:absolute before:-inset-3 before:content-[''] motion-reduce:transition-none"
                id={`${id}-${key}`}
                onCheckedChange={(checked) => onValueChange({ ...value, [key]: checked })}
              />
            </SettingRow>
          ))}
        </SettingsCard>
      ))}
    </div>
  );
}
