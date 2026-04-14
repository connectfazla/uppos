# Deploy Uppearance OS on a Docker VPS (os.uppcore.tech, port 5858)

This guide covers:

1. Running the **Next.js** app in Docker, published on host port **5858**.
2. Putting it behind **Nginx** with TLS at **https://os.uppcore.tech**.
3. Where **PostgreSQL** fits in: the app talks to **Supabase** (Postgres + Auth + Storage APIs), not raw `pg` from Node. Your “Postgres in Docker” options are spelled out below.

---

## How the database works

Uppearance OS uses **`@supabase/supabase-js`** and **`@supabase/ssr`** for:

- Authentication (GoTrue)
- Row Level Security on Postgres (via PostgREST)
- Storage (contract PDFs)

So you need a **Supabase API endpoint**, not only a Postgres container. You can:

| Approach | Postgres location | Good for |
|----------|-------------------|----------|
| **A. Supabase Cloud** | Hosted by Supabase | Fastest: create a project, run SQL migrations in the dashboard, point env vars at the project URL. |
| **B. Self-hosted Supabase (Docker)** | Postgres **in Docker** on your VPS (or another server) as part of the official stack | Full control, DB stays on your machines. |
| **C. Optional `postgres` service** in this repo’s `docker-compose.yml` | Standalone Postgres with profile `db` | Backups, tooling, or experiments; **not** wired to the Next app until you add your own integration. |

For production at **os.uppcore.tech**, **A** or **B** is what you want for the live app.

---

## Prerequisites

- VPS with Docker Engine + Docker Compose v2.
- DNS **A record** for `os.uppcore.tech` → your server’s public IP.
- Ports **80** and **443** open for Nginx (Certbot).
- (Recommended) **Node 20+** if you build the image elsewhere; the included **Dockerfile** uses `node:20-alpine`.

---

## 1. Clone and configure env

```bash
git clone https://github.com/connectfazla/uppos.git
cd uppos
cp .env.production.example .env.production
nano .env.production   # fill NEXT_PUBLIC_SUPABASE_* (and optional NEXT_PUBLIC_SITE_URL)
```

### If you use Supabase Cloud

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → run `supabase/migrations/001_uppearance_os.sql` then `002_profiles_staff_update.sql`.
3. **Storage** → confirm bucket **`contracts`** exists (migration inserts it).
4. **Project Settings → API** → copy **URL** and **anon public** key into `.env.production`.

### If you use self-hosted Supabase (Postgres in Docker)

