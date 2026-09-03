"use client";

import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { layoutMap } from "@/lib/soda/layout";
import type { CognitiveMap } from "@/lib/types";

const kindFill: Record<string, string> = {
  head: "#9e3d2f",
  tail: "#355c45",
  busy: "#1a1714",
  plain: "#5c5348",
};

export function MapGraph({ map }: { map: CognitiveMap }) {
  const laid = layoutMap(map);
  const nodes: Node[] = laid.nodes.map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: `${n.order}. ${n.statement}` },
    style: {
      background: "#fbf8f2",
      border: `1px solid ${kindFill[n.kind]}`,
      borderRadius: 4,
      fontSize: 12,
      width: 240,
      padding: 8,
      color: "#1a1714",
    },
  }));
  const edges: Edge[] = laid.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    label: e.polarity === "negative" ? "−" : "",
    style: {
      stroke: e.polarity === "negative" ? "#9e3d2f" : "#1a1714",
      strokeDasharray: e.polarity === "negative" ? "6 4" : undefined,
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: e.polarity === "negative" ? "#9e3d2f" : "#1a1714",
    },
  }));

  if (map.nodes.length === 0) {
    return <p className="text-sm text-ink-soft">No nodes on this map yet.</p>;
  }

  return (
    <div className="h-[480px] w-full overflow-hidden rounded-md border border-rule bg-[#fbf8f2]">
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background color="#d4c8b8" gap={18} />
        <Controls />
      </ReactFlow>
    </div>
  );
}

export function MapTables({ map }: { map: CognitiveMap }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h4 className="text-xs tracking-[0.2em] uppercase text-ink-soft">Nodes</h4>
        <ul className="mt-2 space-y-2 text-sm">
          {map.nodes.map((n) => (
            <li key={n.id} className="border-b border-rule pb-2">
              <span className="font-mono text-xs text-ink-soft">{n.order}</span> {n.statement}
              <div className="text-xs text-ink-soft">
                {n.authors.map((a) => `${a.name} ${a.order}`).join("; ")}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-xs tracking-[0.2em] uppercase text-ink-soft">Edges (A may lead to B)</h4>
        <ul className="mt-2 space-y-2 text-sm">
          {map.edges.map((e) => {
            const from = map.nodes.find((n) => n.id === e.from)?.statement ?? e.from;
            const to = map.nodes.find((n) => n.id === e.to)?.statement ?? e.to;
            return (
              <li key={e.id}>
                {from} {e.polarity === "negative" ? "⊣" : "→"} {to}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
