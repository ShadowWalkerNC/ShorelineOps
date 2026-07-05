# Shoreline — Deployment Guide

This project builds three distinct outputs from one codebase.
Set `VITE_MODE` before building to select the target.

---

## Build Modes

| Mode | Command | Output | Purpose |
|------|---------|--------|---------|
| `local` | `npm run build:local` | `dist/local/` | On-premises LAN app |
| `demo` | `npm run build:demo` | `dist/demo/` | Public demo website |
| `web` | `npm run build:web` | `dist/web/` | Marketing landing page |

---

## Local / LAN Deployment

The `local` build is a static PWA. Copy `dist/local/` to the facility server.

### Option A — nginx (recommended)

```nginx
server {
    listen 80;
    server_name 192.168.1.x;  # your server's LAN IP

    root /var/www/shoreline;
    index index.html;

    # SPA fallback — all routes serve index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets aggressively
    location ~* \.(js|css|png|ico|woff2|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Copy build to server
npm run build:local
scp -r dist/local/* user@192.168.1.x:/var/www/shoreline/
```

### Option B — serve (quick local test)

```bash
npm install -g serve
npm run build:local
serve dist/local -l 3000
```

---

## Demo Site

Deployed automatically by GitHub Actions on every push to `main`.
Requires `NETLIFY_AUTH_TOKEN` and `NETLIFY_DEMO_SITE_ID` secrets set in GitHub.

The demo build **does not contain** the Setup Wizard, encryption code,
or real resident data. Vite tree-shakes all `IS_LOCAL`-gated code out of
the bundle at build time.

---

## Development

```bash
# Full local mode (all features)
npm run dev

# Simulate demo mode locally
npm run dev:demo

# Simulate web/marketing mode locally
npm run dev:web
```

---

## First-Time Setup (LAN)

1. Deploy `dist/local/` to your facility server (see nginx config above)
2. Open the app in a browser on the local network
3. The Setup Wizard launches automatically on first visit
4. Complete all 7 steps: facility info → HIPAA officer → jurisdiction → admin account → BAA
5. Log in with the admin account you created

The setup wizard only appears once. `localStorage` key `sl_setup_complete` controls this.
To reset: open DevTools → Application → Local Storage → delete `sl_setup_complete`.
