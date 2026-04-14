# Uppearance OS

**Uppearance OS** is a production-oriented web app for digital agencies: **CRM**, **retainer management**, **contract files**, **external invoice tracking** (Google Docs links only — no in-app invoice generation), **payments**, **team dashboard**, and a **client portal**. The open-source repo is published as **`uppos`** on GitHub.

- **Repository:** [github.com/connectfazla/uppos](https://github.com/connectfazla/uppos)
- **Product name:** Uppearance OS  
- **npm package name:** `uppos`

---

## Tech stack

| Layer | Choice |
|--------|--------|
| Framework | [Next.js 14](https://nextjs.org/) (App Router) |
| UI | [shadcn/ui](https://ui.shadcn.com/) (New York style) — `components.json`, Radix primitives, `tailwindcss-animate`, CSS variables in `src/app/globals.css` |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) |
| Charts | [Recharts](https://recharts.org/) |
| Data / cache | [TanStack Query](https://tanstack.com/query) |
| Optional state | [Zustand](https://github.com/pmndrs/zustand) (installed; extend as needed) |
| Database & auth | [Supabase](https://supabase.com/) — PostgreSQL, Auth, Storage |
| Validation | [Zod](https://zod.dev/) |

---

## Prerequisites

- **Node.js** `>= 18.18.0` (recommended: **20+** for Supabase client support and simpler upgrades to Next.js 15+).
- A **Supabase** project (URL + anon key; service role only if you add server-only admin scripts).

---

## Environment variables

Copy `.env.example` to `.env.local` and set:

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional — only for trusted server scripts (not required for the shipped API routes) |

---

## Database setup (Supabase)

1. In the Supabase SQL editor, run migrations **in order**:
   - `supabase/migrations/001_uppearance_os.sql` — core schema, RLS, auth → `profiles` trigger, `contracts` storage policies.
   - `supabase/migrations/002_profiles_staff_update.sql` — allows **admin/team** to update `profiles` (e.g. link a user to a `client_id` for the portal).

2. Confirm the **`contracts`** storage bucket exists (the migration inserts it; verify under Storage).

3. **Roles** (`profiles.role`): `admin`, `team`, `client`. New sign-ups default to `team` via the trigger. Promote users as needed, for example:

   ```sql
   update public.profiles set role = 'admin' where id = '<auth user uuid>';
   ```

4. **Portal users:** set the client organization and role:

   ```sql
   update public.profiles
   set role = 'client', client_id = '<clients.id uuid>'
   where id = '<auth user uuid>';
   ```

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users should use `/login`.

- **Staff** (`admin` / `team`): redirected to **`/dashboard`** (sidebar: Dashboard, Clients, Retainers, Invoices, Contracts).
- **Clients** (`client` with `client_id`): redirected to **`/portal`**.

Other scripts:

```bash
npm run build   # production build
npm run start   # run production server
npm run lint    # ESLint
```

---

## shadcn/ui

This repo is configured for **shadcn/ui**:

- **`components.json`** — style `new-york`, RSC, Tailwind + CSS variables, aliases `@/components`, `@/lib/utils`, etc.
- **Primitives** live under `src/components/ui/` (Button, Card, Input, Label, Badge, Separator, Sheet, Table, Select, Tabs, Textarea, Sonner).

To add more components (when the registry is reachable):

```bash
npx shadcn@latest add dialog dropdown-menu
```

If the CLI times out, you can paste components from [ui.shadcn.com](https://ui.shadcn.com/) into `src/components/ui/` and match `components.json` aliases.

---

## API routes (summary)

| Method | Path | Notes |
|--------|------|--------|
| GET, POST | `/api/clients` | Staff |
| PATCH | `/api/clients/[id]` | Staff (optional `archived`) |
| GET, POST | `/api/contacts` | Staff |
| GET, POST | `/api/retainers` | Staff; nested deliverables on create |
| PATCH | `/api/retainers/[id]` | Staff |
| GET, POST | `/api/invoices` | GET: staff + client (scoped); syncs overdue/paid state |
| PATCH | `/api/invoices/[id]` | Staff |
| POST | `/api/payments` | Staff; updates invoice balance / status |
| GET, POST | `/api/contracts` | Staff; POST = multipart PDF upload |
| GET | `/api/dashboard/metrics` | Staff dashboard aggregates |
| GET | `/api/client/dashboard` | Client portal payload (403 if not linked to a client) |

**Invoices:** `invoice_link` must be an `http(s)` URL (e.g. Google Doc). No PDF/HTML invoice generation in-app.

---

## Product rules (important)

- **No internal invoice generation** — only metadata + link + status + payments.
- **MRR** = sum of **active** retainers’ `monthly_fee`.
- **Overdue** = derived from **due date** + **amount paid** vs **invoice amount** (partial payments supported).

---

## Deploying

Build output is standard Next.js. Deploy to [Vercel](https://vercel.com/), a Node host, or Docker; set the same env vars as `.env.example`. Ensure Supabase **Auth redirect URLs** include your production origin.

---

## Git remote & push

Upstream default:

```bash
git remote add origin https://github.com/connectfazla/uppos.git
git branch -M main
git push -u origin main
```

If `origin` already exists, set URL:

```bash
git remote set-url origin https://github.com/connectfazla/uppos.git
```

Use a [personal access token](https://github.com/settings/tokens) or SSH for authentication when pushing.

---

## License

Private / team use unless you add a license file. Adjust as needed for your organization.
