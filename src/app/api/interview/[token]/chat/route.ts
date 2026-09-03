import { convertToModelMessages, generateText, stepCountIs, tool, type UIMessage } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import { sessionClock } from "@/lib/soda/clock";
import { persistCognitiveMap } from "@/lib/soda/complete";
import {
  guardInterviewerOutput,
  lastInGoalStatement,
  type GoalLogEntry,
} from "@/lib/soda/goal-fence";
import { asUIMessages, textFromMessage } from "@/lib/soda/messages";
import { interviewSystemPrompt } from "@/lib/soda/prompts";
import {
  agentMayCallComplete,
  decideCompletion,
  detectLeaveIntent,
  HARD_STOP_THANKS,
  STAY_INVITATION,
} from "@/lib/soda/session";
import { streamApprovedText } from "@/lib/soda/stream-text";
import { lookupPublicToken, updateInterview } from "@/lib/store";

export const maxDuration = 120;

function turnsFrom(messages: UIMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    text: textFromMessage(m),
  }));
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const found = await lookupPublicToken(token);
  if (!found?.interview) {
    return Response.json({ error: "This interview link is not valid." }, { status: 404 });
  }
  if (found.interview.status === "completed" || found.interview.status === "ended_early") {
    return Response.json({ error: "This interview is already saved." }, { status: 409 });
  }

  const body = (await request.json()) as { messages?: UIMessage[] };
  const messages = body.messages?.length ? body.messages : asUIMessages(found.interview.messages);
  const clock = sessionClock(found.interview.startedAt);
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser ? textFromMessage(lastUser) : "";
  const leave = detectLeaveIntent(lastUserText);
  const alreadyInvited = Boolean(found.interview.earlyExitInvitedAt);

  const persist = async (next: UIMessage[], extra?: Parameters<typeof updateInterview>[1]) => {
    await updateInterview(found.interview!.id, { messages: next, ...extra }, found.instance.id);
  };

  if (clock.mustHardStop) {
    const thanks = HARD_STOP_THANKS;
    await persist(messages);
    try {
      await persistCognitiveMap(found.interview.id, found.instance.id, "completed");
    } catch {
      await updateInterview(
        found.interview.id,
        { status: "completed", completedAt: new Date().toISOString() },
        found.instance.id,
      );
    }
    return streamApprovedText(thanks, messages, async (next) => persist(next));
  }

  if (clock.beforeFloor && leave !== "none") {
    const decision = decideCompletion({ clock, leave, alreadyInvited });
    if (!decision.allow && decision.code === "invite_to_stay") {
      await updateInterview(
        found.interview.id,
        { earlyExitInvitedAt: new Date().toISOString(), messages },
        found.instance.id,
      );
      return streamApprovedText(STAY_INVITATION, messages, async (next) => persist(next));
    }
    if (decision.allow && decision.status === "ended_early") {
      await persist(messages);
      try {
        await persistCognitiveMap(found.interview.id, found.instance.id, "ended_early");
      } catch {
        await updateInterview(
          found.interview.id,
          { status: "ended_early", completedAt: new Date().toISOString() },
          found.instance.id,
        );
      }
      return streamApprovedText(
        "Understood. I'm saving what we have. Thank you — you can close this page.",
        messages,
        async (next) => persist(next),
      );
    }
  }

  const ctx = {
    instance: found.instance,
    client: found.client,
    project: found.project,
    invitee: found.invitee,
    interview: found.interview,
  };

  let proposed = "";
  try {
    const generated = await generateText({
      model: getModel(),
      system: interviewSystemPrompt(ctx, clock),
      messages: await convertToModelMessages(messages),
      stopWhen: stepCountIs(3),
      tools: {
        completeInterview: tool({
          description:
            "Call only when the guest agrees the interview is done after the 30-minute floor, or they explicitly need to stop. Generates and saves their cognitive map.",
          inputSchema: z.object({ guestAgreed: z.boolean() }),
          execute: async ({ guestAgreed }) => {
            if (!guestAgreed) {
              return { ok: false, message: "Stay with the conversation until they agree it is done." };
            }
            if (!agentMayCallComplete(clock, leave)) {
              return {
                ok: false,
                message: `Cannot conclude before 30:00 unless the guest needs to leave. ${clock.remainingLabel}`,
              };
            }
            const decision = decideCompletion({ clock, leave, alreadyInvited, guestExplicitEnd: true });
            if (!decision.allow) {
              return { ok: false, message: decision.message };
            }
            await persist(messages);
            const map = await persistCognitiveMap(found.interview!.id, found.instance.id, decision.status);
            return {
              ok: true,
              saved: true,
              status: decision.status,
              nodeCount: map.nodes.length,
              guestMessage:
                "Your interview is saved. Thank you. You can close this page — there is nothing else you need to do here.",
            };
          },
        }),
      },
    });
    proposed = generated.text.trim();
  } catch {
    proposed = "";
  }

  const lastInGoal = lastInGoalStatement(
    turnsFrom(messages),
    found.instance.interviewGoal,
    found.instance.targetAudience,
  );

  const guarded = guardInterviewerOutput({
    proposed:
      proposed ||
      `What would have to change to ${found.instance.interviewGoal.split(/[.?,]/)[0]?.trim() || found.instance.situationOfInterest}?`,
    guestText: lastUserText,
    lastInGoalStatement: lastInGoal,
    interviewGoal: found.instance.interviewGoal,
    targetAudience: found.instance.targetAudience,
  });

  const goalLog: GoalLogEntry[] = [...found.interview.goalLog, guarded.log];

  return streamApprovedText(guarded.text, messages, async (next) => {
    await updateInterview(
      found.interview!.id,
      { messages: next, goalLog },
      found.instance.id,
    );
  });
}
