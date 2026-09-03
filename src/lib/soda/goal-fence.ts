export const HEURISTICS = [
  "Serve this instance’s goal, not a new theme — including when they answer off-goal.",
  "Ladder why/how from their last in-goal statement, not from the tangent.",
  "Off-goal answer: one beat, capture only in-goal fragments, next question back inside the fence.",
] as const;

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "from", "have", "been", "they", "their", "them",
  "your", "you", "our", "are", "was", "were", "will", "can", "how", "what", "when", "who", "why",
  "into", "about", "than", "then", "also", "just", "more", "most", "some", "any", "not", "but",
  "or", "as", "to", "of", "in", "on", "a", "an", "is", "it", "we", "i", "me", "my", "be", "do",
  "at", "by", "so", "if", "need", "needs", "make", "made", "take", "taking", "get", "got", "would",
  "could", "should", "there", "here", "very", "only", "over", "after", "before", "into", "out",
  "them", "those", "these", "being", "does", "did", "doing", "done",
]);

const SODA_LADDER =
  /why does that matter|how might that be done|what gets in the way|what would have to change|what is the real issue|rather than/i;

const WANDER: RegExp[] = [
  /\bweather\b/i,
  /\bfavou?rite (restaurant|movie|team|holiday|food|book)\b/i,
  /\b(kitchen|contractor|renovat(?:e|ion)|marble|countertop)\b/i,
  /\bbrother'?s wedding\b/i,
  /\bwedding in (italy|france|spain|greece)\b/i,
  /\bcareer (path|history|biography)\b/i,
  /\bpath from medical school\b/i,
  /\bdepartment chair\b/i,
  /\bpatient[- ]facing app\b/i,
  /\bour other product\b/i,
  /\bsports? scores?\b/i,
  /\bfamily vacation\b/i,
  /\bweekend hobby\b/i,
];

export type GoalVerdict = "on-goal" | "redirected";

export type GuestTurnClass = {
  offGoal: boolean;
  inGoalFragments: string[];
  tangent: string | null;
};

export type GoalLogEntry = {
  at: string;
  proposed: string;
  sent: string;
  verdict: GoalVerdict;
  guestOffGoal: boolean;
  reason: string;
};

export type GuardInput = {
  proposed: string;
  guestText: string;
  lastInGoalStatement: string | null;
  interviewGoal: string;
  targetAudience: string;
  at?: string;
};

export type GuardResult = {
  verdict: GoalVerdict;
  text: string;
  reason: string;
  log: GoalLogEntry;
};

export function fenceTerms(interviewGoal: string, targetAudience: string): Set<string> {
  const terms = new Set<string>();
  for (const raw of `${interviewGoal} ${targetAudience}`.split(/[^a-zA-Z0-9]+/)) {
    const word = raw.toLowerCase();
    if (!word) continue;
    if (word.length <= 2 && !/^[A-Z]{2,}$/.test(raw)) continue;
    if (STOPWORDS.has(word)) continue;
    terms.add(word);
    if (word.endsWith("s") && word.length > 4) terms.add(word.slice(0, -1));
  }
  return terms;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOPWORDS.has(w) && (w.length > 2 || w === "cme" || w === "hcp"));
}

function wanderHits(text: string, fence: Set<string>): string[] {
  const hits: string[] = [];
  for (const re of WANDER) {
    const match = text.match(re);
    if (!match) continue;
    const token = match[0].toLowerCase().split(/[^a-z0-9]+/).find((w) => w.length > 2);
    if (token && fence.has(token)) continue;
    hits.push(match[0]);
  }
  return hits;
}

export function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function extractQuestions(text: string): string[] {
  const found = text.match(/[^.!?\n]*\?/g) ?? [];
  return found.map((q) => q.trim()).filter(Boolean);
}

export function overlapCount(text: string, fence: Set<string>): number {
  return tokenize(text).filter((w) => fence.has(w) || [...fence].some((t) => t.startsWith(w) || w.startsWith(t))).length;
}

export function isQuestionOnGoal(question: string, interviewGoal: string, targetAudience: string): boolean {
  const fence = fenceTerms(interviewGoal, targetAudience);
  if (wanderHits(question, fence).length > 0) return false;
  if (SODA_LADDER.test(question)) return true;
  return overlapCount(question, fence) > 0;
}

export function isUtteranceOnGoal(text: string, interviewGoal: string, targetAudience: string): boolean {
  const fence = fenceTerms(interviewGoal, targetAudience);
  if (!text.trim()) return false;
  if (wanderHits(text, fence).length > 0 && overlapCount(text, fence) === 0) return false;
  if (SODA_LADDER.test(text) && wanderHits(text, fence).length === 0) return true;
  return overlapCount(text, fence) > 0;
}

