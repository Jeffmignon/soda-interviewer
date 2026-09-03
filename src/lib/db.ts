import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

type Dialect = "postgres" | "sqlite";

export type SqlClient = {
  dialect: Dialect;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
  close(): Promise<void>;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS instances (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  situation_of_interest TEXT NOT NULL,
  interview_reason TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  interview_goal TEXT NOT NULL DEFAULT '',
  cause_map TEXT,
  analysis TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS invitees (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  linkedin_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS interviews (
  id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  invitee_id TEXT,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  messages TEXT NOT NULL DEFAULT '[]',
  cognitive_map TEXT,
  started_at TEXT,
  early_exit_invited_at TEXT,
  goal_log TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_client ON projects(client_id);
CREATE INDEX IF NOT EXISTS idx_instances_client ON instances(client_id);
CREATE INDEX IF NOT EXISTS idx_instances_project ON instances(project_id);
CREATE INDEX IF NOT EXISTS idx_invitees_instance ON invitees(instance_id);
CREATE INDEX IF NOT EXISTS idx_interviews_instance ON interviews(instance_id);
`;

type Cache = { client: SqlClient; schemaReady: Promise<void> };

const globalForDb = globalThis as unknown as { __sodaDb?: Cache };

function databaseUrl(): string {
  return (
    process.env.DATABASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    "file:./data/dev.db"
  );
}

function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

function toPostgres(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function createPostgresClient(url: string): Promise<SqlClient> {
  const postgres = (await import("postgres")).default;
  const sql = postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });

  const all = async <T>(text: string, params: unknown[] = []) => {
    const rows = await sql.unsafe(toPostgres(text), params as never[]);
    return [...rows] as T[];
  };

  return {
    dialect: "postgres",
    all,
    async get<T>(text: string, params: unknown[] = []) {
      const rows = await all<T>(text, params);
      return rows[0];
    },
    async run(text: string, params: unknown[] = []) {
      await sql.unsafe(toPostgres(text), params as never[]);
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

async function createSqliteClient(url: string): Promise<SqlClient> {
  const Database = (await import("better-sqlite3")).default;
  let path = url.replace(/^file:/, "");
  if (path === ":memory:" || path === "/:memory:" || url === ":memory:") {
    path = ":memory:";
  } else {
    path = resolve(process.cwd(), path);
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  return {
    dialect: "sqlite",
    async all<T>(text: string, params: unknown[] = []) {
      return db.prepare(text).all(...params) as T[];
    },
    async get<T>(text: string, params: unknown[] = []) {
      return db.prepare(text).get(...params) as T | undefined;
    },
    async run(text: string, params: unknown[] = []) {
      db.prepare(text).run(...params);
    },
    async close() {
      db.close();
    },
  };
}

async function createClient(): Promise<SqlClient> {
  const url = databaseUrl();
  if (isPostgresUrl(url)) return createPostgresClient(url);
  return createSqliteClient(url);
}

export async function getSql(): Promise<SqlClient> {
  if (!globalForDb.__sodaDb) {
    const client = await createClient();
    globalForDb.__sodaDb = {
      client,
      schemaReady: applySchema(client),
    };
  }
  await globalForDb.__sodaDb.schemaReady;
  return globalForDb.__sodaDb.client;
}

async function applySchema(client: SqlClient): Promise<void> {
  const statements = SCHEMA.split(";").map((s) => s.trim()).filter(Boolean);
  for (const statement of statements) {
    await client.run(statement);
  }
  const alters = [
    "ALTER TABLE instances ADD COLUMN target_audience TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE instances ADD COLUMN interview_goal TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE interviews ADD COLUMN started_at TEXT",
    "ALTER TABLE interviews ADD COLUMN early_exit_invited_at TEXT",
    "ALTER TABLE interviews ADD COLUMN goal_log TEXT NOT NULL DEFAULT '[]'",
  ];
  for (const statement of alters) {
    try {
      await client.run(statement);
    } catch {
      // Column already exists on a warmed database.
    }
  }
}

/** Test helper: drop the cached connection so a new DATABASE_URL is picked up. */
export async function resetDbCache(): Promise<void> {
  if (globalForDb.__sodaDb) {
    await globalForDb.__sodaDb.client.close().catch(() => undefined);
    globalForDb.__sodaDb = undefined;
  }
}

export function currentDatabaseUrl(): string {
  return databaseUrl();
}

export function isSqliteFallback(): boolean {
  return !isPostgresUrl(databaseUrl());
}
