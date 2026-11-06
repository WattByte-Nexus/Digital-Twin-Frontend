import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@geolibre/ui";
import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { ManagementError, managementRequest } from "./client";

export type RunAction = (path: string, data: unknown) => Promise<boolean>;
export function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
  ...props
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        {...props}
      />
    </div>
  );
}
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? (
          <CardDescription className="max-w-prose">
            {description}
          </CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}
export function useManagementQuery<T>(path: string, revision: number) {
  const [state, setState] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    setState({ loading: true });
    void managementRequest<T>(path, { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setState({ data, loading: false });
      },
      (error) => {
        if (!controller.signal.aborted)
          setState({
            error:
              error instanceof Error
                ? error.message
                : "Unable to load this workspace.",
            loading: false,
          });
      }
    );
    return () => controller.abort();
  }, [path, revision]);
  return state;
}
export function QueryState({
  loading,
  error,
  empty,
  onRefresh,
}: {
  loading: boolean;
  error?: string;
  empty?: boolean;
  onRefresh: () => void;
}) {
  if (loading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Loading current records…
      </p>
    );
  if (error)
    return (
      <div role="alert" className="space-y-3">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={onRefresh}>
          Reload records
        </Button>
      </div>
    );
  return empty ? (
    <p className="text-sm text-muted-foreground">No records yet.</p>
  ) : null;
}
function actionDescription(path: string): string {
  if (path.endsWith("/resend-invitation")) return "Resend invitation";
  if (path.endsWith("/state")) return "Change account suspension";
  if (path.endsWith("/delete")) return "Delete record";
  if (path.endsWith("/provision")) return "Provision trial account";
  if (path.endsWith("/decision")) return "Record review decision";
  if (path.endsWith("/claim")) return "Claim application";
  if (path.endsWith("/release")) return "Release application";
  if (path.endsWith("/transfer")) return "Transfer application";
  const section = path.split("/")[1];
  return (
    (
      {
        staff: "Manage administrative staff",
        organizations: "Manage organization",
        plans: "Manage access plan",
        "tenant-users": "Manage product user",
        "tenant-departments": "Manage department",
        "trial-users": "Manage web trial",
        "organization-extensions": "Request organization extension",
        "trial-extensions": "Request trial extension",
      } as Record<string, string>
    )[section] ?? "Confirm account change"
  );
}

interface Intent {
  path: string;
  data: unknown;
  key: string;
  proof?: string;
}
export function useManagementActions(refresh: () => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState<Intent>();
  const [challenge, setChallenge] = useState<string>();
  const [verified, setVerified] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [code, setCode] = useState("");
  const execute = useCallback(
    async (intent: Intent): Promise<boolean> => {
      setBusy(true);
      setError(undefined);
      setSuccess(false);
      try {
        await managementRequest(intent.path, intent);
        setPending(undefined);
        setChallenge(undefined);
        setCode("");
        setVerified(false);
        setSuccess(true);
        refresh();
        return true;
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Unable to complete this action."
        );
        const verification =
          failure instanceof ManagementError && failure.status === 428;
        setRequiresVerification(verification);
        setPending(
          failure instanceof ManagementError &&
            [400, 401, 403, 409, 422].includes(failure.status)
            ? undefined
            : intent
        );
        if (verification) setVerified(false);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [refresh]
  );
  const run: RunAction = useCallback(
    (path, data) => execute({ path, data, key: crypto.randomUUID() }),
    [execute]
  );
  const startVerification = async () => {
    if (!pending) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await managementRequest<{ challenge_id: string }>(
        "/verification/start",
        { data: { action: `POST:/api/digital-twin/management${pending.path}` } }
      );
      setChallenge(result.challenge_id);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Unable to send verification."
      );
    } finally {
      setBusy(false);
    }
  };
  const verify = async () => {
    if (!pending || !challenge) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await managementRequest<{ action_proof: string }>(
        "/verification/verify",
        {
          data: {
            challenge_id: challenge,
            code,
            action: `POST:/api/digital-twin/management${pending.path}`,
          },
        }
      );
      setPending({ ...pending, proof: result.action_proof });
      setVerified(true);
      setCode("");
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Verification failed."
      );
    } finally {
      setBusy(false);
    }
  };
  const feedback = (
    <div className="space-y-3" aria-live="polite">
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {success ? (
        <p role="status" className="text-sm text-primary">
          Change confirmed. Current records have been refreshed.
        </p>
      ) : null}
      {pending ? (
        <Card surface="subtle">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm font-medium">
              Pending action: {actionDescription(pending.path)}
            </p>
            {requiresVerification && !challenge && !verified ? (
              <Button disabled={busy} onClick={() => void startVerification()}>
                Send email verification code
              </Button>
            ) : null}
            {challenge && !verified ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="action-verification">
                    Email verification code
                  </Label>
                  <Input
                    id="action-verification"
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                  />
                </div>
                <Button disabled={busy || !code} onClick={() => void verify()}>
                  Verify code
                </Button>
              </div>
            ) : null}
            <div className="flex gap-2">
              <Button
                disabled={busy || (requiresVerification && !verified)}
                onClick={() => void execute(pending)}
              >
                {verified ? "Confirm verified action" : "Retry same action"}
              </Button>
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setPending(undefined);
                  setChallenge(undefined);
                  setVerified(false);
                  setCode("");
                  setError(undefined);
                }}
              >
                Cancel pending action
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
  return { run, busy: busy || Boolean(pending), feedback };
}
export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form));
}
