import type { DigitalTwinView } from "../../product-modes/digital-twin/access";

type DigitalTwinSubheaderLabelKey =
  | "digitalTwin.subheader.live.overview"
  | "digitalTwin.subheader.live.assets"
  | "digitalTwin.subheader.live.overviewItems.operations"
  | "digitalTwin.subheader.live.overviewItems.map"
  | "digitalTwin.subheader.live.assetsItems.all"
  | "digitalTwin.subheader.live.assetsItems.lines"
  | "digitalTwin.subheader.live.assetsItems.vegetation"
  | "digitalTwin.subheader.scenarios.library"
  | "digitalTwin.subheader.scenarios.drafts"
  | "digitalTwin.subheader.scenarios.templates"
  | "digitalTwin.subheader.scenarios.libraryItems.all"
  | "digitalTwin.subheader.scenarios.libraryItems.recent"
  | "digitalTwin.subheader.scenarios.libraryItems.shared"
  | "digitalTwin.subheader.scenarios.draftItems.mine"
  | "digitalTwin.subheader.scenarios.draftItems.review"
  | "digitalTwin.subheader.scenarios.templateItems.all"
  | "digitalTwin.subheader.scenarios.templateItems.weather"
  | "digitalTwin.subheader.scenarios.templateItems.vegetation"
  | "digitalTwin.subheader.runs.active"
  | "digitalTwin.subheader.runs.history"
  | "digitalTwin.subheader.runs.replay"
  | "digitalTwin.subheader.runs.activeItems.all"
  | "digitalTwin.subheader.runs.activeItems.autonomous"
  | "digitalTwin.subheader.runs.activeItems.manual"
  | "digitalTwin.subheader.runs.historyItems.all"
  | "digitalTwin.subheader.runs.historyItems.completed"
  | "digitalTwin.subheader.runs.historyItems.failed"
  | "digitalTwin.subheader.runs.replayItems.recent"
  | "digitalTwin.subheader.runs.replayItems.saved";

export interface DigitalTwinSubheaderMenuItem {
  id: string;
  labelKey: DigitalTwinSubheaderLabelKey;
}

export interface DigitalTwinSubheaderOption {
  id: string;
  labelKey: DigitalTwinSubheaderLabelKey;
  items: readonly DigitalTwinSubheaderMenuItem[];
}

export const DIGITAL_TWIN_FOOTER_ACTIONS = [
  { id: "alerts", labelKey: "digitalTwin.subheader.live.alerts" },
] as const;

export const DIGITAL_TWIN_SUBHEADER_OPTIONS: Record<
  DigitalTwinView,
  readonly DigitalTwinSubheaderOption[]
> = {
  live: [
    {
      id: "overview",
      labelKey: "digitalTwin.subheader.live.overview",
      items: [
        {
          id: "operations",
          labelKey: "digitalTwin.subheader.live.overviewItems.operations",
        },
        { id: "map", labelKey: "digitalTwin.subheader.live.overviewItems.map" },
      ],
    },
    {
      id: "assets",
      labelKey: "digitalTwin.subheader.live.assets",
      items: [
        { id: "all", labelKey: "digitalTwin.subheader.live.assetsItems.all" },
        {
          id: "lines",
          labelKey: "digitalTwin.subheader.live.assetsItems.lines",
        },
        {
          id: "vegetation",
          labelKey: "digitalTwin.subheader.live.assetsItems.vegetation",
        },
      ],
    },
  ],
  scenarios: [
    {
      id: "library",
      labelKey: "digitalTwin.subheader.scenarios.library",
      items: [
        {
          id: "all",
          labelKey: "digitalTwin.subheader.scenarios.libraryItems.all",
        },
        {
          id: "recent",
          labelKey: "digitalTwin.subheader.scenarios.libraryItems.recent",
        },
        {
          id: "shared",
          labelKey: "digitalTwin.subheader.scenarios.libraryItems.shared",
        },
      ],
    },
    {
      id: "drafts",
      labelKey: "digitalTwin.subheader.scenarios.drafts",
      items: [
        {
          id: "mine",
          labelKey: "digitalTwin.subheader.scenarios.draftItems.mine",
        },
        {
          id: "review",
          labelKey: "digitalTwin.subheader.scenarios.draftItems.review",
        },
      ],
    },
    {
      id: "templates",
      labelKey: "digitalTwin.subheader.scenarios.templates",
      items: [
        {
          id: "all",
          labelKey: "digitalTwin.subheader.scenarios.templateItems.all",
        },
        {
          id: "weather",
          labelKey: "digitalTwin.subheader.scenarios.templateItems.weather",
        },
        {
          id: "vegetation",
          labelKey: "digitalTwin.subheader.scenarios.templateItems.vegetation",
        },
      ],
    },
  ],
  runs: [
    {
      id: "active",
      labelKey: "digitalTwin.subheader.runs.active",
      items: [
        { id: "all", labelKey: "digitalTwin.subheader.runs.activeItems.all" },
        {
          id: "autonomous",
          labelKey: "digitalTwin.subheader.runs.activeItems.autonomous",
        },
        {
          id: "manual",
          labelKey: "digitalTwin.subheader.runs.activeItems.manual",
        },
      ],
    },
    {
      id: "history",
      labelKey: "digitalTwin.subheader.runs.history",
      items: [
        { id: "all", labelKey: "digitalTwin.subheader.runs.historyItems.all" },
        {
          id: "completed",
          labelKey: "digitalTwin.subheader.runs.historyItems.completed",
        },
        {
          id: "failed",
          labelKey: "digitalTwin.subheader.runs.historyItems.failed",
        },
      ],
    },
    {
      id: "replay",
      labelKey: "digitalTwin.subheader.runs.replay",
      items: [
        {
          id: "recent",
          labelKey: "digitalTwin.subheader.runs.replayItems.recent",
        },
        {
          id: "saved",
          labelKey: "digitalTwin.subheader.runs.replayItems.saved",
        },
      ],
    },
  ],
};

export function getDigitalTwinSubheaderSelectionKey(
  optionId: string,
  itemId: string
): string {
  return `${optionId}.${itemId}`;
}

export function getDefaultDigitalTwinSubheaderOption(
  view: DigitalTwinView
): string {
  const option = DIGITAL_TWIN_SUBHEADER_OPTIONS[view][0];
  return getDigitalTwinSubheaderSelectionKey(option.id, option.items[0].id);
}
