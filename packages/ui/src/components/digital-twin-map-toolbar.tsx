import {
  Building2,
  Compass,
  Cloud,
  Image as ImageIcon,
  Layers3,
  Map,
  MapPin,
  Mountain,
  Route,
  Tag,
  TreePine,
  Waves,
} from "lucide-react";
import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "./menubar";
import { surfaceThemeClassName, type SurfaceTheme } from "../lib/surface-theme";

export interface DigitalTwinMapDisplaySettings {
  satellite: boolean;
  elevation: boolean;
  pointClouds: boolean;
  placeLabels: boolean;
  roads: boolean;
  roadLabels: boolean;
  poiLabels: boolean;
  water: boolean;
  waterLabels: boolean;
  boundaries: boolean;
  buildings: boolean;
  parks: boolean;
}

export const DEFAULT_DIGITAL_TWIN_MAP_DISPLAY_SETTINGS: DigitalTwinMapDisplaySettings =
  {
    satellite: true,
    elevation: true,
    pointClouds: true,
    placeLabels: true,
    roads: true,
    roadLabels: true,
    poiLabels: false,
    water: true,
    waterLabels: true,
    boundaries: true,
    buildings: true,
    parks: true,
  };

export interface DigitalTwinMapToolbarProps {
  theme: SurfaceTheme;
  value: DigitalTwinMapDisplaySettings;
  viewMode: "3d" | "plan";
  onValueChange: (value: DigitalTwinMapDisplaySettings) => void;
  onViewModeChange: (mode: "3d" | "plan") => void;
  onResetOrientation?: () => void;
  className?: string;
}

const contentClassName =
  "min-w-64 rounded-xl border-border bg-popover p-1.5 shadow-2xl";
const labelClassName =
  "pb-1 pt-2 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground";
const itemClassName = "min-h-9 rounded-lg";

/** Compact, keyboard-accessible controls for the Digital Twin map surface. */
export function DigitalTwinMapToolbar({
  theme,
  value,
  viewMode,
  onValueChange,
  onViewModeChange,
  onResetOrientation,
  className,
}: DigitalTwinMapToolbarProps) {
  const themedContentClassName = `${contentClassName} ${surfaceThemeClassName(
    theme
  )}`;

  const set = (key: keyof DigitalTwinMapDisplaySettings, checked: boolean) => {
    onValueChange({ ...value, [key]: checked });
  };

  return (
    <Menubar
      aria-label="Map display toolbar"
      className={`h-11 gap-0.5 rounded-none border-0 bg-transparent p-1 shadow-none ${
        className ?? ""
      }`}
    >
      <MenubarMenu>
        <MenubarTrigger className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-foreground">
          <ImageIcon className="size-3.5 text-muted-foreground" />
          Surface
        </MenubarTrigger>
        <MenubarContent align="end" className={themedContentClassName}>
          <MenubarLabel className={labelClassName}>Map surface</MenubarLabel>
          <MenubarCheckboxItem
            checked={value.satellite}
            className={itemClassName}
            onCheckedChange={(checked) => set("satellite", checked === true)}
          >
            <ImageIcon />
            Satellite imagery
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.elevation}
            className={itemClassName}
            onCheckedChange={(checked) => set("elevation", checked === true)}
          >
            <Mountain />
            Elevation
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.pointClouds}
            className={itemClassName}
            onCheckedChange={(checked) => set("pointClouds", checked === true)}
          >
            <Cloud />
            Point clouds
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-foreground">
          <Tag className="size-3.5 text-muted-foreground" />
          Labels
        </MenubarTrigger>
        <MenubarContent align="end" className={themedContentClassName}>
          <MenubarLabel className={labelClassName}>
            Reference labels
          </MenubarLabel>
          <MenubarCheckboxItem
            checked={value.placeLabels}
            className={itemClassName}
            onCheckedChange={(checked) => set("placeLabels", checked === true)}
          >
            <MapPin />
            City &amp; place names
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.roadLabels}
            className={itemClassName}
            onCheckedChange={(checked) => set("roadLabels", checked === true)}
          >
            <Route />
            Road names &amp; shields
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.poiLabels}
            className={itemClassName}
            onCheckedChange={(checked) => set("poiLabels", checked === true)}
          >
            <Layers3 />
            Points of interest
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.waterLabels}
            className={itemClassName}
            onCheckedChange={(checked) => set("waterLabels", checked === true)}
          >
            <Waves />
            Water names
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-foreground">
          <Layers3 className="size-3.5 text-muted-foreground" />
          Detail
        </MenubarTrigger>
        <MenubarContent align="end" className={themedContentClassName}>
          <MenubarLabel className={labelClassName}>Map detail</MenubarLabel>
          <MenubarCheckboxItem
            checked={value.roads}
            className={itemClassName}
            onCheckedChange={(checked) => set("roads", checked === true)}
          >
            <Route />
            Roads &amp; paths
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.water}
            className={itemClassName}
            onCheckedChange={(checked) => set("water", checked === true)}
          >
            <Waves />
            Water features
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.buildings}
            className={itemClassName}
            onCheckedChange={(checked) => set("buildings", checked === true)}
          >
            <Building2 />
            Buildings
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.parks}
            className={itemClassName}
            onCheckedChange={(checked) => set("parks", checked === true)}
          >
            <TreePine />
            Parks &amp; green space
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={value.boundaries}
            className={itemClassName}
            onCheckedChange={(checked) => set("boundaries", checked === true)}
          >
            <Map />
            Administrative boundaries
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger className="h-8 gap-1.5 rounded-lg px-2.5 text-xs text-foreground">
          <Mountain className="size-3.5 text-muted-foreground" />
          View
        </MenubarTrigger>
        <MenubarContent align="end" className={themedContentClassName}>
          <MenubarLabel className={labelClassName}>Perspective</MenubarLabel>
          <MenubarRadioGroup
            value={viewMode}
            onValueChange={(next) => onViewModeChange(next as "3d" | "plan")}
          >
            <MenubarRadioItem className={itemClassName} value="3d">
              <Mountain />
              Terrain 3D
            </MenubarRadioItem>
            <MenubarRadioItem className={itemClassName} value="plan">
              <Map />
              Plan view
            </MenubarRadioItem>
          </MenubarRadioGroup>
          <MenubarSeparator />
          <MenubarItem
            className={itemClassName}
            disabled={!onResetOrientation}
            onSelect={onResetOrientation}
          >
            <Compass />
            Reset north
            <MenubarShortcut>0°</MenubarShortcut>
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
