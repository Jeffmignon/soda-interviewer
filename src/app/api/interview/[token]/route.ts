import { NextResponse } from "next/server";
import { sessionClock } from "@/lib/soda/clock";
import { publicPayloadForLookup } from "@/lib/soda/isolation";
import { assistantMessage } from "@/lib/soda/messages";
import { guestOpening } from "@/lib/soda/prompts";
import { createInterview, lookupPublicToken, updateInterview } from "@/lib/store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const found = await lookupPublicToken(token);
  if (!found) {
    return NextResponse.json({ error: "This interview link is not valid." }, { status: 404 });
  }
  const payload = publicPayloadForLookup(found);
  return NextResponse.json(payload);
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const found = await lookupPublicToken(token);
  if (!found) {
    return NextResponse.json({ error: "This interview link is not valid." }, { status: 404 });
  }

  if (found.interview) {
    const clock = sessionClock(found.interview.startedAt);
    return NextResponse.json({
      token: found.interview.token,
      status: found.interview.status,
      completed: found.interview.status === "completed" || found.interview.status === "ended_early",
      messages: found.interview.messages,
      startedAt: found.interview.startedAt,
      remainingLabel: clock.remainingLabel,
      remainingMinutes: clock.remainingMinutes,
      phase: clock.phase,
    });
  }

  const opening = assistantMessage(
    guestOpening({
      instance: found.instance,
      client: found.client,
      project: found.project,
      invitee: found.invitee,
      interview: null,
    }),
  );

  const interview = await createInterview({
    instanceId: found.instance.id,
    inviteeId: found.invitee?.id ?? null,
    messages: [opening],
  });

  await updateInterview(interview.id, { messages: [opening] }, found.instance.id);

  const clock = sessionClock(interview.startedAt);
  return NextResponse.json({
    token: interview.token,
    status: interview.status,
    completed: false,
    messages: interview.messages,
    startedAt: interview.startedAt,
    remainingLabel: clock.remainingLabel,
    remainingMinutes: clock.remainingMinutes,
    phase: clock.phase,
  });
}
