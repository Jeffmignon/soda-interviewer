import { NextResponse } from "next/server";
import { sessionClock } from "@/lib/soda/clock";
import { persistCognitiveMap } from "@/lib/soda/complete";
import { asUIMessages, textFromMessage } from "@/lib/soda/messages";
import { decideCompletion, detectLeaveIntent, STAY_INVITATION } from "@/lib/soda/session";
import { lookupPublicToken, updateInterview } from "@/lib/store";

export const maxDuration = 120;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await lookupPublicToken(token);
  if (!found?.interview) {
    return NextResponse.json({ error: "This interview link is not valid." }, { status: 404 });
  }
  if (
    (found.interview.status === "completed" || found.interview.status === "ended_early") &&
    found.interview.cognitiveMap
  ) {
    return NextResponse.json({
      ok: true,
      alreadySaved: true,
      status: found.interview.status,
      nodeCount: found.interview.cognitiveMap.nodes.length,
    });
  }

  const body = (await request.json().catch(() => ({}))) as {
    messages?: unknown[];
    guestExplicitEnd?: boolean;
  };
  if (body.messages) {
    await updateInterview(
      found.interview.id,
      { messages: asUIMessages(body.messages) },
      found.instance.id,
    );
  }

  const clock = sessionClock(found.interview.startedAt);
  const messages = asUIMessages(body.messages ?? found.interview.messages);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const leave = detectLeaveIntent(lastUser ? textFromMessage(lastUser) : "");
  const alreadyInvited = Boolean(found.interview.earlyExitInvitedAt);
  const decision = decideCompletion({
    clock,
    leave,
    alreadyInvited,
    guestExplicitEnd: Boolean(body.guestExplicitEnd) || leave !== "none",
  });

  if (!decision.allow) {
    if (decision.code === "invite_to_stay") {
      await updateInterview(
        found.interview.id,
        { earlyExitInvitedAt: new Date().toISOString() },
        found.instance.id,
      );
      return NextResponse.json({
        ok: false,
        code: "invite_to_stay",
        message: STAY_INVITATION,
        remainingMinutes: clock.remainingMinutes,
        remainingLabel: clock.remainingLabel,
      });
    }
    return NextResponse.json(
      {
        ok: false,
        code: "too_early",
        message: decision.message,
        remainingMinutes: clock.remainingMinutes,
        remainingLabel: clock.remainingLabel,
      },
      { status: 409 },
    );
  }

  const map = await persistCognitiveMap(found.interview.id, found.instance.id, decision.status);
  return NextResponse.json({
    ok: true,
    saved: true,
    status: decision.status,
    reason: decision.reason,
    nodeCount: map.nodes.length,
  });
}
