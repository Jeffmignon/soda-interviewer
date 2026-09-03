import { z } from "zod";
import type { CognitiveMap, MapEdge, MapNode } from "@/lib/types";

export const mapNodeAuthorSchema = z.object({
  name: z.string().min(1),
  order: z.number().int().nonnegative(),
  interviewId: z.string().optional(),
});

export const mapNodeSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().nonnegative(),
  statement: z.string().min(1),
  authors: z.array(mapNodeAuthorSchema).min(1),
  mergedFrom: z.array(z.string()).optional(),
});

export const mapEdgeSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  polarity: z.enum(["positive", "negative"]),
});

export const cognitiveMapSchema = z.object({
  version: z.literal(1),
  type: z.enum(["cognitive", "cause"]),
  nodes: z.array(mapNodeSchema),
  edges: z.array(mapEdgeSchema),
});

export type ParsedCognitiveMap = z.infer<typeof cognitiveMapSchema>;

export const generatedMapSchema = z.object({
  nodes: z.array(
    z.object({
      id: z.string(),
      order: z.number().int(),
      statement: z.string(),
      authorName: z.string().optional(),
      authorOrder: z.number().int().optional(),
    }),
  ),
  edges: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      polarity: z.enum(["positive", "negative"]).default("positive"),
    }),
  ),
});

export function emptyMap(type: CognitiveMap["type"] = "cognitive"): CognitiveMap {
  return { version: 1, type, nodes: [], edges: [] };
}

export function isDoubleHeadedPair(a: MapEdge, b: MapEdge): boolean {
  return a.from === b.to && a.to === b.from && a.id !== b.id;
}

export function findDoubleHeadedPairs(edges: MapEdge[]): Array<[MapEdge, MapEdge]> {
  const pairs: Array<[MapEdge, MapEdge]> = [];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (isDoubleHeadedPair(edges[i], edges[j])) {
        pairs.push([edges[i], edges[j]]);
      }
    }
  }
  return pairs;
}

export function validateMapShape(input: unknown): CognitiveMap {
  const parsed = cognitiveMapSchema.parse(input);
  const nodeIds = new Set(parsed.nodes.map((n) => n.id));
  for (const edge of parsed.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      throw new Error(`Edge ${edge.id} references a missing node`);
    }
    if (edge.from === edge.to) {
      throw new Error(`Edge ${edge.id} is a self-loop`);
    }
  }
  return parsed;
}

export function heads(map: CognitiveMap): MapNode[] {
  const hasOut = new Set(map.edges.map((e) => e.from));
  return map.nodes.filter((n) => !hasOut.has(n.id));
}

export function tails(map: CognitiveMap): MapNode[] {
  const hasIn = new Set(map.edges.map((e) => e.to));
  return map.nodes.filter((n) => !hasIn.has(n.id));
}

export function orphans(map: CognitiveMap): MapNode[] {
  const linked = new Set<string>();
  for (const e of map.edges) {
    linked.add(e.from);
    linked.add(e.to);
  }
  return map.nodes.filter((n) => !linked.has(n.id));
}

export function degrees(map: CognitiveMap): Map<string, { in: number; out: number; total: number }> {
  const d = new Map<string, { in: number; out: number; total: number }>();
  for (const n of map.nodes) d.set(n.id, { in: 0, out: 0, total: 0 });
  for (const e of map.edges) {
    const from = d.get(e.from);
    const to = d.get(e.to);
    if (from) {
      from.out += 1;
      from.total += 1;
    }
    if (to) {
      to.in += 1;
      to.total += 1;
    }
  }
  return d;
}

export function authorLabel(node: MapNode): string {
  return node.authors
    .map((a) => `${a.name} ${a.order}`)
    .join("; ");
}

export function toGeneratedMap(map: CognitiveMap, authorName: string, interviewId?: string): CognitiveMap {
  return {
    version: 1,
    type: "cognitive",
    nodes: map.nodes.map((n) => ({
      ...n,
      authors:
        n.authors.length > 0
          ? n.authors
          : [{ name: authorName, order: n.order, interviewId }],
    })),
    edges: map.edges.map((e, i) => ({
      id: e.id || `e${i + 1}`,
      from: e.from,
      to: e.to,
      polarity: e.polarity ?? "positive",
    })),
  };
}

export function fromGenerated(
  raw: z.infer<typeof generatedMapSchema>,
  type: CognitiveMap["type"],
  authorName: string,
  interviewId?: string,
): CognitiveMap {
  const nodes: MapNode[] = raw.nodes.map((n) => ({
    id: String(n.id),
    order: n.order,
    statement: n.statement.trim(),
    authors: [
      {
        name: n.authorName?.trim() || authorName,
        order: n.authorOrder ?? n.order,
        interviewId,
      },
    ],
  }));
  const edges: MapEdge[] = raw.edges.map((e, i) => ({
    id: `e${i + 1}`,
    from: String(e.from),
    to: String(e.to),
    polarity: e.polarity ?? "positive",
  }));
  return validateMapShape({ version: 1, type, nodes, edges });
}
