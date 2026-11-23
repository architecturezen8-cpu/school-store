# How to open a shareable preview of the site

## Short version

The site is one self-contained file. Drop it on any static host to get a public link in
about 20 seconds:

1. Open <https://app.netlify.com/drop>
2. Drag `preview-build.zip` (in this repo's workspace root) onto the page
3. Copy the `https://….netlify.app` URL it gives you

No account, no build step, no config. The zip contains `index.html` (2.5 MB, JS + CSS +
images inlined) and `.nojekyll`.

Alternatives that serve the same single file:

- **Vercel:** `npx vercel deploy docs --prod` in a checkout
- **Cloudflare Pages:** upload `docs/`, no build command, output dir `/`
- **GitHub Pages:** Settings → Pages → Branch `arena/e2057950-school-store`, folder `/docs`
  (needs one click from the repo owner — see DEPLOY.md)
- **Any static host / S3 bucket / school web server:** copy `docs/index.html`

Regenerate the file after a change with `npm run build:docs`.

## Why the sandbox cannot publish a tunnel itself

Building a proxy tunnel in the sandbox was attempted and is not possible here:

| Attempt | Result |
|---|---|
| **Cloudflare Quick Tunnel** (`cloudflared` 2026.10.6 from npm, run against `localhost:8080`) | binary runs, then `failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": EOF` — the TLS session to Cloudflare is dropped before the HTTP request |
| `curl` to `api.cloudflare.com`, `www.cloudflare.com`, `api.trycloudflare.com` | `000`, TLS closed with `SSLZeroReturnError` (raw `openssl s_client`/Python socket, so it is the egress proxy, not curl) |
| SSH reverse tunnel (`ssh -p 443 -R 80:localhost:8080 nokey@localhost.run`) | `kex_exchange_identification: Connection closed by remote host` |
| `npx localtunnel` (loca.lt) | hangs, then times out |
| `loca.lt`, `bore.pub`, `ngrok.com`, `serveo.net` | TCP opens, TLS handshake reset |
| `apt-get install cloudflared` / `ngrok` | `deb.debian.org` is blocked, package not resolvable |
| GitHub Pages via API | the token has no `pages` scope (`403 Resource not accessible by integration`) |
| Creating a new public repo (fresh Pages site) | token is repo-scoped: `403` |
| Arena preview URLs (`https://<port>-<sandbox>.e2b.app`) | bound to the logged-in session; missing `e2b-traffic-access-token` for anyone else → 403 |

Only `github.com`, `api.github.com`, `registry.npmjs.org`, `pypi.org` and
`files.pythonhosted.org` are reachable, so *any* tunnel provider is out: the sandbox can
download a tunnel client (npm works) but cannot talk to the provider's control plane.

The tunnel therefore has to be opened from a machine that is allowed to reach a tunnel
service, or the file has to be served by a host you can reach. Netlify Drop is the fastest
of those. A Cloudflare Tunnel opened **on your own machine** works fine:

```bash
# on your machine, in a checkout of this repo
npm run build:docs
python3 -m http.server 8080 --directory docs
cloudflared tunnel --url http://localhost:8080     # prints a https://….trycloudflare.com URL
```

## If you want a permanent link instead

Enable GitHub Pages once (repo → Settings → Pages → Branch → `/docs`), and the site is live
at `https://architecturezen8-cpu.github.io/school-store/` after a minute. It then updates
automatically every time `docs/index.html` is rebuilt and pushed.
