import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ManagementError,
  managementRequest,
  accountStatus,
  canResendInvitation,
} from "../apps/geolibre-desktop/src/product-modes/digital-twin/management/client";
describe("account management HTTP boundary", () => {
  it("sends cookie credentials, no-store, version and the same intent key/proof", async () => {
    const calls: { url: string; options?: RequestInit }[] = [];
    const fetchImpl = (async (url: string, options?: RequestInit) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ id: "user" }), { status: 200 });
    }) as typeof fetch;
    await managementRequest("/tenant-users/user/state", {
      baseUrl: "https://example.test",
      fetchImpl,
      data: { version: 7, suspended: true },
      key: "one-intent",
      proof: "one-proof",
    });
    assert.equal(
      calls[0].url,
      "https://example.test/api/digital-twin/management/tenant-users/user/state"
    );
    assert.equal(calls[0].options?.credentials, "include");
    assert.equal(calls[0].options?.cache, "no-store");
    const headers = new Headers(calls[0].options?.headers);
    assert.equal(headers.get("Idempotency-Key"), "one-intent");
    assert.equal(headers.get("X-Action-Proof"), "one-proof");
    assert.deepEqual(JSON.parse(String(calls[0].options?.body)), {
      version: 7,
      suspended: true,
    });
  });
  it("preserves verification/conflict status while discarding private error bodies", async () => {
    for (const status of [428, 409, 403, 503]) {
      await assert.rejects(
        managementRequest("/staff", {
          baseUrl: "https://example.test",
          fetchImpl: (async () =>
            new Response("private provider secret", {
              status,
            })) as typeof fetch,
        }),
        (error) => {
          assert.ok(error instanceof ManagementError);
          assert.equal(error.status, status);
          assert.doesNotMatch(error.message, /private provider secret/);
          return true;
        }
      );
    }
  });
  it("blocks resend during provider setup and permits retry after a safe delivery failure", () => {
    const account = {
      activation_state: "invited",
      suspended: false,
      invitation_delivery: {
        state: "failed",
        attempts: 1,
        failure_code: "provider_unavailable",
      },
    } as Parameters<typeof canResendInvitation>[0];
    assert.equal(canResendInvitation(account), true);
    assert.equal(
      canResendInvitation({
        ...account,
        invitation_delivery: {
          ...account.invitation_delivery!,
          state: "setup-in-progress",
        },
      }),
      false
    );
    assert.equal(canResendInvitation({ ...account, suspended: true }), false);
  });
  it("keeps invitation and suspension distinct", () => {
    assert.equal(
      accountStatus({
        activation_state: "invited",
        suspended: true,
      } as Parameters<typeof accountStatus>[0]),
      "Invitation pending · Suspended"
    );
    assert.equal(
      accountStatus({
        activation_state: "active",
        suspended: false,
      } as Parameters<typeof accountStatus>[0]),
      "Activated"
    );
  });
});
