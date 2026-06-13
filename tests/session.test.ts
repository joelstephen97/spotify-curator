import { describe, it, expect } from "vitest";
import { sealSession, unsealSession } from "@/lib/session";

const secret = "test-secret";

describe("session", () => {
  it("seals and unseals a payload", () => {
    const sealed = sealSession({ userId: "u1", accessToken: "at", expiresAt: 123 }, secret);
    expect(unsealSession(sealed, secret)).toEqual({
      userId: "u1",
      accessToken: "at",
      expiresAt: 123,
    });
  });

  it("rejects a tampered payload", () => {
    const sealed = sealSession({ userId: "u1", accessToken: "at", expiresAt: 123 }, secret);
    expect(unsealSession(sealed + "x", secret)).toBeNull();
  });

  it("rejects a value with the wrong secret", () => {
    const sealed = sealSession({ userId: "u1", accessToken: "at", expiresAt: 123 }, secret);
    expect(unsealSession(sealed, "other-secret")).toBeNull();
  });

  it("rejects a malformed value", () => {
    expect(unsealSession("garbage", secret)).toBeNull();
  });
});
