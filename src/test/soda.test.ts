import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbCache } from "@/lib/db";
import { createUnguessableToken } from "@/lib/ids";
import {
  guestOpening,
  interviewSystemPrompt,
  HEURISTICS,
} from "@/lib/soda/prompts";
import { publicPayloadForLookup, stripOtherInstances } from "@/lib/soda/isolation";
import {
  createClient,
  createInstance,
  createInterview,
  createInvitee,
  createProject,
  getInterview,
  listInterviews,
  lookupPublicToken,
  updateInterview,
} from "@/lib/store";
import {
  cognitiveMapSchema,
  findDoubleHeadedPairs,
  fromGenerated,
  heads,
  tails,
  validateMapShape,
} from "@/lib/soda/map-schema";
import { analyzeCauseMap } from "@/lib/soda/analysis";
import { FLOOR_MS, WALL_MS, canAgentConclude, sessionClock } from "@/lib/soda/clock";
import {
  extractQuestions,
  guardInterviewerOutput,
  isQuestionOnGoal,
  lastInGoalStatement,
} from "@/lib/soda/goal-fence";
import { decideCompletion } from "@/lib/soda/session";
import type { CognitiveMap, InstanceContext } from "@/lib/types";

const CME_AUDIENCE = "HCPs who need to take CME";
const CME_GOAL =
  "understand how we can improve our CMEs to make them frictionless, 100% adapted to the lifestyle of busy HCPs, as personalized as possible — best format, best moment, ideal experience";

function fenceFields() {
  return { targetAudience: CME_AUDIENCE, interviewGoal: CME_GOAL };
}

function ctx(): InstanceContext {
  return {
    client: {
      id: "c1",
      name: "North Harbor Health",
      website: "https://example.org",
      notes: "",
      createdAt: "",
      updatedAt: "",
    },
    project: {
      id: "p1",
      clientId: "c1",
      name: "Weekend discharge delays",
      description: "",
      createdAt: "",
      updatedAt: "",
    },
    instance: {
      id: "i1",
      clientId: "c1",
      projectId: "p1",
      token: "tok",
      name: "Staff view",
      situationOfInterest: "patients waiting too long to leave hospital on weekends",
      interviewReason: "Understand the blockage",
      targetAudience: "ward coordinators and night staff",
      interviewGoal: "understand what would have to change so weekend discharges are not delayed",
      causeMap: null,
      analysis: null,
      createdAt: "",
      updatedAt: "",
    },
    invitee: {
      id: "n1",
      instanceId: "i1",
      token: "inv",
      name: "Sam Okonkwo",
      email: "sam@example.org",
      linkedinUrl: "",
      createdAt: "",
    },
    interview: null,
  };
}

