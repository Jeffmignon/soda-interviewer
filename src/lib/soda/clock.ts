export const FLOOR_MS = 30 * 60 * 1000;
export const WRAP_MS = 32 * 60 * 1000;
export const PERSIST_MS = 38 * 60 * 1000;
export const WALL_MS = 40 * 60 * 1000;

export type ClockPhase = "open" | "wrap" | "persist" | "wall";

export type SessionClock = {
  startedAt: string;
  nowMs: number;
  elapsedMs: number;
  remainingMs: number;
  remainingMinutes: number;
  remainingLabel: string;
  phase: ClockPhase;
  beforeFloor: boolean;
  atOrPastFloor: boolean;
  mustHardStop: boolean;
  shouldWrap: boolean;
  shouldPersist: boolean;
};

export function sessionClock(startedAt: string | null | undefined, nowMs = Date.now()): SessionClock {
  const started = startedAt ? Date.parse(startedAt) : nowMs;
  const origin = Number.isFinite(started) ? started : nowMs;
  const elapsedMs = Math.max(0, nowMs - origin);
  const remainingMs = Math.max(0, WALL_MS - elapsedMs);
  const remainingMinutes = Math.ceil(remainingMs / 60000);
  const phase: ClockPhase =
    elapsedMs >= WALL_MS ? "wall" : elapsedMs >= PERSIST_MS ? "persist" : elapsedMs >= WRAP_MS ? "wrap" : "open";

  return {
    startedAt: new Date(origin).toISOString(),
    nowMs,
    elapsedMs,
    remainingMs,
    remainingMinutes,
    remainingLabel: remainingLabel(remainingMinutes, phase),
    phase,
    beforeFloor: elapsedMs < FLOOR_MS,
    atOrPastFloor: elapsedMs >= FLOOR_MS,
    mustHardStop: elapsedMs >= WALL_MS,
    shouldWrap: elapsedMs >= WRAP_MS,
    shouldPersist: elapsedMs >= PERSIST_MS,
  };
}

export function remainingLabel(remainingMinutes: number, phase: ClockPhase): string {
  if (phase === "wall" || remainingMinutes <= 0) return "This sitting is at its end.";
  if (phase === "persist") return "Closing this sitting.";
  if (phase === "wrap") return "Last stretch — we'll read back what you've raised.";
  if (remainingMinutes >= 15) return `About ${remainingMinutes} minutes left in this sitting.`;
  return `About ${remainingMinutes} minutes left.`;
}

export function canAgentConclude(clock: SessionClock, guestExplicitEnd: boolean): boolean {
  if (clock.mustHardStop) return true;
  if (guestExplicitEnd) return true;
  return clock.atOrPastFloor;
}
