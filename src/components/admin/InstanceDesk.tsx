"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";
import { CopyButton } from "@/components/CopyButton";
import { MapGraph, MapTables } from "@/components/maps/MapGraph";
import type { InstanceBundle, Interview, Invitee } from "@/lib/types";

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((p) => p.text)
    .join("\n");
}

type InviteePack = Invitee & {
  url: string;
  email: { subject: string; body: string };
  linkedin: string;
};

export function InstanceDesk({ initial }: { initial: InstanceBundle }) {
  const [bundle, setBundle] = useState(initial);
  const [tab, setTab] = useState<"invitees" | "interviews" | "maps" | "soda">("invitees");
  const [selected, setSelected] = useState<string[]>(
    initial.interviews.filter((i) => i.cognitiveMap).map((i) => i.id),
  );
  const [invitees, setInvitees] = useState<InviteePack[]>([]);
  const [instanceUrl, setInstanceUrl] = useState("");
  const [instanceEmail, setInstanceEmail] = useState<{ subject: string; body: string } | null>(null);
  const [form, setForm] = useState({ name: "", email: "", linkedinUrl: "" });
  const [brief, setBrief] = useState({
    name: initial.instance.name,
    situationOfInterest: initial.instance.situationOfInterest,
    interviewReason: initial.instance.interviewReason,
    targetAudience: initial.instance.targetAudience,
    interviewGoal: initial.instance.interviewGoal,
  });

  async function refresh() {
    const res = await fetch(`/api/admin/instances/${bundle.instance.id}`);
    if (res.ok) setBundle(await res.json());
    const inv = await fetch(`/api/admin/instances/${bundle.instance.id}/invitees`);
    if (inv.ok) {
      const data = await inv.json();
      setInvitees(data.invitees);
      setInstanceUrl(data.instanceUrl);
      setInstanceEmail(data.instanceEmail);
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBrief(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/admin/instances/${bundle.instance.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(brief),
    });
    await refresh();
  }

  async function addInvitee(e: React.FormEvent) {
    e.preventDefault();
    await fetch(`/api/admin/instances/${bundle.instance.id}/invitees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", email: "", linkedinUrl: "" });
    await refresh();
  }

  const tabs = [
    ["invitees", "Invitees"],
    ["interviews", "Interviews"],
    ["maps", "Maps"],
    ["soda", "SODA desk"],
  ] as const;

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs tracking-[0.22em] uppercase text-ink-soft">
          {bundle.client.name} · {bundle.project.name}
        </p>
        <h1 className="mt-2 font-serif text-4xl">{bundle.instance.name}</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">{bundle.instance.situationOfInterest}</p>
      </header>

      <form onSubmit={saveBrief} className="grid gap-3 rounded-md border border-rule p-4 md:grid-cols-2">
        <label className="text-sm">
          Instance name
          <input
            className="mt-1 w-full border border-rule bg-[#fbf8f2] px-3 py-2"
            value={brief.name}
            onChange={(e) => setBrief({ ...brief, name: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Situation of interest
          <input
            className="mt-1 w-full border border-rule bg-[#fbf8f2] px-3 py-2"
            value={brief.situationOfInterest}
            onChange={(e) => setBrief({ ...brief, situationOfInterest: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Target audience
          <textarea
            required
            className="mt-1 w-full border border-rule bg-[#fbf8f2] px-3 py-2"
            rows={2}
            value={brief.targetAudience}
            onChange={(e) => setBrief({ ...brief, targetAudience: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Interview goal
          <textarea
            required
            className="mt-1 w-full border border-rule bg-[#fbf8f2] px-3 py-2"
            rows={3}
            value={brief.interviewGoal}
            onChange={(e) => setBrief({ ...brief, interviewGoal: e.target.value })}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Reason for the interview
          <textarea
            className="mt-1 w-full border border-rule bg-[#fbf8f2] px-3 py-2"
            rows={2}
            value={brief.interviewReason}
            onChange={(e) => setBrief({ ...brief, interviewReason: e.target.value })}
          />
        </label>
        <button className="w-fit rounded-full bg-ink px-4 py-2 text-sm text-[#f3eee4]" type="submit">
          Save brief
        </button>
      </form>

      <div className="flex gap-4 border-b border-rule">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`pb-2 text-sm ${tab === id ? "border-b-2 border-terracotta" : "text-ink-soft"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "invitees" ? (
        <section className="space-y-6">
          {instanceUrl ? (
            <div className="rounded-md border border-rule p-4">
              <p className="text-xs tracking-[0.2em] uppercase text-ink-soft">Generic instance link</p>
              <p className="mt-2 font-mono text-sm break-all">{instanceUrl}</p>
              <CopyButton text={instanceUrl} />
              {instanceEmail ? (
                <pre className="mt-3 whitespace-pre-wrap text-sm text-ink-soft">{instanceEmail.body}</pre>
              ) : null}
            </div>
          ) : null}

          <form onSubmit={addInvitee} className="grid gap-3 md:grid-cols-3">
            <input
              required
              placeholder="Name"
              className="border border-rule bg-[#fbf8f2] px-3 py-2"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              required
              type="email"
              placeholder="Email"
              className="border border-rule bg-[#fbf8f2] px-3 py-2"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              placeholder="LinkedIn URL (optional)"
              className="border border-rule bg-[#fbf8f2] px-3 py-2"
              value={form.linkedinUrl}
              onChange={(e) => setForm({ ...form, linkedinUrl: e.target.value })}
            />
            <button className="w-fit rounded-full bg-ink px-4 py-2 text-sm text-[#f3eee4]" type="submit">
              Add invitee
            </button>
          </form>
          <p className="text-sm text-ink-soft">
            Outreach is copy only — this app does not send email or LinkedIn messages.
          </p>
          <ul className="space-y-6">
            {invitees.map((person) => (
              <li key={person.id} className="rounded-md border border-rule p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-serif text-xl">{person.name}</h3>
                  <span className="text-sm text-ink-soft">{person.email}</span>
                </div>
                <p className="mt-2 font-mono text-xs break-all">{person.url}</p>
                <div className="mt-2 flex gap-4">
                  <CopyButton text={person.url} label="Copy link" />
                  <CopyButton
                    text={`Subject: ${person.email.subject}\n\n${person.email.body}`}
                    label="Copy email"
                  />
                  <CopyButton text={person.linkedin} label="Copy LinkedIn" />
                </div>
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-ink-soft">Email</summary>
                  <pre className="mt-2 whitespace-pre-wrap">{person.email.body}</pre>
                </details>
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-ink-soft">LinkedIn</summary>
                  <p className="mt-2">{person.linkedin}</p>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tab === "interviews" ? (
        <InterviewsPanel
          interviews={bundle.interviews}
          invitees={bundle.invitees}
          selected={selected}
          onToggle={(id) =>
            setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))
          }
        />
      ) : null}

      {tab === "maps" ? (
        <MapsPanel bundle={bundle} />
      ) : null}

      {tab === "soda" ? (
        <AdminChat instanceId={bundle.instance.id} interviewIds={selected} onDone={refresh} />
      ) : null}
    </div>
  );
}

function InterviewsPanel({
  interviews,
  invitees,
  selected,
  onToggle,
}: {
  interviews: Interview[];
  invitees: Invitee[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  if (interviews.length === 0) {
    return <p className="text-ink-soft">No interviews on this instance yet.</p>;
  }
  return (
    <ul className="space-y-6">
      {interviews.map((interview) => {
        const person = invitees.find((i) => i.id === interview.inviteeId);
        return (
          <li key={interview.id} className="rounded-md border border-rule p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.includes(interview.id)}
                disabled={!interview.cognitiveMap}
                onChange={() => onToggle(interview.id)}
              />
              Select for cause map
            </label>
            <h3 className="mt-2 font-serif text-2xl">{person?.name ?? "Unnamed guest"}</h3>
            <p className="text-sm text-ink-soft">
              {interview.status}
              {interview.completedAt ? ` · saved ${interview.completedAt}` : ""}
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer text-sm">Transcript</summary>
              <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap text-sm leading-6">
                {JSON.stringify(interview.messages, null, 2)}
              </pre>
            </details>
            {interview.cognitiveMap ? (
              <div className="mt-4 space-y-4">
                <MapGraph map={interview.cognitiveMap} />
                <MapTables map={interview.cognitiveMap} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-ink-soft">Cognitive map not stored yet.</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MapsPanel({ bundle }: { bundle: InstanceBundle }) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-serif text-2xl">Cause map</h2>
        {bundle.instance.causeMap ? (
          <div className="mt-4 space-y-4">
            <MapGraph map={bundle.instance.causeMap} />
            <MapTables map={bundle.instance.causeMap} />
          </div>
        ) : (
          <p className="mt-2 text-ink-soft">
            No cause map yet. Select completed interviews and ask SODA to weave one.
          </p>
        )}
      </section>
      <section>
        <h2 className="font-serif text-2xl">Priority spreadsheet</h2>
        {bundle.instance.analysis ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-ink-soft">
              {bundle.instance.analysis.mode === "by-eye" ? "By eye — " : "Structural — "}
              {bundle.instance.analysis.note}
            </p>
            <div className="flex gap-4 text-sm">
              <a
                className="underline"
                href={`/api/admin/instances/${bundle.instance.id}/spreadsheet`}
              >
                Download xlsx
              </a>
              <a
                className="underline"
                href={`/api/admin/instances/${bundle.instance.id}/spreadsheet?format=csv`}
              >
                Download csv
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="py-2">#</th>
                    <th>Statement</th>
                    <th>Type</th>
                    <th>Why</th>
                    <th>Authors</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.instance.analysis.rows.slice(0, 40).map((row) => (
                    <tr key={`${row.priority}-${row.statement}`} className="border-b border-rule align-top">
                      <td className="py-2 font-mono text-xs">{row.priority}</td>
                      <td className="py-2">{row.statement}</td>
                      <td className="py-2">{row.type}</td>
                      <td className="py-2 text-ink-soft">{row.why}</td>
                      <td className="py-2">{row.authors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-ink-soft">Analyze the cause map first, then download.</p>
        )}
      </section>
    </div>
  );
}

function AdminChat({
  instanceId,
  interviewIds,
  onDone,
}: {
  instanceId: string;
  interviewIds: string[];
  onDone: () => void;
}) {
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/admin/instances/${instanceId}/chat`,
        prepareSendMessagesRequest: ({ messages }) => ({
          body: { messages, interviewIds },
        }),
      }),
    [instanceId, interviewIds],
  );
  const { messages, sendMessage, status } = useChat({
    transport,
    onFinish: () => {
      void onDone();
    },
  });
  const streaming = status === "streaming" || status === "submitted";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_220px]">
      <div>
        <div className="min-h-[320px] space-y-4">
          {messages.map((m) => (
            <article key={m.id}>
              <p className="text-[11px] tracking-[0.2em] uppercase text-ink-soft">
                {m.role === "user" ? "Jeff" : "SODA"}
              </p>
              <p className="mt-1 whitespace-pre-wrap font-serif leading-7">{textOf(m)}</p>
            </article>
          ))}
        </div>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = input.trim();
            if (!next) return;
            sendMessage({ text: next });
            setInput("");
          }}
        >
          <input
            className="flex-1 border border-rule bg-[#fbf8f2] px-3 py-2"
            value={input}
            placeholder="Create the causal map / analyze it / make the spreadsheet"
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="rounded-full bg-ink px-4 py-2 text-sm text-[#f3eee4] disabled:opacity-50"
            disabled={streaming}
          >
            Send
          </button>
        </form>
      </div>
      <aside className="text-sm text-ink-soft">
        <p>{interviewIds.length} completed interview(s) selected for weaving.</p>
        <p className="mt-3">
          Cause maps stay on this instance. Analysis is structural, not RICE. Spreadsheet is a
          portfolio of options.
        </p>
      </aside>
    </div>
  );
}
