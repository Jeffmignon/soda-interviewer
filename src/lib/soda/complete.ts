import { generateObject } from "ai";
import { getModel } from "@/lib/ai";
import { nowIso } from "@/lib/ids";
import { analyzeCauseMap } from "@/lib/soda/analysis";
import { emptyMap, fromGenerated, generatedMapSchema } from "@/lib/soda/map-schema";
import { transcriptFromMessages, asUIMessages } from "@/lib/soda/messages";
import { causeMapWeavePrompt, interviewCompletePrompt } from "@/lib/soda/prompts";
import { getInterview, listInterviews, updateInstance, updateInterview } from "@/lib/store";
import type { CognitiveMap, InstanceContext } from "@/lib/types";

export async function persistCognitiveMap(
  interviewId: string,
  instanceId: string,
  status: "completed" | "ended_early" = "completed",
): Promise<CognitiveMap> {
  const interview = await getInterview(interviewId);
  if (!interview || interview.instanceId !== instanceId) {
    throw new Error("Interview not found on this instance");
  }
  const messages = asUIMessages(interview.messages);
  const transcript = transcriptFromMessages(messages);
  const authorName = "Guest";

  let map: CognitiveMap;
  try {
    const { object } = await generateObject({
      model: getModel(),
      schema: generatedMapSchema,
      system: interviewCompletePrompt(authorName),
      prompt: `Transcript:\n\n${transcript}`,
    });
    map = fromGenerated(object, "cognitive", authorName, interview.id);
  } catch {
    map = emptyMap("cognitive");
  }

  await updateInterview(
    interview.id,
    {
      status,
      cognitiveMap: map,
      completedAt: nowIso(),
    },
    instanceId,
  );
  return map;
}

export async function weaveCauseMapForInstance(
  ctx: InstanceContext,
  interviewIds: string[],
): Promise<CognitiveMap> {
  const interviews = await listInterviews(ctx.instance.id);
  const selected = interviews.filter(
    (i) => interviewIds.includes(i.id) && i.instanceId === ctx.instance.id && i.cognitiveMap,
  );
  if (selected.length === 0) {
    throw new Error("Select at least one completed interview on this instance");
  }

  const payload = selected.map((i) => ({
    interviewId: i.id,
    map: i.cognitiveMap,
  }));

  const { object } = await generateObject({
    model: getModel(),
    schema: generatedMapSchema,
    system: causeMapWeavePrompt(),
    prompt: `Situation of interest: ${ctx.instance.situationOfInterest}\n\nCognitive maps JSON:\n${JSON.stringify(payload, null, 2)}`,
  });

  const authors = "woven";
  const map = fromGenerated(object, "cause", authors);
  // Restore authorship from source maps where ids match / mergedFrom.
  const byStatement = new Map<string, NonNullable<(typeof selected)[0]["cognitiveMap"]>["nodes"][0]>();
  for (const interview of selected) {
    for (const node of interview.cognitiveMap?.nodes ?? []) {
      byStatement.set(node.statement.toLowerCase(), node);
      byStatement.set(node.id, node);
    }
  }
  map.nodes = map.nodes.map((n) => {
    const src = byStatement.get(n.id) || byStatement.get(n.statement.toLowerCase());
    if (src) {
      return {
        ...n,
        authors: src.authors.map((a) => ({ ...a, interviewId: a.interviewId ?? selected.find((i) => i.cognitiveMap?.nodes.some((x) => x.id === src.id))?.id })),
        mergedFrom: n.mergedFrom ?? src.mergedFrom,
      };
    }
    return n;
  });

  await updateInstance(ctx.instance.id, { causeMap: map });
  return map;
}

export async function persistAnalysis(instanceId: string, map: CognitiveMap) {
  const analysis = analyzeCauseMap(map);
  await updateInstance(instanceId, { analysis });
  return analysis;
}
