import type { CognitiveMap, Instance, Interview, PublicTokenLookup } from "@/lib/types";
import { sessionClock } from "@/lib/soda/clock";
import { guestOpening, interviewSystemPrompt } from "@/lib/soda/prompts";

/**
 * Token lookup is the isolation boundary for the public site.
 * A resolved token may only ever expose its own instance.
 */
export function lookupResultIsIsolated(result: PublicTokenLookup, token: string): boolean {
  const ids = new Set([result.instance.token]);
  if (result.invitee) ids.add(result.invitee.token);
  if (result.interview) ids.add(result.interview.token);
  if (!ids.has(token) && result.kind === "instance") {
    return result.instance.token === token;
  }
  if (result.kind === "invitee") return result.invitee?.token === token;
  if (result.kind === "interview") return result.interview?.token === token;
  return result.instance.token === token;
}

export function publicPayloadForLookup(result: PublicTokenLookup) {
  const clock = result.interview ? sessionClock(result.interview.startedAt) : null;
  const status = result.interview?.status ?? "not_started";
  return {
    situationOfInterest: result.instance.situationOfInterest,
    inviteeName: result.invitee?.name ?? null,
    status,
    completed: status === "completed" || status === "ended_early",
    startedAt: result.interview?.startedAt ?? null,
    remainingLabel: clock?.remainingLabel ?? null,
    remainingMinutes: clock?.remainingMinutes ?? null,
    phase: clock?.phase ?? null,
    interviewToken: result.kind === "instance" ? null : result.interview?.token ?? result.invitee?.token ?? null,
  };
}

export function systemPromptKnowsBrief(result: PublicTokenLookup): string {
  return interviewSystemPrompt({
    instance: result.instance,
    client: result.client,
    project: result.project,
    invitee: result.invitee,
    interview: result.interview,
  });
}

export function openingKnowsSituation(result: PublicTokenLookup): string {
  return guestOpening({
    instance: result.instance,
    client: result.client,
    project: result.project,
    invitee: result.invitee,
    interview: result.interview,
  });
}

export function mapScopedToInstance(
  map: CognitiveMap | null,
  interviews: Interview[],
  instance: Instance,
): boolean {
  if (!map) return true;
  const allowed = new Set(interviews.filter((i) => i.instanceId === instance.id).map((i) => i.id));
  return map.nodes.every((n) =>
    n.authors.every((a) => !a.interviewId || allowed.has(a.interviewId)),
  );
}

export function stripOtherInstances<T extends { instanceId: string }>(
  rows: T[],
  instanceId: string,
): T[] {
  return rows.filter((row) => row.instanceId === instanceId);
}
