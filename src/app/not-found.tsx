import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-6 py-24">
      <p className="text-xs tracking-[0.22em] uppercase text-terracotta">SODA</p>
      <h1 className="mt-6 font-serif text-4xl">Nothing here.</h1>
      <p className="mt-4 leading-7 text-ink-soft">
        If you were invited to an interview, use the unique link you were sent.
      </p>
      <Link href="/" className="mt-8 inline-block text-sm underline">
        Home
      </Link>
    </main>
  );
}
