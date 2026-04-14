# Deploy Uppearance OS on a Docker VPS (os.uppcore.tech, port 5858)

This guide covers:

1. Running the **Next.js** app in Docker, published on host port **5858**.
2. Putting it behind **Nginx** with TLS at **https://os.uppcore.tech**.
3. How **PostgreSQL** fits in: the app uses **Prisma** against a normal Postgres database and **NextAuth.js** for sign-in. Contract PDFs are stored on the **filesystem** (`CONTRACTS_DIR` / `./data/contracts`).

---

## How the database works

| Approach | Postgres location | Good for |
|----------|-------------------|----------|
| **Managed Postgres** (RDS, Neon, VPS `postgresql` package, etc.) | Wherever you host it | Production: set `DATABASE_URL` in `.env.production`. |
| **Optional `postgres` service** in `docker-compose.yml` | Docker on the same host (`--profile db`) | Local experiments or a single-node stack; set `DATABASE_URL` to reach that container from `web`. |

Before starting the app, run **Prisma migrations** against the same database (from CI or any machine with Node):

```bash
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy
npm run db:seed   # optional — set SEED_ADMIN_PASSWORD in production first
```

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
nano .env.production   # DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL; optional CONTRACTS_DIR
```

---

## 2. NextAuth URLs

Set `NEXTAUTH_URL` to your public origin (for example `https://os.uppcore.tech`). Generate a long random `NEXTAUTH_SECRET` and keep it stable across deploys so existing sessions remain valid.

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

This binds Postgres to **`127.0.0.1:5432`** on the host. Point `DATABASE_URL` at it from the `web` service if you want the app and DB in one Compose stack (for example `postgresql://uppos:PASSWORD@postgres:5432/uppos` on the internal Docker network).

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
| Auth / session errors | `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, and cookies reaching the browser over HTTPS. |
| Contract upload fails | Disk space, `CONTRACTS_DIR` permissions, and writable volume if you mount one. |
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
- **PostgreSQL** holds all product data; apply **`prisma/migrations`** with `npx prisma migrate deploy` before or after each deploy.
- The optional **`postgres` + `--profile db`** service is a convenient Postgres container; wire `DATABASE_URL` to it or to any external Postgres instance.
