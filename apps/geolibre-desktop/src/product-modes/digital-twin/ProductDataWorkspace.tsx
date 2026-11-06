import { useThemeMode } from "../../hooks/useThemeMode";
import {
  defaultDigitalTwinApiUrl,
  DIGITAL_TWIN_ACCESS_INVALIDATED_EVENT,
} from "../../lib/digital-twin-api";
import { hasRegionAction, type DigitalTwinAccessContext } from "./access";
import { NativeDataAdministration } from "./ui/data/NativeDataAdministration";
/** Product data authoring remains separate from every account-administration role. */
export function ProductDataWorkspace({
  access,
  onClose,
}: {
  access: DigitalTwinAccessContext;
  onClose: () => void;
}) {
  const { themeMode } = useThemeMode();
  const refreshAccess = () =>
    window.dispatchEvent(new Event(DIGITAL_TWIN_ACCESS_INVALIDATED_EVENT));
  return (
    <main className="h-full bg-background text-foreground">
      <NativeDataAdministration
        apiUrl={defaultDigitalTwinApiUrl()}
        activeRegionId={access.regions[0]?.id ?? ""}
        activeRasterIds={[]}
        regions={access.regions.map((region) => ({
          ...region,
          description: region.name,
        }))}
        canPerform={(regionId, action) =>
          hasRegionAction(access, regionId, action)
        }
        canPreviewMap={false}
        theme={themeMode}
        onClose={onClose}
        onRegionsChanged={refreshAccess}
        onAssetsChanged={refreshAccess}
        onPointCloudSelected={() => {}}
        onRasterPrepared={() => {}}
      />
    </main>
  );
}
