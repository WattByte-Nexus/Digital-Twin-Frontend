import { Button } from "@geolibre/ui";
import { AlertTriangle, Loader2, LockKeyhole, Map } from "lucide-react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AccessResolutionError,
  createDevelopmentAccess,
  type AuthorizedLocationResolution,
  type DigitalTwinAccessContext,
  loadDigitalTwinAccess,
  resolveApplicationUrl,
  resolveAuthorizedLocation,
  resolveLandingLocation,
} from "./access";

interface AuthorizedRenderContext {
  access: DigitalTwinAccessContext;
  navigate: (location: string, options?: { replace?: boolean }) => void;
  route: Extract<AuthorizedLocationResolution, { kind: "allowed" }>;
}

interface DigitalTwinAccessBoundaryProps {
  children: (context: AuthorizedRenderContext) => ReactNode;
}

type BootstrapState =
  | { status: "loading" }
  | { status: "authenticated"; access: DigitalTwinAccessContext }
  | { status: "failed"; error: AccessResolutionError };

function currentLocation(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function accessEndpoint(): string {
  return resolveApplicationUrl(
    import.meta.env.VITE_DIGITAL_TWIN_ACCESS_URL,
    "api/digital-twin/access",
    import.meta.env.BASE_URL,
    document.baseURI,
  );
}

function signInLocation(): string {
  const url = new URL(
    resolveApplicationUrl(
      import.meta.env.VITE_DIGITAL_TWIN_SIGN_IN_URL,
      "api/digital-twin/sign-in",
      import.meta.env.BASE_URL,
      document.baseURI,
    ),
  );
  // Return paths contain stable route ids, never labels or cached content. Query
  // state is omitted at the unauthenticated boundary to avoid forwarding
  // arbitrary or stale values to the identity provider.
  url.searchParams.set("returnTo", window.location.pathname);
  return url.href;
}

function AccessFrame({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-xl bg-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Map aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-primary">WattByte Nexus</p>
            <h1 className="text-lg font-semibold">Digital Twin</h1>
          </div>
        </div>
        {children}
        <p className="mt-6 text-xs text-muted-foreground">
          Decision support only · Equipment controls unavailable
        </p>
      </section>
    </main>
  );
}

function LoadingAccess() {
  return (
    <AccessFrame>
      <div aria-live="polite" className="flex items-center gap-3" role="status">
        <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="font-medium">Resolving access</p>
          <p className="text-sm text-muted-foreground">
            Checking identity, organization, role, and assigned regions.
          </p>
        </div>
      </div>
    </AccessFrame>
  );
}

function FailedAccess({
  error,
  onRetry,
}: {
  error: AccessResolutionError;
  onRetry: () => void;
}) {
  const unauthenticated = error.kind === "unauthenticated";
  const unavailable = error.kind === "provider-unavailable";
  return (
    <AccessFrame>
      <div className="flex items-start gap-3">
        {unauthenticated ? (
          <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 text-primary" />
        ) : (
          <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 text-amber-600" />
        )}
        <div className="min-w-0">
          <h2 className="font-semibold">
            {unauthenticated
              ? "Sign in required"
              : unavailable
                ? "Identity provider unavailable"
                : "Access unavailable"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {unauthenticated
              ? "Sign in to resolve your organization, role, and assigned regions."
              : unavailable
                ? "Your protected workspace has not loaded. Check the connection and try again."
                : "Your account does not have access to this Digital Twin deployment."}
          </p>
          <div className="mt-4 flex gap-2">
            {unauthenticated ? (
              <Button asChild>
                <a href={signInLocation()}>Sign in</a>
              </Button>
            ) : null}
            {unavailable ? <Button onClick={onRetry}>Try again</Button> : null}
          </div>
        </div>
      </div>
    </AccessFrame>
  );
}

function DeniedRoute({ onReturn }: { onReturn?: () => void }) {
  return (
    <AccessFrame>
      <div className="flex items-start gap-3">
        <LockKeyhole aria-hidden="true" className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold">This location is not available</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The requested route is outside your assigned product, workspace, or region access.
          </p>
          {onReturn ? (
            <Button className="mt-4" onClick={onReturn}>
              Go to my start page
            </Button>
          ) : null}
        </div>
      </div>
    </AccessFrame>
  );
}

/**
 * Prevents every protected workspace hook and canvas from mounting until the
 * trusted application backend has resolved identity and access.
 */
export function DigitalTwinAccessBoundary({ children }: DigitalTwinAccessBoundaryProps) {
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [location, setLocation] = useState(() => currentLocation());
  const [bootstrap, setBootstrap] = useState<BootstrapState>({ status: "loading" });

  useEffect(() => {
    const syncLocation = () => setLocation(currentLocation());
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setBootstrap({ status: "loading" });

    const request =
      import.meta.env.DEV && import.meta.env.VITE_DIGITAL_TWIN_DEV_ACCESS !== "0"
        ? Promise.resolve(
            createDevelopmentAccess({
              regionId: import.meta.env.VITE_DIGITAL_TWIN_DEV_REGION_ID,
              regionName: import.meta.env.VITE_DIGITAL_TWIN_DEV_REGION_NAME,
            }),
          )
        : loadDigitalTwinAccess({ endpoint: accessEndpoint(), signal: controller.signal });

    void request.then(
      (access) => {
        if (!controller.signal.aborted) setBootstrap({ status: "authenticated", access });
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        setBootstrap({
          status: "failed",
          error:
            error instanceof AccessResolutionError
              ? error
              : new AccessResolutionError(
                  "provider-unavailable",
                  "Access resolution failed.",
                  { cause: error },
                ),
        });
      },
    );
    return () => controller.abort();
  }, [retryGeneration]);

  const navigate = useCallback(
    (nextLocation: string, options?: { replace?: boolean }) => {
      const next = new URL(nextLocation, window.location.href);
      if (next.origin !== window.location.origin) return;
      const relative = `${next.pathname}${next.search}${next.hash}`;
      if (options?.replace) window.history.replaceState(null, "", relative);
      else window.history.pushState(null, "", relative);
      setLocation(relative);
    },
    [],
  );

  const resolution = useMemo(() => {
    if (bootstrap.status !== "authenticated") return null;
    return resolveAuthorizedLocation(bootstrap.access, location);
  }, [bootstrap, location]);

  useEffect(() => {
    if (resolution?.kind === "redirect") navigate(resolution.location, { replace: true });
  }, [navigate, resolution]);

  if (bootstrap.status === "loading" || resolution?.kind === "redirect") {
    return <LoadingAccess />;
  }
  if (bootstrap.status === "failed") {
    return (
      <FailedAccess
        error={bootstrap.error}
        onRetry={() => setRetryGeneration((generation) => generation + 1)}
      />
    );
  }
  if (!resolution || resolution.kind === "denied") {
    const landing = resolveLandingLocation(bootstrap.access);
    return (
      <DeniedRoute
        onReturn={landing ? () => navigate(landing, { replace: true }) : undefined}
      />
    );
  }

  return children({ access: bootstrap.access, navigate, route: resolution });
}
