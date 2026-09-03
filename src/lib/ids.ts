import { randomBytes } from "node:crypto";

/** Short public-looking ids for records (not secret). */
export function createId(): string {
  return randomBytes(12).toString("hex");
}

/**
 * Unique unguessable URL token. 24 bytes → 32 chars of base64url.
 * Used on /i/[token] for instances, invitees, and interviews.
 */
export function createUnguessableToken(): string {
  return randomBytes(24).toString("base64url");
}

export function nowIso(): string {
  return new Date().toISOString();
}
