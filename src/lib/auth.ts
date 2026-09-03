const ADMIN_COOKIE = "soda_admin";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export { ADMIN_COOKIE };

function secret(): string | null {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return null;
  return `${process.env.ADMIN_SESSION_SECRET ?? "soda-admin"}:${password}`;
}

export function isAdminConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(message: string, key: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const buf = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createAdminCookieValue(): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const payload = String(Date.now() + MAX_AGE_SECONDS * 1000);
  const sig = await hmacHex(payload, key);
  return `${payload}.${sig}`;
}

export async function verifyAdminCookieValue(value: string | undefined | null): Promise<boolean> {
  if (!value || !value.includes(".")) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const key = secret();
  if (!key) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = await hmacHex(payload, key);
  return safeEqual(sig, expected);
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function checkAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return safeEqual(password, expected);
}
