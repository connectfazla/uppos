# Uppearance OS

**Uppearance OS** is a production-oriented web app for digital agencies: **CRM**, **retainer management**, **contract files**, **external invoice tracking** (Google Docs links only — no in-app invoice generation), **payments**, **team dashboard**, and a **client portal**. The open-source repo is published as **`uppos`** on GitHub.

- **Repository:** [github.com/connectfazla/uppos](https://github.com/connectfazla/uppos)
- **Product name:** Uppearance OS  
- **npm package name:** `uppos`

---

## Tech stack


| Layer           | Choice                                                                                                                                                    |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework       | [Next.js 14](https://nextjs.org/) (App Router)                                                                                                            |
| UI              | [shadcn/ui](https://ui.shadcn.com/) (New York style) — `components.json`, Radix primitives, `tailwindcss-animate`, CSS variables in `src/app/globals.css` |
| Styling         | [Tailwind CSS 3](https://tailwindcss.com/)                                                                                                                |
| Charts          | [Recharts](https://recharts.org/)                                                                                                                         |
| Data / cache    | [TanStack Query](https://tanstack.com/query)                                                                                                              |
| Optional state  | [Zustand](https://github.com/pmndrs/zustand) (installed; extend as needed)                                                                                |
| Database & auth | [PostgreSQL](https://www.postgresql.org/) + [Prisma](https://www.prisma.io/) + [NextAuth.js](https://next-auth.js/) (credentials)                         |
| Validation      | [Zod](https://zod.dev/)                                                                                                                                   |


---

## Prerequisites

- **Node.js** `>= 18.18.0` (recommended: **20+** for Prisma and simpler upgrades to Next.js 15+).
- **PostgreSQL** reachable from the app (`DATABASE_URL`).

---

## Environment variables

Copy `.env.example` to `.env.local` and set:


| Variable            | Purpose                                                                 |
| ------------------- | ----------------------------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string for Prisma                                 |
| `NEXTAUTH_SECRET`   | Secret for signing session tokens (long random string)                |
| `NEXTAUTH_URL`      | Public origin of the app (e.g. `http://localhost:3000` or production) |
| `CONTRACTS_DIR`     | Optional — directory for uploaded PDFs (default: `./data/contracts`)  |
| `SEED_ADMIN_PASSWORD` | Optional — password for `prisma db seed` default admin user          |


---

## Database setup (PostgreSQL + Prisma)

1. Create a database and set `DATABASE_URL` in `.env.local` (see `.env.example`).
2. Apply the schema:
   ```bash
   npx prisma migrate deploy
   ```
   (For a fresh dev database you can use `npx prisma db push` instead of migrate.)
3. Create an initial admin user:
   ```bash
   npm run db:seed
   ```
   Default sign-in: **`admin@example.com`** / **`changeme`** — change the password immediately (set `SEED_ADMIN_PASSWORD` before seeding in production).
4. **Portal users:** create a `User` with `role = CLIENT` and `clientId` set to the client’s UUID (via Prisma Studio, SQL, or your own admin tooling).

---

## Docker / VPS (os.uppcore.tech, port 5858)

Full steps: **[docs/DEPLOYMENT-DOCKER.md](docs/DEPLOYMENT-DOCKER.md)** — Docker Compose, Nginx + TLS, PostgreSQL, firewall, and updates.

Quick start on the server:

```bash
cp .env.production.example .env.production
# edit .env.production — DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL
# run migrations against that database (from CI or the host): npx prisma migrate deploy
docker compose up -d --build
# app: http://SERVER_IP:5858  →  put Nginx in front for https://os.uppcore.tech (see deploy/nginx-os.uppcore.tech.conf)
```

---

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Unauthenticated users should use `/login`.

- **Staff** (`admin` / `team`): redirected to `**/dashboard`** (sidebar: Dashboard, Clients, Retainers, Invoices, Contracts).
- **Clients** (`client` with `client_id`): redirected to `**/portal`**.

Other scripts:

```bash
npm run build   # production build
npm run start   # run production server
npm run lint    # ESLint
```

---

## shadcn/ui

This repo is configured for **shadcn/ui**:

- `**components.json`** — style `new-york`, RSC, Tailwind + CSS variables, aliases `@/components`, `@/lib/utils`, etc.
- **Primitives** live under `src/components/ui/` (Button, Card, Input, Label, Badge, Separator, Sheet, Table, Select, Tabs, Textarea, Sonner).

To add more components (when the registry is reachable):

```bash
npx shadcn@latest add dialog dropdown-menu
```

If the CLI times out, you can paste components from [ui.shadcn.com](https://ui.shadcn.com/) into `src/components/ui/` and match `components.json` aliases.

---

## API routes (summary)


| Method    | Path                     | Notes                                                  |
| --------- | ------------------------ | ------------------------------------------------------ |
| GET, POST | `/api/clients`           | Staff; list includes MRR-style monthly value + manager |
| GET, PATCH | `/api/clients/[id]`     | Staff (detail + optional `archived`, `notes`, manager) |
| GET       | `/api/staff`             | Staff directory (for assigning account managers)     |
| GET, POST | `/api/contacts`          | Staff                                                  |
| GET, POST | `/api/retainers`         | Staff; nested deliverables on create                   |
| PATCH     | `/api/retainers/[id]`    | Staff                                                  |
| GET, POST | `/api/invoices`          | GET: staff + client (scoped); syncs overdue/paid state |
| PATCH     | `/api/invoices/[id]`     | Staff                                                  |
| POST      | `/api/payments`          | Staff; updates invoice balance / status                |
| GET, POST | `/api/contracts`         | Staff; POST = multipart upload (stored on disk)        |
| GET       | `/api/contracts/[id]/file` | Authenticated file download (staff or owning client) |
| GET       | `/api/dashboard/metrics` | Staff dashboard aggregates                             |
| GET       | `/api/client/dashboard`  | Client portal payload (403 if not linked to a client)  |


**Invoices:** `invoice_link` must be an `http(s)` URL (e.g. Google Doc). No PDF/HTML invoice generation in-app.

---

## Product rules (important)

- **No internal invoice generation** — only metadata + link + status + payments.
- **MRR** = sum of **active** retainers’ `monthly_fee`.
- **Overdue** = derived from **due date** + **amount paid** vs **invoice amount** (partial payments supported).

---

## Troubleshooting auth (Docker / VPS)

- **`/api/auth/error?error=Configuration`**: Usually meant **no `NEXTAUTH_SECRET` in the Edge middleware bundle** when using `withAuth`. This repo uses **cookie-based middleware** instead, but you must still set **`NEXTAUTH_SECRET`** and **`NEXTAUTH_URL`** in `.env.production` so **Node** (login, `getServerSession`, JWT) can sign and verify sessions. Generate a secret with `openssl rand -base64 32`.
- **Browser console** (`Receiving end does not exist`, `content.js`): Almost always a **browser extension**, not the app—safe to ignore if the site loads.

---

## Deploying

Build output is standard Next.js. Deploy to [Vercel](https://vercel.com/), a Node host, or Docker; set the same env vars as `.env.example`. Ensure `NEXTAUTH_URL` matches your public origin.

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