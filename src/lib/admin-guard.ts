import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminCookieValue } from "@/lib/auth";

export async function isAdminSession(): Promise<boolean> {
  const jar = await cookies();
  return verifyAdminCookieValue(jar.get(ADMIN_COOKIE)?.value);
}

export async function adminGuard(): Promise<NextResponse | null> {
  if (!(await isAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