1. Follow the official guide: [Self-hosting with Docker](https://supabase.com/docs/guides/self-hosting/docker).
2. After the stack is healthy, run the same SQL migration files against the **Postgres** instance that stack uses (often via Studio SQL or `psql`).
3. Set `NEXT_PUBLIC_SUPABASE_URL` to your **Kong / API URL** (as documented by that compose stack, often `https://api.yourdomain.com` or internal URL + reverse proxy).
4. Set `NEXT_PUBLIC_SUPABASE_ANON_KEY` from that stack’s generated anon key.

---

## 2. Supabase Auth redirect URL

In Supabase (**Authentication → URL configuration**), add:

- **Site URL:** `https://os.uppcore.tech`
- **Redirect URLs:** `https://os.uppcore.tech/**` (and `http://localhost:3000/**` for local dev if needed)

---

## 3. Build and run the app (port 5858)

The `Dockerfile` uses **`npm install`** (not `npm ci`) in the dependency stage so builds stay reliable across npm versions in `node:*-alpine` images; the committed **`package-lock.json`** still pins versions.

From the repo root (where `docker-compose.yml` lives):

```bash
docker compose build --no-cache
docker compose up -d
```

- The app is available at **`http://YOUR_SERVER_IP:5858`** (and on localhost on the VPS).

Check logs:

```bash
docker compose logs -f web
```

### Optional: standalone Postgres container (profile `db`)

Only if you want the **extra** Postgres service from this compose file (see `docker-compose.yml`):

```bash
# Set a strong password in .env.production, then:
docker compose --profile db up -d
```

`POSTGRES_PASSWORD` defaults to a placeholder so **`docker compose up`** (web only) never fails; override it before enabling the `db` profile in production.

This binds Postgres to **`127.0.0.1:5432`** on the host. It does **not** replace Supabase for the app unless you integrate it yourself.

---

## 4. Nginx reverse proxy + TLS (os.uppcore.tech)

**Multi-site VPS:** if `os.uppcore.tech` returns **502** but `curl http://127.0.0.1:5858/login` is **200**, check `/var/log/nginx/error.log`: if `server:` is **not** `os.uppcore.tech` (e.g. `hr.uppcore.tech`) while `host:` is `os.uppcore.tech`, you are missing a **`listen 443 ssl` + `server_name os.uppcore.tech`** block. See **[NGINX-OS-UPPCORE.md](./NGINX-OS-UPPCORE.md)**.

1. Install Nginx and Certbot on the VPS (Debian/Ubuntu example):

   ```bash
   sudo apt update
   sudo apt install -y nginx certbot python3-certbot-nginx
   ```

2. Copy the example site (adjust paths if your distro uses `conf.d`):

   ```bash
   sudo cp deploy/nginx-os.uppcore.tech.conf /etc/nginx/sites-available/os.uppcore.tech
   sudo ln -sf /etc/nginx/sites-available/os.uppcore.tech /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   ```

3. Obtain a certificate:

   ```bash
   sudo certbot --nginx -d os.uppcore.tech
   ```

Certbot will add `listen 443 ssl` and certificate paths. After that, users hit **https://os.uppcore.tech** and Nginx proxies to **`127.0.0.1:5858`**.

**Important after Certbot:** open `/etc/nginx/sites-enabled/os.uppcore.tech` (or the file Certbot edited) and confirm the **`server { listen 443 ssl ... }`** block contains **`location /`** with **`proxy_pass http://127.0.0.1:5858;`**. Certbot sometimes duplicates the server block but leaves the HTTPS `location /` empty or pointing elsewhere — that causes **502**.

---

## 5. Firewall

Allow SSH, HTTP, HTTPS; only expose 5858 locally if you want belt-and-suspenders:

```bash
# UFW example
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
# 5858 does not need to be public if only Nginx on localhost talks to Docker
sudo ufw enable
```

---

## 6. Updates after code changes

```bash
cd uppos
git pull
docker compose build --no-cache
docker compose up -d
```

---

## 7. Troubleshooting

| Issue | What to check |
|--------|----------------|
| **502 Bad Gateway** | See **502 checklist** below. |
| Auth / session errors | Supabase URL and anon key; redirect URLs include `https://os.uppcore.tech`. |
| Storage upload fails | RLS policies; bucket `contracts`; service role only if your API uses it. |
| Build fails on VPS | Prefer building on CI or a dev machine with Node 20, then `docker save` / registry push — or ensure enough RAM for `npm install` + `next build`. |

### 502 Bad Gateway (Nginx → Docker)

Run on the VPS:

```bash
# 1) Is the app up and bound to 5858?
cd ~/uppos && docker compose ps
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:5858/login

# 2) Nginx upstream + errors (look for connect() failed, Connection refused, upstream prematurely closed)
sudo grep -n proxy_pass /etc/nginx/sites-enabled/*
sudo tail -40 /var/log/nginx/error.log
```

**Fixes that usually resolve 502:**

1. **Upstream not running** — `docker compose up -d` in `~/uppos`, then `docker compose logs web --tail=80`.
2. **Wrong host in `proxy_pass`** — use **`http://127.0.0.1:5858`**, not `http://localhost:5858` (IPv6 `::1` vs Docker on IPv4).
3. **HTTPS block missing `proxy_pass`** — after Certbot, the `listen 443 ssl` server must still proxy to `127.0.0.1:5858` (edit the site file, then `sudo nginx -t && sudo systemctl reload nginx`).
4. **Unconditional WebSocket headers** — avoid `proxy_set_header Connection "upgrade";` for every request; use the repo’s updated `deploy/nginx-os.uppcore.tech.conf` (no forced upgrade) or pull latest and re-copy the site file.

---

## Summary

- **Docker Compose** publishes the app on **host port 5858** → container **3000**.
- **https://os.uppcore.tech** → Nginx → **127.0.0.1:5858**.
- **PostgreSQL for the product data** lives behind **Supabase** (cloud or self-hosted Docker). Run the SQL migrations there.
- The optional **`postgres` + `--profile db`** service is extra Dockerized Postgres for your own ops; it is not a drop-in replacement for Supabase without further work.
