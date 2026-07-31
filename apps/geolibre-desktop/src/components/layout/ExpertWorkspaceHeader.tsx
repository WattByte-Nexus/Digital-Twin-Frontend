import { Button } from "@geolibre/ui";
import { ArrowLeft, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ExpertWorkspaceHeaderProps {
  onReturnToDigitalTwin: () => void;
}

/** Persistent mode marker above the existing GeoLibre toolbar in Expert GIS. */
export function ExpertWorkspaceHeader({ onReturnToDigitalTwin }: ExpertWorkspaceHeaderProps) {
  const { t } = useTranslation();

  return (
    <div
      aria-label={t("digitalTwin.expert.title")}
      className="flex h-9 shrink-0 items-center gap-2 border-b bg-muted/50 px-2.5"
      role="status"
    >
      <span className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs font-semibold text-foreground">
        <Wrench aria-hidden="true" className="h-3.5 w-3.5 text-primary" />
        {t("digitalTwin.expert.title")}
      </span>
      <span className="hidden truncate text-xs text-muted-foreground md:inline">
        {t("digitalTwin.expert.description")}
      </span>
      <Button
        className="ms-auto h-7 shrink-0 gap-1.5 px-2 text-xs"
        onClick={onReturnToDigitalTwin}
        size="sm"
        variant="ghost"
      >
        <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5" />
        {t("digitalTwin.expert.return")}
      </Button>
    </div>
  );
}
