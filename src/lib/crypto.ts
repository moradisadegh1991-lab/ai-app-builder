import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "./env";

// AES-256-GCM envelope: "v1:<iv>:<authTag>:<ciphertext>" (all base64url).
const VERSION = "v1";

function loadKey(raw: string): Buffer {
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes encoded as base64");
  }
  return key;
}

export function encryptSecret(plainText: string, rawKey: string = env.encryptionKey()): string {
  const key = loadKey(rawKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(envelope: string, rawKey: string = env.encryptionKey()): string {
  const [version, iv, tag, data] = envelope.split(":");
  if (version !== VERSION || !iv || !tag || data === undefined) {
    throw new Error("Unsupported secret envelope");
  }
  const decipher = createDecipheriv("aes-256-gcm", loadKey(rawKey), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

/** Shows only the last 4 characters of a secret, for display in settings. */
export function maskSecret(secret: string): string {
  if (secret.length <= 8) return "••••";
  return `••••${secret.slice(-4)}`;
}