export function classifyGuestTurn(
  guestText: string,
  interviewGoal: string,
  targetAudience: string,
): GuestTurnClass {
  const fence = fenceTerms(interviewGoal, targetAudience);
  const parts = sentences(guestText);
  const inGoalFragments: string[] = [];
  const tangentParts: string[] = [];
  for (const part of parts) {
    const on = overlapCount(part, fence) > 0;
    if (on) inGoalFragments.push(part);
    else tangentParts.push(part);
  }
  const whollyOnGoal = inGoalFragments.length > 0 && tangentParts.length === 0;
  return {
    offGoal: guestText.trim().length > 0 && !whollyOnGoal,
    inGoalFragments,
    tangent: tangentParts.join(" ") || (inGoalFragments.length === 0 ? guestText : null),
  };
}

export function lastInGoalStatement(
  turns: Array<{ role: string; text: string }>,
  interviewGoal: string,
  targetAudience: string,
): string | null {
  for (let i = turns.length - 1; i >= 0; i--) {
    const turn = turns[i];
    if (turn.role !== "user" && turn.role !== "guest") continue;
    const classified = classifyGuestTurn(turn.text, interviewGoal, targetAudience);
    if (classified.inGoalFragments.length) return classified.inGoalFragments[classified.inGoalFragments.length - 1];
    if (isUtteranceOnGoal(turn.text, interviewGoal, targetAudience)) return turn.text;
  }
  return null;
}

function compress(statement: string): string {
  const trimmed = statement.replace(/^[.!\s]+|[.!\s]+$/g, "");
  if (trimmed.length <= 88) return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return `${trimmed.slice(0, 84).trim()}…`;
}

export function genericOnGoalQuestion(interviewGoal: string, targetAudience: string): string {
  const audience = targetAudience.trim() || "the people in this sitting";
  const goalBit = interviewGoal.split(/[.?,]/)[0]?.trim() || interviewGoal.trim();
  return `What would have to change to ${goalBit.charAt(0).toLowerCase()}${goalBit.slice(1)} — for ${audience}?`;
}

export function steerAfterOffGoalGuest(input: {
  guestText: string;
  lastInGoalStatement: string | null;
  interviewGoal: string;
  targetAudience: string;
}): string {
  const classified = classifyGuestTurn(input.guestText, input.interviewGoal, input.targetAudience);
  const fragment = classified.inGoalFragments[0];
  const seed = fragment ?? input.lastInGoalStatement;
  const ack = "I hear you.";
  if (fragment) {
    return `${ack} Holding onto this: ${compress(fragment)} Why does that matter?`;
  }
  if (seed) {
    return `${ack} Coming back to ${compress(seed)} — how might that be done?`;
  }
  return `${ack} ${genericOnGoalQuestion(input.interviewGoal, input.targetAudience)}`;
}

function firstQuestion(text: string): string | null {
  return extractQuestions(text)[0] ?? null;
}

export function guardInterviewerOutput(input: GuardInput): GuardResult {
  const at = input.at ?? new Date().toISOString();
  const guest = classifyGuestTurn(input.guestText, input.interviewGoal, input.targetAudience);
  const questions = extractQuestions(input.proposed);
  const candidates = questions.length > 0 ? questions : [input.proposed];
  const offQuestions = candidates.filter(
    (q) => !isQuestionOnGoal(q, input.interviewGoal, input.targetAudience),
  );
  const chasedTangent =
    guest.offGoal &&
    candidates.some((q) => !isQuestionOnGoal(q, input.interviewGoal, input.targetAudience));

  if (chasedTangent || offQuestions.length > 0) {
    const redirected = steerAfterOffGoalGuest({
      guestText: input.guestText,
      lastInGoalStatement: input.lastInGoalStatement,
      interviewGoal: input.interviewGoal,
      targetAudience: input.targetAudience,
    });
    const q = firstQuestion(redirected);
    const stillOff = q ? !isQuestionOnGoal(q, input.interviewGoal, input.targetAudience) : false;
    const text = stillOff
      ? `I hear you. ${genericOnGoalQuestion(input.interviewGoal, input.targetAudience)}`
      : redirected;
    return {
      verdict: "redirected",
      text,
      reason: chasedTangent
        ? "Guest answered off-goal; discarded the tangent and asked inside the fence."
        : "Proposed question was outside the interview goal; regenerated inside the fence.",
      log: {
        at,
        proposed: input.proposed,
        sent: text,
        verdict: "redirected",
        guestOffGoal: guest.offGoal,
        reason: chasedTangent ? "off-goal guest turn" : "off-goal question",
      },
    };
  }

  let text = input.proposed.trim();
  if (guest.offGoal && text && !/^\s*i hear you/i.test(text)) {
    text = `I hear you. ${text}`;
  }

  return {
    verdict: "on-goal",
    text,
    reason: guest.offGoal
      ? "Guest wandered; interviewer stayed inside the goal."
      : "Question serves the instance interview goal.",
    log: {
      at,
      proposed: input.proposed,
      sent: text,
      verdict: "on-goal",
      guestOffGoal: guest.offGoal,
      reason: "on-goal",
    },
  };
}

export function twoInstancesDoNotLeakGoals(a: string, b: string, promptForA: string): boolean {
  const uniqueB = tokenize(b).filter((w) => w.length > 5 && !tokenize(a).includes(w));
  if (uniqueB.length === 0) return true;
  const lower = promptForA.toLowerCase();
  return uniqueB.every((w) => !lower.includes(w));
}
