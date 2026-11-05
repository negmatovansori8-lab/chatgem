import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";

const DATA_DIR = path.join(process.cwd(), ".data");

type StoreGlobal = typeof globalThis & { chatgemPool?: Pool; chatgemStoreReady?: Promise<void> };

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || "";
}

function poolConfig(url: string): PoolConfig {
  const local = /localhost|127\.0\.0\.1/.test(url);
  const connectionString = url
    .replace(/([?&])channel_binding=[^&]*/g, "$1")
    .replace(/[?&]$/, "");
  return {
    connectionString,
    max: 4,
    ssl: local ? undefined : { rejectUnauthorized: false },
  };
}

function getPool() {
  const url = databaseUrl();
  if (!url) return null;
  const g = globalThis as StoreGlobal;
  if (!g.chatgemPool) g.chatgemPool = new Pool(poolConfig(url));
  return g.chatgemPool;
}

async function ensureTable(pool: Pool) {
  const g = globalThis as StoreGlobal;
  if (!g.chatgemStoreReady) {
    g.chatgemStoreReady = pool
      .query(
        `CREATE TABLE IF NOT EXISTS app_documents (
          name text PRIMARY KEY,
          body jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        )`,
      )
      .then(() => undefined);
  }
  await g.chatgemStoreReady;
}

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readLocal<T>(filename: string, fallback: T): Promise<T> {
  await ensureDir();
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** JSON store. With DATABASE_URL the row survives a Render restart; otherwise it stays in .data. */
export async function readJsonFile<T>(filename: string, fallback: T): Promise<T> {
  const pool = getPool();
  if (!pool) return readLocal(filename, fallback);
  await ensureTable(pool);
  const found = await pool.query<{ body: T }>("SELECT body FROM app_documents WHERE name = $1", [
    filename,
  ]);
  const row = found.rows[0];
  if (row) return row.body;
  const local = await readLocal<T | undefined>(filename, undefined);
  if (local !== undefined) {
    await pool.query(
      `INSERT INTO app_documents (name, body, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (name) DO NOTHING`,
      [filename, JSON.stringify(local)],
    );
    return local;
  }
  return fallback;
}

export async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await ensureDir();
  await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), "utf8");
  const pool = getPool();
  if (!pool) return;
  await ensureTable(pool);
  await pool.query(
    `INSERT INTO app_documents (name, body, updated_at)
     VALUES ($1, $2::jsonb, now())
     ON CONFLICT (name) DO UPDATE SET body = EXCLUDED.body, updated_at = now()`,
    [filename, JSON.stringify(data)],
  );
}
