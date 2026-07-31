import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geolibre/ui";
import { Database } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ToolbarChrome } from "./constants";

interface AddDataMenuProps {
  chrome: ToolbarChrome;
  onOpenEarthEngineData: () => void;
}

/** The Add Data menu, intentionally focused on API-published Earth Engine data. */
export function AddDataMenu({ chrome, onOpenEarthEngineData }: AddDataMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={chrome.buttonClass}
          variant="ghost"
          size={chrome.buttonSize}
          aria-label={t("toolbar.menu.addData")}
        >
          <Database className={chrome.iconClassName} />
          {chrome.renderLabel(t("toolbar.menu.addData"))}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>{t("toolbar.menu.addData")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onOpenEarthEngineData}>Earth Engine data</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
