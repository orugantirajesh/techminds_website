# TechMinds website

Website for TechMinds Consulting, which offers AI automation services. It's plain HTML, CSS and a
little JavaScript, with no build step, plus a small contact-form mail service.

```
site/                   the website (served as-is by nginx)
  index.html  use-cases.html  services.html  about.html  contact.html
  css/style.css  js/main.js  assets/
contact-api/            contact form -> email (Python standard library only)
  app.py  test_app.py  Dockerfile
docker-compose.yml      nginx + contact service, routed by Traefik on the VPS
```

## Live

Hostinger VPS, behind Traefik (HTTPS via Let's Encrypt):

- https://techmindsconsulting.com.au (and `www.`): DNS at Hostinger, A record → 72.60.192.209
- https://rajeshoruganti.tech (and `www.`)

`/api/` on those domains goes to the contact service; everything else goes to nginx.

## Contact form

The form posts JSON to `/api/contact`. The service checks the input, drops spam (a hidden
honeypot field and too-fast submissions) and limits sending to 5 an hour per visitor and 50 a
day. It then emails techmindsconsulting@gmail.com through Gmail, with Reply-To set to the visitor.

Its Gmail credentials live only on the server in `/docker/techminds/contact.env`, which is
mode 600, owned by uid 65534 and not in git:

```
SMTP_USER=techmindsconsulting@gmail.com
SMTP_APP_PASSWORD=<16-character Gmail app password>
```

To change the password: edit that file, then run `docker compose restart contact`. To revoke it,
go to https://myaccount.google.com/apppasswords.

Tests: `cd contact-api && python3 -m unittest -v test_app`

## Preview locally

```bash
cd site && python3 -m http.server 8000   # open http://localhost:8000
```

The form needs the contact service, so locally it shows "couldn't reach our server".

## Deploy

The server copy is in `/docker/techminds` (`ssh hostinger-vps`). Website files are updated in
place, because nginx serves the folder directly, so no restart is needed:

```bash
tar -czf - -C site . | ssh hostinger-vps 'T=$(mktemp -d); tar -xzf - -C "$T"; \
  rsync -a --delete --no-owner --no-group --chmod=D755,F644 "$T"/ /docker/techminds/site/; rm -rf -- "$T"'
```

If you change `css/style.css` or `js/main.js`, bump the `?v=` number in the pages' links so
browsers fetch the new file. Backups of earlier versions are in `/docker/techminds/backups/`.

Changes to `contact-api/` or `docker-compose.yml`: copy them to the server, then run
`docker compose up -d --build contact`.
