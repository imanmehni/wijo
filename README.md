# API Watcher (DevOps Console)

A minimal, production-ready internal tool to parse Chrome "Copy as fetch" or "Copy as cURL" requests, schedule them via Vercel Cron, and view execution logs.

Built with **Next.js 16** (App Router) and **TypeScript**.

## 1. Local Development

```bash
npm install
npm run dev
```

Type-check without emitting files:

```bash
npm run typecheck
```

## 2. Supabase Setup

1. Create a new Supabase project.
2. Go to SQL Editor and run the script in `supabase/schema.sql`.

## 3. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-random-secret
```

> **IMPORTANT:** Only use `SUPABASE_SERVICE_ROLE_KEY`. It bypasses RLS, making it perfect for server-side Next.js execution. Never leak it to the client!

## 4. Dynamic Variables

You can use placeholders inside your cURL or fetch (in URL, headers, or body):

- `(date)` - Today's date (YYYY-MM-DD)
- `(date+1)` - Tomorrow's date
- `(date-1)` - Yesterday's date
- `(datetime)` - Current Date & Time (YYYY-MM-DDTHH:mm:ss)
- `(timestamp)` - Unix Timestamp
- `(year)` - e.g. 2026
- `(month)` - e.g. 09
- `(day)` - e.g. 14

These variables are evaluated based on the specific **Timezone** assigned to the job (e.g. `Asia/Tehran`).

## 5. Security

- **SSRF Protection:** Executions are checked to prevent requests to `localhost`, `127.0.0.1`, and private IP ranges.
- **Secret Masking:** In the UI, headers containing `auth`, `token`, `bearer`, or `cookie` are automatically masked to prevent shoulder-surfing leaks.

## 6. Vercel Deploy & Cron

1. Push to GitHub and import to Vercel.
2. Vercel will automatically detect `next build`.
3. Add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET` to Vercel Environment Variables.
4. Vercel will automatically configure the Cron from `vercel.json`.

## 7. Project Structure

```
app/
  page.tsx                       Dashboard — list/create projects
  project/[projectId]/page.tsx   Project detail — list/create jobs
  job/[jobId]/page.tsx           Job detail — run now, history, toggle/delete
  api/
    projects/route.ts            GET, POST projects
    jobs/route.ts                GET, POST jobs
    jobs/[id]/route.ts           GET, PATCH, DELETE a single job
    execute/[jobId]/route.ts     POST — manually trigger a job
    executions/route.ts          GET paginated execution logs
    cron/execute/route.ts        GET — cron entrypoint (all active jobs)
lib/
  supabase.ts                    Supabase client
  parsers.ts                     parseFetch / parseCurl
  variables.ts                   resolveVariables / maskSecrets
  runner.ts                      executeJob (retry + SSRF-safe)
types/
  index.ts                       Shared domain types
```
