import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/crypto";

const key = randomBytes(32).toString("base64");

describe("secret encryption", () => {
  it("round-trips a token", () => {
    const envelope = encryptSecret("ghp_example_token_123", key);
    expect(envelope.startsWith("v1:")).toBe(true);
    expect(envelope).not.toContain("ghp_example");
    expect(decryptSecret(envelope, key)).toBe("ghp_example_token_123");
  });

  it("uses a fresh IV for every encryption", () => {
    expect(encryptSecret("same", key)).not.toBe(encryptSecret("same", key));
  });

  it("rejects tampered ciphertext", () => {
    const parts = encryptSecret("secret-value", key).split(":");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => decryptSecret(parts.join(":"), key)).toThrow();
  });

  it("rejects a wrong key", () => {
    const envelope = encryptSecret("secret-value", key);
    expect(() => decryptSecret(envelope, randomBytes(32).toString("base64"))).toThrow();
  });

  it("requires a 32-byte key", () => {
    expect(() => encryptSecret("x", Buffer.from("short").toString("base64"))).toThrow(/32 bytes/);
  });

  it("masks secrets for display", () => {
    expect(maskSecret("sk-abcdefghijkl")).toBe("••••ijkl");
    expect(maskSecret("short")).toBe("••••");
  });
});
