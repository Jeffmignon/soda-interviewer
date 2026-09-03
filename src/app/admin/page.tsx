"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Client, Instance, Project } from "@/lib/types";

export default function AdminHome() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [form, setForm] = useState({
    clientId: "",
    projectId: "",
    name: "",
    situationOfInterest: "",
    interviewReason: "",
    targetAudience: "",
    interviewGoal: "",
  });

  async function load() {
    const [c, p, i] = await Promise.all([
      fetch("/api/admin/clients").then((r) => r.json()),
      fetch("/api/admin/projects").then((r) => r.json()),
      fetch("/api/admin/instances").then((r) => r.json()),
    ]);
    setClients(c.clients ?? []);
    setProjects(p.projects ?? []);
    setInstances(i.instances ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  const projectsForClient = projects.filter((p) => p.clientId === form.clientId);

  async function createInstance(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/admin/instances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Could not create instance");
      return;
    }
    router.push(`/admin/instances/${data.instance.id}`);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <header>
        <p className="text-xs tracking-[0.22em] uppercase text-terracotta">Jeff Mignon</p>
        <h1 className="mt-2 font-serif text-4xl">Instances</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          One chatbot per client and project. Isolated transcripts, maps, and spreadsheets.
        </p>
      </header>

      <form onSubmit={createInstance} className="grid gap-3 rounded-md border border-rule p-5">
        <h2 className="font-serif text-2xl">New instance</h2>
        <select
          required
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={form.clientId}
          onChange={(e) => setForm({ ...form, clientId: e.target.value, projectId: "" })}
        >
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          required
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={form.projectId}
          onChange={(e) => setForm({ ...form, projectId: e.target.value })}
        >
          <option value="">Project</option>
          {projectsForClient.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Instance name (internal)"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          required
          placeholder="Situation of interest (named to the guest)"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={form.situationOfInterest}
          onChange={(e) => setForm({ ...form, situationOfInterest: e.target.value })}
        />
        <textarea
          required
          placeholder="Target audience (who we are interviewing) — e.g. HCPs who need to take CME"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          rows={2}
          value={form.targetAudience}
          onChange={(e) => setForm({ ...form, targetAudience: e.target.value })}
        />
        <textarea
          required
          placeholder="Interview goal (the only legitimate object of questions) — e.g. understand how we can improve CMEs to make them frictionless and personal"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          rows={3}
          value={form.interviewGoal}
          onChange={(e) => setForm({ ...form, interviewGoal: e.target.value })}
        />
        <textarea
          placeholder="Reason for the interview (interviewer only)"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          rows={2}
          value={form.interviewReason}
          onChange={(e) => setForm({ ...form, interviewReason: e.target.value })}
        />
        <p className="text-sm text-ink-soft">
          Audience and interview goal are required. They fence the conversation: the interviewer
          will not follow the guest off that map.
        </p>
        <button className="w-fit rounded-full bg-ink px-5 py-2 text-sm text-[#f3eee4]" type="submit">
          Create instance
        </button>
        <p className="text-sm text-ink-soft">
          Need a client first? <Link href="/admin/clients" className="underline">Clients & projects</Link>
        </p>
      </form>

      <ul className="divide-y divide-rule border-t border-rule">
        {instances.map((instance) => {
          const client = clients.find((c) => c.id === instance.clientId);
          const project = projects.find((p) => p.id === instance.projectId);
          return (
            <li key={instance.id} className="py-5">
              <Link href={`/admin/instances/${instance.id}`} className="block hover:text-terracotta">
                <h3 className="font-serif text-2xl">{instance.name}</h3>
                <p className="mt-1 text-sm text-ink-soft">
                  {client?.name} · {project?.name}
                </p>
                <p className="mt-1">{instance.situationOfInterest}</p>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
