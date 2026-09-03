import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminCookieOptions, checkAdminPassword, createAdminCookieValue, isAdminConfigured } from "@/lib/auth";

export async function POST(request: Request) {
  if (!isAdminConfigured()) {
    return NextResponse.json(
      { error: "ADMIN_PASSWORD is not set on the server." },
      { status: 500 },
    );
  }
  const body = (await request.json()) as { password?: string };
  if (!body.password || !checkAdminPassword(body.password)) {
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }
  const value = await createAdminCookieValue();
  if (!value) {
    return NextResponse.json({ error: "Could not start session." }, { status: 500 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, value, adminCookieOptions());
  return res;
}
