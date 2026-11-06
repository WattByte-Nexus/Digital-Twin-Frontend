import { Button, Input, Label, Textarea } from "@geolibre/ui";
import { useEffect, useId, useState } from "react";
import { digitalTwinAccountEndpoint } from "./client";
import { Field, formValues, Section } from "./shared";
export function PublicAccountEntry({ activate }: { activate: boolean }) {
  const [token] = useState(() =>
    activate
      ? new URLSearchParams(window.location.hash.slice(1)).get("token") ?? ""
      : ""
  );
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string>();
  const reasonId = useId();
  useEffect(() => {
    if (activate && window.location.hash)
      window.history.replaceState(null, "", window.location.pathname);
  }, [activate]);
  return (
    <main className="h-full overflow-y-auto [&_button:not([data-slot=checkbox])]:min-h-11 [&_button:not([data-slot=checkbox])]:min-w-11 bg-background p-6 text-foreground">
      <div className="mx-auto w-full max-w-xl">
        <Section
          title={
            activate
              ? "Activate your Digital Twin account"
              : "Request a Digital Twin trial"
          }
          description={
            activate
              ? "Set your password to accept this invitation. Login requires authenticator-app verification."
              : "Tell the trial team what you would like to evaluate. Submitting an application does not create an account."
          }
        >
          {success ? (
            <div className="space-y-4">
              <p role="status" className="text-sm">
                {activate
                  ? "Account activation confirmed. Sign in to continue."
                  : "Your request was received. The trial team will follow up by email."}
              </p>
              <Button asChild>
                <a href="/api/digital-twin/sign-in">Sign in</a>
              </Button>
            </div>
          ) : (
            <form
              className="grid gap-4"
              onSubmit={async (event) => {
                event.preventDefault();
                if (busy) return;
                const form = event.currentTarget;
                const values = formValues(form);
                if (activate && values.password !== values.confirm_password) {
                  setError("The passwords must match.");
                  return;
                }
                setBusy(true);
                setError(undefined);
                try {
                  const response = await fetch(
                    `${digitalTwinAccountEndpoint("public")}/${
                      activate ? "activate" : "trial-applications"
                    }`,
                    {
                      method: "POST",
                      credentials: "include",
                      cache: "no-store",
                      headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                      },
                      body: JSON.stringify(
                        activate ? { token, password: values.password } : values
                      ),
                    }
                  );
                  if (!response.ok)
                    throw new Error(
                      activate
                        ? "This invitation could not be activated. Check your password requirements or ask the administrator to resend the invitation."
                        : "Your request could not be submitted. Please try again."
                    );
                  form.reset();
                  setSuccess(true);
                } catch (failure) {
                  setError(
                    failure instanceof Error
                      ? failure.message
                      : "The service is unavailable."
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {activate ? (
                <>
                  <Field label="New password" name="password" type="password" />
                  <Field
                    label="Confirm password"
                    name="confirm_password"
                    type="password"
                  />
                  {!token ? (
                    <p role="alert" className="text-sm text-destructive">
                      The invitation token is missing. Open the complete link
                      from your invitation email.
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <Field label="First name" name="first_name" />
                  <Field label="Last name" name="last_name" />
                  <Field label="Email" name="email" type="email" />
                  <Field label="Organization" name="organization_name" />
                  <div className="grid gap-2">
                    <Label htmlFor={reasonId}>
                      What would you like to evaluate?
                    </Label>
                    <Textarea
                      id={reasonId}
                      name="reason"
                      maxLength={2000}
                      required
                    />
                  </div>
                  <div hidden aria-hidden="true">
                    <Label htmlFor="trial-website">Website</Label>
                    <Input
                      id="trial-website"
                      name="website"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </div>
                </>
              )}
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy || (activate && !token)}>
                {busy
                  ? "Submitting…"
                  : activate
                  ? "Activate account"
                  : "Submit trial request"}
              </Button>
            </form>
          )}
        </Section>
      </div>
    </main>
  );
}
