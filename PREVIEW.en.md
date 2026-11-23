# Instant preview (no rebuild, no quota)

Open **`The-Thomian-Store-preview.html`** (repo root, 2.5 MB) by double-clicking it.
It is the same single file as `docs/index.html` and runs straight from disk — no server,
no upload, no build, no internet.

## Why it did not work before

The build embedded the app as `<script type="module">` in the `<head>`. Browsers refuse
module scripts under `file://` (module CORS rules), and a script in the head runs before
`#root` exists (React error #299) — so a double-clicked file showed a blank page.

Fixed in `vite.config.ts`: the HTML is now post-processed into one self-contained file
with the CSS as a `<style>` and the JS as a single classic `<script>` at the end of
`<body>`. Verified from `file://`: home / shop / product / tickets all render, quick
view → add to bag → cart badge works, no console errors, axe-clean.

## About the Netlify quota

Every push-triggered Netlify build costs a build minute, so iterating through Netlify is
the wrong loop. Use one of these instead:

| Need | Use |
|---|---|
| Look at the site right now | double-click the HTML file |
| Share a link with someone | Netlify Drop (a deploy, not a build) or GitHub Pages |
| Auto-updating public URL | GitHub Pages: Settings → Pages → branch + `/docs` |

Netlify Drop and GitHub Pages both serve `docs/index.html` as-is: no build command, so no
build minutes.
