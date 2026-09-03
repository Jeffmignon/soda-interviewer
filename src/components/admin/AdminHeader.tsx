"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminHeader() {
  const pathname = usePathname();
  const router = useRouter();
  if (pathname === "/admin/login") return null;

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-rule px-6 py-4 md:px-10">
      <Link href="/admin" className="text-xs tracking-[0.28em] uppercase">
        SODA desk
      </Link>
      <nav className="flex items-center gap-5 text-sm">
        <Link href="/admin" className="text-ink-soft hover:text-ink">
          Instances
        </Link>
        <Link href="/admin/clients" className="text-ink-soft hover:text-ink">
          Clients
        </Link>
        <button type="button" onClick={logout} className="text-ink-soft hover:text-ink">
          Sign out
        </button>
      </nav>
    </header>
  );
}
