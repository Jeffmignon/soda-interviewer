import { nowIso } from "@/lib/ids";
import {
  authorLabel,
  degrees,
  findDoubleHeadedPairs,
  heads,
  orphans,
  tails,
} from "@/lib/soda/map-schema";
import type { AnalysisRecord, CognitiveMap, MapNode, SpreadsheetRow } from "@/lib/types";

function reachable(
  map: CognitiveMap,
  start: string,
  direction: "up" | "down",
): Set<string> {
  const adj = new Map<string, string[]>();
  for (const n of map.nodes) adj.set(n.id, []);
  for (const e of map.edges) {
    if (direction === "up") adj.get(e.from)?.push(e.to);
    else adj.get(e.to)?.push(e.from);
  }
  const seen = new Set<string>();
  const stack = [start];
  while (stack.length) {
    const cur = stack.pop()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adj.get(cur) ?? []) {
      if (!seen.has(next)) stack.push(next);
    }
  }
  seen.delete(start);
  return seen;
}

function nodeById(map: CognitiveMap, id: string): MapNode | undefined {
  return map.nodes.find((n) => n.id === id);
}

function statement(map: CognitiveMap, id: string): string {
  return nodeById(map, id)?.statement ?? id;
}

/**
 * Structural SODA analysis. Not RICE. On small maps, mode is "by-eye".
 */
