# Nginx: `os.uppcore.tech` on a multi-site VPS

## Symptom: 502 and error log shows the **wrong** `server:`

If you see:

```text
... server: hr.uppcore.tech ... host: "os.uppcore.tech" ... upstream: "http://127.0.0.1:8000/"
```

then **HTTPS for `os.uppcore.tech` is not defined**. Nginx falls back to another vhost (often the `default_server` for `443`), here `hr.uppcore.tech`, which proxies to port **8000** → connection refused → **502**.

**Fix:** add a dedicated `server { listen 443 ssl; server_name os.uppcore.tech; ... }` block (with a certificate for `os.uppcore.tech`) and `proxy_pass http://127.0.0.1:5858;`.

---

## Symptom: `location directive is not allowed here ... line 1`

The file **must** start with a **`server {`** block. If line 1 is `location`, you pasted only the inner part or truncated the file.

**Fix:** replace the site file with the repo example (first line is `server {`):

```bash
cd ~/uppos && git pull
sudo install -m 644 deploy/nginx-os.uppcore.tech.conf /etc/nginx/sites-available/os.uppcore.tech
sudo ln -sf /etc/nginx/sites-available/os.uppcore.tech /etc/nginx/sites-enabled/os.uppcore.tech
sudo nginx -t && sudo systemctl reload nginx
```

Then run Certbot **for this hostname** so TLS exists on its own vhost:

```bash
sudo certbot --nginx -d os.uppcore.tech
```

Open the resulting file and confirm the **`listen 443 ssl`** server for **`server_name os.uppcore.tech`** contains:

```nginx
location / {
    proxy_pass http://127.0.0.1:5858;
    ...
}
```

---

## Quick checks

```bash
# App (Docker)
curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:5858/login

# Which server block answers HTTPS for this name?
curl -vkI --resolve os.uppcore.tech:443:127.0.0.1 https://os.uppcore.tech/ 2>&1 | grep -i subject

# Nginx syntax
sudo nginx -t
```

---

## Optional: avoid accidental default on 443

Do not mark `hr.uppcore.tech` as `default_server` on `listen 443 ssl` unless you intend it to catch unknown hostnames. Prefer an explicit **catch-all** that returns 444 or a static page, and keep each product on its own `server_name`.
