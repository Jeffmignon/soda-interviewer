import { degrees, heads, tails } from "@/lib/soda/map-schema";
import type { CognitiveMap } from "@/lib/types";

export type LaidOutNode = {
  id: string;
  statement: string;
  order: number;
  authors: string;
  x: number;
  y: number;
  kind: "head" | "tail" | "busy" | "plain";
};

export type LaidOutEdge = {
  id: string;
  from: string;
  to: string;
  polarity: "positive" | "negative";
};

export type MapLayout = {
  nodes: LaidOutNode[];
  edges: LaidOutEdge[];
  width: number;
  height: number;
};

/**
 * SODA convention: goals (heads) at the top, options/facts (tails) at the bottom.
 */
export function layoutMap(map: CognitiveMap): MapLayout {
  const rank = new Map<string, number>();
  const down: Record<string, string[]> = {};
  for (const n of map.nodes) down[n.id] = [];
  for (const e of map.edges) down[e.to]?.push(e.from);

  function depth(id: string, seen: Set<string>): number {
    if (rank.has(id)) return rank.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const kids = down[id] ?? [];
    const d = kids.length ? 1 + Math.max(...kids.map((k) => depth(k, seen))) : 0;
    rank.set(id, d);
    return d;
  }

  for (const n of map.nodes) depth(n.id, new Set());

  const byRank = new Map<number, string[]>();
  let maxRank = 0;
  for (const n of map.nodes) {
    const r = rank.get(n.id) ?? 0;
    maxRank = Math.max(maxRank, r);
    const list = byRank.get(r) ?? [];
    list.push(n.id);
    byRank.set(r, list);
  }

  const colW = 280;
  const rowH = 120;
  const headIds = new Set(heads(map).map((n) => n.id));
  const tailIds = new Set(tails(map).map((n) => n.id));
  const deg = degrees(map);

  const nodes: LaidOutNode[] = [];
  for (let r = 0; r <= maxRank; r++) {
    const ids = byRank.get(r) ?? [];
    ids.forEach((id, i) => {
      const n = map.nodes.find((x) => x.id === id)!;
      const d = deg.get(id)!;
      const kind: LaidOutNode["kind"] = headIds.has(id)
        ? "head"
        : tailIds.has(id)
          ? "tail"
          : d.in > 0 && d.out > 0 && d.total >= 3
            ? "busy"
            : "plain";
      nodes.push({
        id,
        statement: n.statement,
        order: n.order,
        authors: n.authors.map((a) => `${a.name} ${a.order}`).join("; "),
        x: 40 + i * colW,
        y: 40 + (maxRank - r) * rowH,
        kind,
      });
    });
  }

  const width = Math.max(640, (Math.max(0, ...[...byRank.values()].map((v) => v.length)) - 1) * colW + 320);
  const height = Math.max(360, maxRank * rowH + 200);

  return {
    nodes,
    edges: map.edges.map((e) => ({
      id: e.id,
      from: e.from,
      to: e.to,
      polarity: e.polarity,
    })),
    width,
    height,
  };
}
