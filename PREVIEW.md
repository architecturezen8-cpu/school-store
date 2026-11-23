# පෙරදසුනක් බැලීම (කිසිම rebuild එකක් නැතුව)

## ළඟම ක්‍රමය: ෆයිල් එක open කරන්න

**`The-Thomian-Store-preview.html`** — repo root එකේ තියෙන තනි ෆයිල් එක (2.5 MB).

1. GitHub එකෙන් ඒ ෆයිල් එක download කරන්න
   (`docs/index.html` එකත් එකම ෆයිල් එකයි)
2. දෙගිට ගහන්න (double-click) — browser එකේ open වෙනවා

Rebuild එකක් නෑ, upload එකක් නෑ, internet connection එකක් පවා අවශ්‍ය නෑ (fonts සහ
stock photos ටික internet එකෙන් load වෙනවා, ඉතුරු ඔක්කොම ෆයිල් එක ඇතුළේ).

මේක වැඩ කරන්නේ build එකේ JS එක `type="module"` නොව **classic `<script>`** එකක්
විදිහට embed වෙන නිසා. `file://` එකේ module scripts block වෙනවා — දැන් ඒ ප්‍රශ්නය නෑ.

## Netlify quota එක ගැන

Netlify වල **rebuild එකක් = build minute එකක්** (100–300 නොමිලේ). වෙනසක් කරන
හැම වතාවකම Netlify එකට push කරලා rebuild කරන එක ඒ නිසාම නරක අදහසක්. ඒ වෙනුවට:

- **Netlify deploy එකක් = `docs/index.html` එක replace කිරීමක්.** Build command
  එකක් නැතුව, `docs/` ෆෝල්ඩරය serve කරන්න විතරයි. එතකොට අලුත් ෆයිල් එකක්
  upload කරන එකට build minute එකක් ගාණට එන්නේ නෑ.
- **GitHub Pages** (Settings → Pages → Branch + `/docs`) — නොමිලේ, unlimited, build
  minutes කියන සීමාවක් නෑ. හැම push එකකටම auto-deploy.
- ඉක්මන් බැලීම් වලට — උඩ කිව්ව ෆයිල් එක double-click කරන්න.

## මම වෙනස් කරපු දේ (මේ වතාවේ)

- Build එකේ output එක දැන් **classic script** එකක් (module නොව) — `file://` එකෙන්
  කෙලින්ම වැඩ කරන්න.
- `dist/index.html` එකේ JS එක `<head>` එකේ තිබුණා (React error #299 → site එක
  හිස්). දැන් bundle එක `<body>` එකේ අන්තිමට තියෙනවා.
- `vite-plugin-singlefile` වෙනුවට කුඩා custom plugin එකක් — CSS `<style>` එකක්, JS
  classic `<script>` එකක්, images inline. ප්‍රතිඵලය එකම තනි HTML ෆයිල් එක.
- පරීක්ෂා කළා: `file://` එකෙන් home / shop / product / tickets හරි, Quick view →
  Add to bag → cart badge ද හරි, console errors නෑ, axe a11y clean (4 route).
