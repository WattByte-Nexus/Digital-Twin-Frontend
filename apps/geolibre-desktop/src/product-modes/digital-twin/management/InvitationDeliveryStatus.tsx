import { Badge } from "@geolibre/ui";
import type { InvitationDelivery } from "./client";
const DELIVERY_LABELS: Record<InvitationDelivery["state"], string> = {
  pending: "Invitation queued",
  processing: "Delivery in progress",
  delivered: "Accepted by email provider",
  failed: "Invitation delivery failed",
  expired: "Invitation expired",
  "setup-in-progress": "Account setup in progress",
  "not-current": "Fresh invitation required",
};
/** Only safe delivery categories are exposed; provider acceptance is not inbox receipt. */
export function InvitationDeliveryStatus({
  delivery,
}: {
  delivery: InvitationDelivery | null;
}) {
  if (!delivery) return null;
  return (
    <div className="space-y-1 pt-2">
      <Badge variant="outline">{DELIVERY_LABELS[delivery.state]}</Badge>
      <p className="text-xs tabular-nums text-muted-foreground">
        Delivery attempts: {delivery.attempts}
      </p>
      {delivery.state === "delivered" ? (
        <p className="max-w-prose text-xs text-muted-foreground">
          Email provider accepted the invitation. Inbox delivery is not
          confirmed.
        </p>
      ) : null}
      {delivery.failure_code ? (
        <p className="max-w-prose text-xs text-destructive">
          {delivery.failure_code === "provider_unavailable"
            ? "The email service is unavailable. Resend the invitation to retry."
            : "The email service did not accept this invitation. Resend it to retry."}
        </p>
      ) : null}
      {delivery.state === "setup-in-progress" ? (
        <p className="max-w-prose text-xs text-muted-foreground">
          Invitation resend is unavailable while account setup is in progress.
        </p>
      ) : null}
    </div>
  );
}
