import { getSql } from "@/lib/db";
import { createId, createUnguessableToken, nowIso } from "@/lib/ids";
import type {
  AnalysisRecord,
  Client,
  CognitiveMap,
  GoalLogEntry,
  Instance,
  InstanceBundle,
  Interview,
  InterviewStatus,
  Invitee,
  Project,
  PublicTokenLookup,
} from "@/lib/types";

type ClientRow = {
  id: string;
  name: string;
  website: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

type ProjectRow = {
  id: string;
  client_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type InstanceRow = {
  id: string;
  client_id: string;
  project_id: string;
  token: string;
  name: string;
  situation_of_interest: string;
  interview_reason: string;
  target_audience: string;
  interview_goal: string;
  cause_map: string | null;
  analysis: string | null;
  created_at: string;
  updated_at: string;
};

type InviteeRow = {
  id: string;
  instance_id: string;
  token: string;
  name: string;
  email: string;
  linkedin_url: string;
  created_at: string;
};

type InterviewRow = {
  id: string;
  instance_id: string;
  invitee_id: string | null;
  token: string;
  status: InterviewStatus;
  messages: string;
  cognitive_map: string | null;
  started_at: string | null;
  early_exit_invited_at: string | null;
  goal_log: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    website: row.website,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInstance(row: InstanceRow): Instance {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    token: row.token,
    name: row.name,
    situationOfInterest: row.situation_of_interest,
    interviewReason: row.interview_reason,
    targetAudience: row.target_audience ?? "",
    interviewGoal: row.interview_goal ?? "",
    causeMap: parseJson<CognitiveMap | null>(row.cause_map, null),
    analysis: parseJson<AnalysisRecord | null>(row.analysis, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvitee(row: InviteeRow): Invitee {
  return {
    id: row.id,
    instanceId: row.instance_id,
    token: row.token,
    name: row.name,
    email: row.email,
    linkedinUrl: row.linkedin_url,
    createdAt: row.created_at,
  };
}

function mapInterview(row: InterviewRow): Interview {
  return {
    id: row.id,
    instanceId: row.instance_id,
    inviteeId: row.invitee_id,
    token: row.token,
    status: row.status,
    messages: parseJson<unknown[]>(row.messages, []),
    cognitiveMap: parseJson<CognitiveMap | null>(row.cognitive_map, null),
    startedAt: row.started_at ?? row.created_at,
    earlyExitInvitedAt: row.early_exit_invited_at,
    goalLog: parseJson<GoalLogEntry[]>(row.goal_log, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export async function listClients(): Promise<Client[]> {
  const sql = await getSql();
  const rows = await sql.all<ClientRow>("SELECT * FROM clients ORDER BY created_at DESC");
  return rows.map(mapClient);
}

export async function getClient(id: string): Promise<Client | undefined> {
  const sql = await getSql();
  const row = await sql.get<ClientRow>("SELECT * FROM clients WHERE id = ?", [id]);
  return row ? mapClient(row) : undefined;
}

export async function createClient(input: {
  name: string;
  website?: string;
  notes?: string;
}): Promise<Client> {
  const sql = await getSql();
  const now = nowIso();
  const row: ClientRow = {
    id: createId(),
    name: input.name.trim(),
    website: input.website?.trim() ?? "",
    notes: input.notes?.trim() ?? "",
    created_at: now,
    updated_at: now,
  };
  await sql.run(
    "INSERT INTO clients (id, name, website, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [row.id, row.name, row.website, row.notes, row.created_at, row.updated_at],
  );
  return mapClient(row);
}

export async function updateClient(
  id: string,
  input: { name?: string; website?: string; notes?: string },
): Promise<Client | undefined> {
  const existing = await getClient(id);
  if (!existing) return undefined;
  const next: Client = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    website: input.website?.trim() ?? existing.website,
    notes: input.notes?.trim() ?? existing.notes,
    updatedAt: nowIso(),
  };
  const sql = await getSql();
  await sql.run(
    "UPDATE clients SET name = ?, website = ?, notes = ?, updated_at = ? WHERE id = ?",
    [next.name, next.website, next.notes, next.updatedAt, id],
  );
  return next;
}

export async function deleteClient(id: string): Promise<void> {
  const projects = await listProjects(id);
  for (const project of projects) {
    await deleteProject(project.id);
  }
  const sql = await getSql();
  await sql.run("DELETE FROM clients WHERE id = ?", [id]);
}

export async function listProjects(clientId?: string): Promise<Project[]> {
  const sql = await getSql();
  const rows = clientId
    ? await sql.all<ProjectRow>("SELECT * FROM projects WHERE client_id = ? ORDER BY created_at DESC", [clientId])
    : await sql.all<ProjectRow>("SELECT * FROM projects ORDER BY created_at DESC");
  return rows.map(mapProject);
}

export async function getProject(id: string): Promise<Project | undefined> {
  const sql = await getSql();
  const row = await sql.get<ProjectRow>("SELECT * FROM projects WHERE id = ?", [id]);
  return row ? mapProject(row) : undefined;
}

export async function createProject(input: {
  clientId: string;
  name: string;
  description?: string;
}): Promise<Project> {
  const sql = await getSql();
  const now = nowIso();
  const row: ProjectRow = {
    id: createId(),
    client_id: input.clientId,
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    created_at: now,
    updated_at: now,
  };
  await sql.run(
    "INSERT INTO projects (id, client_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    [row.id, row.client_id, row.name, row.description, row.created_at, row.updated_at],
  );
  return mapProject(row);
}

export async function updateProject(
  id: string,
  input: { name?: string; description?: string },
): Promise<Project | undefined> {
  const existing = await getProject(id);
  if (!existing) return undefined;
  const next: Project = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    description: input.description?.trim() ?? existing.description,
    updatedAt: nowIso(),
  };
  const sql = await getSql();
  await sql.run(
    "UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?",
    [next.name, next.description, next.updatedAt, id],
  );
  return next;
}

export async function deleteProject(id: string): Promise<void> {
  const sql = await getSql();
  const instances = await sql.all<InstanceRow>("SELECT * FROM instances WHERE project_id = ?", [id]);
  for (const instance of instances) {
    await deleteInstance(instance.id);
  }
  await sql.run("DELETE FROM projects WHERE id = ?", [id]);
}

export async function listInstances(): Promise<Instance[]> {
  const sql = await getSql();
  const rows = await sql.all<InstanceRow>("SELECT * FROM instances ORDER BY created_at DESC");
  return rows.map(mapInstance);
}

export async function getInstance(id: string): Promise<Instance | undefined> {
  const sql = await getSql();
  const row = await sql.get<InstanceRow>("SELECT * FROM instances WHERE id = ?", [id]);
  return row ? mapInstance(row) : undefined;
}

export async function getInstanceByToken(token: string): Promise<Instance | undefined> {
  const sql = await getSql();
  const row = await sql.get<InstanceRow>("SELECT * FROM instances WHERE token = ?", [token]);
  return row ? mapInstance(row) : undefined;
}

export async function createInstance(input: {
  clientId: string;
  projectId: string;
  name: string;
  situationOfInterest: string;
  interviewReason?: string;
  targetAudience: string;
  interviewGoal: string;
}): Promise<Instance> {
  if (!input.targetAudience?.trim() || !input.interviewGoal?.trim()) {
    throw new Error("targetAudience and interviewGoal are required.");
  }
  const sql = await getSql();
  const now = nowIso();
  const row: InstanceRow = {
    id: createId(),
    client_id: input.clientId,
    project_id: input.projectId,
    token: createUnguessableToken(),
    name: input.name.trim(),
    situation_of_interest: input.situationOfInterest.trim(),
    interview_reason: input.interviewReason?.trim() ?? "",
    target_audience: input.targetAudience.trim(),
    interview_goal: input.interviewGoal.trim(),
    cause_map: null,
    analysis: null,
    created_at: now,
    updated_at: now,
  };
  await sql.run(
    `INSERT INTO instances
      (id, client_id, project_id, token, name, situation_of_interest, interview_reason, target_audience, interview_goal, cause_map, analysis, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.client_id,
      row.project_id,
      row.token,
      row.name,
      row.situation_of_interest,
      row.interview_reason,
      row.target_audience,
      row.interview_goal,
      row.cause_map,
      row.analysis,
      row.created_at,
      row.updated_at,
    ],
  );
  return mapInstance(row);
}

export async function updateInstance(
  id: string,
  input: {
    name?: string;
    situationOfInterest?: string;
    interviewReason?: string;
    targetAudience?: string;
    interviewGoal?: string;
    causeMap?: CognitiveMap | null;
    analysis?: AnalysisRecord | null;
  },
): Promise<Instance | undefined> {
  const existing = await getInstance(id);
  if (!existing) return undefined;
  const next: Instance = {
    ...existing,
    name: input.name?.trim() ?? existing.name,
    situationOfInterest: input.situationOfInterest?.trim() ?? existing.situationOfInterest,
    interviewReason: input.interviewReason?.trim() ?? existing.interviewReason,
    targetAudience: input.targetAudience?.trim() ?? existing.targetAudience,
    interviewGoal: input.interviewGoal?.trim() ?? existing.interviewGoal,
    causeMap: input.causeMap !== undefined ? input.causeMap : existing.causeMap,
    analysis: input.analysis !== undefined ? input.analysis : existing.analysis,
    updatedAt: nowIso(),
  };
  const sql = await getSql();
  await sql.run(
    `UPDATE instances
     SET name = ?, situation_of_interest = ?, interview_reason = ?, target_audience = ?, interview_goal = ?, cause_map = ?, analysis = ?, updated_at = ?
     WHERE id = ?`,
    [
      next.name,
      next.situationOfInterest,
      next.interviewReason,
      next.targetAudience,
      next.interviewGoal,
      next.causeMap ? JSON.stringify(next.causeMap) : null,
      next.analysis ? JSON.stringify(next.analysis) : null,
      next.updatedAt,
      id,
    ],
  );
  return next;
}

export async function deleteInstance(id: string): Promise<void> {
  const sql = await getSql();
  await sql.run("DELETE FROM interviews WHERE instance_id = ?", [id]);
  await sql.run("DELETE FROM invitees WHERE instance_id = ?", [id]);
  await sql.run("DELETE FROM instances WHERE id = ?", [id]);
}

export async function listInvitees(instanceId: string): Promise<Invitee[]> {
  const sql = await getSql();
  const rows = await sql.all<InviteeRow>(
    "SELECT * FROM invitees WHERE instance_id = ? ORDER BY created_at DESC",
    [instanceId],
  );
  return rows.map(mapInvitee);
}

export async function getInvitee(id: string): Promise<Invitee | undefined> {
  const sql = await getSql();
  const row = await sql.get<InviteeRow>("SELECT * FROM invitees WHERE id = ?", [id]);
  return row ? mapInvitee(row) : undefined;
}

export async function getInviteeByToken(token: string): Promise<Invitee | undefined> {
  const sql = await getSql();
  const row = await sql.get<InviteeRow>("SELECT * FROM invitees WHERE token = ?", [token]);
  return row ? mapInvitee(row) : undefined;
}

export async function createInvitee(input: {
  instanceId: string;
  name: string;
  email: string;
  linkedinUrl?: string;
}): Promise<Invitee> {
  const sql = await getSql();
  const row: InviteeRow = {
    id: createId(),
    instance_id: input.instanceId,
    token: createUnguessableToken(),
    name: input.name.trim(),
    email: input.email.trim(),
    linkedin_url: input.linkedinUrl?.trim() ?? "",
    created_at: nowIso(),
  };
  await sql.run(
    "INSERT INTO invitees (id, instance_id, token, name, email, linkedin_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [row.id, row.instance_id, row.token, row.name, row.email, row.linkedin_url, row.created_at],
  );
  return mapInvitee(row);
}

export async function deleteInvitee(id: string, instanceId: string): Promise<boolean> {
  const existing = await getInvitee(id);
  if (!existing || existing.instanceId !== instanceId) return false;
  const sql = await getSql();
  await sql.run("DELETE FROM invitees WHERE id = ? AND instance_id = ?", [id, instanceId]);
  return true;
}

export async function listInterviews(instanceId: string): Promise<Interview[]> {
  const sql = await getSql();
  const rows = await sql.all<InterviewRow>(
    "SELECT * FROM interviews WHERE instance_id = ? ORDER BY created_at DESC",
    [instanceId],
  );
  return rows.map(mapInterview);
}

export async function getInterview(id: string): Promise<Interview | undefined> {
  const sql = await getSql();
  const row = await sql.get<InterviewRow>("SELECT * FROM interviews WHERE id = ?", [id]);
  return row ? mapInterview(row) : undefined;
}

export async function getInterviewByToken(token: string): Promise<Interview | undefined> {
  const sql = await getSql();
  const row = await sql.get<InterviewRow>("SELECT * FROM interviews WHERE token = ?", [token]);
  return row ? mapInterview(row) : undefined;
}

export async function getInterviewForInvitee(inviteeId: string): Promise<Interview | undefined> {
  const sql = await getSql();
  const row = await sql.get<InterviewRow>(
    "SELECT * FROM interviews WHERE invitee_id = ? ORDER BY created_at DESC",
    [inviteeId],
  );
  return row ? mapInterview(row) : undefined;
}

export async function createInterview(input: {
  instanceId: string;
  inviteeId?: string | null;
  messages?: unknown[];
}): Promise<Interview> {
  const sql = await getSql();
  const now = nowIso();
  const row: InterviewRow = {
    id: createId(),
    instance_id: input.instanceId,
    invitee_id: input.inviteeId ?? null,
    token: createUnguessableToken(),
    status: "in_progress",
    messages: JSON.stringify(input.messages ?? []),
    cognitive_map: null,
    started_at: now,
    early_exit_invited_at: null,
    goal_log: "[]",
    created_at: now,
    updated_at: now,
    completed_at: null,
  };
  await sql.run(
    `INSERT INTO interviews
      (id, instance_id, invitee_id, token, status, messages, cognitive_map, started_at, early_exit_invited_at, goal_log, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.instance_id,
      row.invitee_id,
      row.token,
      row.status,
      row.messages,
      row.cognitive_map,
      row.started_at,
      row.early_exit_invited_at,
      row.goal_log,
      row.created_at,
      row.updated_at,
      row.completed_at,
    ],
  );
  return mapInterview(row);
}

export async function updateInterview(
  id: string,
  input: {
    status?: InterviewStatus;
    messages?: unknown[];
    cognitiveMap?: CognitiveMap | null;
    completedAt?: string | null;
    startedAt?: string;
    earlyExitInvitedAt?: string | null;
    goalLog?: GoalLogEntry[];
  },
  instanceId?: string,
): Promise<Interview | undefined> {
  const existing = await getInterview(id);
  if (!existing) return undefined;
  if (instanceId && existing.instanceId !== instanceId) return undefined;
  const next: Interview = {
    ...existing,
    status: input.status ?? existing.status,
    messages: input.messages ?? existing.messages,
    cognitiveMap: input.cognitiveMap !== undefined ? input.cognitiveMap : existing.cognitiveMap,
    completedAt: input.completedAt !== undefined ? input.completedAt : existing.completedAt,
    startedAt: input.startedAt ?? existing.startedAt,
    earlyExitInvitedAt:
      input.earlyExitInvitedAt !== undefined ? input.earlyExitInvitedAt : existing.earlyExitInvitedAt,
    goalLog: input.goalLog ?? existing.goalLog,
    updatedAt: nowIso(),
  };
  const sql = await getSql();
  await sql.run(
    `UPDATE interviews
     SET status = ?, messages = ?, cognitive_map = ?, completed_at = ?, started_at = ?, early_exit_invited_at = ?, goal_log = ?, updated_at = ?
     WHERE id = ? AND instance_id = ?`,
    [
      next.status,
      JSON.stringify(next.messages),
      next.cognitiveMap ? JSON.stringify(next.cognitiveMap) : null,
      next.completedAt,
      next.startedAt,
      next.earlyExitInvitedAt,
      JSON.stringify(next.goalLog),
      next.updatedAt,
      id,
      existing.instanceId,
    ],
  );
  return next;
}

export async function getInstanceBundle(id: string): Promise<InstanceBundle | undefined> {
  const instance = await getInstance(id);
  if (!instance) return undefined;
  const [client, project, invitees, interviews] = await Promise.all([
    getClient(instance.clientId),
    getProject(instance.projectId),
    listInvitees(id),
    listInterviews(id),
  ]);
  if (!client || !project) return undefined;
  return { instance, client, project, invitees, interviews };
}

/**
 * Public token lookup. A token may identify an instance, a specific invitee,
 * or an interview already bound to that instance. Never returns other instances.
 */
export async function lookupPublicToken(token: string): Promise<PublicTokenLookup | null> {
  if (!token || token.length < 16) return null;

  const interview = await getInterviewByToken(token);
  if (interview) {
    const bundle = await hydrateInstance(interview.instanceId);
    if (!bundle) return null;
    const invitee = interview.inviteeId ? ((await getInvitee(interview.inviteeId)) ?? null) : null;
    return { kind: "interview", ...bundle, invitee, interview };
  }

  const invitee = await getInviteeByToken(token);
  if (invitee) {
    const bundle = await hydrateInstance(invitee.instanceId);
    if (!bundle) return null;
    const existing = await getInterviewForInvitee(invitee.id);
    return { kind: "invitee", ...bundle, invitee, interview: existing ?? null };
  }

  const instance = await getInstanceByToken(token);
  if (instance) {
    const bundle = await hydrateInstance(instance.id);
    if (!bundle) return null;
    return { kind: "instance", ...bundle, invitee: null, interview: null };
  }

  return null;
}

async function hydrateInstance(instanceId: string) {
  const instance = await getInstance(instanceId);
  if (!instance) return null;
  const client = await getClient(instance.clientId);
  const project = await getProject(instance.projectId);
  if (!client || !project) return null;
  return { instance, client, project };
}

export function interviewsBelongToInstance(
  interviews: Interview[],
  instanceId: string,
): boolean {
  return interviews.every((interview) => interview.instanceId === instanceId);
}

export function assertSameInstance(entityInstanceId: string, instanceId: string): boolean {
  return entityInstanceId === instanceId;
}
