import "server-only";
import fs from "node:fs";
import path from "node:path";

// Dev: PGlite (Postgres embutido, dados em .data/pglite). Produção: DATABASE_URL (Neon).
type Row = Record<string, unknown>;
interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
}

const g = globalThis as unknown as { __db?: Promise<Db> };

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim();
  let db: Db;
  if (url) {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: url, max: 5 });
    db = {
      async query<T>(sql: string, params: unknown[] = []) {
        return (await pool.query(sql, params)).rows as T[];
      },
      async exec(sql) {
        await pool.query(sql);
      },
    };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    // Só em dev; o comentário impede o Turbopack de empacotar a pasta inteira no deploy.
    const dir = process.env.PGLITE_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "pglite");
    fs.mkdirSync(dir, { recursive: true });
    const lite = await PGlite.create(dir);
    db = {
      async query<T>(sql: string, params: unknown[] = []) {
        return (await lite.query<T>(sql, params)).rows;
      },
      async exec(sql) {
        await lite.exec(sql);
      },
    };
  }
  await migrate(db);
  return db;
}

// db/*.sql entram no deploy por outputFileTracingIncludes (next.config.ts).
function sqlFile(name: string) {
  return fs.readFileSync(path.join(/* turbopackIgnore: true */ process.cwd(), "db", name), "utf8");
}

async function migrate(db: Db) {
  const [{ exists }] = await db.query<{ exists: boolean }>(
    "select to_regclass('public.users') is not null as exists",
  );
  if (!exists) await db.exec(sqlFile("schema.sql"));
  // Mudanças posteriores ao schema inicial; idempotentes, rodam sempre.
  await db.exec(sqlFile("migrations.sql"));
}

export function getDb(): Promise<Db> {
  g.__db ??= open();
  return g.__db;
}

export async function query<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function one<T = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  return (await query<T>(sql, params))[0] ?? null;
}