export function analyzeCauseMap(map: CognitiveMap): AnalysisRecord {
  const small = map.nodes.length < 20;
  const mode: AnalysisRecord["mode"] = small ? "by-eye" : "structural";
  const deg = degrees(map);
  const headNodes = heads(map);
  const tailNodes = tails(map);
  const orphanNodes = orphans(map);
  const loops = findDoubleHeadedPairs(map.edges);

  const totals = [...deg.values()].map((d) => d.total).sort((a, b) => a - b);
  const q75 = totals[Math.max(0, Math.floor(totals.length * 0.75))] ?? 0;

  const domainIds = map.nodes
    .filter((n) => {
      const d = deg.get(n.id)!;
      return d.in > 0 && d.out > 0 && d.total >= q75 && d.total >= 3;
    })
    .map((n) => n.id);

  const centralIds = map.nodes
    .map((n) => {
      const d = deg.get(n.id)!;
      const up = reachable(map, n.id, "up").size;
      const down = reachable(map, n.id, "down").size;
      return { id: n.id, score: d.total * (1 + up + down), in: d.in, out: d.out };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(3, Math.ceil(map.nodes.length / 8)))
    .map((n) => n.id);

  const keyIssueIds = [...new Set([...domainIds, ...centralIds])].filter((id) => {
    const d = deg.get(id)!;
    return d.in > 0 && d.out > 0;
  });

  const neighborSets = new Map<string, Set<string>>();
  for (const n of map.nodes) neighborSets.set(n.id, new Set());
  for (const e of map.edges) {
    neighborSets.get(e.from)?.add(e.to);
    neighborSets.get(e.to)?.add(e.from);
  }

  const assigned = new Set<string>();
  const clusters: string[][] = [];
  for (const n of map.nodes) {
    if (assigned.has(n.id)) continue;
    const group = [n.id];
    assigned.add(n.id);
    for (const other of map.nodes) {
      if (assigned.has(other.id)) continue;
      const a = neighborSets.get(n.id)!;
      const b = neighborSets.get(other.id)!;
      const inter = [...a].filter((x) => b.has(x)).length;
      const union = new Set([...a, ...b]).size || 1;
      if (inter / union >= 0.4) {
        group.push(other.id);
        assigned.add(other.id);
      }
    }
    if (group.length > 1) clusters.push(group);
  }

  const teardropNote = keyIssueIds
    .map((id) => {
      const down = [...reachable(map, id, "down")];
      return `${statement(map, id)} ← ${down.slice(0, 8).map((d) => statement(map, d)).join("; ") || "no in-chain"}`;
    })
    .join(" | ");

  const potent = tailNodes.filter((t) => {
    const up = reachable(map, t.id, "up");
    const hits = [...up].filter((id) => keyIssueIds.includes(id) || headNodes.some((h) => h.id === id));
    return hits.length >= 2;
  });

  const intoBusy = new Map<string, string[]>();
  for (const e of map.edges) {
    if (domainIds.includes(e.to) || keyIssueIds.includes(e.to)) {
      const list = intoBusy.get(e.to) ?? [];
      list.push(e.from);
      intoBusy.set(e.to, list);
    }
  }
  const compositeTails = tailNodes.filter((t) =>
    [...intoBusy.values()].some((group) => group.includes(t.id) && group.length > 1),
  );

  const used = new Set<string>();
  const rows: SpreadsheetRow[] = [];

  const push = (
    node: MapNode,
    type: SpreadsheetRow["type"],
    why: string,
    notes: string,
  ) => {
    if (used.has(node.id)) {
      const existing = rows.find((r) => r.statement === node.statement);
      if (existing) existing.notes = [existing.notes, notes].filter(Boolean).join(" ");
      return;
    }
    used.add(node.id);
    rows.push({
      priority: rows.length + 1,
      statement: node.statement,
      type,
      why,
      authors: authorLabel(node),
      notes,
    });
  };

  for (const n of headNodes) {
    const conflicts = map.edges
      .filter((e) => e.to === n.id && e.polarity === "negative")
      .map((e) => statement(map, e.from));
    push(
      n,
      "goal",
      "Head: no out-links — candidate goal, good in its own right until the owner says otherwise.",
      conflicts.length ? `Conflict / dilemma from: ${conflicts.join("; ")}` : "",
    );
  }

  for (const id of keyIssueIds) {
    const n = nodeById(map, id);
    if (!n) continue;
    const d = deg.get(id)!;
    const isBoth = domainIds.includes(id) && centralIds.includes(id);
    push(
      n,
      "key_issue",
      isBoth
        ? `Busy (in ${d.in}, out ${d.out}) and central in the whole structure — key issue.`
        : domainIds.includes(id)
          ? `Domain: busy in and out (in ${d.in}, out ${d.out}); natural breakpoint. Watch hot-topic false positives.`
          : `Central in the whole structure (degree ${d.total}).`,
      "",
    );
  }

  for (const n of potent) {
    const up = [...reachable(map, n.id, "up")].map((id) => statement(map, id));
    push(
      n,
      "potent_option",
      "Potent option: a tail whose consequences load several key issues or goals.",
      `Loads: ${up.slice(0, 6).join("; ")}`,
    );
  }

  for (const n of compositeTails) {
    push(
      n,
      "composite_tail",
      "Composite tail: an option feeding a busy node alongside other options — part of a portfolio, not a single winner.",
      "",
    );
  }

  for (const n of map.nodes) {
    if (used.has(n.id)) continue;
    const extra =
      orphanNodes.some((o) => o.id === n.id)
        ? "Orphan — unlinked; may be a missing means–ends question."
        : "";
    push(n, "other", "On the map; not a head, key issue, or potent option by structure.", extra);
  }

  const goalNote = headNodes.length
    ? `Candidate goals (heads): ${headNodes.map((n) => n.statement).join("; ")}.`
    : "No heads yet — the map may be a cycle or still too thin.";

  return {
    createdAt: nowIso(),
    mode,
    note: small
      ? "Small map: goals, domain, and teardrops are read by eye. Degree numbers are shown as a sketch, not as software metrics to trust."
      : "Priorities come from structure (heads → domain → central → clusters → teardrops → potent options). This is a portfolio, not a single winner. Not RICE.",
    goalSystem: `${goalNote} Name conflicts rather than averaging them.${
      loops.length ? ` Watch possible false loops: ${loops.length} opposing pair(s).` : ""
    }`,
    domain: domainIds.length
      ? domainIds.map((id) => statement(map, id)).join("; ")
      : "No clear domain nodes (busy in and out) — by eye, look for natural breakpoints.",
    central: centralIds.length
      ? centralIds.map((id) => statement(map, id)).join("; ")
      : "Centrality is weak on this map; do not fake a key issue.",
    clusters: clusters.length
      ? clusters.map((c) => c.map((id) => statement(map, id)).join(" / ")).join(" || ")
      : "No strong link-similarity clusters; keep chains visible.",
    teardrops: teardropNote || "No key issues to seed teardrops.",
    rows,
  };
}

export function analysisToCsv(analysis: AnalysisRecord): string {
  const header = ["priority", "statement", "type", "why", "authors", "notes"];
  const lines = [
    header.join(","),
    ...analysis.rows.map((row) =>
      [row.priority, row.statement, row.type, row.why, row.authors, row.notes]
        .map(csvEscape)
        .join(","),
    ),
  ];
  return lines.join("\n");
}

function csvEscape(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
  return s;
}
