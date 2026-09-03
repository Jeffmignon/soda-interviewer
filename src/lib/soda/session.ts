import { canAgentConclude, FLOOR_MS, type SessionClock } from "@/lib/soda/clock";

export type LeaveIntent = "none" | "leave" | "insist";

const LEAVE =
  /\b(i (need|have) to (go|leave|stop|run)|i('m| am) (going to )?leav|i (can't|cannot) (stay|continue)|let'?s stop|wrap (this|it) up|i have to run|got to go|i must go|end (the|this) interview|i'?m done for today)\b/i;

const INSIST =
  /\b(really have to|i insist|please (end|stop)|i('m| am) leaving now|no,? i (need|have) to|save what we have|i cannot stay|i truly have to)\b/i;

export function detectLeaveIntent(text: string): LeaveIntent {
  if (!text.trim()) return "none";
  if (INSIST.test(text)) return "insist";
  if (LEAVE.test(text)) return "leave";
  return "none";
}

export type CompletionDecision =
  | { allow: false; code: "too_early" | "invite_to_stay"; message: string }
  | { allow: true; status: "completed" | "ended_early"; reason: "floor" | "wall" | "guest_early" | "guest_consent" };

export const STAY_INVITATION =
  "I hear that you need to go. This sitting is meant to run about 30–40 minutes so the map has enough depth — can we continue a little longer? If you truly have to leave, say so and I will save what we have.";

export const HARD_STOP_THANKS =
  "We've reached the end of this sitting. Thank you. I'm saving the notes now — there is nothing else you need to do here.";

export function decideCompletion(input: {
  clock: SessionClock;
  leave: LeaveIntent;
  alreadyInvited: boolean;
  guestExplicitEnd?: boolean;
}): CompletionDecision {
  const explicit = Boolean(input.guestExplicitEnd) || input.leave !== "none";

  if (input.clock.mustHardStop) {
    return { allow: true, status: "completed", reason: "wall" };
  }

  if (input.clock.beforeFloor) {
    if (explicit) {
      const insist = input.leave === "insist" || input.alreadyInvited || Boolean(input.guestExplicitEnd && input.alreadyInvited);
      if (input.alreadyInvited || input.leave === "insist") {
        return { allow: true, status: "ended_early", reason: "guest_early" };
      }
      if (input.guestExplicitEnd && !input.alreadyInvited && input.leave === "none") {
        return {
          allow: false,
          code: "invite_to_stay",
          message: STAY_INVITATION,
        };
      }
      if (!insist) {
        return { allow: false, code: "invite_to_stay", message: STAY_INVITATION };
      }
      return { allow: true, status: "ended_early", reason: "guest_early" };
    }
    return {
      allow: false,
      code: "too_early",
      message: `This sitting runs 30–40 minutes. About ${input.clock.remainingMinutes} minutes remain. Stay with the map — do not pad, and do not conclude yet.`,
    };
  }

  if (explicit) {
    return { allow: true, status: "completed", reason: "guest_consent" };
  }

  if (canAgentConclude(input.clock, false) || input.clock.shouldPersist) {
    return { allow: true, status: "completed", reason: input.clock.mustHardStop ? "wall" : "floor" };
  }

  return { allow: true, status: "completed", reason: "floor" };
}

export function agentMayCallComplete(clock: SessionClock, leave: LeaveIntent): boolean {
  if (clock.elapsedMs < FLOOR_MS && leave === "none") return false;
  return canAgentConclude(clock, leave !== "none");
}
