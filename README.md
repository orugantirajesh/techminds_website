# TechMinds website

Static website for TechMinds (software design, development and cloud services): four HTML pages,
one stylesheet, a little JavaScript (including a 3D hero on the home page) and two images. No
build step.

```
site/
  index.html  services.html  about.html  contact.html
  css/style.css
  js/main.js  js/hero-3d.js
  assets/logo.png  assets/ceo-photo.jpg
docker-compose.yml   nginx container + Traefik routing on the VPS
```

## Live

Served from the Hostinger VPS by an `nginx:alpine` container behind Traefik, which handles
HTTPS (Let's Encrypt) for the domains in `docker-compose.yml`:

- https://techmindsconsulting.com.au (and `www.`): DNS at Hostinger, A record → VPS 72.60.192.209
- https://rajeshoruganti.tech (and `www.`)

## Preview locally

```bash
cd site && python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy

The server copy lives in `/docker/techminds` on the VPS (`ssh hostinger-vps`). Nginx serves
`site/` read-only, so copying the files is enough; no restart needed:

```bash
rsync -av --delete site/ hostinger-vps:/docker/techminds/site/
```

Change `docker-compose.yml` (e.g. to add a domain) only together with a restart on the server:
`cd /docker/techminds && docker compose up -d`.
