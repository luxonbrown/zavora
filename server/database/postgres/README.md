# ZAVORA — external PostgreSQL database

This folder holds everything needed to run the API against a **hosted
PostgreSQL** instead of the default local MySQL/MariaDB. MySQL stays the
default, so a fresh clone keeps working with no database; set two env vars
and the same Express code talks to Postgres through a translation shim.

```
server/database/postgres/
├── schema.sql          Postgres DDL (port of ../schema.sql) — 17 tables
├── pool.js             pg Pool exposing the SAME API as ../pool.js
│                       (? -> $n, backticks, ON DUPLICATE -> ON CONFLICT,
│                       RETURNING id -> insertId, affectedRows)
├── schema-runner.js    applies schema.sql to DATABASE_URL (destructive)
├── seed.js             same demo data as ../seed.js (TRUNCATE ... CASCADE)
├── check-connection.js TCP/auth/version/table-presence probe
├── .env.example        DB_DRIVER + DATABASE_URL (.. or discrete PG vars)
└── README.md           this file
```

## 1. Create the hosted database (pick one, ~2 min)

| Provider | What to do | What you get |
| --- | --- | --- |
| **Neon** (recommended) | neon.tech → New Project → name `zavora` → copy **Connection string** | `postgresql://user:pass@ep-xxx.aws.neon.tech/zavora?sslmode=require` |
| **Supabase** | supabase.com → New Project → Settings → Database → **Connection string** (URI) | `postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres?...` |
| **Railway/Render** | New → PostgreSQL → Connect → **External Connection String** | `postgresql://...` |

Any Postgres 14+ works, including a local Docker one:

```bash
docker run --name zavora-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=zavora -p 5432:5432 -d postgres:16
# DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/zavora
```

## 2. Point the server at it (PowerShell)

```powershell
cd server
npm install            # adds pg (already in package.json)
$env:DB_DRIVER = 'postgres'
$env:DATABASE_URL = 'postgresql://user:pass@host:5432/zavora?sslmode=require'
npm run db:pg:check   # reachable? version? tables present?
npm run db:pg:schema  # DESTRUCTIVE: drops + recreates all 17 tables
npm run db:pg:seed    # demo catalogue / users / orders (same as MySQL seed)
npm run dev           # API on http://localhost:5000, now on Postgres
```

Discrete vars work too when `DATABASE_URL` is empty
(`DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD`/`DB_NAME`, `DB_SSL=true` for hosted).
Port defaults to **5432** unless you set `DB_PORT` (a leftover 3306 is
auto-corrected to 5432 in postgres/pool.js, so switching drivers cannot
silently point Postgres at MySQL's port).

## 3. Switching back

```powershell
$env:DB_DRIVER = 'mysql'   # or remove the var entirely (default)
npm run db:reset           # MySQL schema + seed, unchanged
```

`server/database/pool.js` dispatches on `config.db.driver`:
`mysql` → the original mysql2 pool, `postgres` → this folder's `pool.js`.
No controller or route imports change.

## 4. What the shim does (and does not do)

Kept identical on purpose: placeholder style (`?` in source, translated to
`$n` at runtime), `execute()` returning `{ insertId, affectedRows }`,
transaction `conn.query()` → `[rows, fields]` / `conn.execute()` →
`[header, fields]` tuple shapes, NUMERIC-as-string money handling.

Translated per statement:

- `` `name` `` → `name` (backtick strip)
- `SET FOREIGN_KEY_CHECKS = 0/1` → no-op
- `TRUNCATE TABLE x` → `TRUNCATE TABLE x RESTART IDENTITY CASCADE`
- `ON DUPLICATE KEY UPDATE a = VALUES(a)` →
  `ON CONFLICT (<keys>) DO UPDATE SET a = EXCLUDED.a`, with targets
  `store_settings(setting_key)`, `product_variants(product_id, name)`,
  `cart_items(cart_id, product_id, variant_key)`,
  `product_supplier(product_id, supplier)`, `categories(slug)`, `products(slug)`
- bare `INSERT` → `INSERT ... RETURNING id`

Deliberate source-level branch (not shim-rewritable):

- **Search.** MySQL uses `MATCH(...) AGAINST (... IN BOOLEAN MODE)` with a
  `LIKE` retry; on Postgres `server/lib/catalog.js` skips straight to the
  `ILIKE` path (backed by `pg_trgm` + tsvector indexes in schema.sql).

MySQL-only syntax that never reaches Postgres at runtime: `ENUM`,
`ENGINE=InnoDB`, `CHARSET`, `FOREIGN_KEY_CHECKS`, `information_schema`
table-listing (the PG runner queries `pg_tables` instead).

## 5. Scripts

```bash
npm run db:pg:check   # probe connection + table presence (exit 2 if schema missing)
npm run db:pg:schema  # apply postgres/schema.sql (DROPs everything)
npm run db:pg:seed    # seed demo data via postgres/pool.js
npm run db:pg:reset   # schema + seed
```

## 6. Troubleshooting

- `connection FAILED: password authentication failed` → wrong user/password
  in `DATABASE_URL` (URL-encode `@`, `/`, `#`, `?` in the password).
- `self signed certificate` → hosted PG needs SSL; keep
  `?sslmode=require` on the URL (auto-enables `ssl: { rejectUnauthorized:
  false }`) or set `DB_SSL=true`.
- `ENOTFOUND / timeout` → wrong host/port, or the provider's IP allow-list
  is blocking you.
- `relation "x" does not exist` → schema not applied yet (`db:pg:schema`),
  or the app is pointed at the wrong database name in the URL path.
- `ON DUPLICATE KEY UPDATE for unknown table` → a new upsert was added for
  a table without a conflict target; add it to `conflictTarget()` in
  `pool.js` matching the UNIQUE constraint in `schema.sql`.
