// One-off: apply packages/db/migrations to the production Supabase project via the
// Management API query endpoint (no DB password needed — uses SUPABASE_ACCESS_TOKEN).
// Usage: SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... npx tsx packages/db/scripts/migrate-management-api.ts
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = process.env.SUPABASE_PROJECT_REF;
if (!token || !ref) throw new Error('SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF required');
const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

async function query(sql: string): Promise<unknown[]> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Query failed ${response.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as unknown[];
}

const dir = fileURLToPath(new URL('../migrations', import.meta.url));
await query(
  'CREATE TABLE IF NOT EXISTS _dev_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now())',
);
const applied = new Set(
  ((await query('SELECT name FROM _dev_migrations')) as { name: string }[]).map((r) => r.name),
);
for (const name of (await readdir(dir)).filter((n) => n.endsWith('.sql')).sort()) {
  if (applied.has(name)) {
    console.log(`skip ${name} (already applied)`);
    continue;
  }
  const sql = await readFile(`${dir}/${name}`, 'utf8');
  await query(`BEGIN;\n${sql}\nINSERT INTO _dev_migrations (name) VALUES ('${name}');\nCOMMIT;`);
  console.log(`applied ${name}`);
}
console.log('done');
