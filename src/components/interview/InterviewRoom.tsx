"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { sessionClock } from "@/lib/soda/clock";

type PublicView = {
  kind: "instance" | "invitee" | "interview";
  situationOfInterest: string;
  inviteeName: string | null;
  status: string;
  completed: boolean;
  messages: UIMessage[];
  startedAt?: string | null;
};

function messageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

export function InterviewRoom({
  token,
  initial,
}: {
  token: string;
  initial: PublicView | null;
}) {
  const router = useRouter();
  const resume = Boolean(initial && initial.status === "in_progress" && initial.kind !== "instance");
  const [phase, setPhase] = useState<"gate" | "chat" | "saved">(
    initial?.completed ? "saved" : resume ? "chat" : "gate",
  );
  const [activeToken, setActiveToken] = useState(token);
  const [seedMessages, setSeedMessages] = useState<UIMessage[]>(initial?.messages ?? []);
  const [startedAt, setStartedAt] = useState<string | null>(initial?.startedAt ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/interview/${token}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not start.");
      if (data.completed) {
        setPhase("saved");
        return;
      }
      setSeedMessages((data.messages ?? []) as UIMessage[]);
      setActiveToken(data.token);
      setStartedAt(data.startedAt ?? new Date().toISOString());
      if (data.token !== token) {
        router.replace(`/i/${data.token}`);
      }
      setPhase("chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  if (!initial) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24">
        <p className="text-xs tracking-[0.22em] uppercase text-terracotta">SODA</p>
        <h1 className="mt-6 font-serif text-4xl">This link is not valid.</h1>
        <p className="mt-4 leading-7 text-ink-soft">
          Interview links are unique and private. If you were invited, use the link in your message.
        </p>
      </main>
    );
  }

  if (phase === "saved") {
    return (
      <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-24">
        <p className="text-xs tracking-[0.22em] uppercase text-sage">Saved</p>
        <h1 className="mt-6 font-serif text-4xl">Your interview is saved.</h1>
        <p className="mt-4 leading-7 text-ink-soft">
          Thank you. There is nothing else you need to do here. You can close this page.
        </p>
      </main>
    );
  }

  if (phase === "gate") {
    const guest = initial.inviteeName;
    return (
      <main className="mx-auto flex min-h-full max-w-xl flex-col justify-center px-6 py-24">
        <p className="text-xs tracking-[0.22em] uppercase text-terracotta">Private interview</p>
        <h1 className="mt-6 font-serif text-4xl leading-tight">
          {guest ? `${guest.split(" ")[0]}, this` : "This"} conversation is already briefed.
        </h1>
        <p className="mt-5 text-lg leading-8 text-ink-soft">
          We&apos;ll talk about {initial.situationOfInterest}. There isn&apos;t a questionnaire. This
          sitting runs about 30–40 minutes. When you&apos;re ready, begin.
        </p>
        {error ? <p className="mt-4 text-sm text-terracotta">{error}</p> : null}
        <button
          type="button"
          onClick={begin}
          disabled={busy}
          className="mt-10 w-fit rounded-full bg-ink px-6 py-3 text-sm text-[#f3eee4] hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Opening…" : "Begin the interview"}
        </button>
      </main>
    );
  }

  return (
    <ChatPane
      token={activeToken}
      initialMessages={seedMessages}
      situation={initial.situationOfInterest}
      guest={initial.inviteeName}
      startedAt={startedAt ?? initial.startedAt ?? new Date().toISOString()}
      onSaved={() => setPhase("saved")}
    />
  );
}

function ChatPane({
  token,
  initialMessages,
  situation,
  guest,
  startedAt,
  onSaved,
}: {
  token: string;
  initialMessages: UIMessage[];
  situation: string;
  guest: string | null;
  startedAt: string;
  onSaved: () => void;
}) {
  const [input, setInput] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const transport = useMemo(
    () => new DefaultChatTransport({ api: `/api/interview/${token}/chat` }),
    [token],
  );
  const { messages, sendMessage, status } = useChat({
    transport,
    messages: initialMessages,
  });
  const streaming = status === "submitted" || status === "streaming";
  const clock = sessionClock(startedAt, now);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!clock.mustHardStop) return;
    void finish(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock.mustHardStop]);

  async function finish(fromWall = false) {
    setFinishing(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/interview/${token}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, guestExplicitEnd: !fromWall }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.code === "invite_to_stay") {
        setNotice(data.message);
        return;
      }
      if (!res.ok) {
        setNotice(data.message || data.error || "This sitting still has time on the clock.");
        return;
      }
      onSaved();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not save the interview.");
    } finally {
      setFinishing(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-rule px-5 py-4 md:px-10">
        <div className="mx-auto flex max-w-3xl items-baseline justify-between gap-4">
          <div>
            <p className="text-[11px] tracking-[0.28em] uppercase text-ink-soft">SODA interview</p>
            <p className="mt-1 font-serif text-lg leading-snug">{situation}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-ink-soft">{guest ?? "Private"}</p>
            <p className="mt-1 text-xs text-ink-soft">{clock.remainingLabel}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-8 md:px-10">
        <div className="mx-auto flex max-w-3xl flex-col gap-8">
          {messages.map((message) => {
            const text = messageText(message);
            if (!text) return null;
            const mine = message.role === "user";
            return (
              <article key={message.id} className={mine ? "ml-8 md:ml-24" : "mr-8 md:mr-16"}>
                <p className="text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                  {mine ? "You" : "Interviewer"}
                </p>
                <p
                  className={
                    mine
                      ? "mt-2 whitespace-pre-wrap leading-7"
                      : "mt-2 whitespace-pre-wrap font-serif text-[1.15rem] leading-8"
                  }
                >
                  {text}
                </p>
              </article>
            );
          })}
          {streaming ? (
            <p className="font-serif italic text-ink-soft">Listening, then following the thread…</p>
          ) : null}
          {notice ? <p className="text-sm leading-6 text-ink-soft">{notice}</p> : null}
        </div>
      </div>

      <form
        className="border-t border-rule bg-[#e7dfd2]/70 px-5 py-4 md:px-10"
        onSubmit={(e) => {
          e.preventDefault();
          const next = input.trim();
          if (!next || streaming || clock.mustHardStop) return;
          sendMessage({ text: next });
          setInput("");
        }}
      >
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const next = input.trim();
                if (!next || streaming || clock.mustHardStop) return;
                sendMessage({ text: next });
                setInput("");
              }
            }}
            rows={3}
            disabled={clock.mustHardStop}
            placeholder="Speak in your words. Shift+Enter for a new line."
            className="w-full resize-none rounded-md border border-rule bg-[#fbf8f2] px-4 py-3 leading-7 outline-none focus:border-ink disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="submit"
              disabled={streaming || !input.trim() || clock.mustHardStop}
              className="rounded-full bg-ink px-5 py-2 text-sm text-[#f3eee4] disabled:opacity-50"
            >
              Send
            </button>
            <button
              type="button"
              onClick={() => void finish(false)}
              disabled={finishing || streaming}
              className="text-sm text-ink-soft underline-offset-4 hover:underline disabled:opacity-50"
            >
              {finishing ? "Saving your notes…" : "I need to stop — save what we have"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
