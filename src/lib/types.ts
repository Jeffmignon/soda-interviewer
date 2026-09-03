export type InterviewStatus = "not_started" | "in_progress" | "completed" | "ended_early";

export type Client = {
  id: string;
  name: string;
  website: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Project = {
  id: string;
  clientId: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
};

export type Instance = {
  id: string;
  clientId: string;
  projectId: string;
  token: string;
  name: string;
  situationOfInterest: string;
  interviewReason: string;
  targetAudience: string;
  interviewGoal: string;
  causeMap: CognitiveMap | null;
  analysis: AnalysisRecord | null;
  createdAt: string;
  updatedAt: string;
};

export type Invitee = {
  id: string;
  instanceId: string;
  token: string;
  name: string;
  email: string;
  linkedinUrl: string;
  createdAt: string;
};

export type GoalLogEntry = {
  at: string;
  proposed: string;
  sent: string;
  verdict: "on-goal" | "redirected";
  guestOffGoal: boolean;
  reason: string;
};

export type Interview = {
  id: string;
  instanceId: string;
  inviteeId: string | null;
  token: string;
  status: InterviewStatus;
  messages: unknown[];
  cognitiveMap: CognitiveMap | null;
  startedAt: string;
  earlyExitInvitedAt: string | null;
  goalLog: GoalLogEntry[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type MapNodeAuthor = {
  name: string;
  order: number;
  interviewId?: string;
};

export type MapNode = {
  id: string;
  order: number;
  statement: string;
  authors: MapNodeAuthor[];
  mergedFrom?: string[];
};

export type MapPolarity = "positive" | "negative";

export type MapEdge = {
  id: string;
  from: string;
  to: string;
  polarity: MapPolarity;
};

export type CognitiveMap = {
  version: 1;
  type: "cognitive" | "cause";
  nodes: MapNode[];
  edges: MapEdge[];
};

export type SpreadsheetRow = {
  priority: number;
  statement: string;
  type: "goal" | "key_issue" | "potent_option" | "composite_tail" | "other";
  why: string;
  authors: string;
  notes: string;
};

export type AnalysisRecord = {
  createdAt: string;
  mode: "structural" | "by-eye";
  note: string;
  goalSystem: string;
  domain: string;
  central: string;
  clusters: string;
  teardrops: string;
  rows: SpreadsheetRow[];
};

export type InstanceContext = {
  instance: Instance;
  client: Client;
  project: Project;
  invitee: Invitee | null;
  interview: Interview | null;
};

export type PublicTokenKind = "instance" | "invitee" | "interview";

export type PublicTokenLookup = {
  kind: PublicTokenKind;
  instance: Instance;
  client: Client;
  project: Project;
  invitee: Invitee | null;
  interview: Interview | null;
};

export type InstanceBundle = {
  instance: Instance;
  client: Client;
  project: Project;
  invitees: Invitee[];
  interviews: Interview[];
};
