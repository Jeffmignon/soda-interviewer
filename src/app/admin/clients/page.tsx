"use client";

import { useEffect, useState } from "react";
import type { Client, Project } from "@/lib/types";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clientForm, setClientForm] = useState({ name: "", website: "", notes: "" });
  const [projectForm, setProjectForm] = useState({ clientId: "", name: "", description: "" });

  async function load() {
    const [c, p] = await Promise.all([
      fetch("/api/admin/clients").then((r) => r.json()),
      fetch("/api/admin/projects").then((r) => r.json()),
    ]);
    setClients(c.clients ?? []);
    setProjects(p.projects ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function addClient(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clientForm),
    });
    setClientForm({ name: "", website: "", notes: "" });
    await load();
  }

  async function addProject(e: React.FormEvent) {
    e.preventDefault();
    await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(projectForm),
    });
    setProjectForm({ ...projectForm, name: "", description: "" });
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-12">
      <header>
        <h1 className="font-serif text-4xl">Clients & projects</h1>
        <p className="mt-2 text-ink-soft">
          A client is the company being served. A project is the product, service, or situation of
          interest. Instances bind one of each.
        </p>
      </header>

      <form onSubmit={addClient} className="grid gap-3 rounded-md border border-rule p-5">
        <h2 className="font-serif text-2xl">New client</h2>
        <input
          required
          placeholder="Company name"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={clientForm.name}
          onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
        />
        <input
          placeholder="Website"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={clientForm.website}
          onChange={(e) => setClientForm({ ...clientForm, website: e.target.value })}
        />
        <textarea
          placeholder="Notes (optional)"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          rows={2}
          value={clientForm.notes}
          onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
        />
        <button className="w-fit rounded-full bg-ink px-5 py-2 text-sm text-[#f3eee4]">Save client</button>
      </form>

      <form onSubmit={addProject} className="grid gap-3 rounded-md border border-rule p-5">
        <h2 className="font-serif text-2xl">New project</h2>
        <select
          required
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={projectForm.clientId}
          onChange={(e) => setProjectForm({ ...projectForm, clientId: e.target.value })}
        >
          <option value="">Client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          required
          placeholder="Product / service / situation"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          value={projectForm.name}
          onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
        />
        <textarea
          placeholder="Description"
          className="border border-rule bg-[#fbf8f2] px-3 py-2"
          rows={2}
          value={projectForm.description}
          onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
        />
        <button className="w-fit rounded-full bg-ink px-5 py-2 text-sm text-[#f3eee4]">Save project</button>
      </form>

      <ul className="space-y-8">
        {clients.map((client) => (
          <li key={client.id}>
            <h3 className="font-serif text-2xl">{client.name}</h3>
            <p className="text-sm text-ink-soft">{client.website}</p>
            {client.notes ? <p className="mt-1 text-sm">{client.notes}</p> : null}
            <ul className="mt-3 list-disc pl-5 text-sm">
              {projects
                .filter((p) => p.clientId === client.id)
                .map((p) => (
                  <li key={p.id}>
                    {p.name}
                    {p.description ? ` — ${p.description}` : ""}
                  </li>
                ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