describe("unguessable tokens", () => {
  it("are long, unique, and URL-safe", () => {
    const a = createUnguessableToken();
    const b = createUnguessableToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThanOrEqual(32);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe("instance context injection", () => {
  it("names the situation and forbids asking which company or product", () => {
    const prompt = interviewSystemPrompt(ctx());
    expect(prompt).toContain("patients waiting too long to leave hospital on weekends");
    expect(prompt).toContain("North Harbor Health");
    expect(prompt.toLowerCase()).toMatch(/never ask/);
    expect(prompt.toLowerCase()).toContain("which company");
    expect(prompt).toContain("What is the real issue here?");
    expect(prompt.toLowerCase()).not.toContain("rice");
    expect(prompt).toContain(HEURISTICS[0]);
    expect(prompt).toContain("including when they answer off-goal");
    expect(prompt).toContain("ward coordinators and night staff");
    expect(prompt).toContain("weekend discharges are not delayed");
  });

  it("opens by naming the situation, not by asking who this is for", () => {
    const opening = guestOpening(ctx());
    expect(opening).toContain("patients waiting too long to leave hospital on weekends");
    expect(opening.toLowerCase()).toContain("what is the real issue");
    expect(opening.toLowerCase()).not.toContain("which company");
    expect(opening.toLowerCase()).not.toContain("what product");
  });

  it("does not expose the client name in the public payload", () => {
    const payload = publicPayloadForLookup({
      kind: "invitee",
      ...ctx(),
      interview: null,
    });
    expect(JSON.stringify(payload)).not.toContain("North Harbor Health");
    expect(payload.situationOfInterest).toContain("weekends");
  });
});

describe("cognitive map JSON shape", () => {
  const map: CognitiveMap = {
    version: 1,
    type: "cognitive",
    nodes: [
      {
        id: "1",
        order: 1,
        statement: "Clear weekend discharge blockers",
        authors: [{ name: "Sam Okonkwo", order: 1, interviewId: "iv1" }],
      },
      {
        id: "2",
        order: 2,
        statement: "Staff pharmacy before noon",
        authors: [{ name: "Sam Okonkwo", order: 2, interviewId: "iv1" }],
      },
      {
        id: "3",
        order: 3,
        statement: "Keep patients waiting on the ward",
        authors: [{ name: "Sam Okonkwo", order: 3, interviewId: "iv1" }],
      },
    ],
    edges: [
      { id: "e1", from: "2", to: "1", polarity: "positive" },
      { id: "e2", from: "3", to: "1", polarity: "negative" },
    ],
  };

  it("parses versioned nodes, edges, and polarity", () => {
    const parsed = validateMapShape(map);
    expect(parsed.nodes).toHaveLength(3);
    expect(parsed.edges[1].polarity).toBe("negative");
    expect(cognitiveMapSchema.parse(parsed).type).toBe("cognitive");
  });

  it("treats heads as candidate goals and tails as options", () => {
    expect(heads(map).map((n) => n.id)).toEqual(["1"]);
    expect(tails(map).map((n) => n.id).sort()).toEqual(["2", "3"]);
  });

  it("detects opposing directed pairs rather than allowing a double-headed arrow", () => {
    const looped: CognitiveMap = {
      ...map,
      edges: [
        ...map.edges,
        { id: "e3", from: "1", to: "2", polarity: "positive" },
      ],
    };
    const pairs = findDoubleHeadedPairs(looped.edges);
    expect(pairs.length).toBeGreaterThan(0);
  });

  it("accepts generated maps and stamps authorship", () => {
    const built = fromGenerated(
      {
        nodes: [{ id: "1", order: 1, statement: "Cut weekend delays" }],
        edges: [],
      },
      "cognitive",
      "Sam Okonkwo",
      "iv1",
    );
    expect(built.nodes[0].authors[0].name).toBe("Sam Okonkwo");
    expect(built.nodes[0].authors[0].interviewId).toBe("iv1");
  });

  it("does not invent RICE scores", () => {
    const analysis = analyzeCauseMap(map);
    expect(analysis.rows.every((r) => !/RICE|impact\/effort/i.test(r.why))).toBe(true);
    expect(analysis.mode).toBe("by-eye");
  });
});

describe("token lookup and instance isolation", () => {
  beforeEach(async () => {
    process.env.DATABASE_URL = `file:./data/test-${randomBytes(6).toString("hex")}.db`;
    await resetDbCache();
  });

  afterEach(async () => {
    await resetDbCache();
  });

  it("resolves instance, invitee, and interview tokens to the same instance only", async () => {
    const client = await createClient({ name: "Harbor" });
    const project = await createProject({ clientId: client.id, name: "Discharge" });
    const instance = await createInstance({
      clientId: client.id,
      projectId: project.id,
      name: "A",
      situationOfInterest: "weekend delays",
      ...fenceFields(),
    });
    const invitee = await createInvitee({
      instanceId: instance.id,
      name: "Sam",
      email: "sam@example.org",
    });
    const interview = await createInterview({ instanceId: instance.id, inviteeId: invitee.id });

    const byInstance = await lookupPublicToken(instance.token);
    const byInvitee = await lookupPublicToken(invitee.token);
    const byInterview = await lookupPublicToken(interview.token);

    expect(byInstance?.instance.id).toBe(instance.id);
    expect(byInvitee?.instance.id).toBe(instance.id);
    expect(byInterview?.instance.id).toBe(instance.id);
    expect(byInvitee?.invitee?.id).toBe(invitee.id);
    expect(byInterview?.interview?.id).toBe(interview.id);
  });

  it("never returns another instance's interviews or maps", async () => {
    const clientA = await createClient({ name: "A Co" });
    const clientB = await createClient({ name: "B Co" });
    const projectA = await createProject({ clientId: clientA.id, name: "A project" });
    const projectB = await createProject({ clientId: clientB.id, name: "B project" });
    const instA = await createInstance({
      clientId: clientA.id,
      projectId: projectA.id,
      name: "A inst",
      situationOfInterest: "situation A",
      targetAudience: "CME-taking clinicians",
      interviewGoal: CME_GOAL,
    });
    const instB = await createInstance({
      clientId: clientB.id,
      projectId: projectB.id,
      name: "B inst",
      situationOfInterest: "situation B",
      targetAudience: "warehouse supervisors",
      interviewGoal: "understand how to cut slotting delays without adding night shifts",
    });
    const interviewA = await createInterview({ instanceId: instA.id });
    const interviewB = await createInterview({ instanceId: instB.id });
    await updateInterview(interviewB.id, {
      cognitiveMap: {
        version: 1,
        type: "cognitive",
        nodes: [
          {
            id: "1",
            order: 1,
            statement: "Secret B statement",
            authors: [{ name: "Bee", order: 1, interviewId: interviewB.id }],
          },
        ],
        edges: [],
      },
    });

    const listedA = await listInterviews(instA.id);
    expect(listedA.every((i) => i.instanceId === instA.id)).toBe(true);
    expect(listedA.map((i) => i.id)).toContain(interviewA.id);
    expect(listedA.map((i) => i.id)).not.toContain(interviewB.id);
    expect(JSON.stringify(listedA)).not.toContain("Secret B statement");

    const leaked = stripOtherInstances([interviewA, interviewB], instA.id);
    expect(leaked).toHaveLength(1);
    expect(leaked[0].id).toBe(interviewA.id);

    const foundB = await lookupPublicToken(instB.token);
    expect(foundB?.instance.id).toBe(instB.id);
    expect(foundB?.instance.situationOfInterest).toBe("situation B");
    expect(foundB?.instance.id).not.toBe(instA.id);

    const publicA = publicPayloadForLookup((await lookupPublicToken(instA.token))!);
    expect(JSON.stringify(publicA)).not.toContain("slotting");
    expect(JSON.stringify(publicA)).not.toContain(instB.interviewGoal);
    const promptA = interviewSystemPrompt({
      instance: instA,
      client: clientA,
      project: projectA,
      invitee: null,
      interview: null,
    });
    expect(promptA).toContain("CME");
    expect(promptA.toLowerCase()).not.toContain("slotting delays");

    const other = await getInterview(interviewB.id);
    expect(other?.instanceId).toBe(instB.id);
  });

  it("rejects short or unknown tokens without listing anything", async () => {
    expect(await lookupPublicToken("short")).toBeNull();
    expect(await lookupPublicToken("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
  });

  it("requires target audience and interview goal on an instance", async () => {
    const client = await createClient({ name: "Need Fence" });
    const project = await createProject({ clientId: client.id, name: "P" });
    await expect(
      createInstance({
        clientId: client.id,
        projectId: project.id,
        name: "No fence",
        situationOfInterest: "something",
        targetAudience: "",
        interviewGoal: "",
      }),
    ).rejects.toThrow(/interviewGoal|targetAudience/);
  });
});

describe("session clock", () => {
  it("cannot complete before 30 minutes without an explicit guest end", () => {
    const started = new Date(Date.now() - 12 * 60 * 1000).toISOString();
    const clock = sessionClock(started);
    expect(clock.beforeFloor).toBe(true);
    expect(canAgentConclude(clock, false)).toBe(false);
    const decision = decideCompletion({ clock, leave: "none", alreadyInvited: false });
    expect(decision.allow).toBe(false);
    if (!decision.allow) expect(decision.code).toBe("too_early");
  });

  it("invites once if the guest tries to leave before 30, then allows ended_early", () => {
    const clock = sessionClock(new Date(Date.now() - 8 * 60 * 1000).toISOString());
    const first = decideCompletion({ clock, leave: "leave", alreadyInvited: false });
    expect(first.allow).toBe(false);
    if (!first.allow) expect(first.code).toBe("invite_to_stay");
    const second = decideCompletion({ clock, leave: "insist", alreadyInvited: true });
    expect(second.allow).toBe(true);
    if (second.allow) expect(second.status).toBe("ended_early");
  });

  it("hard-stops at 40 minutes", () => {
    const started = new Date(Date.now() - (WALL_MS + 5_000)).toISOString();
    const clock = sessionClock(started);
    expect(clock.mustHardStop).toBe(true);
    expect(clock.elapsedMs).toBeGreaterThan(FLOOR_MS);
    const decision = decideCompletion({ clock, leave: "none", alreadyInvited: false });
    expect(decision.allow).toBe(true);
    if (decision.allow) expect(decision.reason).toBe("wall");
  });
});

describe("goal fence", () => {
  const lastInGoal = "Fit CME into a clinic day";

  it("does not send an off-goal interviewer question", () => {
    const proposed = "What's your favorite restaurant near the hospital?";
    const result = guardInterviewerOutput({
      proposed,
      guestText: "Clinic days are packed and CME never fits.",
      lastInGoalStatement: lastInGoal,
      interviewGoal: CME_GOAL,
      targetAudience: CME_AUDIENCE,
    });
    expect(result.verdict).toBe("redirected");
    expect(result.text.toLowerCase()).not.toContain("restaurant");
    const question = extractQuestions(result.text)[0];
    expect(question).toBeTruthy();
    expect(isQuestionOnGoal(question, CME_GOAL, CME_AUDIENCE)).toBe(true);
  });

  it("keeps the next question inside the instance goal after an off-goal guest story", () => {
    const guest =
      "Last summer I renovated my kitchen and fought with the contractor for months about the marble countertop. Nightmare. Anyway.";
    const proposed = "What happened with the contractor? Did you get the marble you wanted?";
    const result = guardInterviewerOutput({
      proposed,
      guestText: guest,
      lastInGoalStatement: lastInGoal,
      interviewGoal: CME_GOAL,
      targetAudience: CME_AUDIENCE,
    });
    expect(result.log.guestOffGoal).toBe(true);
    expect(result.verdict).toBe("redirected");
    expect(result.text.toLowerCase()).not.toMatch(/contractor|marble|kitchen/);
    const question = extractQuestions(result.text)[0];
    expect(question).toBeTruthy();
    expect(isQuestionOnGoal(question, CME_GOAL, CME_AUDIENCE)).toBe(true);
    expect(result.text.toLowerCase()).toMatch(/cme|clinic|format|lifestyle|hcp|friction|experience|moment|how might|why does/);
  });

  it("captures only the in-goal fragment when the guest mixes a tangent with the goal", () => {
    const guest =
      "The kitchen renovation was hell. The only CME I get done is on the train after clinic.";
    const proposed = "Tell me more about the renovation?";
    const result = guardInterviewerOutput({
      proposed,
      guestText: guest,
      lastInGoalStatement: lastInGoal,
      interviewGoal: CME_GOAL,
      targetAudience: CME_AUDIENCE,
    });
    expect(result.verdict).toBe("redirected");
    expect(result.text.toLowerCase()).not.toMatch(/renovation|kitchen/);
    expect(result.text.toLowerCase()).toMatch(/cme|train|clinic/);
    expect(isQuestionOnGoal(extractQuestions(result.text)[0], CME_GOAL, CME_AUDIENCE)).toBe(true);
  });

  it("ladders from the last in-goal statement, not the tangent", () => {
    const last = lastInGoalStatement(
      [
        { role: "user", text: "I only finish CME on the train after clinic." },
        { role: "user", text: "My brother's wedding in Italy was chaotic and the flight was a mess." },
      ],
      CME_GOAL,
      CME_AUDIENCE,
    );
    expect(last?.toLowerCase()).toMatch(/cme|train|clinic/);
    expect(last?.toLowerCase()).not.toMatch(/wedding|italy/);
  });
});
