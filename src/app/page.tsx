import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-full">
      <header className="flex items-baseline justify-between px-6 py-5 md:px-12">
        <p className="text-xs tracking-[0.28em] uppercase text-ink-soft">SODA interviewer</p>
        <Link href="/admin" className="text-sm text-ink-soft underline-offset-4 hover:underline">
          Admin
        </Link>
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 pb-24 pt-16 md:px-12">
        <p className="text-xs tracking-[0.22em] uppercase text-terracotta">By invitation</p>
        <h1 className="font-serif text-5xl leading-[1.1] tracking-tight md:text-6xl">
          This conversation is private.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-ink-soft">
          If you were invited to a SODA interview, use the unique link you were sent. The interviewer
          already has the brief. You will not be asked which company, product, or service this is for.
        </p>
        <div className="rule" />
        <div className="grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="font-serif text-2xl">What this is</h2>
            <p className="mt-3 leading-7 text-ink-soft">
              A one-to-one interview that maps how you see a messy situation — in your words, as
              action, not as a survey. The notes are two-dimensional so connections stay visible.
            </p>
          </section>
          <section>
            <h2 className="font-serif text-2xl">What this is not</h2>
            <p className="mt-3 leading-7 text-ink-soft">
              There is no public list of interviews. There is no generic chatbot. Each instance
              belongs to one client and one project, and stays isolated.
            </p>
          </section>
        </div>
        <p className="text-sm text-ink-soft">
          Jeff Mignon · SODA interviews
        </p>
      </main>
    </div>
  );
}
