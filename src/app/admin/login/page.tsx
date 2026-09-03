"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not sign in.");
      return;
    }
    router.push(search.get("next") || "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="mt-10 space-y-4">
      <label className="block text-sm">
        Password
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full border border-rule bg-[#fbf8f2] px-3 py-2"
        />
      </label>
      {error ? <p className="text-sm text-terracotta">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-full bg-ink px-5 py-2 text-sm text-[#f3eee4] disabled:opacity-50"
      >
        {busy ? "Checking…" : "Enter"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <p className="text-xs tracking-[0.22em] uppercase text-terracotta">SODA desk</p>
      <h1 className="mt-4 font-serif text-4xl">Jeff Mignon</h1>
      <p className="mt-3 text-ink-soft">Password session. Nothing here is public.</p>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
