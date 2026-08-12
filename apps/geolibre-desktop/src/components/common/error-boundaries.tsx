import {
  Button,
  ErrorBoundary,
  toast,
  type ErrorBoundaryFallbackProps,
} from "@geolibre/ui";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import type { ErrorInfo, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { appendDiagnostic } from "../../lib/diagnostics";

/**
 * Records a boundary-caught error in the diagnostics panel so it is visible to
 * the user (and copyable for bug reports) instead of only landing in the
 * console.
 *
 * Note: in development React re-throws boundary-caught errors as a synthetic
 * `window.error` event, which `installDiagnosticsCapture` also records — so
 * each error shows up twice in the Diagnostics panel in dev mode. Production
 * builds (where React does not re-throw) record it once.
 */
function reportBoundaryError(label: string, error: Error, info?: ErrorInfo): void {
  appendDiagnostic({
    category: "runtime",
    level: "error",
    message: `${label} crashed: ${error.message}`,
    detail: [error.stack, info?.componentStack]
      .filter((part): part is string => Boolean(part))
      .join("\n\n"),
    source: label,
  });
}

export { reportBoundaryError };

function reportAndToastBoundaryError(label: string, error: Error, info?: ErrorInfo): void {
  reportBoundaryError(label, error, info);
  toast.error(`${label} failed`, {
    description: error.message || String(error),
    duration: 8_000,
  });
}

/**
 * Top-level boundary. A render error anywhere not caught by a more specific
 * boundary is reported in a toast and diagnostics instead of rendering a
 * full-page recovery screen. Routine workspace failures are isolated by the
 * section boundaries below, keeping the rest of the shell available.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, info) => reportAndToastBoundaryError("Application", error, info)}
      fallback={() => null}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Boundary for an individual region of the shell (a panel, the toolbar, the map
 * surface, etc.). A crash in one region shows a compact inline notice and a
 * retry button while the rest of the app keeps working. `resetKeys` lets the
 * region recover automatically when its driving inputs change.
 */
export function SectionErrorBoundary({
  label,
  children,
  fallbackClassName,
  resetKeys,
  onClose,
}: {
  label: string;
  children: ReactNode;
  /**
   * Class applied to the error fallback container. It has no effect during
   * normal rendering — the boundary injects no wrapper around its children.
   */
  fallbackClassName?: string;
  resetKeys?: readonly unknown[];
  /**
   * When the crashed section owns its own close control (a dockable panel whose
   * header is replaced by this fallback), pass a closer so the user is not
   * stranded when Retry keeps re-throwing — the fallback then offers a "Close"
   * action that dismisses the section entirely.
   */
  onClose?: () => void;
}) {
  return (
    <ErrorBoundary
      resetKeys={resetKeys}
      onError={(error, info) => reportAndToastBoundaryError(label, error, info)}
      fallback={({ reset }) => (
        <SectionErrorFallback
          label={label}
          reset={reset}
          className={fallbackClassName}
          onClose={onClose}
        />
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/**
 * Boundary for a non-essential overlay (e.g. a badge floating over the map): on
 * error it renders nothing rather than a visible fallback, but still reports to
 * diagnostics. Use it so a faulty overlay can never take down the surrounding
 * UI it shares a subtree with.
 */
export function SilentErrorBoundary({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ErrorBoundary
      onError={(error, info) => reportAndToastBoundaryError(label, error, info)}
      fallback={() => null}
    >
      {children}
    </ErrorBoundary>
  );
}

function SectionErrorFallback({
  label,
  reset,
  className,
  onClose,
}: Pick<ErrorBoundaryFallbackProps, "reset"> & {
  label: string;
  className?: string;
  onClose?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="alert"
      className={`flex flex-col items-center justify-center gap-3 p-4 text-center ${
        className ?? ""
      }`}
    >
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm text-muted-foreground">
        {label} failed to render. The rest of GeoLibre is still available.
      </p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={reset}>
          <RefreshCw className="h-4 w-4" />
          {t("common.retry")}
        </Button>
        {onClose ? (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
            {t("common.close")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
