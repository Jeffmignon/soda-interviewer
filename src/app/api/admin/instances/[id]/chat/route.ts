import { convertToModelMessages, stepCountIs, streamText, tool, type UIMessage } from "ai";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-guard";
import { getModel } from "@/lib/ai";
import { persistAnalysis, persistCognitiveMap, weaveCauseMapForInstance } from "@/lib/soda/complete";
import { causeMapSystemPrompt } from "@/lib/soda/prompts";
import { getInstanceBundle, listInterviews } from "@/lib/store";
import type { InstanceContext } from "@/lib/types";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await adminGuard();
  if (denied) return denied;
  const { id } = await params;
  const bundle = await getInstanceBundle(id);
  if (!bundle) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await request.json()) as { messages?: UIMessage[]; interviewIds?: string[] };
  const messages = body.messages ?? [];
  const ctx: InstanceContext = {
    instance: bundle.instance,
    client: bundle.client,
    project: bundle.project,
    invitee: null,
    interview: null,
  };

  const result = streamText({
    model: getModel(),
    system: causeMapSystemPrompt(ctx),
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(6),
    tools: {
      weaveCauseMap: tool({
        description:
          "Weave a cause map from completed cognitive maps on THIS instance only. Meaning over wording. Persists the cause map.",
        inputSchema: z.object({
          interviewIds: z.array(z.string()).optional(),
        }),
        execute: async ({ interviewIds }) => {
          const all = await listInterviews(id);
          const ids =
            interviewIds && interviewIds.length > 0
              ? interviewIds
              : body.interviewIds && body.interviewIds.length > 0
                ? body.interviewIds
                : all.filter((i) => i.cognitiveMap).map((i) => i.id);
          const map = await weaveCauseMapForInstance(ctx, ids);
          return {
            ok: true,
            nodeCount: map.nodes.length,
            edgeCount: map.edges.length,
            message: `Cause map stored on this instance (${map.nodes.length} nodes). Authorship is kept. Disagreement stays as parallel chains.`,
          };
        },
      }),
      analyzeCauseMap: tool({
        description:
          "Analyze the stored cause map structurally (goals, domain, central, clusters, teardrops, potent options). Not RICE. Persists analysis.",
        inputSchema: z.object({}),
        execute: async () => {
          const fresh = await getInstanceBundle(id);
          if (!fresh?.instance.causeMap) {
            return { ok: false, message: "No cause map on this instance yet. Weave one first." };
          }
          const analysis = await persistAnalysis(id, fresh.instance.causeMap);
          return {
            ok: true,
            mode: analysis.mode,
            note: analysis.note,
            goalSystem: analysis.goalSystem,
            domain: analysis.domain,
            central: analysis.central,
            rowCount: analysis.rows.length,
          };
        },
      }),
      generateSpreadsheet: tool({
        description: "Confirm the priority spreadsheet is ready to download for this instance (after analysis).",
        inputSchema: z.object({}),
        execute: async () => {
          const fresh = await getInstanceBundle(id);
          if (!fresh?.instance.analysis) {
            return { ok: false, message: "Analyze the cause map first, then download the spreadsheet." };
          }
          return {
            ok: true,
            download: `/api/admin/instances/${id}/spreadsheet`,
            rows: fresh.instance.analysis.rows.length,
            mode: fresh.instance.analysis.mode,
          };
        },
      }),
      inspectInterviewMap: tool({
        description: "Read one interview's stored cognitive map on this instance.",
        inputSchema: z.object({ interviewId: z.string() }),
        execute: async ({ interviewId }) => {
          const interviews = await listInterviews(id);
          const interview = interviews.find((i) => i.id === interviewId);
          if (!interview) return { ok: false, message: "Not on this instance." };
          return {
            ok: true,
            status: interview.status,
            map: interview.cognitiveMap,
          };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
